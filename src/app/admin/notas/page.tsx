import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, noteContacts, noteFolders, notes, users } from "@/db/schema";
import { purgeOldNotes, type NoteDto } from "@/lib/actions-notes";
import { PageHeader } from "@/components/admin-ui";
import { NotesApp } from "@/components/notes-client";

export const dynamic = "force-dynamic";

export default async function NotasPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string; nova?: string; contacto?: string }>;
}) {
  const params = await searchParams;
  await purgeOldNotes();

  const [rows, links, folders] = await Promise.all([
    db
      .select({ n: notes, author: users.name })
      .from(notes)
      .leftJoin(users, eq(users.id, notes.authorId))
      .orderBy(desc(notes.updatedAt))
      .limit(2000),
    db
      .select({ noteId: noteContacts.noteId, id: contacts.id, name: contacts.name })
      .from(noteContacts)
      .innerJoin(contacts, eq(contacts.id, noteContacts.contactId)),
    db.select({ id: noteFolders.id, name: noteFolders.name }).from(noteFolders).orderBy(asc(noteFolders.name)),
  ]);

  const byNote = new Map<number, { id: number; name: string }[]>();
  for (const l of links) byNote.set(l.noteId, [...(byNote.get(l.noteId) ?? []), { id: l.id, name: l.name }]);

  const list: NoteDto[] = rows.map(({ n, author }) => ({
    id: n.id,
    body: n.body,
    folderId: n.folderId,
    pinned: n.pinned,
    author,
    contacts: byNote.get(n.id) ?? [],
    deletedAt: n.deletedAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));

  const selected = Number(params.n) || null;

  return (
    <>
      <PageHeader
        title="Notas"
        subtitle="Ideias, tarefas e apontamentos da equipa, ligados aos contactos. Escreva - [ ] para criar tarefas e #etiquetas para organizar."
      />
      <NotesApp
        initialNotes={list}
        initialFolders={folders}
        initialSelected={selected && list.some((n) => n.id === selected) ? selected : null}
        createFor={{ nova: params.nova === "1", contactId: Number(params.contacto) || null }}
      />
    </>
  );
}
