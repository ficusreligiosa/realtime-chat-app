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

function StatusTick({ status }) {
  if (status === 'delivered') {
    // Double blue tick — delivered to at least one other online user
    return <i className="bi bi-check2-all" style={{ color: '#60a5fa', fontSize: '0.95rem' }} />;
  }
  if (status === 'sending') {
    // Single grey tick — in transit, not yet confirmed by server
    return <i className="bi bi-check2" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }} />;
  }
  // 'sent' or default — single tick, confirmed by server but no other users online
  return <i className="bi bi-check2" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }} />;
}

export default function MessageBubble({ message, isOwn, onImageClick }) {
  return (
    <div className={`message-row mb-2 ${isOwn ? 'own' : ''}`}>
      <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
        {!isOwn && <div className="message-author">{message.username}</div>}
        {isDataURL(message.text) ? (
          <img
            src={message.text}
            alt="Shared content"
            className="bubble-image"
            onClick={() => onImageClick(message.text)}
          />
        ) : (
          <div className="message-text">{message.text}</div>
        )}
        <div className="message-meta">
          <span>{formatTime(message.createdAt)}</span>
          {isOwn && (
            <span className="status-tick" title={message.status || 'sent'}>
              <StatusTick status={message.status} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
