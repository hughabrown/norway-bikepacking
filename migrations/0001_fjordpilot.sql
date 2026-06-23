CREATE TABLE IF NOT EXISTS trip_notes (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  variant TEXT NOT NULL,
  day INTEGER,
  location TEXT,
  category TEXT NOT NULL,
  note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS post_call_logs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  conversation_id TEXT,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS itinerary_change_jobs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  variant TEXT NOT NULL,
  summary TEXT NOT NULL,
  affected_days_json TEXT NOT NULL,
  change_type TEXT NOT NULL,
  prd TEXT NOT NULL,
  constraints_json TEXT NOT NULL,
  acceptance_criteria_json TEXT NOT NULL,
  result_json TEXT
);
