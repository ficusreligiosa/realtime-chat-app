export default function OnlineUsers({ users, currentUser }) {
  const sortedUsers = [...users].sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return a.username.localeCompare(b.username);
  });

  const onlineCount = users.filter((u) => u.isOnline).length;

  return (
    <>
      <div className="online-section-title">
        Members ({onlineCount} online)
      </div>
      <ul className="online-users-list">
        {sortedUsers.map((u) => (
          <li key={u.username} className={`online-user-item ${u.isOnline ? 'active-member' : 'offline-member'}`}>
            <span className={`status-dot ${u.isOnline ? 'online' : 'offline'}`} />
            <span className="text-truncate" style={u.isOnline ? {} : { opacity: 0.5 }}>
              {u.username} {u.username === currentUser && <em className="text-muted ms-1 small">(you)</em>}
            </span>
          </li>
        ))}
        {users.length === 0 && (
          <li className="online-user-item text-muted small">
            No members yet
          </li>
        )}
      </ul>
    </>
  );
}
