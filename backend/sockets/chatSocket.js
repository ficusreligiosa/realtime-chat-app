const { createMessage, updateMessageText, getAllUsernames } = require('../db/messageStore');

/**
 * Tracks which usernames are currently online.
 * Map<username (lowercased), Set<socketId>> — a user can have multiple tabs/devices open,
 * so we only mark them offline once every socket for that username disconnects.
 * We also store the original-case display name.
 */
const onlineUsers = new Map(); // key: lowercase username, value: { displayName, sockets: Set<socketId> }

function addOnlineUser(username, socketId) {
  const key = username.toLowerCase();
  if (!onlineUsers.has(key)) {
    onlineUsers.set(key, { displayName: username, sockets: new Set() });
  }
  onlineUsers.get(key).sockets.add(socketId);
}

function removeOnlineUser(username, socketId) {
  const key = username.toLowerCase();
  const entry = onlineUsers.get(key);
  if (!entry) return;
  entry.sockets.delete(socketId);
  if (entry.sockets.size === 0) onlineUsers.delete(key);
}

function getOnlineUsernames() {
  return Array.from(onlineUsers.values()).map(e => e.displayName);
}

function getUsersPresenceList() {
  const dbUsers = getAllUsernames();
  const activeKeys = new Set(Array.from(onlineUsers.keys()));
  const seen = new Set();
  const result = [];

  // Add all online users first
  for (const [key, entry] of onlineUsers) {
    seen.add(key);
    result.push({ username: entry.displayName, isOnline: true });
  }

  // Add offline users from DB history
  for (const dbUser of dbUsers) {
    const k = dbUser.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      result.push({ username: dbUser, isOnline: false });
    }
  }

  return result;
}

/**
 * Count how many OTHER users (not the sender) are currently online.
 */
function countOtherOnlineUsers(senderUsername) {
  const senderKey = senderUsername.toLowerCase();
  let count = 0;
  for (const [key] of onlineUsers) {
    if (key !== senderKey) count++;
  }
  return count;
}

function registerChatSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    socket.on('user:join', (username) => {
      try {
        if (!username || typeof username !== 'string') return;
        socket.data.username = username.trim();
        addOnlineUser(socket.data.username, socket.id);

        io.emit('users:presence', getUsersPresenceList());
        console.log(`[socket] ${socket.data.username} joined (${socket.id})`);
      } catch (err) {
        console.error('[socket] user:join error:', err);
        socket.emit('error:message', 'Failed to join chat');
      }
    });

    socket.on('message:send', (payload, ack) => {
      try {
        const username = (payload && payload.username) || socket.data.username;
        const text = payload && payload.text;
        const tempId = payload && payload.tempId;

        if (!username || !text || !text.trim()) {
          const errMsg = 'username and text are required';
          if (typeof ack === 'function') ack({ success: false, error: errMsg });
          socket.emit('error:message', errMsg);
          return;
        }

        const message = createMessage({
          username: username.trim(),
          text: text.trim(),
          replyToId: payload.replyToId,
          replyToUsername: payload.replyToUsername,
          replyToText: payload.replyToText,
          isViewOnce: payload.isViewOnce,
        });
        const othersOnline = countOtherOnlineUsers(username.trim());
        const status = othersOnline > 0 ? 'delivered' : 'sent';

        // Broadcast to everyone EXCEPT the sender — sender updates via ack callback
        socket.broadcast.emit('message:new', { ...message, status: 'delivered' });

        // Ack to sender with the correct status for their own message
        if (typeof ack === 'function') {
          ack({ success: true, message: { ...message, status, tempId } });
        }

        io.emit('users:presence', getUsersPresenceList());
      } catch (err) {
        console.error('[socket] message:send error:', err);
        if (typeof ack === 'function') ack({ success: false, error: 'Failed to send message' });
        socket.emit('error:message', 'Failed to send message');
      }
    });

    socket.on('message:edit', (payload, ack) => {
      try {
        const username = socket.data.username;
        const { id, text } = payload || {};
        if (!username || !id || !text || !text.trim()) {
          if (typeof ack === 'function') ack({ success: false, error: 'Invalid edit payload' });
          return;
        }

        const updated = updateMessageText(id, username, text.trim());
        if (updated) {
          io.emit('message:edited', updated);
          if (typeof ack === 'function') ack({ success: true, message: updated });
        } else {
          if (typeof ack === 'function') ack({ success: false, error: 'Cannot edit message' });
        }
      } catch (err) {
        console.error('[socket] message:edit error:', err);
        if (typeof ack === 'function') ack({ success: false, error: 'Failed to edit message' });
      }
    });

    socket.on('typing:start', (username) => {
      socket.broadcast.emit('typing:update', { username: username || socket.data.username, isTyping: true });
    });

    socket.on('typing:stop', (username) => {
      socket.broadcast.emit('typing:update', { username: username || socket.data.username, isTyping: false });
    });

    socket.on('disconnect', (reason) => {
      try {
        const username = socket.data.username;
        if (username) {
          removeOnlineUser(username, socket.id);
          io.emit('users:presence', getUsersPresenceList());
          console.log(`[socket] ${username} disconnected (${reason})`);
        }
      } catch (err) {
        console.error('[socket] disconnect handling error:', err);
      }
    });
  });
}

module.exports = { registerChatSocket, getOnlineUsernames, countOtherOnlineUsers };
