/**
 * lib/resend-receiving.ts — Resend inbound (`email.received`) event parsing
 * + the Received-Emails API client.
 *
 * IMPORTANT (verified against Resend docs, Feb 2026): the inbound webhook
 * payload contains **metadata only** — `email_id`, `from`, `to[]`,
 * `subject`, `message_id`, and attachment metadata. It does NOT include the
 * body, the headers, or the attachment content. To get those we call the
 * Received-Emails API with the RESEND_API_KEY:
 *
 *   GET https://api.resend.com/emails/receiving/{id}
 *     → { from, to[], subject, text, html, headers{}, message_id, attachments[] }
 *   GET https://api.resend.com/emails/receiving/{id}/attachments/{attId}
 *     → { download_url, content_type, filename, size, … }   (signed CDN URL)
 *
 * In-Reply-To / References live inside the `headers` map of the retrieve
 * response (not as top-level fields).
 */

const RESEND_API = "https://api.resend.com";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB cap

/** Attachment metadata as it appears in the webhook + retrieve response. */
export type ReceivedAttachmentMeta = {
  id: string;
  filename: string;
  contentType: string;
};

/** What the `email.received` webhook actually gives us (metadata only). */
export type ReceivedEventMeta = {
  emailId: string;
  from: string;
  to: string[];
  subject: string;
  messageId: string | null;
  attachments: ReceivedAttachmentMeta[];
};

/** Fully-hydrated inbound email after the retrieve API call. */
export type FetchedEmail = {
  emailId: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  attachments: ReceivedAttachmentMeta[];
};

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string") return [v];
  return [];
}

function firstEmail(v: unknown): string {
  // `from` may be "addr" or "Name <addr>" or { email }.
  if (typeof v === "string") {
    const m = v.match(/<([^>]+)>/);
    return (m ? m[1] : v).toLowerCase().trim();
  }
  if (v && typeof v === "object" && typeof (v as Record<string, unknown>).email === "string") {
    return ((v as { email: string }).email).toLowerCase().trim();
  }
  return "";
}

function parseAttachments(raw: unknown): ReceivedAttachmentMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: ReceivedAttachmentMeta[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const ao = a as Record<string, unknown>;
    const id = typeof ao.id === "string" ? ao.id : "";
    if (!id) continue;
    out.push({
      id,
      filename: typeof ao.filename === "string" ? ao.filename : "attachment",
      contentType:
        typeof ao.content_type === "string"
          ? ao.content_type
          : typeof ao.contentType === "string"
            ? ao.contentType
            : "application/octet-stream",
    });
  }
  return out;
}

/**
 * Parse the `email.received` webhook envelope into metadata. Returns null
 * for any other event type or a payload missing the email id / from.
 */
export function parseReceivedEvent(raw: unknown): ReceivedEventMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.type === "string" && obj.type !== "email.received") return null;

  const data = (obj.data ?? obj) as Record<string, unknown>;
  const emailId =
    typeof data.email_id === "string"
      ? data.email_id
      : typeof data.emailId === "string"
        ? data.emailId
        : typeof data.id === "string"
          ? data.id
          : "";
  const from = firstEmail(data.from);
  if (!emailId || !from) return null;

  return {
    emailId,
    from,
    to: asStringArray(data.to).map((t) => firstEmail(t)),
    subject: typeof data.subject === "string" ? data.subject : "",
    messageId: typeof data.message_id === "string" ? data.message_id : null,
    attachments: parseAttachments(data.attachments),
  };
}

function headerLookup(headers: Record<string, string>, name: string): string | null {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower && typeof v === "string") return v;
  }
  return null;
}

/**
 * Hydrate a received email via the Resend API: body text/html, headers,
 * and the In-Reply-To / References for thread matching. Returns null on
 * any non-2xx or malformed response (caller decides how to react).
 */
export async function fetchReceivedEmail(emailId: string): Promise<FetchedEmail | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`${RESEND_API}/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return null;

  const body = (await res.json()) as Record<string, unknown>;
  const headersRaw = (body.headers ?? {}) as Record<string, unknown>;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(headersRaw)) {
    if (typeof v === "string") headers[k] = v;
  }

  return {
    emailId,
    from: firstEmail(body.from),
    to: asStringArray(body.to).map((t) => firstEmail(t)),
    subject: typeof body.subject === "string" ? body.subject : "",
    text: typeof body.text === "string" ? body.text : "",
    html: typeof body.html === "string" ? body.html : "",
    headers,
    messageId: typeof body.message_id === "string" ? body.message_id : headerLookup(headers, "Message-ID"),
    inReplyTo: headerLookup(headers, "In-Reply-To"),
    references: headerLookup(headers, "References"),
    attachments: parseAttachments(body.attachments),
  };
}

/**
 * Download a single attachment's bytes via its signed CDN URL. Respects the
 * 10 MB cap (skips anything larger). Returns null on any failure.
 */
export async function fetchAttachmentBuffer(
  emailId: string,
  attachmentId: string,
): Promise<{ contentType: string; buffer: Buffer } | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  const metaRes = await fetch(
    `${RESEND_API}/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { headers: { authorization: `Bearer ${apiKey}` } },
  );
  if (!metaRes.ok) return null;

  const meta = (await metaRes.json()) as Record<string, unknown>;
  const downloadUrl = typeof meta.download_url === "string" ? meta.download_url : null;
  const contentType = typeof meta.content_type === "string" ? meta.content_type : "application/octet-stream";
  const size = typeof meta.size === "number" ? meta.size : null;
  if (!downloadUrl) return null;
  if (size != null && size > MAX_ATTACHMENT_BYTES) return null;

  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) return null;
  const arrayBuf = await fileRes.arrayBuffer();
  if (arrayBuf.byteLength > MAX_ATTACHMENT_BYTES) return null;

  return { contentType, buffer: Buffer.from(arrayBuf) };
}
