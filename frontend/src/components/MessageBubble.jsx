import { useState } from 'react';

function formatTime(isoLike) {
  try {
    const iso = isoLike.includes('T') ? isoLike : isoLike.replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function isDataURL(str) {
  return typeof str === 'string' && str.startsWith('data:image/');
}

function renderTextWithLinks(text) {
  if (!text) return null;
  // Regex to match http, https, or www URLs
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, idx) => {
    if (urlRegex.test(part)) {
      const href = part.startsWith('www.') ? `http://${part}` : part;
      return (
        <a
          key={idx}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="message-link"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function StatusTick({ status }) {
  if (status === 'delivered') {
    return <i className="bi bi-check2-all" style={{ color: '#60a5fa', fontSize: '0.95rem' }} />;
  }
  if (status === 'sending') {
    return <i className="bi bi-check2" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }} />;
  }
  return <i className="bi bi-check2" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }} />;
}

export default function MessageBubble({ message, isOwn, onImageClick, onReply, onEdit }) {
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [swipeOffset, setSwipeOffset] = useState(0);

  // View once state for images
  const isViewOnceMsg = Boolean(message.isViewOnce || message.is_view_once);
  const [viewOnceOpened, setViewOnceOpened] = useState(() => {
    if (!isViewOnceMsg) return false;
    return localStorage.getItem(`view_once_${message.id}`) === 'true';
  });

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = Math.abs(touch.clientY - touchStart.y);

    // Only swipe right if horizontal drag dominates
    if (deltaX > 0 && deltaY < 30) {
      setSwipeOffset(Math.min(deltaX, 70));
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset > 40) {
      onReply(message);
    }
    setSwipeOffset(0);
  };

  const handleDoubleClick = () => {
    onReply(message);
  };

  const handleOpenViewOnce = () => {
    setViewOnceOpened(true);
    localStorage.setItem(`view_once_${message.id}`, 'true');
    onImageClick(message.text);
  };

  const scrollToRepliedMessage = (id) => {
    if (!id) return;
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-msg');
      setTimeout(() => el.classList.remove('highlight-msg'), 1500);
    }
  };

  const replyUser = message.replyToUsername || message.reply_to_username;
  const replyText = message.replyToText || message.reply_to_text;
  const replyId = message.replyToId || message.reply_to_id;
  const isEditedMsg = Boolean(message.isEdited || message.is_edited);

  return (
    <div className={`message-row mb-2 ${isOwn ? 'own' : ''}`} id={`msg-${message.id}`}>
      <div
        className={`message-bubble ${isOwn ? 'own' : 'other'}`}
        style={{
          transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : 'none',
          transition: swipeOffset > 0 ? 'none' : 'transform 0.2s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        {/* Author header */}
        {!isOwn && <div className="message-author">{message.username}</div>}

        {/* Quoted message if this is a reply */}
        {replyUser && (
          <div className="reply-quote" onClick={() => scrollToRepliedMessage(replyId)}>
            <div className="reply-quote-author">@{replyUser}</div>
            <div className="reply-quote-text text-truncate">
              {isDataURL(replyText) ? '📷 Photo' : replyText}
            </div>
          </div>
        )}

        {/* Content body */}
        {isDataURL(message.text) ? (
          isViewOnceMsg ? (
            viewOnceOpened ? (
              <div className="view-once-opened">
                <i className="bi bi-1-circle text-muted me-1" />
                <span>Opened</span>
              </div>
            ) : (
              <button type="button" className="btn-view-once" onClick={handleOpenViewOnce}>
                <i className="bi bi-1-circle-fill me-1" />
                <span>Photo (View Once)</span>
              </button>
            )
          ) : (
            <img
              src={message.text}
              alt="Shared content"
              className="bubble-image"
              onClick={() => onImageClick(message.text)}
            />
          )
        ) : (
          <div className="message-text">{renderTextWithLinks(message.text)}</div>
        )}

        {/* Message metadata footer */}
        <div className="message-meta">
          {isEditedMsg && <span className="edited-tag me-1">(edited)</span>}
          <span>{formatTime(message.createdAt)}</span>

          {isOwn && !isDataURL(message.text) && onEdit && (
            <button
              type="button"
              className="btn-bubble-edit ms-1"
              title="Edit message"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(message);
              }}
            >
              <i className="bi bi-pencil-fill" />
            </button>
          )}

          {isOwn && (
            <span className="status-tick ms-1" title={message.status || 'sent'}>
              <StatusTick status={message.status} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
