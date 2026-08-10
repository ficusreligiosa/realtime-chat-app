import { useState } from 'react';

export default function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a username to continue.');
      return;
    }
    if (trimmed.length > 24) {
      setError('Username must be 24 characters or fewer.');
      return;
    }
    setError('');
    onLogin(trimmed);
  }

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="card login-card">
        <div className="text-center">
          <div className="login-icon-wrapper">
            <i className="bi bi-chat-text-fill" />
          </div>
          <h1 className="login-title">Realtime Chat</h1>
          <p className="text-muted small mb-4">Pick a username to join the chatroom</p>
        </div>

        <input
          autoFocus
          type="text"
          className="form-control custom-input mb-3"
          value={name}
          placeholder="Username (e.g. manav)"
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
        />

        {error && (
          <div className="alert alert-danger py-2 px-3 small mb-3 border-0 bg-danger bg-opacity-10 text-danger">
            {error}
          </div>
        )}

        <button type="submit" className="btn custom-btn w-100">
          Join Chat
        </button>
      </form>
    </div>
  );
}
