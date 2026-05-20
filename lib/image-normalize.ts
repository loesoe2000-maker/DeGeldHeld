/**
 * lib/image-normalize.ts — bring user-uploaded images into a shape that
 * Groq Vision will accept reliably.
 *
 * Why this exists:
 *   - MacBook screenshots are retina (2880-5120px wide). Groq Vision
 *     rejects oversized images with "invalid image data".
 *   - iPhone HEIC images aren't supported by sharp on Vercel (no libheif
 *     in the pre-built binary) and Groq doesn't read HEIC either — we
 *     pre-convert HEIC → JPEG using the pure-JS heic-convert package
 *     before handing off to sharp.
 *   - Some JPEGs ship with CMYK / Display P3 / Adobe-RGB color profiles
 *     which Groq's OpenAI-compatible vision endpoint can't parse.
 *   - Mac screenshot JPEGs sometimes embed Adobe APP14 markers, non-
 *     standard JFIF versions or huge thumbnails that confuse the parser.
 *
 * v15.2: no more pass-through. Even small "sRGB" JPEGs from macOS have
 * been seen to get "invalid image data" rejections — the only reliable
 * fix is to always re-encode through libjpeg-turbo with the most
 * conservative possible settings.
 *
 * v15.3: HEIC pre-conversion via heic-convert (wasm-based, pure JS, no
 * native libheif required).
 *
 * After normalisation every image is:
 *   - JPEG, sRGB color, no alpha, no ICC profile, no EXIF metadata
 *   - Long-edge at most 1280px (Llama 4 Scout's vision tower runs at
 *     896, anything above ~1300 is downsampled server-side anyway)
 *   - Baseline JPEG, 4:2:0 chroma subsampling, quality 85
 */

import sharp from "sharp";

/**
 * HEIC detection by magic bytes. The MIME label from the browser is
 * unreliable on cross-platform uploads ("image/heif", "image/heic" or
 * sometimes "application/octet-stream") so we sniff the actual ftyp
 * box at byte offset 4.
 *
 * https://nokiatech.github.io/heif/technical.html — supported brands:
 *   heic, heix, hevc, hevx, heim, heis, hevm, hevs, mif1, msf1
 */
function isHeicBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12).toLowerCase();
  return [
    "heic",
    "heix",
    "hevc",
    "hevx",
    "heim",
    "heis",
    "hevm",
    "hevs",
    "mif1",
    "msf1",
  ].includes(brand);
}

/**
 * Decode an HEIC/HEIF buffer to a JPEG buffer using the pure-JS
 * heic-convert library. Returns null on failure so the caller can
 * surface a clean error instead of crashing.
 *
 * Hard 20s timeout: libheif-js can hang on edge-case inputs and we
 * never want to silently consume the function's full 60s budget.
 */
const HEIC_CONVERT_TIMEOUT_MS = 20_000;

async function heicToJpegBuffer(buf: Buffer): Promise<Buffer | null> {
  const start = Date.now();
  try {
    // heic-convert ships no types; require dynamically so the build
    // doesn't break if the package is missing in a future tree-shake.
    const mod = await import("heic-convert");
    const convert = (mod.default ?? mod) as (opts: {
      buffer: Buffer | ArrayBuffer | Uint8Array;
      format: "JPEG" | "PNG";
      quality?: number;
    }) => Promise<ArrayBuffer>;

    const convertPromise = convert({ buffer: buf, format: "JPEG", quality: 0.85 });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`heic-convert timeout after ${HEIC_CONVERT_TIMEOUT_MS}ms`)),
        HEIC_CONVERT_TIMEOUT_MS,
      ),
    );
    const out = await Promise.race([convertPromise, timeoutPromise]);
    const elapsed = Date.now() - start;
    console.warn(`[image-normalize] heic-convert ok in ${elapsed}ms`);
    return Buffer.from(out);
  } catch (e) {
    const elapsed = Date.now() - start;
    console.error(
      `[image-normalize] heic-convert failed after ${elapsed}ms:`,
      (e as Error).message,
    );
    return null;
  }
}

const MAX_LONG_EDGE = 1280;
const FALLBACK_LONG_EDGE = 800;
const JPEG_QUALITY = 85;

export type NormalizeResult = {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png";
  width: number;
  height: number;
  bytes: number;
  sourceFormat: string | "unknown";
  sourceSpace: string | "unknown";
  sourceChannels: number;
  resized: boolean;
};

type EncodeOpts = {
  maxLongEdge: number;
  format: "jpeg" | "png";
};

/**
 * Convert any user-uploaded image (incl. HEIC, oversized PNG, CMYK JPEG,
 * Mac-screenshot JPEG with Display P3) into a Groq-friendly buffer.
 *
 * Never throws on processable input — falls back to the original buffer
 * if any sharp operation fails. Callers should treat the result as a
 * best-effort normalisation.
 */
