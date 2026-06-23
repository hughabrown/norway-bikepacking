import type { DeepTripAnalysisJob } from "../fjordpilot/types";
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

export async function insertDeepTripAnalysisJob(
  db: D1Database,
  job: DeepTripAnalysisJob,
): Promise<void> {
  await db
    .prepare(`
    INSERT INTO deep_trip_analysis_jobs (
      id,
      created_at,
      status,
      variant,
      analysis_type,
      question,
      start_day,
      end_day,
      constraints_json,
      current_date,
      current_itinerary_date,
      conversation_id,
      prompt,
      result_json,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      job.id,
      job.createdAt,
      job.status,
      job.variant,
      job.analysisType,
      job.question,
      job.startDay ?? null,
      job.endDay ?? null,
      JSON.stringify(job.constraints),
      job.currentDate ?? null,
      job.currentItineraryDate ?? null,
      job.conversationId ?? null,
      job.prompt,
      null,
      job.createdAt,
    )
    .run();
}
