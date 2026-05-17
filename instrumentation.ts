/**
 * instrumentation.ts
 *
 * Next.js automatically calls register() on cold-start for server +
 * edge. We delegate to the existing sentry.{server,edge}.config.ts files
 * so the DSN is initialised before any handler runs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string };
  },
  context: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "middleware";
  },
) {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureRequestError(err, request, context);
    } catch {
      // Sentry not configured — ignore
    }
  }
}
