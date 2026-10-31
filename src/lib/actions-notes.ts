"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { contacts, noteContacts, noteFolders, notes } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { noteTitle, TRASH_DAYS } from "@/lib/notes-def";

export type NoteDto = {
  id: number;
  body: string;
  folderId: number | null;
  pinned: boolean;
  author: string | null;
  contacts: { id: number; name: string }[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Result = { ok: boolean; error?: string };

function refresh(contactIds: number[] = []) {
  revalidatePath("/admin/notas");
  for (const id of contactIds) revalidatePath(`/admin/crm/${id}`);
}

async function linkedContacts(noteId: number) {
  const rows = await db.select({ id: noteContacts.contactId }).from(noteContacts).where(eq(noteContacts.noteId, noteId));
  return rows.map((r) => r.id);
}

/**
 * Corre ao abrir a página: notas apagadas há mais de 30 dias saem de vez, e notas que ficaram
 * vazias (criadas e abandonadas) desaparecem passada uma hora, como nas Notas da Apple.
 */
export async function purgeOldNotes() {
  await requireAdmin();
  await db.delete(notes).where(and(isNotNull(notes.deletedAt), lt(notes.deletedAt, new Date(Date.now() - TRASH_DAYS * 86400000))));
  await db.delete(notes).where(and(eq(notes.body, ""), lt(notes.updatedAt, new Date(Date.now() - 3600000))));
}

export async function createNote(opts: { folderId?: number | null; contactId?: number | null; body?: string } = {}): Promise<NoteDto> {
  const user = await requireAdmin();
  const body = opts.body ?? "";
  const [n] = await db
    .insert(notes)
    .values({ body, title: noteTitle(body), folderId: opts.folderId ?? null, authorId: user.id })
    .returning();
  let linked: NoteDto["contacts"] = [];
  if (opts.contactId) {
    const [c] = await db.select({ id: contacts.id, name: contacts.name }).from(contacts).where(eq(contacts.id, opts.contactId)).limit(1);
    if (c) {
      await db.insert(noteContacts).values({ noteId: n.id, contactId: c.id });
      linked = [c];
    }
  }
  refresh(linked.map((c) => c.id));
  return {
    id: n.id,
    body: n.body,
    folderId: n.folderId,
    pinned: n.pinned,
    author: user.name,
    contacts: linked,
    deletedAt: null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

export async function saveNote(id: number, body: string): Promise<Result> {
  await requireAdmin();
  const clean = body.slice(0, 100_000);
  await db.update(notes).set({ body: clean, title: noteTitle(clean), updatedAt: new Date() }).where(eq(notes.id, id));
  refresh(await linkedContacts(id));
  return { ok: true };
}

export async function setNotePinned(id: number, pinned: boolean): Promise<Result> {
  await requireAdmin();
  await db.update(notes).set({ pinned }).where(eq(notes.id, id));
  refresh();
  return { ok: true };
}

export async function moveNote(id: number, folderId: number | null): Promise<Result> {
  await requireAdmin();
  await db.update(notes).set({ folderId }).where(eq(notes.id, id));
  refresh();
  return { ok: true };
}

/** Vai para "Apagadas recentemente"; pode ser recuperada durante 30 dias. */
export async function trashNote(id: number): Promise<Result> {
  await requireAdmin();
  await db.update(notes).set({ deletedAt: new Date(), pinned: false }).where(eq(notes.id, id));
  refresh(await linkedContacts(id));
  return { ok: true };
}

export async function restoreNote(id: number): Promise<Result> {
  await requireAdmin();
  await db.update(notes).set({ deletedAt: null }).where(eq(notes.id, id));
  refresh(await linkedContacts(id));
  return { ok: true };
}

/** Apaga de vez (também usada para notas que ficaram vazias). */
export async function destroyNote(id: number): Promise<Result> {
  await requireAdmin();
  const linked = await linkedContacts(id);
  await db.delete(notes).where(eq(notes.id, id));
  refresh(linked);
  return { ok: true };
}

export async function emptyNotesTrash(): Promise<Result> {
  await requireAdmin();
  await db.delete(notes).where(isNotNull(notes.deletedAt));
  refresh();
  return { ok: true };
}

/* ------------------------------ CONTACTOS ------------------------------- */

export async function linkNoteContact(noteId: number, contactId: number): Promise<{ ok: boolean; contact?: { id: number; name: string } }> {
  await requireAdmin();
  const [c] = await db.select({ id: contacts.id, name: contacts.name }).from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!c) return { ok: false };
  await db.insert(noteContacts).values({ noteId, contactId }).onConflictDoNothing();
  await db.update(notes).set({ updatedAt: new Date() }).where(eq(notes.id, noteId));
  refresh([contactId]);
  return { ok: true, contact: c };
}

export async function unlinkNoteContact(noteId: number, contactId: number): Promise<Result> {
  await requireAdmin();
  await db.delete(noteContacts).where(and(eq(noteContacts.noteId, noteId), eq(noteContacts.contactId, contactId)));
  refresh([contactId]);
  return { ok: true };
}

/* -------------------------------- PASTAS -------------------------------- */

export async function createNoteFolder(name: string): Promise<{ ok: boolean; folder?: { id: number; name: string }; error?: string }> {
  await requireAdmin();
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!clean) return { ok: false, error: "Indique um nome." };
  const [f] = await db.insert(noteFolders).values({ name: clean }).returning({ id: noteFolders.id, name: noteFolders.name });
  refresh();
  return { ok: true, folder: f };
}

export async function renameNoteFolder(id: number, name: string): Promise<Result> {
  await requireAdmin();
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!clean) return { ok: false, error: "Indique um nome." };
  await db.update(noteFolders).set({ name: clean }).where(eq(noteFolders.id, id));
  refresh();
  return { ok: true };
}

/** As notas da pasta não são apagadas: ficam em "Todas as notas". */
export async function deleteNoteFolder(id: number): Promise<Result> {
  await requireAdmin();
  await db.delete(noteFolders).where(eq(noteFolders.id, id));
  refresh();
  return { ok: true };
}
