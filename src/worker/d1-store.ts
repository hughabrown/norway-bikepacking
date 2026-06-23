import type {
  DeepTripAnalysisJob,
  DeepTripAnalysisResultPayload,
  DeepTripAnalysisStatus,
  DeepTripAnalysisStatusResult,
  DeepTripAnalysisType,
} from "../fjordpilot/types";
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

interface DeepTripAnalysisRow {
  id: string;
  created_at: string;
  status: DeepTripAnalysisStatus;
  variant: string;
  analysis_type: DeepTripAnalysisType;
  question: string;
  start_day: number | null;
  end_day: number | null;
  constraints_json: string;
  current_date: string | null;
  current_itinerary_date: string | null;
  conversation_id: string | null;
  prompt: string;
  result_json: string | null;
  updated_at: string | null;
}

function parseJson<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function rowToJob(row: DeepTripAnalysisRow): DeepTripAnalysisJob {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    variant: row.variant,
    analysisType: row.analysis_type,
    question: row.question,
    startDay: row.start_day ?? undefined,
    endDay: row.end_day ?? undefined,
    constraints: parseJson<string[]>(row.constraints_json, []),
    currentDate: row.current_date ?? undefined,
    currentItineraryDate: row.current_itinerary_date ?? undefined,
    conversationId: row.conversation_id ?? undefined,
    prompt: row.prompt,
  };
}

function rowToStatusResult(row: DeepTripAnalysisRow): DeepTripAnalysisStatusResult {
  const result = parseJson<DeepTripAnalysisResultPayload | { error: string } | undefined>(
    row.result_json,
    undefined,
  );

  return {
    ok: true,
    request_id: row.id,
    status: row.status,
    variant: row.variant,
    analysis_type: row.analysis_type,
    question: row.question,
    result:
      result && "answer" in result
        ? {
            answer: result.answer,
            model: result.model,
            runner: result.runner,
            completedAt: result.completedAt,
          }
        : undefined,
    error: result && "error" in result ? result.error : undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

export async function getDeepTripAnalysisJobStatus(
  db: D1Database,
  id: string,
): Promise<DeepTripAnalysisStatusResult> {
  const row = await db
    .prepare(`
      SELECT
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
      FROM deep_trip_analysis_jobs
      WHERE id = ?
    `)
    .bind(id)
    .first<DeepTripAnalysisRow>();

  if (!row) {
    return { ok: false, error: `No deep analysis request found for ${id}.` };
  }

  return rowToStatusResult(row);
}

export async function claimNextDeepTripAnalysisJob(
  db: D1Database,
  now: string,
): Promise<DeepTripAnalysisJob | undefined> {
  const row = await db
    .prepare(`
      SELECT
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
      FROM deep_trip_analysis_jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
    `)
    .first<DeepTripAnalysisRow>();

  if (!row) {
    return undefined;
  }

  await db
    .prepare(`
      UPDATE deep_trip_analysis_jobs
      SET status = 'running', updated_at = ?
      WHERE id = ? AND status = 'queued'
    `)
    .bind(now, row.id)
    .run();

  return rowToJob({ ...row, status: "running", updated_at: now });
}

export async function completeDeepTripAnalysisJob(
  db: D1Database,
  input: {
    id: string;
    answer: string;
    model: string | undefined;
    runner: string | undefined;
    completedAt: string;
  },
): Promise<void> {
  const result: DeepTripAnalysisResultPayload = {
    answer: input.answer,
    model: input.model,
    runner: input.runner,
    completedAt: input.completedAt,
  };

  await db
    .prepare(`
      UPDATE deep_trip_analysis_jobs
      SET status = 'completed', result_json = ?, updated_at = ?
      WHERE id = ?
    `)
    .bind(JSON.stringify(result), input.completedAt, input.id)
    .run();
}

export async function failDeepTripAnalysisJob(
  db: D1Database,
  input: {
    id: string;
    error: string;
    runner: string | undefined;
    failedAt: string;
  },
): Promise<void> {
  await db
    .prepare(`
      UPDATE deep_trip_analysis_jobs
      SET status = 'failed', result_json = ?, updated_at = ?
      WHERE id = ?
    `)
    .bind(
      JSON.stringify({
        error: input.error,
        runner: input.runner,
        failedAt: input.failedAt,
      }),
      input.failedAt,
      input.id,
    )
    .run();
}
