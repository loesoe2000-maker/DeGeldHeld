/**
 * lib/inbound.ts — helpers voor Resend Inbound (mail-forward) webhook.
 *
 * Signature verification lives in lib/inbound-verify.ts (Svix). This module
 * keeps the legacy payload-parse + the user lookup; the canonical webhook
 * entry-point is lib/inbound-handler.ts.
 */

import { prisma } from "@/lib/db";

export type InboundAttachment = {
  filename: string;
  contentType: string;
  base64: string;
};

export type InboundPayload = {
  from: string;
  subject: string;
  text: string;
  attachments: InboundAttachment[];
};

/**
 * Parse Resend inbound webhook payload — shape:
 *   { type: "email.inbound", data: { from: {email}, subject, text, attachments[] } }
 * The exact format depends on the Resend Inbound spec; we tolerate slight
 * variations by trying common shapes.
 */
export function parseInboundPayload(raw: unknown): InboundPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const dataRaw = (obj.data ?? obj) as Record<string, unknown>;

  const fromRaw = dataRaw.from;
  let from = "";
  if (typeof fromRaw === "string") from = fromRaw;
  else if (fromRaw && typeof fromRaw === "object" && typeof (fromRaw as Record<string, unknown>).email === "string") {
    from = (fromRaw as { email: string }).email;
  }

  const subject = typeof dataRaw.subject === "string" ? dataRaw.subject : "";
  const text = typeof dataRaw.text === "string" ? dataRaw.text : "";

  const attRaw = dataRaw.attachments;
  const attachments: InboundAttachment[] = [];
  if (Array.isArray(attRaw)) {
    for (const a of attRaw) {
      if (!a || typeof a !== "object") continue;
      const ao = a as Record<string, unknown>;
      const filename = typeof ao.filename === "string" ? ao.filename : "attachment";
      const contentType = typeof ao.content_type === "string"
        ? ao.content_type
        : typeof ao.contentType === "string" ? ao.contentType : "application/octet-stream";
      const base64 = typeof ao.content === "string"
        ? ao.content
        : typeof ao.base64 === "string" ? ao.base64 : "";
      if (base64.length === 0) continue;
      attachments.push({ filename, contentType, base64 });
    }
  }

  if (!from) return null;
  return { from: from.toLowerCase().trim(), subject, text, attachments };
}

export async function userForFromAddress(from: string): Promise<{ id: string; email: string } | null> {
  const u = await prisma.user.findUnique({
    where: { email: from },
    select: { id: true, email: true },
  });
  return u;
}
