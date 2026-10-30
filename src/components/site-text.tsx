import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { SITE_ICONS } from "@/lib/site-def";
import { cn } from "@/lib/utils";

/**
 * Peças para mostrar o conteúdo editável no site: títulos com destaque, parágrafos,
 * imagens (locais, enviadas pelo backoffice ou externas), links e a ordem dos blocos.
 */

/** "*texto*" fica em itálico com a cor da marca; cada linha nova é uma quebra. */
export function Rich({ text, em = "italic text-plum" }: { text: string; em?: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(/(\*[^*]+\*)/g).map((part, i) =>
            part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
              <span key={i} className={em}>
                {part.slice(1, -1)}
              </span>
            ) : (
              <Fragment key={i}>{part}</Fragment>
            )
          )}
        </Fragment>
      ))}
    </>
  );
}

/** Texto com parágrafos separados por linha em branco. */
export function Paras({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className={className}>
            {p}
          </p>
        ))}
    </>
  );
}

/** Link interno (navegação suave) ou externo (novo separador). */
export function Href({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (/^https?:\/\//i.test(href))
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  if (/^(mailto:|tel:)/i.test(href))
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  return (
    <Link href={href || "/"} className={className}>
      {children}
    </Link>
  );
}

/** Imagem do site: as de /img são optimizadas pelo Next; as enviadas ou externas são servidas tal como estão. */
export function SiteImg({ src, alt, className, width, height, priority }: { src: string; alt: string; className?: string; width: number; height: number; priority?: boolean }) {
  if (!src) return <div className={cn("bg-plum/10", className)} />;
  return <Image src={src} alt={alt} width={width} height={height} priority={priority} unoptimized={!src.startsWith("/img/")} className={className} />;
}

export function SiteIcon({ name, size, className }: { name: string; size: number; className?: string }) {
  const Icon = SITE_ICONS[name] ?? SITE_ICONS.sparkles;
  return <Icon size={size} className={className} />;
}

/** Mostra os blocos pela ordem escolhida no backoffice, sem os escondidos. */
export function Sections({ page, blocks }: { page: { order: string[]; hidden: string[] }; blocks: Record<string, () => ReactNode> }) {
  return (
    <>
      {page.order
        .filter((id) => blocks[id] && !page.hidden.includes(id))
        .map((id) => (
          <div key={id} id={`bloco-${id}`} className="scroll-mt-[72px]">
            {blocks[id]()}
          </div>
        ))}
    </>
  );
}
