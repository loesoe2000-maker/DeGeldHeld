import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // 10% of all sessions, 100% of sessions with an error.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        // Privacy: never record what the user typed or the bill images
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, string>;
        delete h.cookie;
        delete h.authorization;
      }
      return event;
    },
  });
}
