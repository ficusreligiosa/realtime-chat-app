# Realtime Chat App

A real-time chat application built with **React (Vite)** on the frontend and **Node.js + Express + Socket.io + SQLite** on the backend.

> **Note on frontend framework:** The brief asked for React Native (preferred) or React. This was built with **React (web)** rather than React Native, because producing and testing this in the environment it was built in doesn't have an Android SDK / Expo build toolchain available to compile and verify an APK. All the chat logic — REST calls, Socket.io events, state management — is written in plain hooks-based React components with no web-only APIs beyond `fetch`/`sessionStorage`, so it would port to React Native (`View`/`Text`/`FlatList` instead of `div`/`p`/scroll container, `AsyncStorage` instead of `sessionStorage`) with very little rework. See **Assumptions** below.

---

## Features

- **Realtime Messaging**: Send and receive messages instantly via Socket.io (no polling, no page refresh)
- **Persistent Chat History**: Saved in SQLite database on the backend and fetched via REST API on page reload
- **Timestamps**: Displayed on all messages
- **Dummy Authentication**: Username-based login (no password required)
- **Presence List**: Active online/offline user list shown in a sliding responsive drawer on mobile
- **Typing Indicator**: Real-time broadcast when other users are typing
- **Message Status Ticks**: Double-ticks to show when a message has been delivered/saved to the database
- **Image Sharing & Camera Capture**:
  - Image Upload button (select from gallery)
  - Dedicated Mobile Camera trigger button (takes a photo directly on mobile device)
  - Client-side Canvas Compression (automatically resizes and optimizes large camera files down to ~150KB to prevent layout lag)
  - Interactive full-screen glassmorphic Lightbox overlay to view photos in-app
- **Resilience**: Falls back to REST `POST /api/messages` if the websocket drops, with a visual "Reconnecting" connection status banner
- **Premium Glassmorphic Design**: Clean mobile-first responsive layout with dynamic drawer sidebars and animations

---

## Project structure

```
chat-app/
├── backend/
│   ├── db/
│   │   ├── index.js          # SQLite connection + schema
│   │   └── messageStore.js   # Data-access layer for messages
│   ├── routes/
│   │   └── messages.js       # REST endpoints (send / history)
│   ├── sockets/
│   │   └── chatSocket.js     # Socket.io event handlers (message, typing, presence)
│   ├── server.js             # App entrypoint (Express + Socket.io wiring)
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Login.jsx
    │   │   ├── ChatWindow.jsx
    │   │   ├── MessageBubble.jsx
    │   │   ├── TypingIndicator.jsx
    │   │   ├── OnlineUsers.jsx
    │   │   └── ConnectionBanner.jsx
    │   ├── styles/index.css  # Small stylesheet layered on top of Bootstrap
    │   ├── api.js             # REST helper functions
    │   ├── socket.js           # Socket.io client singleton
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html              # Loads Bootstrap 5 via CDN
    ├── .env.example
    └── package.json
```

---

## Prerequisites

- Node.js 18+ and npm
- No external database needed — SQLite is a local file, created automatically on first run

---

## Backend setup

```bash
cd backend
npm install
cp .env.example .env
npm start        # or: npm run dev  (nodemon, auto-restart)
```

The server starts on `http://localhost:5000` by default and creates `backend/db/chat.sqlite3` automatically on first run.

### Backend environment variables (`backend/.env`)

| Variable         | Description                                         | Default                   |
|-------------------|-----------------------------------------------------|----------------------------|
| `PORT`            | Port the Express/Socket.io server listens on        | `5000`                     |
| `CLIENT_ORIGIN`   | Allowed CORS origin(s) for REST + sockets, comma-sep | `http://localhost:5173`   |
| `DB_PATH`         | Path to the SQLite file                              | `./db/chat.sqlite3`       |

### REST API

| Method | Endpoint             | Description                                  |
|--------|-----------------------|-----------------------------------------------|
| GET    | `/api/health`         | Health check                                  |
| GET    | `/api/messages?limit=` | Fetch chat history (oldest → newest, default limit 100) |
| POST   | `/api/messages`       | Send a message — body `{ username, text }`. Also broadcasts over the socket, used as a fallback path when the client's socket is disconnected. |

### Socket.io events

