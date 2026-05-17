/**
 * lib/crypto-rotate.ts — re-encrypt BankConnection tokens under the
 * current primary key. Run after swapping TOKEN_ENC_KEY_PRIMARY +
 * TOKEN_ENC_KEY_FALLBACK in Vercel env.
 */

import { prisma } from "@/lib/db";
import { decryptToken, encryptToken, isLegacyOrFallbackEncrypted } from "@/lib/crypto";

export type RotationStats = {
  scanned: number;
  rotated: number;
  skipped: number;
  failed: number;
};

export async function rotateBankConnectionKeys(): Promise<RotationStats> {
  const stats: RotationStats = { scanned: 0, rotated: 0, skipped: 0, failed: 0 };
  const conns = await prisma.bankConnection.findMany({
    select: { id: true, accessTokenEnc: true, refreshTokenEnc: true },
  });
  for (const c of conns) {
    stats.scanned++;
    const accessIsLegacy = isLegacyOrFallbackEncrypted(c.accessTokenEnc);
    const refreshIsLegacy = c.refreshTokenEnc ? isLegacyOrFallbackEncrypted(c.refreshTokenEnc) : false;
    if (!accessIsLegacy && !refreshIsLegacy) {
      stats.skipped++;
      continue;
    }
    try {
      const newAccess = accessIsLegacy ? encryptToken(decryptToken(c.accessTokenEnc)) : c.accessTokenEnc;
      const newRefresh = refreshIsLegacy && c.refreshTokenEnc
        ? encryptToken(decryptToken(c.refreshTokenEnc))
        : c.refreshTokenEnc;
      await prisma.bankConnection.update({
        where: { id: c.id },
        data: { accessTokenEnc: newAccess, refreshTokenEnc: newRefresh },
      });
      stats.rotated++;
    } catch {
      stats.failed++;
    }
  }
  return stats;
}
