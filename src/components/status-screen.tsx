import type { ReactNode } from "react";
import Link from "next/link";

export type Mood = "lost" | "broken" | "sleepy";

/**
 * Boneco animado (SVG + CSS, sem dependências nem pedidos externos) para as páginas
 * de 404, erro e sessão terminada — continua a funcionar mesmo com o servidor em baixo.
 */
export function Mascot({ mood, className }: { mood: Mood; className?: string }) {
  const asleep = mood === "sleepy";
  return (
    <svg viewBox="0 0 260 240" className={className} role="img" aria-hidden="true">
      <style>{`
        .m-float{animation:m-float 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
        .m-shadow{animation:m-shadow 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
        .m-blink{animation:m-blink 4.6s infinite;transform-box:fill-box;transform-origin:center}
        .m-look{animation:m-look 6s ease-in-out infinite}
        .m-wave{animation:m-wave 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:10% 90%}
        .m-sign{animation:m-sign 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
        .m-twinkle{animation:m-twinkle 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
        .m-drop{animation:m-drop 2.2s ease-in infinite}
        .m-z{animation:m-z 3s ease-out infinite;opacity:0}
        .m-breathe{animation:m-breathe 3.6s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
        @keyframes m-float{50%{transform:translateY(-10px)}}
        @keyframes m-shadow{50%{transform:scale(.78);opacity:.45}}
        @keyframes m-blink{0%,44%,48%,100%{transform:scaleY(1)}46%{transform:scaleY(.1)}}
        @keyframes m-look{0%,20%{transform:translateX(0)}30%,45%{transform:translateX(-4px)}55%,70%{transform:translateX(4px)}80%,100%{transform:translateX(0)}}
        @keyframes m-wave{50%{transform:rotate(-22deg)}}
        @keyframes m-sign{50%{transform:rotate(-6deg)}}
        @keyframes m-twinkle{0%,100%{transform:scale(.4);opacity:.2}50%{transform:scale(1);opacity:1}}
        @keyframes m-drop{0%{transform:translateY(0);opacity:0}15%{opacity:1}80%{transform:translateY(16px);opacity:1}100%{transform:translateY(20px);opacity:0}}
        @keyframes m-z{0%{transform:translate(0,0) scale(.6);opacity:0}20%{opacity:1}100%{transform:translate(22px,-46px) scale(1.15);opacity:0}}
        @keyframes m-breathe{50%{transform:scale(1.03,.97)}}
        @media (prefers-reduced-motion:reduce){svg *{animation:none!important}}
      `}</style>
      <defs>
        <radialGradient id="m-body" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="55%" stopColor="#a21caf" />
          <stop offset="100%" stopColor="#5c005c" />
        </radialGradient>
      </defs>

      {/* brilhos de fundo */}
      <g fill="#c084fc">
        <path className="m-twinkle" d="M36 60l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
        <path className="m-twinkle" style={{ animationDelay: ".8s" }} d="M222 42l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
        <path className="m-twinkle" style={{ animationDelay: "1.5s" }} d="M214 150l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        <circle className="m-twinkle" style={{ animationDelay: "1.1s" }} cx="52" cy="160" r="3" />
      </g>

      <ellipse className="m-shadow" cx="130" cy="222" rx="54" ry="8" fill="#3b0764" opacity=".18" />

      <g className={asleep ? "" : "m-float"}>
        <g className={asleep ? "m-breathe" : ""}>
          {/* braço esquerdo */}
          <path d="M78 140c-16 4-24 14-22 24" stroke="#86198f" strokeWidth="11" strokeLinecap="round" fill="none" />

          {/* corpo */}
          <path
            d="M130 52c44 0 70 34 70 80 0 44-28 72-70 72s-70-28-70-72c0-46 26-80 70-80z"
            fill="url(#m-body)"
          />
          <ellipse cx="104" cy="82" rx="16" ry="9" fill="#fff" opacity=".28" transform="rotate(-24 104 82)" />
          {/* antena */}
          <path d="M130 52c0-14 6-22 14-26" stroke="#86198f" strokeWidth="5" strokeLinecap="round" fill="none" />
          <circle cx="146" cy="24" r="7" fill="#c084fc" />

          {/* olhos */}
          {asleep ? (
            <g stroke="#2e0530" strokeWidth="4.5" strokeLinecap="round" fill="none">
              <path d="M98 126q10 8 20 0" />
              <path d="M142 126q10 8 20 0" />
            </g>
          ) : (
            <g className="m-blink">
              <ellipse cx="108" cy="122" rx="15" ry="17" fill="#fff" />
              <ellipse cx="152" cy="122" rx="15" ry="17" fill="#fff" />
              <g className="m-look" fill="#2e0530">
                <circle cx={mood === "broken" ? 110 : 108} cy="125" r="7.5" />
                <circle cx={mood === "broken" ? 150 : 152} cy="125" r="7.5" />
                <circle cx="111" cy="121" r="2.4" fill="#fff" />
                <circle cx="155" cy="121" r="2.4" fill="#fff" />
              </g>
            </g>
          )}

          {/* bochechas */}
          <ellipse cx="90" cy="150" rx="9" ry="5" fill="#f9a8d4" opacity=".7" />
          <ellipse cx="170" cy="150" rx="9" ry="5" fill="#f9a8d4" opacity=".7" />

          {/* boca */}
          {mood === "lost" && <ellipse cx="130" cy="156" rx="7" ry="8" fill="#2e0530" />}
          {mood === "broken" && (
            <path d="M114 160q8-8 16 0t16 0" stroke="#2e0530" strokeWidth="4" strokeLinecap="round" fill="none" />
          )}
          {asleep && <ellipse cx="130" cy="156" rx="5" ry="4" fill="#2e0530" />}

          {/* braço direito: segura a placa (404 / erro) */}
          {!asleep && (
            <g className="m-wave">
              <path d="M186 140c14-6 22-20 22-34" stroke="#86198f" strokeWidth="11" strokeLinecap="round" fill="none" />
            </g>
          )}
        </g>

        {mood === "lost" && (
          <g className="m-sign">
            <path d="M208 108v-20" stroke="#a16207" strokeWidth="4" strokeLinecap="round" />
            <rect x="176" y="58" width="66" height="34" rx="9" fill="#fff" stroke="#e9d5ff" strokeWidth="2" />
            <text x="209" y="82" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontWeight="700" fontSize="20" fill="#800080">
              404
            </text>
          </g>
        )}
        {mood === "broken" && (
          <>
            <path className="m-drop" d="M178 88c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z" fill="#7dd3fc" />
            <g transform="rotate(-18 112 66)">
              <rect x="96" y="60" width="34" height="12" rx="6" fill="#fde68a" />
              <path d="M110 60v12M116 60v12" stroke="#f59e0b" strokeWidth="1.5" />
            </g>
          </>
        )}
      </g>

      {asleep && (
        <g fontFamily="Georgia, serif" fontStyle="italic" fontWeight="700" fill="#800080">
          <text className="m-z" x="176" y="92" fontSize="22">z</text>
          <text className="m-z" style={{ animationDelay: "1s" }} x="176" y="92" fontSize="18">z</text>
          <text className="m-z" style={{ animationDelay: "2s" }} x="176" y="92" fontSize="14">z</text>
        </g>
      )}
    </svg>
  );
}

/** Ecrã inteiro com o boneco, título, texto e botões. */
export function StatusScreen({
  mood,
  code,
  title,
  text,
  children,
}: {
  mood: Mood;
  code?: string;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-5 py-16 text-zinc-950">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(168_85_247/0.14),transparent_65%)]" />
      <div className="relative flex w-full max-w-md flex-col items-center text-center">
        <Link href="/" className="font-display text-2xl font-semibold italic text-zinc-950">
          Marina Loyola
        </Link>
        <Mascot mood={mood} className="mt-6 h-56 w-60 sm:h-64 sm:w-72" />
        {code && <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.32em] text-plum">{code}</p>}
        <h1 className="mt-3 font-display text-3xl font-medium italic leading-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-500">{text}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>
      </div>
    </main>
  );
}
