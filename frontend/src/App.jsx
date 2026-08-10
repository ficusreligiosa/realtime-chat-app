// Trigger Vercel rebuild
import { useState } from 'react';
import Login from './components/Login.jsx';
import ChatWindow from './components/ChatWindow.jsx';

const STORAGE_KEY = 'chat_username';

export default function App() {
  const [username, setUsername] = useState(() => sessionStorage.getItem(STORAGE_KEY) || '');

  function handleLogin(name) {
    sessionStorage.setItem(STORAGE_KEY, name);
    setUsername(name);
  }

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setUsername('');
  }

  if (!username) {
    return <Login onLogin={handleLogin} />;
  }

  return <ChatWindow username={username} onLogout={handleLogout} />;
}
