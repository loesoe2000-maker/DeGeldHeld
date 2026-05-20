import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

// Tag every event with the deploy environment + the exact commit it ran
// on, so a production crash is never mistaken for a preview/local one and
// can be traced back to a release. Vercel injects these at build time.
const environment =
  process.env.NEXT_PUBLIC_VERCEL_ENV ??
  process.env.SENTRY_ENVIRONMENT ??
  process.env.NODE_ENV;
const release =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
  undefined;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment,
    release,
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
