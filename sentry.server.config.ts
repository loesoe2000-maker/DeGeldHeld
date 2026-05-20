import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

// Tag every event with the deploy environment + the exact commit it ran
// on. Vercel injects VERCEL_ENV / VERCEL_GIT_COMMIT_SHA at build time.
const environment =
  process.env.VERCEL_ENV ??
  process.env.SENTRY_ENVIRONMENT ??
  process.env.NODE_ENV;
const release =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.SENTRY_RELEASE ??
  undefined;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment,
    release,
    beforeSend(event) {
      // strip cookies + auth headers (commonly contain session tokens)
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
