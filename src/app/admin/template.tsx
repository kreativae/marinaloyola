import type { ReactNode } from "react";

// Remonta a cada mudança de página: entrada suave do conteúdo
export default function Template({ children }: { children: ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
