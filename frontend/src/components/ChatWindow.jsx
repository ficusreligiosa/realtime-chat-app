import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../socket.js';
import { fetchHistory, sendMessageRest, editMessageRest } from '../api.js';
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

  // New features state: Replying, Editing, View Once
  const [replyingTo, setReplyingTo] = useState(null); // { id, username, text }
  const [editingMessage, setEditingMessage] = useState(null); // { id, text }
  const [isViewOnce, setIsViewOnce] = useState(false);

  const [imageDraft, setImageDraft] = useState('');
  const [imageName, setImageName] = useState('');
  const [imageSize, setImageSize] = useState(0);
  const [lightboxImage, setLightboxImage] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const sendLockRef = useRef(false);

  // Load history + connect socket on mount
  useEffect(() => {
    let cancelled = false;

    fetchHistory(100)
      .then((history) => {
        if (!cancelled) {
          const historyWithStatus = history.map((m) => ({ ...m, status: 'delivered' }));
          setMessages(historyWithStatus);

          const uniqueUsernames = Array.from(new Set(history.map((m) => m.username)))
            .filter((u) => u && u.trim());
          if (!uniqueUsernames.includes(username)) {
            uniqueUsernames.push(username);
          }
          setOnlineUsers((prev) => {
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
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, { ...message, status: message.status || 'delivered' }];
      });
    }

    function handleEditedMessage(editedMsg) {
      setMessages((prev) =>
        prev.map((m) => (m.id === editedMsg.id ? { ...m, ...editedMsg, isEdited: 1 } : m))
      );
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
    socket.on('message:edited', handleEditedMessage);
    socket.on('users:presence', handleUsersPresence);
    socket.on('typing:update', handleTypingUpdate);
    socket.on('error:message', handleSocketError);

    socket.connect();

    return () => {
      cancelled = true;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('message:new', handleNewMessage);
      socket.off('message:edited', handleEditedMessage);
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

  // Keep messages visible when mobile keyboard opens/closes
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function handleViewportResize() {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }

    vv.addEventListener('resize', handleViewportResize);
    return () => vv.removeEventListener('resize', handleViewportResize);
  }, []);

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
      const MAX_SIZE = 1.5 * 1024 * 1024;
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
    setIsViewOnce(false);
  }

  const handleStartReply = (msg) => {
    setEditingMessage(null);
    setReplyingTo({
      id: msg.id,
      username: msg.username,
      text: msg.text,
    });
  };

  const handleStartEdit = (msg) => {
    setReplyingTo(null);
    setEditingMessage({
      id: msg.id,
      text: msg.text,
    });
    setDraft(msg.text);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setDraft('');
  };

  async function handleSend(e) {
    e.preventDefault();

    // Handling message edit mode
    if (editingMessage) {
      const newText = draft.trim();
      if (!newText) return;

      const editId = editingMessage.id;
      setEditingMessage(null);
      setDraft('');

      // Optimistically update locally
      setMessages((prev) =>
        prev.map((m) => (m.id === editId ? { ...m, text: newText, isEdited: 1 } : m))
      );

      if (connected) {
        socket.emit('message:edit', { id: editId, text: newText }, (ack) => {
          if (!ack?.success) {
            setSendError(ack?.error || 'Failed to edit message.');
          }
        });
      } else {
        try {
          await editMessageRest(editId, { username, text: newText });
        } catch (err) {
          console.error(err);
          setSendError('Failed to edit message via REST.');
        }
      }
      return;
    }

    // Handling new message / image send
    if (sendLockRef.current) return;

    const text = draft.trim();
    const image = imageDraft;
    if (!text && !image) return;

    sendLockRef.current = true;
    const currentReply = replyingTo;
    const currentViewOnce = isViewOnce;

    setDraft('');
    setImageDraft('');
    setImageName('');
    setImageSize(0);
    setReplyingTo(null);
    setIsViewOnce(false);
    setSendError('');
    clearTimeout(typingTimeoutRef.current);
    stopTyping();

    const payloads = [];
    if (image) {
      payloads.push({
        username,
        text: image,
        replyToId: currentReply?.id,
        replyToUsername: currentReply?.username,
        replyToText: currentReply?.text,
        isViewOnce: currentViewOnce,
      });
    }
    if (text) {
      payloads.push({
        username,
        text,
        replyToId: currentReply?.id,
        replyToUsername: currentReply?.username,
        replyToText: currentReply?.text,
        isViewOnce: 0,
      });
    }

    let remaining = payloads.length;
    function unlock() {
      remaining--;
      if (remaining <= 0) sendLockRef.current = false;
    }

    for (const payload of payloads) {
      const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          username,
          text: payload.text,
          replyToId: payload.replyToId,
          replyToUsername: payload.replyToUsername,
          replyToText: payload.replyToText,
          isViewOnce: payload.isViewOnce,
          createdAt: new Date().toISOString(),
          status: 'sending',
        },
      ]);

      if (connected) {
        socket.emit('message:send', { ...payload, tempId }, (ack) => {
          if (ack?.success) {
            const serverMsg = ack.message;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId
                  ? { ...serverMsg, status: serverMsg.status || 'sent' }
                  : m
              )
            );
          } else {
            setSendError(ack?.error || 'Failed to send message.');
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
          }
          unlock();
        });
      } else {
        try {
          const message = await sendMessageRest(payload);
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...message, status: message.status || 'sent' } : m))
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
              onReply={handleStartReply}
              onEdit={handleStartEdit}
            />
          ))}
          <TypingIndicator typingUsers={typingUsers} />
          <div ref={messagesEndRef} />
        </div>

        {sendError && (
          <div className="custom-banner-error text-center">{sendError}</div>
        )}

        <form className="input-area" onSubmit={handleSend}>
          {/* Replying banner */}
          {replyingTo && (
            <div className="input-action-banner reply-mode">
              <div className="action-banner-info text-truncate">
                <i className="bi bi-reply-fill me-1" />
                Replying to <strong>@{replyingTo.username}</strong>: "{replyingTo.text.slice(0, 40)}"
              </div>
              <button type="button" className="btn-close-banner" onClick={() => setReplyingTo(null)}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
          )}

          {/* Editing banner */}
          {editingMessage && (
            <div className="input-action-banner edit-mode">
              <div className="action-banner-info text-truncate">
                <i className="bi bi-pencil-fill me-1" />
                Editing message
              </div>
              <button type="button" className="btn-close-banner" onClick={handleCancelEdit}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
          )}

          {imageDraft && (
            <div className="image-preview-bar">
              <div className="image-preview-wrapper">
                <img src={imageDraft} alt="Preview" />
              </div>
              <div className="image-preview-info">
                <div className="image-preview-name text-truncate">{imageName}</div>
                <div className="image-preview-size">{(imageSize / 1024).toFixed(1)} KB</div>
              </div>
              <button
                type="button"
                className={`btn-view-once-toggle ${isViewOnce ? 'active' : ''}`}
                onClick={() => setIsViewOnce(!isViewOnce)}
                title="Toggle View Once"
              >
                <i className={isViewOnce ? 'bi bi-1-circle-fill' : 'bi bi-1-circle'} />
                <span className="ms-1 d-none d-sm-inline">View Once</span>
              </button>
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
              placeholder={editingMessage ? 'Edit your message...' : 'Type a message...'}
              value={draft}
              onChange={handleDraftChange}
              onBlur={stopTyping}
              maxLength={2000}
            />
            <button type="submit" className="btn btn-send" disabled={!draft.trim() && !imageDraft}>
              <i className={editingMessage ? 'bi bi-check-lg' : 'bi bi-send-fill'} />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
