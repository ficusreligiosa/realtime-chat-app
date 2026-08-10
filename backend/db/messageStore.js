const db = require('./index');

const insertStmt = db.prepare(
  `INSERT INTO messages (username, text, status) VALUES (?, ?, 'delivered')`
);
const listStmt = db.prepare(
  `SELECT id, username, text, created_at AS createdAt, status
   FROM messages
   ORDER BY id ASC
   LIMIT ?`
);
const countStmt = db.prepare(`SELECT COUNT(*) AS count FROM messages`);

/**
 * Persist a new chat message.
 * @param {{username: string, text: string}} payload
 * @returns {object} the saved message row
 */
function createMessage({ username, text }) {
  const info = insertStmt.run(username, text);
  return getMessageById(info.lastInsertRowid);
}

const getByIdStmt = db.prepare(
  `SELECT id, username, text, created_at AS createdAt, status FROM messages WHERE id = ?`
);
function getMessageById(id) {
  return getByIdStmt.get(id);
}

/**
 * Fetch chat history, most recent `limit` messages, oldest first.
 */
function getHistory(limit = 100) {
  const total = countStmt.get().count;
  if (total <= limit) {
    return listStmt.all(limit);
  }
  // grab the last `limit` rows in ascending order
  const rows = db
    .prepare(
      `SELECT id, username, text, created_at AS createdAt, status
       FROM messages ORDER BY id DESC LIMIT ?`
    )
    .all(limit);
  return rows.reverse();
}

module.exports = {
  createMessage,
  getHistory,
  getMessageById,
};
