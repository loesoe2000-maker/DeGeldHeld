/**
 * scripts/export-training-dataset.ts
 *
 * Dump reviewed OcrTrainingSample rows to JSONL for Replicate /
 * HuggingFace fine-tuning. Each line is a single training example in
 * OpenAI chat-completion format (which both Replicate vision adapters
 * and HF Liger trainer accept after a tiny transform).
 *
 * Run: npx tsx scripts/export-training-dataset.ts
 *      OUT=ocr-dataset.jsonl npx tsx scripts/export-training-dataset.ts
 */

export {};

import { prisma } from "../lib/db";
import { writeFileSync } from "node:fs";

const OUT = process.env.OUT ?? "ocr-dataset.jsonl";

async function main() {
  const samples = await prisma.ocrTrainingSample.findMany({
    where: { reviewed: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Found ${samples.length} reviewed samples.`);

  const lines: string[] = [];
  for (const s of samples) {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(s.anonymizedJson) as Record<string, unknown>;
    } catch {
      continue;
    }
    const example = {
      messages: [
        {
          role: "user",
          content: s.imageStorageUrl
            ? [
                { type: "image_url", image_url: { url: s.imageStorageUrl } },
                {
                  type: "text",
                  text:
                    "Extract bill metadata as JSON: provider, monthly_subscription_eur, total_eur, plan, period, language, country, confidence.",
                },
              ]
            : [
                {
                  type: "text",
                  text:
                    `Hier is de raw OCR-tekst van een NL factuur. Extract de velden:\n\n${parsed.rawText ?? ""}`,
                },
              ],
        },
        {
          role: "assistant",
          content: JSON.stringify({
            provider: parsed.provider,
            monthly_subscription_eur: parsed.monthlyAmountCents ? (parsed.monthlyAmountCents as number) / 100 : null,
            total_eur: parsed.totalAmountCents ? (parsed.totalAmountCents as number) / 100 : null,
            plan: parsed.plan,
            period: parsed.period,
            language: parsed.language,
            country: parsed.country,
          }),
        },
      ],
    };
    lines.push(JSON.stringify(example));
  }
  writeFileSync(OUT, lines.join("\n") + (lines.length > 0 ? "\n" : ""));
  console.log(`Wrote ${lines.length} examples to ${OUT}.`);
  if (lines.length < 500) {
    console.log("\n⚠ Less than 500 samples — fine-tuning is typically not worthwhile yet.");
    console.log("   Recommend waiting until ≥500 reviewed before uploading to Replicate.");
  } else {
    console.log("\nNext steps:");
    console.log("  1. Upload to Replicate fine-tune endpoint for llama-4-scout vision");
    console.log("  2. Or transform to HuggingFace format and run on a H100 (Liger trainer)");
    console.log("  3. Set the resulting model as GROQ_VISION_MODEL in Vercel");
  }
}

void main().finally(() => prisma.$disconnect());
