import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import { StatusScreen } from "@/components/status-screen";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <StatusScreen
      mood="lost"
      code="Erro 404"
      title="Esta página perdeu-se."
      text="O endereço pode ter mudado ou já não existir. Volte ao início e encontre o que procura a partir daí."
    >
      <Link href="/" className="btn-primary">
        <Home size={16} /> Voltar à página inicial
      </Link>
      <Link href="/contato" className="btn-ghost">
        <ArrowLeft size={16} /> Falar connosco
      </Link>
    </StatusScreen>
  );
}
