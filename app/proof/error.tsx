"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function ProofError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundary {...props} area="proof" />;
}
