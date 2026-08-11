const db = require('./index');

const insertStmt = db.prepare(
  `INSERT INTO messages (username, text, status, reply_to_id, reply_to_username, reply_to_text, is_view_once)
   VALUES (?, ?, 'sent', ?, ?, ?, ?)`
);

const listStmt = db.prepare(
  `SELECT id, username, text, created_at AS createdAt, status,
          reply_to_id AS replyToId, reply_to_username AS replyToUsername, reply_to_text AS replyToText,
          is_edited AS isEdited, is_view_once AS isViewOnce
   FROM messages
   ORDER BY id ASC
   LIMIT ?`
);

const countStmt = db.prepare(`SELECT COUNT(*) AS count FROM messages`);

const getByIdStmt = db.prepare(
  `SELECT id, username, text, created_at AS createdAt, status,
          reply_to_id AS replyToId, reply_to_username AS replyToUsername, reply_to_text AS replyToText,
          is_edited AS isEdited, is_view_once AS isViewOnce
   FROM messages WHERE id = ?`
);

const updateTextStmt = db.prepare(
  `UPDATE messages SET text = ?, is_edited = 1 WHERE id = ? AND username = ?`
);

const deleteStmt = db.prepare(`DELETE FROM messages WHERE id = ?`);
const clearAllStmt = db.prepare(`DELETE FROM messages`);

/**
 * Persist a new chat message.
 */
function createMessage({ username, text, replyToId = null, replyToUsername = null, replyToText = null, isViewOnce = 0 }) {
  const info = insertStmt.run(
    username,
    text,
    replyToId || null,
    replyToUsername || null,
    replyToText || null,
    isViewOnce ? 1 : 0
  );
  return getMessageById(info.lastInsertRowid);
}

function updateMessageText(id, username, text) {
  const result = updateTextStmt.run(text, id, username);
  if (result.changes > 0) {
    return getMessageById(id);
  }
  return null;
}

function deleteMessage(id) {
  const result = deleteStmt.run(id);
  return result.changes > 0;
}

function clearAllMessages() {
  clearAllStmt.run();
  return true;
}

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
  const rows = db
    .prepare(
      `SELECT id, username, text, created_at AS createdAt, status,
              reply_to_id AS replyToId, reply_to_username AS replyToUsername, reply_to_text AS replyToText,
              is_edited AS isEdited, is_view_once AS isViewOnce
       FROM messages ORDER BY id DESC LIMIT ?`
    )
    .all(limit);
  return rows.reverse();
}

const uniqueUsersStmt = db.prepare(
  `SELECT DISTINCT username FROM messages`
);

function getAllUsernames() {
  try {
    return uniqueUsersStmt.all().map(row => row.username);
  } catch (err) {
    console.error('Failed to get unique usernames:', err);
    return [];
  }
}

module.exports = {
  createMessage,
  updateMessageText,
  deleteMessage,
  clearAllMessages,
  getHistory,
  getMessageById,
  getAllUsernames,
};