| Event            | Direction        | Payload                                   |
|-------------------|------------------|---------------------------------------------|
| `user:join`       | client → server  | `username`                                   |
| `message:send`    | client → server  | `{ username, text }` (+ ack callback)        |
| `message:new`     | server → clients | saved message row (broadcast to everyone)    |
| `typing:start`    | client → server  | `username`                                   |
| `typing:stop`     | client → server  | `username`                                   |
| `typing:update`   | server → clients | `{ username, isTyping }`                     |
| `users:online`    | server → clients | array of online usernames                    |
| `error:message`   | server → client  | error string                                 |

---

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Opens at `http://localhost:5173` by default.

### Frontend environment variables (`frontend/.env`)

| Variable          | Description                                | Default                  |
|--------------------|---------------------------------------------|----------------------------|
| `VITE_SERVER_URL`  | Base URL of the backend (REST + Socket.io) | `http://localhost:5000`  |

### Build for production

```bash
npm run build     # outputs to frontend/dist
npm run preview   # serve the production build locally
```

---

## Running both together

1. Start the backend first (`cd backend && npm start`) so the SQLite DB and Socket.io server are ready.
2. Start the frontend (`cd frontend && npm run dev`).
3. Open `http://localhost:5173` in two different browser tabs/windows with two different usernames to see real-time delivery, typing indicators, and online presence working between them.

---

## Design decisions

- **SQLite via `better-sqlite3`** instead of MongoDB — the brief listed SQLite as an accepted option, and a synchronous, zero-config, single-file database keeps setup to `npm install` with nothing else to run, which matters most for a reviewer trying this in 24 hours.
- **One broadcast channel of truth**: both the REST `POST` and the socket `message:send` path write to the same `messageStore` and then `io.emit('message:new', ...)` to every connected client, including the sender. This means the UI never "optimistically" renders a message that might not match what got saved — every bubble on screen came from the server's copy, and duplicate IDs are de-duped client-side.
- **REST fallback for sending**: if a client's socket connection drops, the message form still works over plain `POST /api/messages`, so a flaky connection doesn't fully block the user; a banner tells them they're reconnecting.
- **Presence tracked per-username with a socket-ID set**, not per-socket — so a user with two tabs open doesn't flicker offline when they close one of them; they only go offline when every one of their sockets disconnects.
- **Bootstrap 5 via CDN** for styling rather than a custom design system, to keep the UI clean and fast to review without a heavy CSS build step; only chat-specific bits (bubble shapes, typing-dot animation, scroll containment) are custom CSS.
- **`sessionStorage` for the dummy username**, not `localStorage` — intentional, so each browser tab/session asks for a username again rather than persisting a login indefinitely, which suits the "dummy auth" nature of the login.

## Assumptions

- "Username-based login" means no password or account system — anyone can type any username and join; usernames are not checked for uniqueness.
- Chat is a single global room; there's no concept of separate conversations/DMs.
- History is capped to the most recent 100 messages by default (configurable via `?limit=`) rather than loading the entire table, since an unbounded history fetch isn't realistic for a growing chat log.
- "Message read status" is simplified to sent vs. delivered (double-tick once the server has persisted and broadcast the message) rather than full per-recipient read receipts, since this is a single shared room rather than 1:1 conversations where "read by whom" would be well-defined.
- Built and verified as a React web app rather than a React Native app — see the note at the top of this file.

## Submission & Deployment Details

This project is fully deployed and active.

### Live Links
*   **GitHub Repository**: [https://github.com/ficusreligiosa/realtime-chat-app](https://github.com/ficusreligiosa/realtime-chat-app)
*   **Live Web Client (Vercel)**: [https://realtime-chat-app-eight-steel.vercel.app](https://realtime-chat-app-eight-steel.vercel.app)
*   **Live Backend REST/Socket API (Render)**: [https://realtime-chat-app-backend-n2j7.onrender.com](https://realtime-chat-app-backend-n2j7.onrender.com)

### Verification & Testing
1. **Desktop / Mobile Browsing**: You can open the live link on two different devices (e.g. your computer and your phone) or open it in a private browser window. Log in with different usernames to test real-time chat, typing indicators, image attachments, camera triggers, and online status lists syncing instantly.
2. **Auto-Deployment**: Any pushes to the GitHub repository's `main` branch automatically trigger Vercel to rebuild and publish the latest frontend client, and Render to rebuild and restart the live Node.js chat server.
