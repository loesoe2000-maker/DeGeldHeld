import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  discoverProvider,
  parseRetentionJson,
  __setDiscoveryDeps,
} from "@/lib/provider_discovery";

const webFetchMock = vi.fn();
const llmExtractMock = vi.fn();

beforeEach(() => {
  webFetchMock.mockReset();
  llmExtractMock.mockReset();
  __setDiscoveryDeps({ webFetch: webFetchMock, llmExtract: llmExtractMock });
});

afterEach(() => {
  __setDiscoveryDeps(null);
});

describe("provider_discovery — parseRetentionJson", () => {
  it("parses valid email+phone+url", () => {
    const r = parseRetentionJson(
      JSON.stringify({
        email: "retention@kpn.nl",
        phone: "+31-800-1234567",
        url: "https://www.kpn.com/contact",
        hours: "ma-vr 9-18",
      }),
    );
    expect(r).not.toBeNull();
    expect(r!.email).toBe("retention@kpn.nl");
    expect(r!.url).toBe("https://www.kpn.com/contact");
  });

  it("rejects email without @", () => {
    const r = parseRetentionJson(JSON.stringify({ email: "not-an-email" }));
    expect(r).toBeNull();
  });

  it("rejects too-short phone", () => {
    const r = parseRetentionJson(JSON.stringify({ phone: "12" }));
    expect(r).toBeNull();
  });

  it("rejects non-http url", () => {
    const r = parseRetentionJson(JSON.stringify({ url: "ftp://abc.com" }));
    expect(r).toBeNull();
  });

  it("returns null on completely empty payload", () => {
    expect(parseRetentionJson("{}")).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    expect(parseRetentionJson("{not json")).toBeNull();
  });
});

describe("provider_discovery — happy path", () => {
  it("fetches sources + extracts retention", async () => {
    webFetchMock.mockResolvedValue("Contact our retention team at retention@example.com (long body of html-stripped text " + "x".repeat(500) + ")");
    llmExtractMock.mockResolvedValueOnce({
      email: "retention@example.com",
      hours: "ma-vr 9-17",
    });
    const r = await discoverProvider({ name: "Acme", country: "NL" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.retention.email).toBe("retention@example.com");
      expect(r.sources.length).toBeGreaterThan(0);
    }
  });
});

describe("provider_discovery — failure paths", () => {
  it("returns no-sources when all webFetch calls fail", async () => {
    webFetchMock.mockResolvedValue("");
    const r = await discoverProvider({ name: "Acme", country: "NL" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no-sources");
  });

  it("returns no-extractable-contact when LLM finds nothing", async () => {
    webFetchMock.mockResolvedValue("Big page of irrelevant content " + "y".repeat(500));
    llmExtractMock.mockResolvedValueOnce(null);
    const r = await discoverProvider({ name: "Acme", country: "NL" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no-extractable-contact");
  });

  it("returns empty-name for blank input", async () => {
    const r = await discoverProvider({ name: "  ", country: "NL" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty-name");
  });

  it("does not fabricate when fetch throws", async () => {
    webFetchMock.mockRejectedValue(new Error("timeout"));
    const r = await discoverProvider({ name: "Acme", country: "NL" });
    expect(r.ok).toBe(false);
  });
});
