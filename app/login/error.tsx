"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function LoginError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundary {...props} area="login" />;
}
