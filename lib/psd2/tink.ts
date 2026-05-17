/**
 * lib/psd2/tink.ts — thin HTTP client voor Tink Open Banking.
 *
 * Tink heeft geen officiële Node SDK (mei 2026). Wij praten direct met
 * https://api.tink.com via fetch. Alle responses worden als JSON
 * geparsed; bij non-2xx gooien we een error met body voor debug.
 *
 * Auth flow (Tink Link / Connect):
 *   1. getAuthUrl(userId, redirectUri) → redirect user naar Tink
 *   2. Tink redirect terug met ?code=... → exchangeCode(code) geeft access_token
 *   3. Encrypt + opslaan in BankConnection
 *   4. listAccounts / listTransactions met user-token
 */

export type TinkConfig = {
  clientId: string;
  clientSecret: string;
  apiBase: string;
};

export type TinkAccount = {
  id: string;
  name: string;
  type: string;
};

export type TinkTransaction = {
  id: string;
  accountId: string;
  amount: { value: number; currencyCode: string }; // value in major units (e.g. -29.95)
  bookedDateTime: string;
  descriptions: { display: string; original: string };
  counterParties?: { payee?: { name?: string }; payer?: { name?: string } };
};

export type TinkTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  scope: string;
  token_type: string;
};

function getConfig(): TinkConfig {
  return {
    clientId: process.env.TINK_CLIENT_ID ?? "",
    clientSecret: process.env.TINK_CLIENT_SECRET ?? "",
    apiBase: process.env.TINK_API_BASE ?? "https://api.tink.com",
  };
}

export function isPsd2Enabled(): boolean {
  return process.env.PSD2_ENABLED === "true";
}

/**
 * Build Tink Link URL for a one-off connect flow.
 * Tink Link is the user-facing OAuth-ish bank consent flow.
 */
export function getAuthUrl(userId: string, redirectUri: string, market = "NL"): string {
  const cfg = getConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    market,
    locale: "nl_NL",
    scope: "accounts:read,transactions:read",
    state: userId,
  });
  return `https://link.tink.com/1.0/transactions/connect-accounts?${params.toString()}`;
}

async function tinkFetch<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const cfg = getConfig();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.token) headers["authorization"] = `Bearer ${init.token}`;
  const res = await fetch(`${cfg.apiBase}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Tink ${path} returned ${res.status}: ${text.slice(0, 240)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Tink ${path} returned non-JSON: ${text.slice(0, 120)}`);
  }
}

export async function exchangeCode(code: string, redirectUri: string): Promise<TinkTokenResponse> {
  const cfg = getConfig();
  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${cfg.apiBase}/api/v1/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Tink oauth ${res.status}: ${text.slice(0, 240)}`);
  return JSON.parse(text) as TinkTokenResponse;
}

export async function listAccounts(userToken: string): Promise<TinkAccount[]> {
  const r = await tinkFetch<{ accounts: TinkAccount[] }>(`/data/v2/accounts`, { token: userToken });
  return r.accounts;
}

export async function listTransactions(
  userToken: string,
  accountId: string,
  fromIsoDate: string,
): Promise<TinkTransaction[]> {
  const params = new URLSearchParams({
    accountIdIn: accountId,
    bookedDateGte: fromIsoDate,
    pageSize: "500",
  });
  const r = await tinkFetch<{ transactions: TinkTransaction[] }>(`/data/v2/transactions?${params.toString()}`, {
    token: userToken,
  });
  return r.transactions;
}
