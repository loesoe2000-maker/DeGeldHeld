/**
 * scripts/rotate-keys.ts — runs rotateBankConnectionKeys() once.
 *
 * Pre-condition: both TOKEN_ENC_KEY_PRIMARY (new key) and
 * TOKEN_ENC_KEY_FALLBACK (current/old key) must be set in env.
 */

export {};

import { rotateBankConnectionKeys } from "../lib/crypto-rotate";
import { hasFallbackKey } from "../lib/crypto";
import { prisma } from "../lib/db";

async function main() {
  if (!hasFallbackKey()) {
    console.log("⚠ TOKEN_ENC_KEY_FALLBACK not set — nothing to rotate from. Aborting.");
    process.exit(2);
  }
  console.log("Rotating BankConnection encrypted tokens under new primary key…");
  const stats = await rotateBankConnectionKeys();
  console.log(
    `scanned=${stats.scanned} rotated=${stats.rotated} skipped=${stats.skipped} failed=${stats.failed}`,
  );
  if (stats.failed > 0) {
    console.log("⚠ Some records failed to rotate — inspect logs + retry; do NOT remove FALLBACK yet.");
    process.exit(1);
  }
  console.log("✓ rotation complete. Safe to remove TOKEN_ENC_KEY_FALLBACK from env.");
}

void main().finally(() => prisma.$disconnect());
