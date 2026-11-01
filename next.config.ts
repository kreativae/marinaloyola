import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança em todas as páginas:
 * - ninguém pode abrir a plataforma dentro de um iframe noutro site (clickjacking);
 * - formulários só enviam para o próprio domínio e não há <base> nem plugins;
 * - o browser não adivinha tipos de ficheiro e só usa HTTPS depois da primeira visita.
 * As pré-visualizações do site e dos links (iframes do próprio domínio) continuam a funcionar.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microfone para gravar áudios no WhatsApp; Face ID para as chaves de acesso
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self), publickey-credentials-get=(self), publickey-credentials-create=(self)",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Anexos dos cursos são enviados por server action (limite em src/lib/files.ts)
    serverActions: { bodySizeLimit: "52mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Áreas privadas fora dos motores de busca
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/aluno/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/login", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
