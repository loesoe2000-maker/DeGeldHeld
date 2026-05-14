"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function LoginForm() {
  const params = useSearchParams();
  const checkEmail = params?.get("check") === "email";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("email", { email, callbackUrl: "/dashboard" });
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold mb-4">Inloggen</h1>
        {checkEmail ? (
          <p className="text-green-600">Check je email voor de login link.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jouw@email.nl"
              className="w-full p-3 border rounded"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white p-3 rounded font-semibold"
            >
              {loading ? "Versturen..." : "Stuur magic link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8">Laden...</div>}>
      <LoginForm />
    </Suspense>
  );
}
