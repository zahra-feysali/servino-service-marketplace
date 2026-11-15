import type { TxClient } from "@/lib/prisma";
import { notify } from "@/features/notifications/service";
import { selectEligibleProviders, type MatchCandidate } from "./rules";

/**
 * Finds eligible providers for a freshly created request and records the matches.
 * Runs inside the request-creation transaction.
 *
 * Quota consumption is race-safe: the subscription counter is incremented with a single
 * conditional UPDATE that re-checks status, expiry and the plan quota in the database.
 * If it affects 0 rows (quota used up concurrently), that subscription is skipped.
 */
export async function matchProvidersForRequest(
  tx: TxClient,
  request: { id: string; code: number; serviceId: string; cityId: string; serviceName: string },
  now: Date = new Date(),
): Promise<number> {
  const profiles = await tx.providerProfile.findMany({
    where: {
      verificationStatus: "APPROVED",
      user: { status: "ACTIVE" },
      services: { some: { serviceId: request.serviceId } },
      areas: { some: { cityId: request.cityId } },
    },
    select: {
      id: true,
      userId: true,
      verificationStatus: true,
      user: {
        select: {
          status: true,
          subscriptions: {
            where: { status: "ACTIVE", endsAt: { gt: now } },
            select: {
              id: true,
              status: true,
              startsAt: true,
              endsAt: true,
              requestsReceived: true,
              offersSubmitted: true,
              planSnapshot: true,
            },
          },
        },
      },
      services: { where: { serviceId: request.serviceId }, select: { serviceId: true } },
      areas: { where: { cityId: request.cityId }, select: { cityId: true } },
    },
  });

  const candidates: MatchCandidate[] = profiles.map((p) => ({
    providerId: p.id,
    userId: p.userId,
    userStatus: p.user.status,
    verificationStatus: p.verificationStatus,
    serviceIds: p.services.map((s) => s.serviceId),
    cityIds: p.areas.map((a) => a.cityId),
    subscriptions: p.user.subscriptions,
  }));

  const eligible = selectEligibleProviders(candidates, request, now);
  let matched = 0;

  for (const e of eligible) {
    const candidate = candidates.find((c) => c.providerId === e.providerId)!;
    // Try the preferred subscription first, then any other active one of the provider.
    const order = [e.subscriptionId, ...candidate.subscriptions.map((s) => s.id).filter((id) => id !== e.subscriptionId)];
    let usedSubscription: string | null = null;
    for (const subscriptionId of order) {
      if (await consumeRequestQuota(tx, subscriptionId)) {
        usedSubscription = subscriptionId;
        break;
      }
    }
    if (!usedSubscription) continue;

    await tx.requestMatch.create({
      data: { requestId: request.id, providerId: e.providerId, subscriptionId: usedSubscription },
    });
    await notify(tx, [
      {
        userId: e.userId,
        type: "NEW_REQUEST",
        title: `درخواست جدید: ${request.serviceName}`,
        body: `درخواست شماره ${request.code} در محدوده خدمات شما ثبت شد. پیشنهاد خود را ارسال کنید.`,
        link: `/dashboard/provider/requests/${request.id}`,
      },
    ]);
    matched++;
  }

  return matched;
}

/**
 * Atomically consumes one request from a subscription's quota. Returns false if not allowed.
 * A missing/malformed quota key fails closed (NULL comparisons are false).
 */
export async function consumeRequestQuota(tx: TxClient, subscriptionId: string): Promise<boolean> {
  const affected = await tx.$executeRaw`
    UPDATE "Subscription"
       SET "requestsReceived" = "requestsReceived" + 1, "updatedAt" = NOW()
     WHERE "id" = ${subscriptionId}::uuid
       AND "status" = 'ACTIVE'
       AND "endsAt" > NOW()
       AND ("startsAt" IS NULL OR "startsAt" <= NOW())
       AND (
         jsonb_typeof("planSnapshot" -> 'maxRequestsPerPeriod') = 'null' -- unlimited plan
         OR "requestsReceived" < ("planSnapshot" ->> 'maxRequestsPerPeriod')::int
       )`;
  return affected === 1;
}

/** Atomically consumes one offer from any usable subscription of the user. Returns the subscription id or null. */
export async function consumeOfferQuota(tx: TxClient, userId: string): Promise<string | null> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    UPDATE "Subscription"
       SET "offersSubmitted" = "offersSubmitted" + 1, "updatedAt" = NOW()
     WHERE "id" = (
       SELECT "id" FROM "Subscription"
        WHERE "userId" = ${userId}::uuid
          AND "status" = 'ACTIVE'
          AND "endsAt" > NOW()
          AND ("startsAt" IS NULL OR "startsAt" <= NOW())
          AND (
            jsonb_typeof("planSnapshot" -> 'maxOffersPerPeriod') = 'null' -- unlimited plan
            OR "offersSubmitted" < ("planSnapshot" ->> 'maxOffersPerPeriod')::int
          )
        ORDER BY "endsAt" ASC
        LIMIT 1
        FOR UPDATE
     )
     RETURNING "id"`;
  return rows[0]?.id ?? null;
}
