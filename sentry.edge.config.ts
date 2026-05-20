import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

// Tag every event with the deploy environment + the exact commit it ran on.
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
  });
}
