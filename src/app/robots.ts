import type { MetadataRoute } from "next";

/** Keep private areas out of search engines (they are also protected server-side). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/", "/payment/", "/request/"] }],
  };
}
