/** Railway / Partner env often stores a hostname with no scheme. */
export function withShopifyAppUrl(raw: string | undefined): string {
  const value = String(raw ?? "").trim().replace(/\/+$/, "");
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}
