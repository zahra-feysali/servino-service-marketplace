"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Format = "count" | "price";

const nf = new Intl.NumberFormat("fa-IR");
const compact = new Intl.NumberFormat("fa-IR", { notation: "compact", maximumFractionDigits: 1 });
const fmt = (v: number, f: Format) => (f === "price" ? `${nf.format(v)} تومان` : nf.format(v));

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/** Simple responsive bar chart (Recharts). Labels are pre-formatted on the server. */
export function SimpleBarChart({ data, format = "count", height = 240 }: { data: { label: string; value: number }[]; format?: Format; height?: number }) {
  return (
    <div style={{ height }} dir="ltr" className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} width={48} tickFormatter={(v: number) => compact.format(v)} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            formatter={(v) => [fmt(Number(v), format), format === "price" ? "مبلغ" : "تعداد"]}
            contentStyle={{ direction: "rtl", fontFamily: "inherit", borderRadius: 8, borderColor: "var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" }}
          />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimplePieChart({ data, height = 240 }: { data: { label: string; value: number }[]; height?: number }) {
  if (data.every((d) => d.value === 0)) return <p className="py-10 text-center text-sm text-muted-foreground">داده‌ای وجود ندارد.</p>;
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div style={{ height, width: height }} className="shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="90%" paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, name) => [nf.format(Number(v)), String(name)]}
              contentStyle={{ direction: "rtl", fontFamily: "inherit", borderRadius: 8, borderColor: "var(--border)", background: "var(--popover)" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="size-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} aria-hidden />
            <span>{d.label}</span>
            <span className="text-muted-foreground">({nf.format(d.value)})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
