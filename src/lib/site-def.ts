import {
  Award,
  BookOpen,
  Compass,
  Crown,
  Gem,
  Heart,
  HeartHandshake,
  Layers,
  Lightbulb,
  MonitorPlay,
  Palette,
  PenTool,
  Rocket,
  Ruler,
  Sparkles,
  Star,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Conteúdo editável do site público: cada página tem SEO e blocos (secções) com campos.
 * SITE_PAGES descreve o formulário do editor; SITE_DEFAULTS tem o texto original de cada campo
 * (as chaves têm de coincidir). O que for guardado no backoffice sobrepõe-se aos valores por omissão.
 *
 * Nos títulos, *texto entre asteriscos* fica em itálico com a cor da marca e cada linha nova é uma quebra.
 */

export const SITE_ICONS: Record<string, LucideIcon> = {
  users: Users,
  sparkles: Sparkles,
  monitor: MonitorPlay,
  gem: Gem,
  ruler: Ruler,
  handshake: HeartHandshake,
  award: Award,
  star: Star,
  palette: Palette,
  pen: PenTool,
  target: Target,
  rocket: Rocket,
  lightbulb: Lightbulb,
  book: BookOpen,
  heart: Heart,
  compass: Compass,
  crown: Crown,
  layers: Layers,
};

export type FieldType = "text" | "title" | "textarea" | "image" | "url" | "icon" | "toggle" | "list" | "strings";

export type SiteField = {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  /** Campos de cada item (type "list"). */
  fields?: SiteField[];
  /** Nome de um item, para o botão "Adicionar …" (listas). */
  item?: string;
  /** Ocupa meia largura no editor. */
  half?: boolean;
};

export type SiteSection = { id: string; label: string; description?: string; fields: SiteField[] };

export type SitePageDef = {
  id: SitePageId;
  label: string;
  path: string;
  description: string;
  /** Blocos com posição fixa (sem esconder nem reordenar). */
  fixed?: boolean;
  seo?: boolean;
  sections: SiteSection[];
};

/* -------------------------------- AJUDANTES ------------------------------- */

const t = (key: string, label: string, extra?: Partial<SiteField>): SiteField => ({ key, label, type: "text", ...extra });
const title = (key = "title", label = "Título"): SiteField => ({
  key,
  label,
  type: "title",
  hint: "Use *asteriscos* para o destaque em itálico e Enter para mudar de linha.",
});
const area = (key: string, label: string, hint?: string): SiteField => ({ key, label, type: "textarea", hint });
const img = (key = "image", label = "Imagem"): SiteField => ({ key, label, type: "image" });
const url = (key: string, label: string, extra?: Partial<SiteField>): SiteField => ({
  key,
  label,
  type: "url",
  hint: "Página do site (/agendar), link externo (https://…) ou email (mailto:).",
  ...extra,
});
const strings = (key: string, label: string, item: string): SiteField => ({ key, label, type: "strings", item });
const list = (key: string, label: string, item: string, fields: SiteField[]): SiteField => ({ key, label, type: "list", item, fields });
const kicker = t("kicker", "Sobretítulo", { hint: "Texto pequeno acima do título." });
const button = (n: string, label: string) => [t(`${n}Label`, `${label} — texto`, { half: true }), url(`${n}Href`, `${label} — link`, { half: true, hint: undefined })];

/* -------------------------------- PÁGINAS --------------------------------- */

export const SITE_PAGES: SitePageDef[] = [
  {
    id: "geral",
    label: "Geral",
    path: "/",
    description: "Cabeçalho, menu, rodapé e botão de WhatsApp — aparecem em todas as páginas.",
    fixed: true,
    sections: [
      {
        id: "header",
        label: "Cabeçalho e menu",
        fields: [
          t("brand", "Nome da marca", { half: true }),
          t("brandTag", "Assinatura", { half: true }),
          list("nav", "Menu", "item", [t("label", "Texto", { half: true }), url("href", "Link", { half: true, hint: undefined })]),
          ...button("cta", "Botão de destaque"),
        ],
      },
      {
        id: "footer",
        label: "Rodapé",
        fields: [
          area("about", "Texto de apresentação"),
          url("instagram", "Instagram", { half: true, hint: undefined }),
          url("linkedin", "LinkedIn", { half: true, hint: undefined }),
          t("bottom", "Linha final", { hint: "Aparece depois de “© ano”." }),
        ],
      },
      {
        id: "whatsapp",
        label: "Botão flutuante de WhatsApp",
        description: "O número vem de Configurações → Geral.",
        fields: [
          { key: "show", label: "Mostrar o botão em todas as páginas", type: "toggle" },
          area("message", "Mensagem pré-escrita"),
        ],
      },
    ],
  },
  {
    id: "inicio",
    label: "Início",
    path: "/",
    description: "A página principal do site.",
    seo: true,
    sections: [
      {
        id: "hero",
        label: "Destaque principal",
        fields: [
          kicker,
          title(),
          area("text", "Texto"),
          ...button("cta1", "Botão principal"),
          ...button("cta2", "Botão secundário"),
          list("stats", "Números", "número", [t("value", "Valor", { half: true }), t("label", "Legenda", { half: true })]),
          img("image", "Foto"),
          t("imageName", "Nome sobre a foto", { half: true }),
          t("imageRole", "Legenda sobre a foto", { half: true }),
        ],
      },
      { id: "marquee", label: "Faixa animada", fields: [strings("items", "Palavras", "palavra")] },
      {
        id: "services",
        label: "Serviços",
        fields: [
          kicker,
          title(),
          ...button("cta", "Botão"),
          list("items", "Cartões", "cartão", [
            { key: "icon", label: "Ícone", type: "icon", half: true },
            t("n", "Número", { half: true }),
            t("title", "Título"),
            area("desc", "Descrição"),
            t("cta", "Texto do link", { half: true }),
            url("href", "Link", { half: true, hint: undefined }),
          ]),
        ],
      },
      {
        id: "method",
        label: "O método",
        fields: [kicker, title(), list("items", "Etapas", "etapa", [t("n", "Numeração", { half: true }), t("title", "Título", { half: true }), area("desc", "Descrição")])],
      },
      {
        id: "testimonials",
        label: "Depoimentos",
        fields: [kicker, title(), list("items", "Depoimentos", "depoimento", [area("quote", "Depoimento"), t("name", "Nome", { half: true }), t("role", "Profissão · cidade", { half: true })])],
      },
      {
        id: "featured",
        label: "Curso em destaque",
        fields: [img(), kicker, title(), area("text", "Texto"), strings("bullets", "Pontos", "ponto"), ...button("cta", "Botão")],
      },
      {
        id: "newsletter",
        label: "Newsletter",
        description: "Quem se inscreve entra nos Contactos com a etiqueta “Newsletter”.",
        fields: [title(), area("text", "Texto"), t("button", "Texto do botão"), t("successTitle", "Mensagem de sucesso — título"), area("successText", "Mensagem de sucesso — texto")],
      },
      { id: "cta", label: "Chamada final", fields: [title(), area("text", "Texto"), ...button("cta1", "Botão principal"), ...button("cta2", "Botão secundário")] },
    ],
  },
  {
    id: "sobre",
    label: "Sobre",
    path: "/sobre",
    description: "A história e os valores da Marina.",
    seo: true,
    sections: [
      {
        id: "intro",
        label: "Apresentação",
        fields: [
          kicker,
          title(),
          img("image", "Foto"),
          area("quote", "Citação"),
          t("quoteAuthor", "Autora da citação"),
          area("lead", "Parágrafo de abertura"),
          area("body", "Texto", "Deixe uma linha em branco entre parágrafos."),
          ...button("cta1", "Botão principal"),
          ...button("cta2", "Botão secundário"),
        ],
      },
      {
        id: "timeline",
        label: "Trajetória",
        fields: [kicker, title(), list("items", "Marcos", "marco", [t("year", "Ano", { half: true }), t("title", "Título", { half: true }), area("text", "Texto")])],
      },
      {
        id: "values",
        label: "Valores",
        fields: [
          kicker,
          title(),
          list("items", "Valores", "valor", [{ key: "icon", label: "Ícone", type: "icon", half: true }, t("title", "Título", { half: true }), area("text", "Texto")]),
        ],
      },
    ],
  },
  {
    id: "mentoria",
    label: "Mentoria",
    path: "/mentoria",
    description: "A página de venda da mentoria 1:1.",
    seo: true,
    sections: [
      {
        id: "hero",
        label: "Destaque",
        fields: [
          kicker,
          title(),
          area("text", "Texto"),
          t("waLabel", "Botão WhatsApp — texto"),
          area("waMessage", "Botão WhatsApp — mensagem pré-escrita"),
          ...button("cta2", "Botão secundário"),
        ],
      },
      {
        id: "offer",
        label: "Para quem é e formato",
        fields: [
          t("forWhomTitle", "Título — para quem é"),
          strings("forWhom", "Para quem é", "ponto"),
          t("formatTitle", "Título — formato"),
          strings("format", "Formato", "ponto"),
          t("priceLabel", "Etiqueta do preço", { half: true }),
          t("price", "Preço", { half: true }),
          t("priceNote", "Nota do preço", { hint: "Ex.: ou 3 × 620€" }),
        ],
      },
      {
        id: "program",
        label: "O programa",
        fields: [kicker, title(), list("items", "Fases", "fase", [t("phase", "Período", { half: true }), t("title", "Título", { half: true }), area("text", "Texto")])],
      },
      { id: "faq", label: "Perguntas frequentes", fields: [kicker, title(), list("items", "Perguntas", "pergunta", [t("q", "Pergunta"), area("a", "Resposta")])] },
      { id: "cta", label: "Chamada final", fields: [title(), area("text", "Texto"), ...button("cta", "Botão")] },
    ],
  },
  {
    id: "cursos",
    label: "Cursos",
    path: "/cursos",
    description: "Lista de cursos e workshops publicados.",
    seo: true,
    sections: [
      { id: "hero", label: "Destaque", fields: [kicker, title(), area("text", "Texto")] },
      {
        id: "list",
        label: "Lista de cursos",
        description: "Os cursos (foto, título, preço, link) editam-se em Cursos & LMS.",
        fields: [t("priceLabel", "Etiqueta do preço", { half: true }), t("button", "Texto do botão", { half: true }), t("note", "Nota abaixo do botão")],
      },
      { id: "guarantee", label: "Garantia", fields: [t("title", "Título"), area("text", "Texto"), strings("bullets", "Pontos", "ponto")] },
      { id: "cta", label: "Chamada final", fields: [title(), area("text", "Texto"), ...button("cta", "Botão")] },
    ],
  },
  {
    id: "contato",
    label: "Contacto",
    path: "/contato",
    description: "Formulário e canais de contacto.",
    fixed: true,
    seo: true,
    sections: [
      { id: "hero", label: "Destaque", fields: [kicker, title(), area("text", "Texto")] },
      {
        id: "form",
        label: "Formulário",
        description: "Cada mensagem entra nos Contactos com a etiqueta “Contacto Site”.",
        fields: [strings("subjects", "Assuntos", "assunto"), t("button", "Texto do botão"), t("successTitle", "Mensagem de sucesso — título"), area("successText", "Mensagem de sucesso — texto")],
      },
      {
        id: "channels",
        label: "Canais",
        description: "O número de WhatsApp e o email vêm de Configurações → Geral.",
        fields: [
          t("waTitle", "WhatsApp — título", { half: true }),
          t("waText", "WhatsApp — texto", { half: true }),
          area("waMessage", "WhatsApp — mensagem pré-escrita"),
          t("emailTitle", "Email — título"),
          t("locationTitle", "Localização — título", { half: true }),
          t("locationText", "Localização — texto", { half: true }),
          t("bookTitle", "Agendar — título", { half: true }),
          t("bookText", "Agendar — texto", { half: true }),
          t("social", "Redes sociais"),
        ],
      },
    ],
  },
  {
    id: "agendar",
    label: "Agendar",
    path: "/agendar",
    description: "Agenda online. Os tipos de sessão e horários editam-se na Agenda.",
    fixed: true,
    seo: true,
    sections: [{ id: "hero", label: "Destaque", fields: [kicker, title(), area("text", "Texto"), area("empty", "Mensagem sem agenda disponível")] }],
  },
  {
    id: "legal",
    label: "Legal",
    path: "/legal",
    description: "Política de privacidade e termos.",
    seo: true,
    sections: [
      { id: "intro", label: "Cabeçalho", fields: [kicker, title(), t("updated", "Linha de actualização")] },
      { id: "privacy", label: "Privacidade", fields: [t("title", "Título"), list("items", "Cláusulas", "cláusula", [t("t", "Título"), area("p", "Texto")])] },
      { id: "terms", label: "Termos", fields: [t("title", "Título"), list("items", "Cláusulas", "cláusula", [t("t", "Título"), area("p", "Texto")])] },
    ],
  },
];

/* ---------------------------- TEXTO ORIGINAL ------------------------------ */

export const SITE_DEFAULTS = {
  geral: {
    seo: { title: "", description: "" },
    header: {
      brand: "Marina Loyola",
      brandTag: "Design & Mentoria",
      nav: [
        { label: "Início", href: "/" },
        { label: "Sobre", href: "/sobre" },
        { label: "Mentoria", href: "/mentoria" },
        { label: "Cursos", href: "/cursos" },
        { label: "Contacto", href: "/contato" },
      ],
      ctaLabel: "Agendar",
      ctaHref: "/agendar",
    },
    footer: {
      about:
        "Design com estratégia, marcas com alma. Mentoria, workshops e cursos para designers que querem construir um negócio criativo sólido e sofisticado.",
      instagram: "https://instagram.com/marinaloyola",
      linkedin: "https://linkedin.com/in/marinaloyola",
      bottom: "Marina Loyola · marinaloyola.com · Todos os direitos reservados · RGPD compliant",
    },
    whatsapp: { show: "1", message: "Olá Marina! Vim do site e gostaria de mais informações." },
  },
  inicio: {
    seo: { title: "", description: "" },
    hero: {
      kicker: "Mentoria · Workshops · Cursos online",
      title: "Design com\nassinatura.\n*Negócio com alma.*",
      text: "Ajudo designers ambiciosas a transformar talento em posicionamento premium — marcas que cobram o que valem, com elegância, método e estratégia.",
      cta1Label: "Agendar sessão exploratória",
      cta1Href: "/agendar",
      cta2Label: "Conhecer a mentoria",
      cta2Href: "/mentoria",
      stats: [
        { value: "12+", label: "anos de estúdio" },
        { value: "400+", label: "alunas mentoradas" },
        { value: "97%", label: "de satisfação" },
      ],
      image: "/img/marina-hero.jpg",
      imageName: "Marina Loyola",
      imageRole: "Designer · Mentora · Lisboa",
    },
    marquee: {
      items: ["Mentoria 1:1", "Identidade Visual", "Branding", "Posicionamento Premium", "Workshops ao vivo", "Cursos Online", "Portfólio", "Design de Marca"],
    },
    services: {
      kicker: "Como posso ajudar",
      title: "Três caminhos, um só destino: *o seu próximo nível.*",
      ctaLabel: "Falar comigo",
      ctaHref: "/contato",
      items: [
        {
          icon: "users",
          n: "01",
          title: "Mentoria 1:1",
          desc: "Doze semanas de acompanhamento próximo para redesenhar o seu posicionamento, portfólio e preços — com sessões semanais e suporte direto no WhatsApp.",
          cta: "Conhecer a mentoria",
          href: "/mentoria",
        },
        {
          icon: "sparkles",
          n: "02",
          title: "Workshops ao vivo",
          desc: "Sessões intensivas e práticas sobre identidade visual, branding e apresentação de projetos. Vagas limitadas, trabalho real, feedback direto.",
          cta: "Ver próximos workshops",
          href: "/cursos",
        },
        {
          icon: "monitor",
          n: "03",
          title: "Cursos online",
          desc: "Programas gravados para fazer ao seu ritmo, com módulos, materiais de apoio, quizzes e certificado de conclusão na área de aluna.",
          cta: "Explorar cursos",
          href: "/cursos",
        },
      ],
    },
    method: {
      kicker: "O método",
      title: "Um percurso desenhado como uma *boa grelha tipográfica.*",
      items: [
        { n: "I", title: "Diagnóstico", desc: "Auditoria honesta da sua marca, do seu portfólio e do modelo de negócio atual." },
        { n: "II", title: "Identidade", desc: "Uma linguagem visual com assinatura própria: tipografia, cor, ritmo e detalhe." },
        { n: "III", title: "Posicionamento", desc: "Nicho, mensagem e preços premium. O mercado passa a perceber o seu valor." },
        { n: "IV", title: "Expansão", desc: "Rotinas de marketing e vendas com consistência — o crescimento deixa de ser acaso." },
      ],
    },
    testimonials: {
      kicker: "Vozes de quem passou por aqui",
      title: "Resultados com *assinatura.*",
      items: [
        {
          quote: "Em três meses dupliquei o valor dos meus projetos. A Marina não ensina só design — ensina a pensar o negócio com elegância.",
          name: "Sofia Andrade",
          role: "Designer · Lisboa",
        },
        {
          quote:
            "O workshop de identidade visual mudou completamente a forma como apresento propostas. Passei a ser escolhida pelo valor, não pelo preço.",
          name: "Inês Marques",
          role: "Fundadora · Estúdio Meridional",
        },
        {
          quote: "A mentoria é cirúrgica. Cada sessão termina com decisões claras. O meu posicionamento nunca foi tão sólido — e tão meu.",
          name: "Beatriz Lemos",
          role: "Brand Designer · Porto",
        },
      ],
    },
    featured: {
      image: "/img/curso-marca.jpg",
      kicker: "Curso em destaque",
      title: "Identidade com *Assinatura*",
      text: "O programa completo para construir identidades visuais premium — da estratégia à apresentação final — com o método que uso há 12 anos no estúdio.",
      bullets: [
        "3 módulos · 9 aulas em vídeo",
        "Materiais, templates e exercícios",
        "Quiz por módulo e certificado de conclusão",
        "Acesso imediato na área de aluna após a compra",
      ],
      ctaLabel: "Ver cursos e inscrições",
      ctaHref: "/cursos",
    },
    newsletter: {
      title: "O Dossiê — *cartas sobre design e negócio.*",
      text: "Receba o guia gratuito “5 erros que tornam o seu portfólio invisível” e, a cada duas semanas, uma carta com bastidores, método e estratégia.",
      button: "Quero receber",
      successTitle: "Inscrição confirmada.",
      successText: "Verifique o seu email — o guia está a caminho. Obrigada por estar desse lado.",
    },
    cta: {
      title: "Pronta para desenhar o *próximo capítulo?*",
      text: "Agende uma sessão exploratória gratuita de 30 minutos. Sem compromisso — apenas clareza sobre o seu caminho.",
      cta1Label: "Agendar agora",
      cta1Href: "/agendar",
      cta2Label: "Explorar cursos",
      cta2Href: "/cursos",
    },
  },
  sobre: {
    seo: {
      title: "Sobre",
      description: "A trajetória de Marina Loyola: 12 anos de estúdio, centenas de marcas desenhadas e uma missão — elevar o design português a premium.",
    },
    intro: {
      kicker: "Sobre mim",
      title: "Olá, sou a Marina. Desenho marcas — e *carreiras.*",
      image: "/img/marina-sobre.jpg",
      quote: "O design é 20% estética e 80% decisões. Eu ensino as decisões.",
      quoteAuthor: "Marina Loyola",
      lead: "Há 12 anos que desenho identidades visuais para marcas que querem ser levadas a sério. Há 7 que ensino outras designers a fazer o mesmo — com método, coragem e preços justos.",
      body: [
        "Comecei como tantas de vocês: portfólio improvisado, clientes que negociavam cada euro e a sensação permanente de que faltava alguma coisa que ninguém ensina na faculdade. Faltava — e não era talento. Era posicionamento, processo e apresentação.",
        "Depois de centenas de projetos de branding, condensei tudo num método próprio que hoje partilho em mentorias individuais, workshops intensivos e cursos online. Mais de 400 designers já passaram por estes programas e transformaram a relação com o seu trabalho — e com os seus clientes.",
        "Acredito num design português que cobra o que vale, que tem assinatura e que não pede desculpa pela ambição. Se é isso que procura, estamos no mesmo caminho.",
      ].join("\n\n"),
      cta1Label: "Trabalhar comigo",
      cta1Href: "/mentoria",
      cta2Label: "Agendar conversa",
      cta2Href: "/agendar",
    },
    timeline: {
      kicker: "Trajetória",
      title: "Uma década a desenhar *o essencial.*",
      items: [
        { year: "2013", title: "O começo", text: "Licenciatura em Design de Comunicação e os primeiros projetos de identidade visual para marcas locais." },
        { year: "2016", title: "Estúdio próprio", text: "Nasce o estúdio Marina Loyola. Primeiros clientes internacionais e a especialização em branding premium." },
        { year: "2019", title: "A viragem para o ensino", text: "Primeira turma de mentoria. Percebo que ensinar designers a valorizar o seu trabalho é a minha missão." },
        { year: "2022", title: "Workshops e cursos", text: "Lançamento dos programas online. Mais de 400 alunas passam pelos cursos e mentorias." },
        { year: "2026", title: "A plataforma", text: "Tudo reunido num só ecossistema: cursos, mentoria, comunidade e acompanhamento personalizado." },
      ],
    },
    values: {
      kicker: "Valores",
      title: "Aquilo em que acredito — *e ensino.*",
      items: [
        { icon: "gem", title: "Elegância acima do ruído", text: "Menos, mas impecável. O bom design é silencioso e impossível de ignorar ao mesmo tempo." },
        { icon: "ruler", title: "Método antes do talento", text: "Intuição treina-se. Processos claros libertam a criatividade em vez de a prender." },
        { icon: "handshake", title: "Generosidade radical", text: "Ensino tudo o que sei, sem reservas. O sucesso das minhas alunas é o meu portfólio." },
        { icon: "award", title: "Excelência discreta", text: "Premium não é arrogância. É consistência, detalhe e respeito pelo ofício." },
      ],
    },
  },
  mentoria: {
    seo: {
      title: "Mentoria 1:1",
      description: "Mentoria individual de 12 semanas para designers: posicionamento, portfólio, preços premium e um negócio criativo sustentável.",
    },
    hero: {
      kicker: "Mentoria 1:1 · 12 semanas",
      title: "Mentoria *Design Business*",
      text: "Três meses de acompanhamento individual para transformar a sua prática de design num negócio premium, sustentável e com assinatura própria.",
      waLabel: "Candidatar via WhatsApp",
      waMessage: "Olá Marina! Quero candidatar-me à Mentoria Design Business.",
      cta2Label: "Sessão exploratória gratuita",
      cta2Href: "/agendar",
    },
    offer: {
      forWhomTitle: "Para quem é",
      forWhom: [
        "Designers freelancers que querem cobrar mais e escolher melhor os clientes",
        "Profissionais em transição para branding e identidade visual",
        "Fundadoras de estúdio que precisam de posicionamento e processo",
        "Quem sente que o talento já lá está — falta a estratégia",
      ],
      formatTitle: "O formato",
      format: [
        "12 sessões individuais de 60 minutos via Zoom",
        "Suporte direto no WhatsApp entre sessões",
        "Templates, scripts e materiais de trabalho",
        "Plano de 90 dias desenhado consigo",
        "Apenas 6 vagas em simultâneo",
      ],
      priceLabel: "Investimento",
      price: "1.800€",
      priceNote: "ou 3 × 620€",
    },
    program: {
      kicker: "O programa",
      title: "Doze semanas, *quatro movimentos.*",
      items: [
        { phase: "Semanas 1–3", title: "Diagnóstico & Fundação", text: "Auditoria completa do seu negócio criativo: portfólio, preços, clientes e mensagem. Definimos o destino." },
        { phase: "Semanas 4–6", title: "Identidade & Assinatura", text: "A sua linguagem visual e editorial refinada até ser inconfundível. Do moodboard à apresentação." },
        { phase: "Semanas 7–9", title: "Posicionamento & Preço", text: "Nicho, proposta de valor e tabela de preços premium. Aprende a dizer o valor sem hesitar." },
        { phase: "Semanas 10–12", title: "Vendas & Expansão", text: "Rotinas de marketing, scripts de proposta e um plano de 90 dias para crescer com consistência." },
      ],
    },
    faq: {
      kicker: "Perguntas frequentes",
      title: "Antes de dizer *sim.*",
      items: [
        {
          q: "Como funcionam as sessões?",
          a: "Sessões semanais de 60 minutos via Zoom, com gravação e notas partilhadas. Entre sessões, tem acesso direto a mim via WhatsApp para dúvidas e feedback.",
        },
        {
          q: "Qual é o investimento?",
          a: "O programa completo de 12 semanas tem o valor de 1.800€, com possibilidade de pagamento faseado em 3x. Em Portugal aceito transferência ou MBWay; fora de Portugal, via Hotmart em qualquer moeda.",
        },
        {
          q: "E se não for o momento certo?",
          a: "A sessão exploratória existe exatamente para isso: 30 minutos gratuitos para percebermos juntas se a mentoria é o próximo passo certo para si.",
        },
        { q: "Quantas vagas existem?", a: "A trabalhar apenas com 6 mentorandas em simultâneo, para garantir profundidade real em cada acompanhamento." },
      ],
    },
    cta: {
      title: "A próxima vaga pode ser *a sua.*",
      text: "Comece com uma sessão exploratória gratuita e saia com clareza — tenha ou não lugar na mentoria.",
      ctaLabel: "Agendar sessão",
      ctaHref: "/agendar",
    },
  },
  cursos: {
    seo: {
      title: "Cursos & Workshops",
      description: "Cursos online e workshops ao vivo de identidade visual, branding e negócio criativo. Inscrições com pagamento seguro via Hotmart.",
    },
    hero: {
      kicker: "Formação",
      title: "Cursos & *workshops.*",
      text: "Programas desenhados ao milímetro para designers que querem subir de nível — com materiais, exercícios, quizzes e certificado, na sua área de aluna.",
    },
    list: { priceLabel: "Investimento", button: "Inscrever na Hotmart", note: "Pagamento seguro · acesso imediato à área de aluna" },
    guarantee: {
      title: "Garantia incondicional de 7 dias",
      text: "Todos os cursos têm garantia total via Hotmart. Se não for para si, devolvemos o investimento — sem perguntas, sem letras pequenas.",
      bullets: ["Acesso vitalício", "Certificado incluído", "Suporte por email"],
    },
    cta: {
      title: "Prefere um acompanhamento *mais próximo?*",
      text: "A mentoria 1:1 é o caminho mais rápido: 12 semanas, sessões semanais e um plano desenhado para o seu momento.",
      ctaLabel: "Conhecer a mentoria",
      ctaHref: "/mentoria",
    },
  },
  contato: {
    seo: { title: "Contacto", description: "Fale com Marina Loyola: formulário, WhatsApp direto ou email. Resposta em menos de 24 horas úteis." },
    hero: {
      kicker: "Contacto",
      title: "Vamos *conversar.*",
      text: "Resposta em menos de 24 horas úteis. Escolha o canal que lhe for mais confortável — ou escreva diretamente pelo formulário.",
    },
    form: {
      subjects: ["Mentoria 1:1", "Workshops & Cursos", "Parcerias & Imprensa", "Outro assunto"],
      button: "Enviar mensagem",
      successTitle: "Mensagem recebida.",
      successText: "Obrigada pelo contacto — responderei em menos de 24 horas úteis. Entretanto, pode acompanhar o trabalho no Instagram.",
    },
    channels: {
      waTitle: "WhatsApp direto",
      waText: "O canal mais rápido — resposta no próprio dia.",
      waMessage: "Olá Marina! Gostaria de falar consigo.",
      emailTitle: "Email",
      locationTitle: "Lisboa, Portugal",
      locationText: "Sessões online para todo o mundo.",
      bookTitle: "Agendar diretamente",
      bookText: "Escolha data e hora em tempo real.",
      social: "@marinaloyola nas redes sociais",
    },
  },
  agendar: {
    seo: {
      title: "Agendar sessão",
      description:
        "Agende uma sessão exploratória, mentoria ou workshop com Marina Loyola. Disponibilidade em tempo real, confirmação imediata e link Zoom automático.",
    },
    hero: {
      kicker: "Agenda online",
      title: "Escolha o momento. *O resto é comigo.*",
      text: "Disponibilidade em tempo real. A confirmação chega por email e WhatsApp com o link do Zoom — e os lembretes também.",
      empty: "A agenda está temporariamente indisponível. Fale comigo pelo WhatsApp.",
    },
  },
  legal: {
    seo: { title: "Privacidade & Termos", description: "Política de privacidade (RGPD) e termos e condições de utilização do site marinaloyola.com." },
    intro: { kicker: "Informação legal", title: "Privacidade *& Termos*", updated: "Última atualização: janeiro de 2026 · marinaloyola.com" },
    privacy: {
      title: "Política de Privacidade",
      items: [
        {
          t: "1. Responsável pelo tratamento",
          p: "Marina Loyola (doravante “a Responsável”), com sede em Lisboa, Portugal, é a entidade responsável pelo tratamento dos dados pessoais recolhidos através deste site, em conformidade com o Regulamento Geral sobre a Proteção de Dados (RGPD — Regulamento (UE) 2016/679).",
        },
        {
          t: "2. Dados recolhidos e finalidades",
          p: "Recolhemos nome, email, telefone e mensagens enviadas através dos formulários de contacto, agendamento e subscrição de newsletter. Estes dados servem exclusivamente para responder a pedidos, gerir agendamentos, processar inscrições em cursos e mentorias e enviar comunicações de marketing quando consentidas.",
        },
        {
          t: "3. Base legal e conservação",
          p: "O tratamento baseia-se no consentimento do titular e/ou na execução de um contrato. Os dados são conservados apenas pelo período necessário às finalidades descritas ou até retirada do consentimento, podendo ser eliminados a qualquer momento mediante pedido para o email de contacto.",
        },
        {
          t: "4. Partilha com terceiros",
          p: "Os dados podem ser tratados por subcontratantes estritamente necessários à operação (Hotmart para pagamentos, Zoom para videoconferência, Google Calendar para agenda e fornecedor de email transacional), sempre sob obrigações de confidencialidade e segurança. Não vendemos dados a terceiros.",
        },
        {
          t: "5. Direitos do titular",
          p: "Nos termos do RGPD, tem direito de acesso, retificação, apagamento, limitação, portabilidade e oposição ao tratamento dos seus dados, bem como o direito de apresentar reclamação à CNPD (Comissão Nacional de Proteção de Dados).",
        },
        {
          t: "6. Cookies e rastreamento",
          p: "Este site pode utilizar cookies de análise e pixels de rastreamento (Meta Pixel, Google Analytics) para medir o desempenho de conteúdos e campanhas. Pode gerir o consentimento através do banner de cookies ou das definições do seu navegador.",
        },
      ],
    },
    terms: {
      title: "Termos e Condições",
      items: [
        {
          t: "1. Objeto",
          p: "Os presentes termos regulam a utilização do site marinaloyola.com e a aquisição de serviços de mentoria, workshops e cursos online disponibilizados por Marina Loyola.",
        },
        {
          t: "2. Compras via Hotmart",
          p: "As compras de cursos e workshops são processadas pela plataforma Hotmart, regendo-se pelos respetivos termos de utilização e política de reembolso, que inclui garantia incondicional de 7 dias para produtos digitais.",
        },
        {
          t: "3. Mentoria e agendamentos",
          p: "As sessões de mentoria são confirmadas após agendamento e pagamento. O reagendamento é gratuito até 12 horas antes da sessão; cancelamentos fora deste prazo poderão implicar a perda da sessão.",
        },
        {
          t: "4. Propriedade intelectual",
          p: "Todos os conteúdos, materiais, vídeos, textos e templates disponibilizados são propriedade de Marina Loyola e destinam-se a uso pessoal da aluna, sendo expressamente proibida a sua partilha, revenda ou reprodução.",
        },
        {
          t: "5. Acesso à área de aluna",
          p: "As credenciais de acesso são pessoais e intransmissíveis. A partilha de acessos poderá resultar na suspensão da conta sem direito a reembolso.",
        },
        {
          t: "6. Lei aplicável",
          p: "Os presentes termos regem-se pela lei portuguesa, sendo competente o foro da comarca de Lisboa para resolução de litígios, sem prejuízo dos direitos imperativos do consumidor.",
        },
      ],
    },
  },
};

export type SitePageId = keyof typeof SITE_DEFAULTS;
export type SiteDefaults = typeof SITE_DEFAULTS;

export type FieldValue = string | string[] | Record<string, string>[];
export type SectionValues = Record<string, FieldValue>;

/** Conteúdo de uma página, como o editor o guarda. */
export type StoredPage = {
  seo?: { title?: string; description?: string };
  order?: string[];
  hidden?: string[];
  sections?: Record<string, SectionValues>;
};

export const pageDef = (id: string) => SITE_PAGES.find((p) => p.id === id);
export const settingKey = (id: SitePageId) => `site_page_${id}`;
