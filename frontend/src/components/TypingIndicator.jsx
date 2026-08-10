export default function TypingIndicator({ typingUsers }) {
  if (!typingUsers || typingUsers.length === 0) return null;

  const label =
    typingUsers.length === 1
      ? `${typingUsers[0]} is typing...`
      : `${typingUsers.join(', ')} are typing...`;

  return (
    <div className="d-flex align-items-center text-muted small mt-1 mb-2">
      <span className="typing-dots">
        <span></span><span></span><span></span>
      </span>
      {label}
    </div>
  );
}
