export default function OnlineUsers({ users, currentUser }) {
  return (
    <>
      <div className="online-section-title">
        Online — {users.length}
      </div>
      <ul className="online-users-list">
        {users.map((u) => (
          <li key={u} className="online-user-item">
            <span className="status-dot online" />
            <span className="text-truncate">
              {u} {u === currentUser && <em className="text-muted ms-1 small">(you)</em>}
            </span>
          </li>
        ))}
        {users.length === 0 && (
          <li className="online-user-item text-muted small">
            No one else online yet
          </li>
        )}
      </ul>
    </>
  );
}
