import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Fraunces, Manrope } from "next/font/google";
import { NavProgress } from "@/components/transitions";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://marinaloyola.com"),
  title: {
    default: "Marina Loyola — Design, Mentoria & Formação",
    template: "%s — Marina Loyola",
  },
  description:
    "Plataforma oficial de Marina Loyola: mentoria de design, workshops, cursos online e acompanhamento personalizado para designers que querem elevar a sua marca e o seu negócio.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt" data-scroll-behavior="smooth" className={`${display.variable} ${sans.variable}`}>
      <body className="bg-white font-sans text-zinc-950 antialiased">
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
