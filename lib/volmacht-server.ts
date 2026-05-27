/**
 * lib/volmacht-server.ts — v36 idee 2 — server-only Volmacht helpers.
 *
 * Bevat de IP-hash (node:crypto-afhankelijk) zodat lib/volmacht.ts zelf
 * browser-veilig blijft en in client-components mag worden geïmporteerd
 * voor de mandate-text preview.
 *
 * NB: dit bestand mag ALLEEN worden geïmporteerd door route-handlers /
 * server-pages (geen "use client" boven). Het `node:crypto` import bewijst
 * dat aan webpack — als je dit per ongeluk in een client-bundel trekt
 * krijg je de bekende "Reading from node:crypto is not handled by plugins"
 * fout in `npm run build`.
 */
import crypto from "node:crypto";

/**
 * SHA-256 hash van een IP met server-side secret. 64 hex chars output.
 * Bedoeld voor audit-trail in Volmacht.ipHash zonder de rauwe IP op te
 * slaan (privacy by design).
 *
 * De secret komt uit env `VOLMACHT_IP_HASH_SECRET`. Op dev/test zonder env
 * gebruiken we een vaste dev-fallback — dat is OK want we beveiligen tegen
 * casual lookup, niet tegen een attacker met server-toegang.
 */
export function hashIp(ip: string, secret?: string): string {
  const key = secret ?? process.env.VOLMACHT_IP_HASH_SECRET ?? "dev-fallback";
  return crypto
    .createHash("sha256")
    .update(`${key}|${ip}`)
    .digest("hex");
}
