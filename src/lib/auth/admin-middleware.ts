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
  .server(async ({ next }) => {
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { isAdminSession, adminContext } = await import("./admin-session.server");
    const { UnauthorizedError } = await import("./verify.server");
    assertSameSiteRequest();
    if (!isAdminSession()) throw new UnauthorizedError();
    return next({ context: adminContext() });
  });
