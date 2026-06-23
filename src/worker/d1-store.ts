import type { PersistedTripNote } from "../fjordpilot/notes";

export async function insertTripNote(
  db: D1Database,
  note: PersistedTripNote,
): Promise<void> {
  await db
    .prepare(`
    INSERT INTO trip_notes (id, created_at, variant, day, location, category, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      note.id,
      note.createdAt,
      note.variant,
      note.day ?? null,
      note.location ?? null,
      note.category,
      note.note,
    )
    .run();
}

export interface PostCallLog {
  id: string;
  createdAt: string;
  conversationId: string | undefined;
  payload: unknown;
}

export async function insertPostCallLog(
  db: D1Database,
  log: PostCallLog,
): Promise<void> {
  await db
    .prepare(`
    INSERT INTO post_call_logs (id, created_at, conversation_id, payload_json)
    VALUES (?, ?, ?, ?)
  `)
    .bind(
      log.id,
      log.createdAt,
      log.conversationId ?? null,
      JSON.stringify(log.payload),
    )
    .run();
}
