const express = require('express');
const { createMessage, getHistory } = require('../db/messageStore');
const { countOtherOnlineUsers } = require('../sockets/chatSocket');

module.exports = function messagesRouter(io) {
  const router = express.Router();

  // GET /api/messages?limit=100 -> chat history
  router.get('/', (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
      const messages = getHistory(limit);
      res.json({ success: true, messages });
    } catch (err) {
      console.error('Failed to fetch history:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch chat history' });
    }
  });

  // POST /api/messages -> send a message (REST fallback when socket is down)
  router.post('/', (req, res) => {
    try {
      const { username, text } = req.body;

      if (!username || typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({ success: false, error: 'username is required' });
      }
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ success: false, error: 'text is required' });
      }

      const message = createMessage({ username: username.trim(), text: text.trim() });
      const othersOnline = countOtherOnlineUsers(username.trim());
      const status = othersOnline > 0 ? 'delivered' : 'sent';

      // Broadcast to all connected sockets so other users see the message in real-time
      io.emit('message:new', { ...message, status: 'delivered' });

      // Respond to the REST caller with their own status
      res.status(201).json({ success: true, message: { ...message, status } });
    } catch (err) {
      console.error('Failed to save message:', err);
      res.status(500).json({ success: false, error: 'Failed to send message' });
    }
  });

  return router;
};
