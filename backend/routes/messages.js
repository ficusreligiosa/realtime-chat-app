const express = require('express');
const { createMessage, getHistory } = require('../db/messageStore');

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

  // POST /api/messages -> send a message (also used as a fallback if socket is down)
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

      // Broadcast to all connected clients so REST-sent messages also show up live
      io.emit('message:new', message);

      res.status(201).json({ success: true, message });
    } catch (err) {
      console.error('Failed to save message:', err);
      res.status(500).json({ success: false, error: 'Failed to send message' });
    }
  });

  return router;
};
