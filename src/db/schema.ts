import {
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  primaryKey,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";

/* ------------------------------- ENUMS ---------------------------------- */

export const roleEnum = pgEnum("role", ["admin", "staff", "student"]);
export const leadSourceEnum = pgEnum("lead_source", [
  "whatsapp",
  "hotmart",
  "site",
  "social",
  "referral",
  "manual",
]);
export const contactStatusEnum = pgEnum("contact_status", [
  "lead",
  "qualified",
  "negotiating",
  "client",
  "inactive",
  "lost",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "confirmed",
  "completed",
  "refunded",
  "cancelled",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "hotmart",
  "mbway",
  "transfer",
  "other",
]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "confirmed",
  "cancelled",
  "rescheduled",
  "completed",
]);
export const postStatusEnum = pgEnum("post_status", [
  "idea",
  "production",
  "review",
  "approved",
  "published",
]);
export const lessonTypeEnum = pgEnum("lesson_type", ["video", "material", "quiz"]);

/* ------------------------------- AUTH ----------------------------------- */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("student"),
  phone: text("phone"),
  lastLoginAt: timestamp("last_login_at"),
  passwordChangedAt: timestamp("password_changed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Chaves de acesso (WebAuthn): Face ID, Touch ID, Windows Hello ou chave física. */
export const passkeys = pgTable("passkeys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: jsonb("transports").$type<string[]>(),
  deviceType: text("device_type"),
  backedUp: boolean("backed_up").notNull().default(false),
  name: text("name").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* -------------------------------- CRM ----------------------------------- */

/** Canais/redes de onde vêm os contactos (BNI, CNN, BNEX…), geridos pela equipa. */
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#800080"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  location: text("location"),
  source: leadSourceEnum("source").notNull().default("manual"),
  status: contactStatusEnum("status").notNull().default("lead"),
  channelId: integer("channel_id").references(() => channels.id, { onDelete: "set null" }),
  country: text("country"), // ISO 3166-1 alfa-2 (PT, BR…)
  timezone: text("timezone"), // IANA (Europe/Lisbon, America/Sao_Paulo…)
  referredBy: text("referred_by"), // quem indicou (ex: membro do BNI)
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#800080"),
});

export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.tagId] })]
);

