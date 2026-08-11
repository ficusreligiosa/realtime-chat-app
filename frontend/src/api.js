const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

export async function fetchHistory(limit = 100) {
  const res = await fetch(`${SERVER_URL}/api/messages?limit=${limit}`, {
    headers: {
      'bypass-tunnel-reminder': 'true',
      'x-pinggy-no-screen': 'true'
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch history: ${res.status}`);
  }
  const data = await res.json();
  return data.messages;
}

export async function sendMessageRest(payload) {
  const res = await fetch(`${SERVER_URL}/api/messages`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'bypass-tunnel-reminder': 'true',
      'x-pinggy-no-screen': 'true'
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to send message: ${res.status}`);
  }
  const data = await res.json();
  return data.message;
}

export async function editMessageRest(id, { username, text }) {
  const res = await fetch(`${SERVER_URL}/api/messages/${id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'bypass-tunnel-reminder': 'true',
      'x-pinggy-no-screen': 'true'
    },
    body: JSON.stringify({ username, text }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to edit message: ${res.status}`);
  }
  const data = await res.json();
  return data.message;
}

export async function deleteMessageRest(id) {
  const res = await fetch(`${SERVER_URL}/api/messages/${id}`, {
    method: 'DELETE',
    headers: { 
      'bypass-tunnel-reminder': 'true',
      'x-pinggy-no-screen': 'true'
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to delete message: ${res.status}`);
  }
  return res.json();
}

export async function clearChatRest() {
  const res = await fetch(`${SERVER_URL}/api/messages`, {
    method: 'DELETE',
    headers: { 
      'bypass-tunnel-reminder': 'true',
      'x-pinggy-no-screen': 'true'
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to clear chat: ${res.status}`);
  }
  return res.json();
}
