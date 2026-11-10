# Zed Stream

WebRTC proctoring sessions: a proctor creates a room, shares the link, and candidates join a mesh video call with chat, screen sharing, and snapshot capture.

## Requirements

- Node.js 18+

## Run locally

```bash
npm install
cp .env.example .env   # optional: add Twilio credentials for cross-network TURN
npm start
```

Open http://localhost:3000, create a session, and share the generated link.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP/WebSocket port (default `3000`) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID for TURN credentials |
| `TWILIO_API_KEY_SID` | Twilio API key SID |
| `TWILIO_API_KEY_SECRET` | Twilio API key secret |

Without Twilio credentials the server falls back to public STUN/TURN servers, which are less reliable on restrictive networks.

## Deploy

`render.yaml` provisions a Render web service. Set the three `TWILIO_*` values in the Render dashboard. Rooms are held in process memory, so a restart or redeploy ends active sessions.

## Diagnostics

Append `?debug` to the page URL to enable `window.debugRTC()`, `window.checkVideos()`, `window.testTurnServers()`, and the 10-second connection diagnostic log.
