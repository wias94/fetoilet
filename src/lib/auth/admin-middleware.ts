import { createMiddleware } from "@tanstack/react-start";

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

export const adminMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { getSessionUser, UnauthorizedError } = await import("./verify.server");
    const { getSql } = await import("@/lib/db");
    assertSameSiteRequest();
    const user = await getSessionUser(context.bearerToken);
    if (!user?.id) throw new UnauthorizedError();
    const email = (user.email ?? "").trim().toLowerCase();
    if (!email) throw new ForbiddenError();
    const sql = await getSql();
    const rows = await sql<{ email: string }>`
      select email from admins where lower(email) = ${email} limit 1
    `;
    if (!rows[0]) throw new ForbiddenError();
    return next({ context: { userId: user.id, email } });
  });
