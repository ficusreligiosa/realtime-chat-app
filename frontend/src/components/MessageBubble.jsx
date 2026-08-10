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
            <span title={message.status || 'sent'}>
              {message.status === 'delivered' ? (
                <i className="bi bi-check2-all" />
              ) : (
                <i className="bi bi-check2" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
