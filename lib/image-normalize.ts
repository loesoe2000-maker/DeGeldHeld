/**
 * lib/image-normalize.ts — bring user-uploaded images into a shape that
 * Groq Vision will accept reliably.
 *
 * Why this exists:
 *   - MacBook screenshots are retina (2880-5120px wide). Groq Vision
 *     rejects oversized images with "invalid image data".
 *   - iPhone HEIC images aren't supported by Groq at all.
 *   - Some JPEGs ship with CMYK color profiles which Groq can't parse.
 *   - Embedded EXIF metadata can carry orientation flags that confuse
 *     downstream OCR.
 *
 * After normalisation every image is:
 *   - JPEG, sRGB color, no EXIF metadata
 *   - Long-edge at most 1568px (Llama 4 Scout's effective resolution)
 *   - Quality 88 (visually identical, ~1MB for a full-page invoice)
 */

import sharp from "sharp";

const MAX_LONG_EDGE = 1568;
const JPEG_QUALITY = 88;

export type NormalizeResult = {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png";
  width: number;
  height: number;
  bytes: number;
  sourceFormat: string | "unknown";
  resized: boolean;
};

/**
 * Convert any user-uploaded image (incl. HEIC, oversized PNG, CMYK JPEG)
 * into a Groq-friendly JPEG buffer.
 *
 * Never throws on processable input — falls back to the original buffer
 * (still as JPEG) if any sharp operation fails. Callers should treat
 * the result as a best-effort normalisation.
 */
export async function normalizeImageForVision(
  inputBuffer: Buffer,
  inputMime: string,
): Promise<NormalizeResult> {
  try {
    const pipeline = sharp(inputBuffer, { failOn: "none" });
    const meta = await pipeline.metadata();
    const originalWidth = meta.width ?? 0;
    const originalHeight = meta.height ?? 0;
    const longEdge = Math.max(originalWidth, originalHeight);
    const needsResize = longEdge > MAX_LONG_EDGE;
    const isJpegOrPng = meta.format === "jpeg" || meta.format === "png";
    const isSrgb = !meta.space || meta.space === "srgb";

    // Fast path: if input is already a small sRGB JPEG/PNG, pass it
    // through untouched. Re-encoding with mozjpeg has triggered Groq's
    // "invalid image data" rejection on otherwise-valid uploads, so we
    // only transform when there's an actual reason (oversize / HEIC /
    // CMYK / weird orientation).
    const hasOrientation = (meta.orientation ?? 1) !== 1;
    const canPassThrough = isJpegOrPng && !needsResize && isSrgb && !hasOrientation;
    if (canPassThrough) {
      return {
        buffer: inputBuffer,
        mimeType: meta.format === "png" ? "image/png" : "image/jpeg",
        width: originalWidth,
        height: originalHeight,
        bytes: inputBuffer.length,
        sourceFormat: meta.format ?? "unknown",
        resized: false,
      };
    }

    let processed = pipeline
      .rotate() // honor EXIF orientation, then strip
      .toColorspace("srgb");

    if (needsResize) {
      processed = processed.resize({
        width: longEdge === originalWidth ? MAX_LONG_EDGE : undefined,
        height: longEdge === originalHeight ? MAX_LONG_EDGE : undefined,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Plain libjpeg-turbo encode (no mozjpeg). Standard baseline JPEG
    // is the only thing Groq Vision parses reliably.
    const buffer = await processed
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: false, progressive: false })
      .toBuffer();

    return {
      buffer,
      mimeType: "image/jpeg",
      width: needsResize ? Math.min(originalWidth, MAX_LONG_EDGE) : originalWidth,
      height: needsResize ? Math.min(originalHeight, MAX_LONG_EDGE) : originalHeight,
      bytes: buffer.length,
      sourceFormat: meta.format ?? "unknown",
      resized: needsResize,
    };
  } catch {
    // Sharp couldn't read it — return original as-is, mark mime jpeg so
    // the data-URL still gets the right scheme. Groq will likely fail on
    // truly-corrupt input but that's a separate error to surface.
    return {
      buffer: inputBuffer,
      mimeType: "image/jpeg",
      width: 0,
      height: 0,
      bytes: inputBuffer.length,
      sourceFormat: inputMime,
      resized: false,
    };
  }
}
