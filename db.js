import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const dataDir = path.join(process.cwd(), "data");
const sqlitePath = path.join(dataDir, "describer.sqlite");
const promptsSeedPath = path.join(dataDir, "prompts.json");
const dbSeedPath = path.join(dataDir, "db.json");

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(sqlitePath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    image TEXT NOT NULL,
    alt TEXT NOT NULL,
    easy TEXT NOT NULL,
    advanced TEXT NOT NULL,
    keywords TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_name TEXT NOT NULL,
    word TEXT NOT NULL,
    saved_at TEXT NOT NULL,
    right_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    phonetic TEXT NOT NULL DEFAULT '',
    meaning TEXT NOT NULL DEFAULT '',
    example TEXT NOT NULL DEFAULT '',
    UNIQUE(list_name, word)
  );

  CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    image TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 89,
    easy_example TEXT NOT NULL DEFAULT '',
    advanced_example TEXT NOT NULL DEFAULT ''
  );
`);

ensureHistoryColumns();

seedPromptsIfNeeded();
seedAppDataIfNeeded();

export function getBootstrap(dateString) {
  return {
    todayPrompt: getPromptForDate(dateString),
    readingList: getWords("reading"),
    speakingList: getWords("speaking"),
    history: getHistory(),
  };
}

export function addWord({ listName, word, savedAt, phonetic, meaning, example }) {
  const existing = db
    .prepare("SELECT word FROM words WHERE list_name = ? AND lower(word) = lower(?)")
    .get(listName, word);
  if (!existing) {
    db.prepare(
      `INSERT INTO words (list_name, word, saved_at, right_count, wrong_count, phonetic, meaning, example)
       VALUES (?, ?, ?, 0, 0, ?, ?, ?)`
    ).run(listName, word, savedAt, phonetic || "", meaning || "", example || "");
  }
  return getWords(listName);
}

export function deleteWord(listName, word) {
  db.prepare("DELETE FROM words WHERE list_name = ? AND lower(word) = lower(?)").run(
    listName,
    word
  );
  return getWords(listName);
}

export function updateReviewCount(listName, word, matched) {
  const column = matched ? "right_count" : "wrong_count";
  db.prepare(
    `UPDATE words SET ${column} = ${column} + 1 WHERE list_name = ? AND lower(word) = lower(?)`
  ).run(listName, word);
  return getWords(listName);
}

export function addHistoryEntry(entry) {
  db.prepare(
    `INSERT INTO history (id, date, title, summary, image, score, easy_example, advanced_example, original_transcript, corrected_transcript)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entry.id,
    entry.date,
    entry.title,
    entry.summary,
    entry.image,
    entry.score ?? 89,
    entry.easyExample || "",
    entry.advancedExample || "",
    entry.originalTranscript || "",
    entry.correctedTranscript || ""
  );
  return getHistory();
}

export function deleteHistoryEntry(id) {
  db.prepare("DELETE FROM history WHERE id = ?").run(id);
  return getHistory();
}

export function clearHistoryEntries() {
  db.prepare("DELETE FROM history").run();
  return getHistory();
}

function getWords(listName) {
  return db
    .prepare(
      `SELECT word, saved_at as savedAt, right_count as rightCount, wrong_count as wrongCount,
              phonetic, meaning, example
       FROM words
       WHERE list_name = ?
       ORDER BY saved_at DESC, id DESC`
    )
    .all(listName);
}

function getHistory() {
  return db
    .prepare(
      `SELECT id, date, title, summary, image,
              score,
              easy_example as easyExample,
              advanced_example as advancedExample,
              original_transcript as originalTranscript,
              corrected_transcript as correctedTranscript
       FROM history
       ORDER BY date DESC, id DESC`
    )
    .all();
}

function ensureHistoryColumns() {
  const columns = db.prepare("PRAGMA table_info(history)").all();
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("original_transcript")) {
    db.exec("ALTER TABLE history ADD COLUMN original_transcript TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has("corrected_transcript")) {
    db.exec("ALTER TABLE history ADD COLUMN corrected_transcript TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has("score")) {
    db.exec("ALTER TABLE history ADD COLUMN score INTEGER NOT NULL DEFAULT 89");
  }
  if (!names.has("easy_example")) {
    db.exec("ALTER TABLE history ADD COLUMN easy_example TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has("advanced_example")) {
    db.exec("ALTER TABLE history ADD COLUMN advanced_example TEXT NOT NULL DEFAULT ''");
  }
}

function getPromptForDate(dateString) {
  const prompts = db
    .prepare(
      "SELECT id, title, image, alt, easy, advanced, keywords FROM prompts ORDER BY rowid ASC"
    )
    .all()
    .map((prompt) => ({
      ...prompt,
      keywords: JSON.parse(prompt.keywords),
    }));

  const date = new Date(`${dateString}T12:00:00`);
  const dayIndex = Math.floor(date.getTime() / 86400000);
  return prompts[dayIndex % prompts.length];
}

function seedPromptsIfNeeded() {
  const count = db.prepare("SELECT count(*) as count FROM prompts").get().count;
  if (count > 0) return;

  const prompts = JSON.parse(fs.readFileSync(promptsSeedPath, "utf8"));
  const insert = db.prepare(
    `INSERT INTO prompts (id, title, image, alt, easy, advanced, keywords)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.id,
        row.title,
        row.image,
        row.alt,
        row.easy,
        row.advanced,
        JSON.stringify(row.keywords || [])
      );
    }
  });
  tx(prompts);
}

function seedAppDataIfNeeded() {
  const wordCount = db.prepare("SELECT count(*) as count FROM words").get().count;
  const historyCount = db.prepare("SELECT count(*) as count FROM history").get().count;
  if (wordCount > 0 || historyCount > 0) return;

  const seed = JSON.parse(fs.readFileSync(dbSeedPath, "utf8"));
  const insertWord = db.prepare(
    `INSERT INTO words (list_name, word, saved_at, right_count, wrong_count, phonetic, meaning, example)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertHistory = db.prepare(
    `INSERT INTO history (id, date, title, summary, image, score, easy_example, advanced_example, original_transcript, corrected_transcript)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    for (const item of seed.readingList || []) {
      insertWord.run(
        "reading",
        item.word,
        item.savedAt,
        item.rightCount || 0,
        item.wrongCount || 0,
        item.phonetic || "",
        item.meaning || "",
        item.example || ""
      );
    }
    for (const item of seed.speakingList || []) {
      insertWord.run(
        "speaking",
        item.word,
        item.savedAt,
        item.rightCount || 0,
        item.wrongCount || 0,
        item.phonetic || "",
        item.meaning || "",
        item.example || ""
      );
    }
    for (const item of seed.history || []) {
      insertHistory.run(
        item.id,
        item.date,
        item.title,
        item.summary,
        item.image,
        item.score ?? 89,
        item.easyExample || "",
        item.advancedExample || "",
        item.originalTranscript || "",
        item.correctedTranscript || ""
      );
    }
  });

  tx();
}
