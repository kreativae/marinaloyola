# Marina Loyola — Plataforma Digital

Site público, agendamento, CRM, pipeline, LMS (área de aluna), marketing e financeiro.
Next.js 16 + PostgreSQL (Drizzle ORM).

## Correr localmente (macOS)

```bash
brew install postgresql@17
brew services start postgresql@17
psql -h 127.0.0.1 -d postgres -c "CREATE ROLE postgres LOGIN SUPERUSER PASSWORD 'postgres';"
psql -h 127.0.0.1 -d postgres -c "CREATE DATABASE app_db OWNER postgres;"

cp .env.example .env   # e gere um AUTH_SECRET: openssl rand -hex 32
npm install
npm run db:setup       # cria as tabelas e carrega dados de exemplo
npm run dev            # http://localhost:3000
```

`npm run db:seed` repõe os dados de exemplo (apaga tudo o resto).

Contas de exemplo: admin `marina@marinaloyola.com` / `marina123`, aluna `sofia@email.com` / `aluno123`.

## Publicar no servidor (Coolify)

1. **Base de dados:** crie um recurso PostgreSQL no Coolify e copie o URL interno de ligação.
2. **Aplicação:** novo recurso a partir do repositório GitHub (branch `main`). O Coolify detecta o Next.js
   sozinho (`npm run build` / `npm run start`, porta `3000`).
3. **Variáveis de ambiente** (ver a tabela abaixo). No mínimo: `DATABASE_URL`, `AUTH_SECRET`
   (`openssl rand -hex 32`), `APP_URL` (ex: `https://marinaloyola.com`) e `TZ=Europe/Lisbon`.
4. **Armazenamento persistente:** monte um volume em `/app/uploads`. É lá que ficam os anexos dos cursos e
   os comprovativos; sem volume, perdem-se a cada novo deploy.
5. **Comando pós-deploy:** `npm run db:deploy` — cria ou actualiza as tabelas e, se ainda estiver vazia,
   a estrutura base (fases do pipeline, tipos de sessão, horário semanal, canais e links da bio).
   Não apaga nem duplica nada, por isso corre em todos os deploys.
6. **Primeira conta de administradora** (uma vez, no terminal do contentor):

   ```bash
   npm run db:admin -- marina@marinaloyola.com "Marina Loyola" "uma-palavra-passe-forte"
   ```

   Não corra `npm run db:seed` em produção: apaga todos os dados e cria contas de exemplo com
   palavras-passe conhecidas.

O build não precisa da base de dados; só a aplicação em execução se liga a ela.

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Ligação PostgreSQL |
| `AUTH_SECRET` | Assinatura do cookie de sessão — obrigatório em produção |
| `RESEND_API_KEY` | Envio de emails via [Resend](https://resend.com). Sem ela, os emails ficam em `.emails/` para pré-visualização |
| `EMAIL_FROM` | Remetente, ex. `Marina Loyola <ola@marinaloyola.com>` — o domínio tem de estar verificado no Resend |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` | Opcional: credenciais da Evolution API (também configuráveis em Admin → WhatsApp) |
| `APP_URL` | URL pública da plataforma, usada no webhook da Evolution |
| `HOTMART_HOTTOK` | Hottok do webhook Hotmart; quando definido, pedidos sem ele são rejeitados |
| `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | Opcional: Zoom Server-to-Server OAuth (também em Configurações → Zoom) |
| `TZ` | `Europe/Lisbon` — fuso do servidor (os scripts npm já o definem) |

## Notas

- A aplicação corre no fuso `Europe/Lisbon` (definido nos scripts npm). Em produção, garanta `TZ=Europe/Lisbon` no servidor.
- As imagens em `public/img/` são marcadores — substitua pelas fotografias reais com os mesmos nomes.
- Ao agendar, a cliente recebe um email de confirmação com convite de calendário (.ics) e a Marina recebe uma notificação no email definido em Configurações.
- WhatsApp (Evolution API v2): em **Admin → WhatsApp** configure o servidor, clique em “Ligar WhatsApp” e leia o QR code. O webhook é registado automaticamente. Mensagens de números novos criam leads no CRM (origem WhatsApp); as conversas ficam na caixa de entrada e podem ser respondidas dali. Agendamentos com telefone recebem confirmação por WhatsApp. Em desenvolvimento, a Evolution precisa de alcançar o `APP_URL` (use um túnel, ex. ngrok).
- Webhook Hotmart: `POST /api/webhooks/hotmart`.
