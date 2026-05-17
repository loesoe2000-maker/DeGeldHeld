/**
 * lib/referral.ts — referral-code helpers.
 *
 * Code is 6 hoofdletters/cijfers — verwarrings-veilig (geen 0/O/1/I).
 */
import { prisma } from "@/lib/db";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function isValidCode(code: string): boolean {
  if (!code || code.length < 4 || code.length > 12) return false;
  return /^[A-Z2-9]+$/.test(code);
}

/**
 * Get-or-create a referralCode for this user. Generates a fresh code
 * if the user doesn't have one yet; retries on rare collision.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (u?.referralCode) return u.referralCode;

  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // unique-collision; try again
    }
  }
  throw new Error("Could not allocate referral code");
}

/**
 * Tries to mark a referral as used by a newly-signed-up user.
 * Fail-soft: returns null if the code doesn't exist or is already used
 * (so signup is never blocked).
 */
export async function consumeReferral(code: string, newUserId: string): Promise<string | null> {
  const owner = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
  if (!owner || owner.id === newUserId) return null;

  // 1 free negotiation reward = 499 cents (€4.99 paywall price)
  const REWARD_CENTS = 499;
  try {
    const ref = await prisma.referral.create({
      data: {
        code,
        ownerId: owner.id,
        usedById: newUserId,
        usedAt: new Date(),
        rewardCents: REWARD_CENTS,
      },
    });
    return ref.id;
  } catch {
    return null;
  }
}

export function buildShareUrl(code: string, base = "https://degeldheld.com"): string {
  return `${base}/uitnodiging/${code}`;
}

export function buildShareText(code: string, savedEur?: number): string {
  const savedPart = savedEur && savedEur > 0 ? `Ik bespaarde €${savedEur} via DeGeldHeld. ` : "";
  return `${savedPart}Jij eerste onderhandeling gratis: ${buildShareUrl(code)}`;
}
