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

export default function MessageBubble({ message, isOwn }) {
  return (
    <div className={`message-row mb-2 ${isOwn ? 'own' : ''}`}>
      <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
        {!isOwn && <div className="message-author">{message.username}</div>}
        {isDataURL(message.text) ? (
          <img
            src={message.text}
            alt="Shared content"
            className="bubble-image"
            onClick={() => {
              const w = window.open();
              w.document.write(`
                <html>
                  <head>
                    <title>Image Viewer</title>
                    <style>
                      body {
                        margin: 0;
                        background: #0f0c20;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        overflow: hidden;
                        font-family: sans-serif;
                      }
                      img {
                        max-width: 90vw;
                        max-height: 90vh;
                        object-fit: contain;
                        box-shadow: 0 20px 40px rgba(0,0,0,0.6);
                        border-radius: 12px;
                        border: 1px solid rgba(255,255,255,0.1);
                      }
                    </style>
                  </head>
                  <body>
                    <img src="${message.text}" alt="Shared Image" />
                  </body>
                </html>
              `);
              w.document.close();
            }}
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
