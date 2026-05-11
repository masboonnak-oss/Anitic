# TikTok Live Leaderboard

Real-time leaderboard app that tracks TikTok Live viewers who comment or like, displaying their profile photos, scores, Village, and win rate.

## Run & Operate

- `npm run dev` — starts both server (port 3001) and Vite frontend (port 5000) concurrently
- No required env vars — TikTok username is entered via the UI

## Stack

- **Frontend**: React 19 + Vite (CSS Modules, socket.io-client)
- **Backend**: Node.js + Express + Socket.IO (port 3001)
- **TikTok**: tiktok-live-connector v2
- **Runtime**: Node.js 20

## Where things live

- `server/index.js` — Express + Socket.IO server, TikTok connection logic
- `src/App.jsx` — root React component, socket listener
- `src/components/` — Leaderboard, ConnectPanel, PlayerRow, modals
- `vite.config.js` — proxies `/api` and `/socket.io` to port 3001

## Architecture decisions

- Backend manages a `Map<uniqueId, player>` in memory; score = likes×1 + comments×2 + gifts×5 diamonds
- Socket.IO broadcasts leaderboard updates on every event
- Vite dev proxy routes `/api` and `/socket.io` to backend so frontend uses relative URLs
- Village and win rate are manually set via PUT `/api/player/:uniqueId`

## Product

- Connect to a TikTok Live by entering username
- Commenters and likers auto-appear on the leaderboard with their profile photos
- Top 3 shown in podium view (gold/silver/bronze), rest in table
- Admin can manually add players or edit Village + win rate per player
- Reset button clears all players

## Deploy บน VPS (Production)

1. ติดตั้ง Node 20 + PostgreSQL บน VPS
2. `git clone` โปรเจ็กต์ + `npm install`
3. ตั้ง env vars ใน `.env` หรือ `systemd`:
   - `DATABASE_URL=postgres://user:pass@host:5432/dbname` (จำเป็น)
   - `PORT=3001` (default)
   - `RESEND_API_KEY=...` (ถ้าใช้ส่งอีเมล)
4. `npm run build` → สร้าง `dist/` (Vite production)
5. `npm start` → Express จะ serve `dist/` static ที่พอร์ตเดียว (ไม่ต้องใช้ Vite proxy แล้ว) + รัน Socket.IO + API ที่ `PORT`
6. ตั้ง `nginx` reverse proxy 80/443 → `localhost:3001` พร้อม `proxy_set_header Upgrade/Connection` สำหรับ WebSocket
7. Process manager แนะนำ `pm2`: `pm2 start npm --name win-leaderboard -- start`
8. URL ที่ใช้:
   - Dashboard: `https://your.domain/roomeffects`
   - OBS Browser Source: `https://your.domain/roomeffects` (ไม่มี `?preview`) ขนาด 1920×1080

## Gotchas

- `tiktok-live-connector` requires the TikTok account to actually be live to connect
- Profile pictures from TikTok may be blocked by CORS in browser — fallback initials shown
- Port 5000 = Vite (webview), Port 3001 = Express backend (not exposed)