export async function normalizeImageForVision(
  inputBuffer: Buffer,
  inputMime: string,
): Promise<NormalizeResult> {
  return encodeWithSharp(inputBuffer, inputMime, {
    maxLongEdge: MAX_LONG_EDGE,
    format: "jpeg",
  });
}

/**
 * Last-resort re-encode for when Groq Vision rejects our normalised
 * output with "invalid image data". Smaller resolution + PNG codec
 * sidesteps any remaining JPEG-quirk-based rejections.
 */
export async function renormalizeForVisionFallback(
  inputBuffer: Buffer,
  inputMime: string,
): Promise<NormalizeResult> {
  return encodeWithSharp(inputBuffer, inputMime, {
    maxLongEdge: FALLBACK_LONG_EDGE,
    format: "png",
  });
}

async function encodeWithSharp(
  inputBuffer: Buffer,
  inputMime: string,
  opts: EncodeOpts,
): Promise<NormalizeResult> {
  try {
    // v15.3: HEIC/HEIF pre-convert. Vercel's pre-built sharp binary has
    // no libheif, so sharp().metadata() throws on iPhone photos. Detect
    // by magic bytes (mime is unreliable across platforms) and convert
    // to JPEG via heic-convert before sharp ever sees the buffer.
    const heicByMagic = isHeicBuffer(inputBuffer);
    const heicByMime = /heic|heif/i.test(inputMime);
    let workingBuffer = inputBuffer;
    let preConverted = false;
    if (heicByMagic || heicByMime) {
      const jpeg = await heicToJpegBuffer(inputBuffer);
      if (jpeg) {
        workingBuffer = jpeg;
        preConverted = true;
        console.warn(
          `[image-normalize] HEIC → JPEG pre-convert: ${inputBuffer.length} → ${jpeg.length} bytes`,
        );
      } else {
        // Conversion failed — surface a hard error so the OCR layer can
        // catch and message the user, rather than silently shipping
        // undecodable bytes to Groq.
        throw new Error("HEIC_CONVERT_FAILED");
      }
    }

    const pipeline = sharp(workingBuffer, { failOn: "none" });
    const meta = await pipeline.metadata();
    const originalWidth = meta.width ?? 0;
    const originalHeight = meta.height ?? 0;
    const longEdge = Math.max(originalWidth, originalHeight);
    const needsResize = longEdge > opts.maxLongEdge;

    // Always re-encode: rotate to honour EXIF, then strip; flatten any
    // alpha to white (Groq sometimes chokes on RGBA); force sRGB so we
    // never ship Display P3 / Adobe-RGB / CMYK. Metadata is stripped by
    // default in sharp unless `withMetadata(true)` is set.
    let processed = pipeline
      .rotate()
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .toColorspace("srgb");

    if (needsResize) {
      processed = processed.resize({
        width: longEdge === originalWidth ? opts.maxLongEdge : undefined,
        height: longEdge === originalHeight ? opts.maxLongEdge : undefined,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    const buffer =
      opts.format === "jpeg"
        ? await processed
            .jpeg({
              quality: JPEG_QUALITY,
              mozjpeg: false, // plain libjpeg-turbo — Groq parses this reliably
              progressive: false, // baseline only
              chromaSubsampling: "4:2:0", // the safe default
            })
            .toBuffer()
        : await processed
            .png({ compressionLevel: 9, palette: false })
            .toBuffer();

    const outWidth = needsResize ? Math.min(originalWidth, opts.maxLongEdge) : originalWidth;
    const outHeight = needsResize ? Math.min(originalHeight, opts.maxLongEdge) : originalHeight;

    return {
      buffer,
      mimeType: opts.format === "png" ? "image/png" : "image/jpeg",
      width: outWidth,
      height: outHeight,
      bytes: buffer.length,
      // Preserve true source format — sharp's meta.format reports "jpeg"
      // on the heic-converted intermediate, which would hide the fact
      // that the upload was HEIC.
      sourceFormat: preConverted ? "heic" : meta.format ?? "unknown",
      sourceSpace: meta.space ?? "unknown",
      sourceChannels: meta.channels ?? 0,
      resized: needsResize,
    };
  } catch {
    // Sharp couldn't process it — return original as-is, mark mime jpeg
    // so the data-URL still gets a recognisable scheme. Groq will likely
    // fail on truly-corrupt input but that's a separate error to surface.
    return {
      buffer: inputBuffer,
      mimeType: "image/jpeg",
      width: 0,
      height: 0,
      bytes: inputBuffer.length,
      sourceFormat: inputMime,
      sourceSpace: "unknown",
      sourceChannels: 0,
      resized: false,
    };
  }
}
