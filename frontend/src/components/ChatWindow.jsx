import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../socket.js';
import { fetchHistory, sendMessageRest } from '../api.js';
import MessageBubble from './MessageBubble.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import OnlineUsers from './OnlineUsers.jsx';
import ConnectionBanner from './ConnectionBanner.jsx';

const TYPING_STOP_DELAY = 1500;

function compressImage(file, maxWidth, maxHeight, quality, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      
      const head = 'data:image/jpeg;base64,'.length;
      const sizeInBytes = Math.round((compressedDataUrl.length - head) * 0.75);

      callback(compressedDataUrl, sizeInBytes);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

export default function ChatWindow({ username, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [connected, setConnected] = useState(socket.connected);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [sendError, setSendError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [imageDraft, setImageDraft] = useState('');
  const [imageName, setImageName] = useState('');
  const [imageSize, setImageSize] = useState(0);
  const [lightboxImage, setLightboxImage] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const sendLockRef = useRef(false); // synchronous lock — React state is async and batched, so it can't prevent double-sends

  // Load history + connect socket on mount
  useEffect(() => {
    let cancelled = false;

    fetchHistory(100)
      .then((history) => {
        if (!cancelled) {
          // History messages are confirmed saved — mark them all as delivered
          const historyWithStatus = history.map((m) => ({ ...m, status: 'delivered' }));
          setMessages(historyWithStatus);

          // Pre-populate presence list from message authors (offline fallback)
          const uniqueUsernames = Array.from(new Set(history.map((m) => m.username)))
            .filter((u) => u && u.trim());
          if (!uniqueUsernames.includes(username)) {
            uniqueUsernames.push(username);
          }
          setOnlineUsers((prev) => {
            // Only set fallback if we don't already have a server-provided list
            if (prev.length > 0) return prev;
            return uniqueUsernames.map((u) => ({
              username: u,
              isOnline: false
            }));
          });
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setHistoryError('Could not load previous messages.');
      });
    function handleConnect() {
      setConnected(true);
      socket.emit('user:join', username);
      setOnlineUsers((prev) =>
        prev.map((u) => (u.username === username ? { ...u, isOnline: true } : u))
      );
    }
    function handleDisconnect() {
      setConnected(false);
      setOnlineUsers((prev) =>
        prev.map((u) => (u.username === username ? { ...u, isOnline: false } : u))
      );
    }
    function handleNewMessage(message) {
      setMessages((prev) => {
        // 1. Replace optimistic message if tempId matches
        if (message.tempId) {
          const hasOptimistic = prev.some((m) => m.id === message.tempId);
          if (hasOptimistic) {
            return prev.map((m) =>
              m.id === message.tempId
                ? { ...message, id: message.id, status: message.status || 'delivered' }
                : m
            );
          }
        }
        // 2. Skip if we already have this server message id (dedup)
        if (prev.some((m) => m.id === message.id)) return prev;
        // 3. New message from another user or from REST fallback
        return [...prev, { ...message, status: message.status || 'delivered' }];
      });
    }
    function handleUsersPresence(presenceList) {
      setOnlineUsers(presenceList);
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
    socket.on('users:presence', handleUsersPresence);
    socket.on('typing:update', handleTypingUpdate);
    socket.on('error:message', handleSocketError);

    socket.connect();

    return () => {
      cancelled = true;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('message:new', handleNewMessage);
      socket.off('users:presence', handleUsersPresence);
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

  function handleFileClick() {
    fileInputRef.current?.click();
  }

  function handleCameraClick() {
    cameraInputRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSendError('Please select a valid image file.');
      return;
    }

    setSendError('Compressing image...');
    setImageName(file.name);

    compressImage(file, 1200, 1200, 0.7, (compressedDataUrl, sizeInBytes) => {
      const MAX_SIZE = 1.5 * 1024 * 1024; // 1.5MB safety margin
      if (sizeInBytes > MAX_SIZE) {
        setSendError('Compressed image is still too large. Please select a smaller photo.');
        setImageDraft('');
        setImageName('');
        setImageSize(0);
        return;
      }
      setSendError('');
      setImageDraft(compressedDataUrl);
      setImageSize(sizeInBytes);
    });

    e.target.value = '';
  }

  function handleRemoveImage() {
    setImageDraft('');
    setImageName('');
    setImageSize(0);
  }

  async function handleSend(e) {
    e.preventDefault();

    // Synchronous lock — React state is batched/async so it can't guard against rapid double-clicks
    if (sendLockRef.current) return;

    const text = draft.trim();
    const image = imageDraft;
    if (!text && !image) return;

    sendLockRef.current = true;
    setDraft('');
    setImageDraft('');
    setImageName('');
    setImageSize(0);
    setSendError('');
    clearTimeout(typingTimeoutRef.current);
    stopTyping();

    const payloads = [];
    if (image) payloads.push({ username, text: image });
    if (text) payloads.push({ username, text });

    let remaining = payloads.length;
    function unlock() {
      remaining--;
      if (remaining <= 0) sendLockRef.current = false;
    }

    for (const payload of payloads) {
      const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

      // Optimistically show the message with 'sending' status (single grey tick)
      setMessages((prev) => [
        ...prev,
        { id: tempId, username, text: payload.text, createdAt: new Date().toISOString(), status: 'sending' },
      ]);

      if (connected) {
        socket.emit('message:send', { ...payload, tempId }, (ack) => {
          if (!ack?.success) {
            setSendError(ack?.error || 'Failed to send message.');
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
          }
          unlock();
        });
      } else {
        try {
          const message = await sendMessageRest(payload);
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...message, status: 'delivered' } : m))
          );
        } catch (err) {
          console.error(err);
          setSendError('Failed to send message. Please check your connection.');
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
        }
        unlock();
      }
    }
  }

  return (
    <div className="chat-layout">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <button type="button" className="btn-close-lightbox" onClick={() => setLightboxImage(null)}>
            <i className="bi bi-x-lg"></i>
          </button>
          <img src={lightboxImage} alt="Fullscreen Preview" className="lightbox-image" />
        </div>
      )}
      
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span className="user-badge text-truncate">
            <i className="bi bi-person-circle text-primary" />
            {username}
          </span>
          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-close-sidebar d-lg-none" onClick={() => setSidebarOpen(false)}>
              <i className="bi bi-x-lg"></i>
            </button>
            <button className="btn btn-leave" onClick={onLogout}>
              Leave
            </button>
          </div>
        </div>
        <OnlineUsers users={onlineUsers} currentUser={username} />
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <button type="button" className="btn btn-toggle-sidebar" onClick={() => setSidebarOpen(true)}>
            <i className="bi bi-people-fill"></i>
          </button>
          <h2 className="chat-title">Global Room</h2>
          <div className="d-lg-none" style={{ width: 32 }} />
        </header>

        <ConnectionBanner connected={connected} />
        {historyError && (
          <div className="custom-banner-error text-center">{historyError}</div>
        )}

        <div className="messages-list">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isOwn={m.username === username}
              onImageClick={setLightboxImage}
            />
          ))}
          <TypingIndicator typingUsers={typingUsers} />
          <div ref={messagesEndRef} />
        </div>

        {sendError && (
          <div className="custom-banner-error text-center">{sendError}</div>
        )}

        <form className="input-area" onSubmit={handleSend}>
          {imageDraft && (
            <div className="image-preview-bar">
              <div className="image-preview-wrapper">
                <img src={imageDraft} alt="Preview" />
              </div>
              <div className="image-preview-info">
                <div className="image-preview-name text-truncate">{imageName}</div>
                <div className="image-preview-size">{(imageSize / 1024).toFixed(1)} KB</div>
              </div>
              <button type="button" className="btn btn-remove-preview" onClick={handleRemoveImage}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <div className="input-container">
            <button type="button" className="btn btn-attach" onClick={handleFileClick} title="Upload Image">
              <i className="bi bi-image" />
            </button>
            <button type="button" className="btn btn-attach" onClick={handleCameraClick} title="Open Camera">
              <i className="bi bi-camera-fill" />
            </button>
            <input
              type="text"
              className="form-control custom-input"
              placeholder="Type a message..."
              value={draft}
              onChange={handleDraftChange}
              onBlur={stopTyping}
              maxLength={2000}
            />
            <button type="submit" className="btn btn-send" disabled={!draft.trim() && !imageDraft}>
              <i className="bi bi-send-fill" />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
