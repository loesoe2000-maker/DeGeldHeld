import { describe, it, expect } from "vitest";

/**
 * The script writes JSONL; this test mirrors the per-sample transform
 * to verify the line shape Replicate/HF expect.
 */
function buildExampleLine(sample: {
  imageStorageUrl: string | null;
  anonymizedJson: string;
}): string | null {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(sample.anonymizedJson) as Record<string, unknown>;
  } catch {
    return null;
  }
  const example = {
    messages: [
      {
        role: "user",
        content: sample.imageStorageUrl
          ? [
              { type: "image_url", image_url: { url: sample.imageStorageUrl } },
              { type: "text", text: "Extract bill metadata as JSON" },
            ]
          : [{ type: "text", text: `Hier is de raw OCR-tekst:\n\n${parsed.rawText ?? ""}` }],
      },
      {
        role: "assistant",
        content: JSON.stringify({
          provider: parsed.provider,
          monthly_subscription_eur: parsed.monthlyAmountCents
            ? (parsed.monthlyAmountCents as number) / 100
            : null,
          plan: parsed.plan,
        }),
      },
    ],
  };
  return JSON.stringify(example);
}

describe("export JSONL format", () => {
  it("emits valid JSON per line", () => {
    const line = buildExampleLine({
      imageStorageUrl: null,
      anonymizedJson: JSON.stringify({
        provider: "KPN",
        monthlyAmountCents: 2965,
        plan: "Compleet",
        rawText: "anon text",
      }),
    });
    expect(line).not.toBeNull();
    const parsed = JSON.parse(line!) as { messages: Array<{ role: string }> };
    expect(parsed.messages[0].role).toBe("user");
    expect(parsed.messages[1].role).toBe("assistant");
  });

  it("uses image content type when imageStorageUrl is set", () => {
    const line = buildExampleLine({
      imageStorageUrl: "https://blob.vercel.com/x.jpg",
      anonymizedJson: JSON.stringify({ provider: "Vodafone", monthlyAmountCents: 2995 }),
    });
    const parsed = JSON.parse(line!) as { messages: Array<{ content: Array<{ type: string }> }> };
    expect(parsed.messages[0].content[0].type).toBe("image_url");
  });

  it("falls back to text-only when no image url", () => {
    const line = buildExampleLine({
      imageStorageUrl: null,
      anonymizedJson: JSON.stringify({ provider: "Eneco", rawText: "hello" }),
    });
    const parsed = JSON.parse(line!) as { messages: Array<{ content: Array<{ type: string; text?: string }> }> };
    expect(parsed.messages[0].content[0].type).toBe("text");
    expect(parsed.messages[0].content[0].text).toContain("hello");
  });

  it("returns null on broken anonymizedJson", () => {
    const line = buildExampleLine({ imageStorageUrl: null, anonymizedJson: "not json" });
    expect(line).toBeNull();
  });

  it("assistant content is structured JSON string", () => {
    const line = buildExampleLine({
      imageStorageUrl: null,
      anonymizedJson: JSON.stringify({ provider: "Ziggo", monthlyAmountCents: 4500 }),
    });
    const parsed = JSON.parse(line!) as { messages: Array<{ content: unknown }> };
    const asst = parsed.messages[1].content as string;
    expect(typeof asst).toBe("string");
    expect(JSON.parse(asst)).toMatchObject({ provider: "Ziggo", monthly_subscription_eur: 45 });
  });
});
