"use client";

import { Home, RotateCw } from "lucide-react";
import { StatusScreen } from "@/components/status-screen";
import "./globals.css";

/** Último recurso: substitui o layout principal quando é ele próprio que falha. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt">
      <body className="bg-white font-sans text-zinc-950 antialiased">
        <StatusScreen
          mood="broken"
          code={error.digest ? `Erro ${error.digest}` : "Erro"}
          title="Ups, algo correu mal."
          text="A plataforma não respondeu como devia. Tente outra vez daqui a um momento."
        >
          <button type="button" onClick={reset} className="btn-primary">
            <RotateCw size={16} /> Tentar de novo
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- recarrega por completo, sem depender do router */}
          <a href="/" className="btn-ghost">
            <Home size={16} /> Voltar à página inicial
          </a>
        </StatusScreen>
      </body>
    </html>
  );
}
