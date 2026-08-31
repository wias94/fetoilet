/** Railway healthcheck — no DB, no session. */
export default function health(event: { url: URL }, next: () => unknown) {
  if (event.url.pathname === "/healthz") {
    return new Response("ok", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return next();
}
