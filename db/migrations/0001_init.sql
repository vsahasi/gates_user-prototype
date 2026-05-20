-- db/migrations/0001_init.sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE students (
  id TEXT PRIMARY KEY,
  displayName TEXT NOT NULL,
  personaId TEXT,
  pinnedSummaryJson TEXT,
  summaryUpdatedAt INTEGER,
  createdAt INTEGER NOT NULL
);

CREATE TABLE adults (
  id TEXT PRIMARY KEY,
  displayName TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('parent','counselor','other')),
  createdAt INTEGER NOT NULL
);

CREATE TABLE student_profiles (
  studentId TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  profileJson TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  studentId TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  adultId TEXT NOT NULL REFERENCES adults(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','active','revoked')),
  createdAt INTEGER NOT NULL,
  UNIQUE (studentId, adultId)
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  studentId TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  phase TEXT,
  workbenchStateJson TEXT,
  lastMessageAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);
CREATE INDEX idx_conversations_student ON conversations(studentId, lastMessageAt DESC);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  structuredComponentJson TEXT,
  citationsJson TEXT,
  signalsJson TEXT,
  rubricScoreJson TEXT,
  timestamp INTEGER NOT NULL
);
CREATE INDEX idx_messages_conv ON messages(conversationId, timestamp);

CREATE TABLE adult_conversations (
  id TEXT PRIMARY KEY,
  adultId TEXT NOT NULL REFERENCES adults(id) ON DELETE CASCADE,
  studentId TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lastMessageAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);
CREATE INDEX idx_adult_conv ON adult_conversations(adultId, lastMessageAt DESC);

CREATE TABLE adult_messages (
  id TEXT PRIMARY KEY,
  adultConvId TEXT NOT NULL REFERENCES adult_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
CREATE INDEX idx_adult_msg_conv ON adult_messages(adultConvId, timestamp);

CREATE TABLE trust_events (
  id TEXT PRIMARY KEY,
  messageId TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payloadJson TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);
CREATE INDEX idx_trust_msg ON trust_events(messageId);

CREATE TABLE share_tokens (
  token TEXT PRIMARY KEY,
  studentId TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('parent','counselor','other')),
  expiresAt INTEGER NOT NULL,
  claimedByAdultId TEXT REFERENCES adults(id) ON DELETE SET NULL
);

CREATE TABLE eval_runs (
  id TEXT PRIMARY KEY,
  startedAt INTEGER NOT NULL,
  finishedAt INTEGER,
  summaryJson TEXT,
  reportPath TEXT NOT NULL
);
