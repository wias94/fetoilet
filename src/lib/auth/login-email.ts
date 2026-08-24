export const ADMIN_LOGIN = "admin";
export const ADMIN_EMAIL = "admin@xiangce.local";

export function resolveLoginEmail(raw: string) {
  const value = raw.trim().toLowerCase();
  if (value === ADMIN_LOGIN) return ADMIN_EMAIL;
  return value;
}
