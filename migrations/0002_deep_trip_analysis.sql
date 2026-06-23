CREATE TABLE IF NOT EXISTS deep_trip_analysis_jobs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  variant TEXT NOT NULL,
  analysis_type TEXT NOT NULL,
  question TEXT NOT NULL,
  start_day INTEGER,
  end_day INTEGER,
  constraints_json TEXT NOT NULL,
  current_date TEXT,
  current_itinerary_date TEXT,
  conversation_id TEXT,
  prompt TEXT NOT NULL,
  result_json TEXT,
  updated_at TEXT
);
