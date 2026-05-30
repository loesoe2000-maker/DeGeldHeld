import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * v37 idee 1 — attachVaultDocAsProof: kluis-document als bewijs koppelen.
 * Mockt prisma + @vercel/blob copy zodat we de ownership-gate + happy-path
 * + copy-fout testen zonder echte IO.
 */

const findUnique = vi.fn();
const copyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { userDocument: { findUnique: (a: unknown) => findUnique(a) } },
}));
vi.mock("@vercel/blob", () => ({ copy: (...a: unknown[]) => copyMock(...a) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { attachVaultDocAsProof } from "@/lib/claim-proof-from-vault";

beforeEach(() => {
  findUnique.mockReset();
  copyMock.mockReset();
});

describe("attachVaultDocAsProof", () => {
  it("document van andere user → niet gevonden (ownership-gate)", async () => {
    findUnique.mockResolvedValue({
      id: "d1",
      userId: "someone-else",
      storageUrl: "https://blob/x.pdf",
      filename: "x.pdf",
    });
    const r = await attachVaultDocAsProof({
      documentId: "d1",
      userId: "me",
      claimType: "HuurServicekostenClaim",
      claimId: "c1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/niet gevonden/i);
    expect(copyMock).not.toHaveBeenCalled();
  });

  it("niet-bestaand document → niet gevonden", async () => {
    findUnique.mockResolvedValue(null);
    const r = await attachVaultDocAsProof({
      documentId: "nope",
      userId: "me",
      claimType: "EnergieEindafrekeningClaim",
      claimId: "c1",
    });
    expect(r.ok).toBe(false);
    expect(copyMock).not.toHaveBeenCalled();
  });

  it("eigen document → kopieert blob + geeft nieuwe url terug", async () => {
    findUnique.mockResolvedValue({
      id: "d1",
      userId: "me",
      storageUrl: "https://blob/orig.pdf",
      filename: "jaarafrekening-2024.pdf",
    });
    copyMock.mockResolvedValue({ url: "https://blob/claim-proofs/copy.pdf" });
    const r = await attachVaultDocAsProof({
      documentId: "d1",
      userId: "me",
      claimType: "HuurServicekostenClaim",
      claimId: "c1",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.storageUrl).toBe("https://blob/claim-proofs/copy.pdf");
      expect(r.filename).toBe("jaarafrekening-2024.pdf");
    }
    // copy(from, toPath, opts) — bron is de originele kluis-url, doel zit in
    // de claim-proofs-namespace.
    expect(copyMock).toHaveBeenCalledTimes(1);
    const [from, toPath] = copyMock.mock.calls[0];
    expect(from).toBe("https://blob/orig.pdf");
    expect(String(toPath)).toMatch(/^claim-proofs\/HuurServicekostenClaim\/me\/c1\//);
  });

  it("copy gooit → nette foutmelding (geen throw)", async () => {
    findUnique.mockResolvedValue({
      id: "d1",
      userId: "me",
      storageUrl: "https://blob/orig.pdf",
      filename: "x.pdf",
    });
    copyMock.mockRejectedValue(new Error("blob down"));
    const r = await attachVaultDocAsProof({
      documentId: "d1",
      userId: "me",
      claimType: "EnergieEindafrekeningClaim",
      claimId: "c1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/mislukte|opnieuw/i);
  });
});
