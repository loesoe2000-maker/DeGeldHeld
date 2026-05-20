/**
 * lib/proof-inbound.ts — HMAC verification + payload parsing for the
 * proof webhook (`/api/inbound/proof`).
 *
 * The proof-matching logic — a [PROOF-{id}] subject token or an
 * In-Reply-To matching a Negotiation thread-id — is reused by the
 * canonical webhook handler (lib/inbound-handler.ts). Signature
 * verification is shared via lib/inbound-verify.ts (Svix).
 */

export type ProofInboundPayload = {
  from: string;
  subject: string;
  text: string;
  inReplyTo: string | null;
  attachmentsBase64: { filename: string; contentType: string; base64: string }[];
};

export function parseProofPayload(raw: unknown): ProofInboundPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const dataRaw = (obj.data ?? obj) as Record<string, unknown>;

  const headers = (dataRaw.headers ?? {}) as Record<string, unknown>;
  function h(name: string): string | null {
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lower && typeof v === "string") return v;
    }
    const direct = dataRaw[name];
    if (typeof direct === "string") return direct;
    return null;
  }

  let from = "";
  const fromRaw = dataRaw.from;
  if (typeof fromRaw === "string") from = fromRaw;
  else if (fromRaw && typeof fromRaw === "object" && typeof (fromRaw as Record<string, unknown>).email === "string") {
    from = (fromRaw as { email: string }).email;
  }
  if (!from) return null;

  const attRaw = dataRaw.attachments;
  const attachments: ProofInboundPayload["attachmentsBase64"] = [];
  if (Array.isArray(attRaw)) {
    for (const a of attRaw) {
      if (!a || typeof a !== "object") continue;
      const ao = a as Record<string, unknown>;
      const filename = typeof ao.filename === "string" ? ao.filename : "attachment";
      const contentType =
        typeof ao.content_type === "string"
          ? ao.content_type
          : typeof ao.contentType === "string"
          ? ao.contentType
          : "application/octet-stream";
      const base64 =
        typeof ao.content === "string" ? ao.content : typeof ao.base64 === "string" ? ao.base64 : "";
      if (base64.length === 0) continue;
      attachments.push({ filename, contentType, base64 });
    }
  }

  return {
    from: from.toLowerCase().trim(),
    subject: typeof dataRaw.subject === "string" ? dataRaw.subject : "",
    text: typeof dataRaw.text === "string" ? dataRaw.text : "",
    inReplyTo: h("In-Reply-To"),
    attachmentsBase64: attachments,
  };
}

/** Extract a [PROOF-cuid] token from a subject line. */
export function extractProofToken(subject: string): string | null {
  const m = /\[PROOF-([a-zA-Z0-9_-]{20,40})\]/.exec(subject);
  return m ? m[1] : null;
}