export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("note"), // note | whatsapp | email | purchase | booking | system
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ------------------------------ WHATSAPP -------------------------------- */

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(), // in | out
  body: text("body").notNull(), // texto, ou a legenda de um ficheiro
  kind: text("kind").notNull().default("text"), // text | image | video | audio | document | sticker | location | contact
  // Ficheiros: só são descarregados da Evolution quando alguém pede para ver (poupa o servidor)
  mediaMime: text("media_mime"),
  mediaName: text("media_name"),
  mediaSize: integer("media_size"),
  mediaSeconds: integer("media_seconds"),
  mediaFile: text("media_file"), // nome em uploads/whatsapp, depois de descarregado ou enviado por nós
  waRaw: jsonb("wa_raw").$type<{ key: Record<string, unknown>; message: Record<string, unknown> }>(), // para pedir o ficheiro à Evolution
  waMessageId: text("wa_message_id").unique(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ------------------------------ PIPELINE -------------------------------- */

export const pipelineStages = pgTable("pipeline_stages", {
  id: serial("id").primaryKey(),
  pipeline: text("pipeline").notNull().default("mentoria"), // mentoria | workshops
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
  color: text("color").notNull().default("#800080"),
});

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  stageId: integer("stage_id")
    .notNull()
    .references(() => pipelineStages.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  product: text("product").notNull().default("Mentoria"),
  value: numeric("value", { precision: 10, scale: 2 }).notNull().default("0"),
  owner: text("owner").notNull().default("Marina"),
  // Fecho do negócio: aberto, ganho ou perdido (os fechados saem do quadro)
  outcome: text("outcome").notNull().default("open"), // open | won | lost
  expectedClose: timestamp("expected_close"),
  closedAt: timestamp("closed_at"),
  lostReason: text("lost_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ------------------------------ PAGAMENTOS ------------------------------ */

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  product: text("product").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  method: paymentMethodEnum("method").notNull().default("transfer"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  reference: text("reference"), // id de transação / referência
  dueDate: timestamp("due_date"), // vencimento (pagamentos pendentes e parcelas)
  paidAt: timestamp("paid_at"), // data em que foi recebido; conta para a receita do período
  notes: text("notes"),
  // Parcelas: "2 de 3" do mesmo plano
  installment: integer("installment"),
  installments: integer("installments"),
  planRef: text("plan_ref"),
  receiptName: text("receipt_name"),
  receiptFile: text("receipt_file"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Despesas do negócio, para calcular o lucro. */
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  category: text("category").notNull().default("Outros"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  date: timestamp("date").notNull().defaultNow(),
  supplier: text("supplier"),
  recurring: boolean("recurring").notNull().default(false), // repete todos os meses
  notes: text("notes"),
  receiptName: text("receipt_name"),
  receiptFile: text("receipt_file"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ------------------------------- AGENDA --------------------------------- */

export const eventTypes = pgTable("event_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  durationMin: integer("duration_min").notNull().default(30),
  color: text("color").notNull().default("#800080"),
  active: boolean("active").notNull().default(true),
});

export const availability = pgTable("availability", {
  id: serial("id").primaryKey(),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = domingo
  startTime: text("start_time").notNull().default("09:00"),
  endTime: text("end_time").notNull().default("18:00"),
  // Intervalo opcional (ex: almoço): sem marcações entre estas horas
  breakStart: text("break_start"),
  breakEnd: text("break_end"),
  active: boolean("active").notNull().default(true),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  eventTypeId: integer("event_type_id")
    .notNull()
    .references(() => eventTypes.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  notes: text("notes"),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  status: appointmentStatusEnum("status").notNull().default("confirmed"),
  meetingUrl: text("meeting_url"),
  timezone: text("timezone").notNull().default("Europe/Lisbon"), // fuso da cliente ao marcar
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Compromissos da Marina criados no backoffice (reuniões, viagens, pausas). Podem bloquear a marcação pública. */
export const agendaEvents = pgTable("agenda_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes"),
  location: text("location"),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  allDay: boolean("all_day").notNull().default(false),
  blocksBooking: boolean("blocks_booking").notNull().default(true),
  color: text("color").notNull().default("#0ea5e9"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* -------------------------------- LMS ----------------------------------- */

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  subtitle: text("subtitle"),
  description: text("description"),
  cover: text("cover"),
  level: text("level").notNull().default("Todos os níveis"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  hotmartUrl: text("hotmart_url"),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const modules = pgTable("modules", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  order: integer("order").notNull().default(0),
});

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  moduleId: integer("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  order: integer("order").notNull().default(0),
  type: lessonTypeEnum("type").notNull().default("video"),
  durationMin: integer("duration_min").notNull().default(10),
  videoUrl: text("video_url"),
  content: text("content"), // texto rico / descrição (num quiz: instruções)
  materialUrl: text("material_url"),
  // Quiz: quantas questões sortear do banco (null = todas) e nota mínima
  quizDraw: integer("quiz_draw"),
  quizMinScore: integer("quiz_min_score").notNull().default(70),
});

/**
 * Ficheiros complementares de um curso (ou de uma aula), guardados em disco fora de /public
 * e servidos só a alunas inscritas.
 */
export const courseFiles = pgTable("course_files", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  lessonId: integer("lesson_id").references(() => lessons.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  storedName: text("stored_name").notNull().unique(),
  mime: text("mime").notNull().default("application/octet-stream"),
  size: integer("size").notNull().default(0),
  downloads: integer("downloads").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Banco de questões de uma aula do tipo quiz. */
export const quizQuestions = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  answer: integer("answer").notNull(), // índice em options
  explanation: text("explanation"),
  order: integer("order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Tentativa de uma aluna: guarda as questões sorteadas e a ordem baralhada das opções,
 * para a correcção ser feita no servidor (as respostas certas nunca vão para o browser).
 */
export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  items: jsonb("items").$type<{ qid: number; order: number[] }[]>().notNull(),
  answers: jsonb("answers").$type<Record<string, number>>(), // qid → índice da opção original
  score: integer("score"),
  passed: boolean("passed"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  submittedAt: timestamp("submitted_at"),
});

export const enrollments = pgTable(
  "enrollments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("enroll_user_course_unique").on(t.userId, t.courseId)]
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (t) => [unique("progress_user_lesson_unique").on(t.userId, t.lessonId)]
);

/* ------------------------------ MARKETING ------------------------------- */

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  publishAt: timestamp("publish_at"),
  network: text("network").notNull().default("Instagram"),
  format: text("format").notNull().default("Carrossel"),
  copy: text("copy"),
  hashtags: text("hashtags"),
  link: text("link"),
  notes: text("notes"),
  status: postStatusEnum("status").notNull().default("idea"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ---------------------------- LINK NA BIO -------------------------------- */

/** Links personalizados da página /links (estilo linktree). */
export const bioLinks = pgTable("bio_links", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  url: text("url").notNull(),
  image: text("image"), // cartão com imagem (banner); sem imagem fica um botão simples
  highlight: boolean("highlight").notNull().default(false), // destaque com a cor da marca
  order: integer("order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Visitas e cliques da página de links, para as estatísticas. */
export const bioEvents = pgTable("bio_events", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // view | click
  target: text("target"), // ex: l12 (link), c3 (curso), agendar, whatsapp
  referrer: text("referrer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ------------------------------ SETTINGS -------------------------------- */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

/* ------------------------------- TYPES ---------------------------------- */

export type User = typeof users.$inferSelect;
export type Passkey = typeof passkeys.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type CourseFile = typeof courseFiles.$inferSelect;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Interaction = typeof interactions.$inferSelect;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type EventType = typeof eventTypes.$inferSelect;
export type Availability = typeof availability.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Module = typeof modules.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type BioLink = typeof bioLinks.$inferSelect;
