/**
 * Minimal type declaration for `heic-convert` (pure-JS HEIC → JPEG/PNG
 * decoder built on a wasm libheif port). The package itself ships no
 * .d.ts; this stub is just enough for our single call site in
 * lib/image-normalize.ts.
 */
declare module "heic-convert" {
  type ConvertOptions = {
    buffer: Buffer | ArrayBuffer | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number; // 0..1, JPEG only
  };
  function convert(opts: ConvertOptions): Promise<ArrayBuffer>;
  export default convert;
}
