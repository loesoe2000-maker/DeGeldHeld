/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    // Next.js 14: instrumentation.ts register() (which boots the Sentry
    // server/edge SDK) only runs when this hook is enabled. Without it the
    // server-side Sentry.init() never fires → captureException is a no-op
    // → events silently dropped. Stable+default in Next 15.
    instrumentationHook: true,
    // @napi-rs/canvas (gebruikt door lib/pdf_render.ts voor multi-page PDF
    // → PNG rendering) is een native .node binary. Webpack kan die niet
    // bundelen — markeer als external zodat 'm op de Vercel Node runtime
    // dynamisch wordt geladen i.p.v. in de bundle. Hetzelfde geldt voor
    // sharp en de pure-JS HEIC-decoder (libheif-js ships als wasm).
    serverComponentsExternalPackages: [
      "@napi-rs/canvas",
      "pdfjs-dist",
      "sharp",
      "heic-convert",
      "libheif-js",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Voorkom dat webpack probeert .node binaries te parsen.
      config.externals = config.externals || [];
      config.externals.push({
        "@napi-rs/canvas": "commonjs @napi-rs/canvas",
        sharp: "commonjs sharp",
      });
    }
    // Onderdruk de bekende "Critical dependency: require function is used in a
    // way which dependencies cannot be statically extracted" warning. Komt van
    // `require-in-the-middle` (gebruikt door @opentelemetry/instrumentation,
    // @sentry/node, @prisma/instrumentation). Het is een onvermijdelijke
    // dynamic-require die élk Next.js + Sentry-project genereert; de app
    // werkt prima. Onderdrukken = clean terminal voor development.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /require-in-the-middle/ },
      { module: /@opentelemetry\/instrumentation/ },
      { module: /@sentry\/node/ },
      { module: /@prisma\/instrumentation/ },
    ];
    return config;
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
