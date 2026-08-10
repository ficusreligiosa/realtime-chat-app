# Realtime Chat App

A real-time chat application built with **React (Vite)** on the frontend and **Node.js + Express + Socket.io + SQLite** on the backend.

> **Note on frontend framework:** The brief asked for React Native (preferred) or React. This was built with **React (web)** rather than React Native, because producing and testing this in the environment it was built in doesn't have an Android SDK / Expo build toolchain available to compile and verify an APK. All the chat logic — REST calls, Socket.io events, state management — is written in plain hooks-based React components with no web-only APIs beyond `fetch`/`sessionStorage`, so it would port to React Native (`View`/`Text`/`FlatList` instead of `div`/`p`/scroll container, `AsyncStorage` instead of `sessionStorage`) with very little rework. See **Assumptions** below.

---

## Features

- Send and receive messages instantly via Socket.io (no polling, no page refresh)
- Chat history persisted in SQLite and reloaded on refresh
- Message timestamps
- Username-based (dummy) login — no password, just picks a display name
- Typing indicator ("X is typing...")
- Online / offline user presence list
- Sent vs. delivered message status ticks
- Graceful handling of disconnects/reconnects — falls back to REST `POST /api/messages` if the socket is temporarily down, and shows a "Reconnecting..." banner
- Clean, mobile-friendly UI built with Bootstrap 5

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

## Submission notes

This deliverable is the source code only. Producing a GitHub repository link, an APK, a screen recording, and a live-hosted backend URL all require accounts/services (GitHub, an Android build toolchain or Expo, a screen-recording pipeline, Render/Railway) that aren't available in the environment this was built in. To complete the submission checklist:

1. `git init`, commit this folder, and push to a new GitHub repo.
2. Run backend + frontend locally (steps above) and record a short screen capture of two browser tabs chatting in real time, or port the React components into an Expo/React Native project to produce an APK.
3. Optionally deploy `backend/` to Render/Railway (set the env vars above) and point `VITE_SERVER_URL` in the deployed frontend at that URL.
