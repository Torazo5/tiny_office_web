export function getSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const rawUrl = configuredUrl || (process.env.NODE_ENV === "production" ? null : "http://localhost:3000");

  if (!rawUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be set in production.");
  }

  const siteUrl = new URL(rawUrl);
  if (process.env.VERCEL_ENV === "production" && siteUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in Vercel production.");
  }

  return siteUrl;
}
