# ⚡ Airavat — WebUI

React web interface for the Airavat MCP Agent. Provides chat, settings, and MCP server management.

## Setup

```bash
npm install
```

## Running

```bash
# Development (with hot reload + API proxy)
npm run dev

# Production build
npm run build
npm start
```

The dev server runs on `http://localhost:5173` and proxies `/api` requests to the daemon on `:3000`.

## Features

- 💬 **Chat Interface** — Conversational UI with tool call visualization
- ⚙️ **Settings Page** — Switch LLM providers, manage API keys, toggle MCP servers
- 🎨 **Theme Support** — Light and dark mode (configured via daemon API)
- 🔴 **Daemon Detection** — Shows error banner when the backend daemon is offline
- 📱 **Responsive Layout** — Collapsible sidebar with server/tool info

## Tech Stack

- **React 19** with React Router
- **Vite** for dev server and builds
- **Tailwind CSS v4** for styling

## Project Structure

```
airavat-webui/
├── src/
│   ├── App.jsx            # Router, theme & daemon context
│   ├── main.jsx           # Entry point
│   ├── index.css          # Tailwind + theme tokens
│   ├── pages/
│   │   ├── ChatPage.jsx   # Chat interface
│   │   └── SettingsPage.jsx # Settings panel
│   └── components/
│       └── Sidebar.jsx    # Navigation sidebar
├── server.js              # Production static file server
├── vite.config.js
├── index.html
└── package.json
```
