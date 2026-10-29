import type { Metadata } from "next";
import { Reveal } from "@/components/site";

export const metadata: Metadata = {
  title: "Privacidade & Termos",
  description:
    "Política de privacidade (RGPD) e termos e condições de utilização do site marinaloyola.com.",
};

const PRIVACY = [
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
];

const TERMS = [
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
];

export default function LegalPage() {
  return (
    <section className="bg-white pb-24 pt-16 text-zinc-950 lg:pt-24">
      <div className="mx-auto max-w-3xl px-5 lg:px-8">
        <Reveal>
          <p className="kicker flex items-center gap-3">
            <span className="h-px w-10 bg-plum-bright" /> Informação legal
          </p>
          <h1 className="mt-6 font-display text-5xl font-medium tracking-tight lg:text-6xl">
            Privacidade <span className="italic text-plum">& Termos</span>
          </h1>
          <p className="mt-5 text-sm text-zinc-500">
            Última atualização: janeiro de 2026 · marinaloyola.com
          </p>
        </Reveal>

        <Reveal delay={100}>
          <h2
            id="privacidade"
            className="mt-16 scroll-mt-28 font-display text-3xl italic text-plum"
          >
            Política de Privacidade
          </h2>
          <div className="mt-8 space-y-8">
            {PRIVACY.map((s) => (
              <div key={s.t}>
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-950">
                  {s.t}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">{s.p}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={140}>
          <h2
            id="termos"
            className="mt-20 scroll-mt-28 font-display text-3xl italic text-plum"
          >
            Termos e Condições
          </h2>
          <div className="mt-8 space-y-8">
            {TERMS.map((s) => (
              <div key={s.t}>
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-950">
                  {s.t}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">{s.p}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
