import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../socket.js';
import { fetchHistory, sendMessageRest } from '../api.js';
import MessageBubble from './MessageBubble.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import OnlineUsers from './OnlineUsers.jsx';
import ConnectionBanner from './ConnectionBanner.jsx';

const TYPING_STOP_DELAY = 1500;

export default function ChatWindow({ username, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [connected, setConnected] = useState(socket.connected);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [sendError, setSendError] = useState('');

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Load history + connect socket on mount
  useEffect(() => {
    let cancelled = false;

    fetchHistory(100)
      .then((history) => {
        if (!cancelled) setMessages(history);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setHistoryError('Could not load previous messages.');
      });

    socket.connect();
    socket.emit('user:join', username);

    function handleConnect() {
      setConnected(true);
      socket.emit('user:join', username);
    }
    function handleDisconnect() {
      setConnected(false);
    }
    function handleNewMessage(message) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev; // avoid dupes from REST fallback
        return [...prev, message];
      });
    }
    function handleOnlineUsers(users) {
      setOnlineUsers(users);
    }
    function handleTypingUpdate({ username: who, isTyping }) {
      if (who === username) return;
      setTypingUsers((prev) => {
        if (isTyping) return prev.includes(who) ? prev : [...prev, who];
        return prev.filter((u) => u !== who);
      });
    }
    function handleSocketError(msg) {
      setSendError(msg);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('message:new', handleNewMessage);
    socket.on('users:online', handleOnlineUsers);
    socket.on('typing:update', handleTypingUpdate);
    socket.on('error:message', handleSocketError);

    return () => {
      cancelled = true;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('message:new', handleNewMessage);
      socket.off('users:online', handleOnlineUsers);
      socket.off('typing:update', handleTypingUpdate);
      socket.off('error:message', handleSocketError);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const stopTyping = useCallback(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit('typing:stop', username);
    }
  }, [username]);

  function handleDraftChange(e) {
    setDraft(e.target.value);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing:start', username);
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, TYPING_STOP_DELAY);
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setDraft('');
    setSendError('');
    clearTimeout(typingTimeoutRef.current);
    stopTyping();

    const payload = { username, text };

    if (connected) {
      socket.emit('message:send', payload, (ack) => {
        if (!ack?.success) {
          setSendError(ack?.error || 'Failed to send message.');
        }
      });
    } else {
      // Fallback to REST if the socket is temporarily disconnected
      try {
        const message = await sendMessageRest(payload);
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      } catch (err) {
        console.error(err);
        setSendError('Failed to send message. Please check your connection.');
      }
    }
  }

  return (
    <div className="chat-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="user-badge text-truncate">
            <i className="bi bi-person-circle text-primary" />
            {username}
          </span>
          <button className="btn btn-leave" onClick={onLogout}>
            Leave
          </button>
        </div>
        <OnlineUsers users={onlineUsers} currentUser={username} />
      </aside>

      <main className="chat-main">
        <ConnectionBanner connected={connected} />
        {historyError && (
          <div className="custom-banner-error text-center">{historyError}</div>
        )}

        <div className="messages-list">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} isOwn={m.username === username} />
          ))}
          <TypingIndicator typingUsers={typingUsers} />
          <div ref={messagesEndRef} />
        </div>

        {sendError && (
          <div className="custom-banner-error text-center">{sendError}</div>
        )}

        <form className="input-area" onSubmit={handleSend}>
          <div className="input-container">
            <input
              type="text"
              className="form-control custom-input"
              placeholder="Type a message..."
              value={draft}
              onChange={handleDraftChange}
              onBlur={stopTyping}
              maxLength={2000}
            />
            <button type="submit" className="btn btn-send" disabled={!draft.trim()}>
              <i className="bi bi-send-fill" />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
