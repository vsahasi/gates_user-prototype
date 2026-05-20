-- db/migrations/0002_selections.sql
CREATE TABLE IF NOT EXISTS student_selections (
  id TEXT PRIMARY KEY,
  studentId TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('school','pathway','major','career')),
  refId TEXT NOT NULL,
  refLabel TEXT NOT NULL,
  note TEXT,
  stance TEXT NOT NULL CHECK (stance IN ('considering','leaning','committed')) DEFAULT 'considering',
  createdAt INTEGER NOT NULL,
  UNIQUE(studentId, kind, refId)
);
CREATE INDEX IF NOT EXISTS idx_selections_student ON student_selections(studentId, createdAt DESC);
