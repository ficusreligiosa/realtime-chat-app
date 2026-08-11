const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'chat.sqlite3');

// Make sure the directory for the DB file exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'sent',
    reply_to_id INTEGER,
    reply_to_username TEXT,
    reply_to_text TEXT,
    is_edited INTEGER DEFAULT 0,
    is_view_once INTEGER DEFAULT 0
  );
`);

// Add columns if table already existed without them
try { db.exec(`ALTER TABLE messages ADD COLUMN reply_to_id INTEGER;`); } catch (_) {}
try { db.exec(`ALTER TABLE messages ADD COLUMN reply_to_username TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE messages ADD COLUMN reply_to_text TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE messages ADD COLUMN is_edited INTEGER DEFAULT 0;`); } catch (_) {}
try { db.exec(`ALTER TABLE messages ADD COLUMN is_view_once INTEGER DEFAULT 0;`); } catch (_) {}

module.exports = db;

