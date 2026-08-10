import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

// autoConnect: false lets us connect only after the user has chosen a username
export const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  extraHeaders: {
    'bypass-tunnel-reminder': 'true',
    'x-pinggy-no-screen': 'true'
  }
});
