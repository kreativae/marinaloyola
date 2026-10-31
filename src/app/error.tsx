"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCw } from "lucide-react";
import { StatusScreen } from "@/components/status-screen";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      mood="broken"
      code={error.digest ? `Erro ${error.digest}` : "Erro"}
      title="Ups, algo correu mal."
      text="Não conseguimos carregar esta página agora. Tente outra vez daqui a um momento; se continuar, volte ao início."
    >
      <button type="button" onClick={reset} className="btn-primary">
        <RotateCw size={16} /> Tentar de novo
      </button>
      <Link href="/" className="btn-ghost">
        <Home size={16} /> Voltar à página inicial
      </Link>
    </StatusScreen>
  );
}
