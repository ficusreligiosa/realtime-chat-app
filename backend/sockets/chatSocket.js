const { createMessage, getAllUsernames } = require('../db/messageStore');

/**
 * Tracks which usernames are currently online.
 * Map<username, Set<socketId>> — a user can have multiple tabs/devices open,
 * so we only mark them offline once every socket for that username disconnects.
 */
const onlineUsers = new Map();

function addOnlineUser(username, socketId) {
  if (!onlineUsers.has(username)) onlineUsers.set(username, new Set());
  onlineUsers.get(username).add(socketId);
}

function removeOnlineUser(username, socketId) {
  const sockets = onlineUsers.get(username);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) onlineUsers.delete(username);
}

function getOnlineUsernames() {
  return Array.from(onlineUsers.keys());
}

function getUsersPresenceList() {
  const dbUsers = getAllUsernames();
  const activeUsers = getOnlineUsernames();
  const allUsers = new Set([...dbUsers, ...activeUsers]);
  
  return Array.from(allUsers).map(username => ({
    username,
    isOnline: activeUsers.includes(username)
  }));
}

/**
 * Determine message status based on whether other users are online.
 * 'sent'      = saved to DB, no other users connected to receive it
 * 'delivered'  = saved to DB AND at least one other user is connected
 */
function determineStatus(senderUsername) {
  const others = getOnlineUsernames().filter(u => u !== senderUsername);
  return others.length > 0 ? 'delivered' : 'sent';
}

function registerChatSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // Client identifies itself right after connecting
    socket.on('user:join', (username) => {
      try {
        if (!username || typeof username !== 'string') return;
        socket.data.username = username.trim();
        addOnlineUser(socket.data.username, socket.id);

        // Let everyone know the updated presence list (online + offline users)
        io.emit('users:presence', getUsersPresenceList());
        console.log(`[socket] ${socket.data.username} joined (${socket.id})`);
      } catch (err) {
        console.error('[socket] user:join error:', err);
        socket.emit('error:message', 'Failed to join chat');
      }
    });

    // Incoming chat message
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

        const message = createMessage({ username: username.trim(), text: text.trim() });
        const status = determineStatus(username.trim());

        // Broadcast to everyone, including sender, with computed status and tempId
        io.emit('message:new', { ...message, status, tempId });

        // If this is a new username sending a message, update the presence lists
        io.emit('users:presence', getUsersPresenceList());

        if (typeof ack === 'function') ack({ success: true, message: { ...message, status } });
      } catch (err) {
        console.error('[socket] message:send error:', err);
        if (typeof ack === 'function') ack({ success: false, error: 'Failed to send message' });
        socket.emit('error:message', 'Failed to send message');
      }
    });

    // Typing indicator
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

module.exports = { registerChatSocket, getOnlineUsernames };
