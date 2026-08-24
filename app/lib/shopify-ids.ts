export function toDraftOrderGid(id: string | number): string {
  const value = String(id).trim();
  if (value.startsWith("gid://")) return value;
  return `gid://shopify/DraftOrder/${value}`;
}

export function toDraftOrderNumericId(id: string | number): string {
  const value = String(id).trim();
  return value.replace(/^gid:\/\/shopify\/DraftOrder\//, "");
}
