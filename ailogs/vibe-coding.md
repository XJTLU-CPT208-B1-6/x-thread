# Primary prompts used during development (vibe coding)

Representative prompts used with AI coding assistants to design, implement, and iterate on x-thread — a XJTLU group discussion platform with room-based collaboration, real-time sync, mind maps, and AI assistance.

Below, prompts are grouped by **backend**, **frontend**, then **misc** (repo / team noise).

---

## Backend

### 1. Monorepo scaffold

**User**

> I'm starting a uni group project — a real-time group discussion platform for XJTLU students. Can you scaffold a monorepo with **NestJS + Fastify** backend and **React 18 + Vite + TypeScript + Tailwind** frontend?
>
> Backend needs: Prisma ORM with PostgreSQL, Redis for session/pubsub, Socket.IO for real-time sync. Use **pnpm workspace** for the monorepo.
>
> Please add:
> - `backend/` — NestJS app with modules scaffolded: auth, rooms, chat, mindmap, ai, shared-files
> - `frontend/` — React + Vite app with pages/, components/, stores/, hooks/, lib/ structure
> - `docker-compose.yml` — PostgreSQL 16 + Redis 7
> - Root `package.json` with workspace scripts (`dev`, `build`, `db:push`, `db:studio`)
> - `.env.example` with DATABASE_URL, JWT_SECRET, AI_PROVIDER placeholders
> - `pnpm-workspace.yaml`

---

### 2. Prisma data model

**User**

> Now design the Prisma schema. I need these models:
>
> - **User** — id, nickname, personalityType (I or E enum), email, passwordHash, isGuest, isAdmin. A user can own rooms, have memberships, write chat messages, create mind map nodes, and have AI settings / companion profiles.
> - **Room** — id, unique 6-char code, topic, mode (ONSITE / REMOTE), phase (LOBBY / ICEBREAK / DISCUSS / REVIEW / CLOSED), owner relation, maxMembers, isPublic, isLocked, tags[], botEnabled + botProfileId for the AI companion.
> - **RoomMember** — junction between User and Room with role (OWNER / MEMBER / OBSERVER) and presence status (ACTIVE / DISCONNECTED / LEFT).
> - **MindMapNode** / **MindMapEdge** — nodes have label, type (IDEA / QUESTION / FACT / ACTION), posX/posY; edges connect source→target with optional label. Both scoped to room.
> - **ChatMessage** — content, type (TEXT / VOICE_TRANSCRIPT / SYSTEM), optional botName/botEmoji for AI messages.
> - **AgendaItem** — room-scoped, content, order, durationMin, done boolean.
> - **InputEvent** — room-scoped audit log: kind (TEXT / VOICE_TRANSCRIPT / FILE_CONTEXT / AMBIENT_SLICE), content, source, status (ACCEPTED / PROCESSING / COMPLETED / FAILED), metadata JSON.
> - **UserAiSettings** — 1:1 with User, stores provider, encrypted API key, baseUrl, model.
> - **UserCompanionProfile** — custom AI personalities: kind (CAT / DOG / COMPUTER / DOLPHIN / CUSTOM), slug, name, emoji, systemPrompt, styleGuide.
>
> Use `@default(cuid())` for PKs, `@updatedAt` for timestamps. Add proper cascade deletes and unique constraints.

---

### 3. Auth system with JWT + guests

**User**

> Build the auth module. Requirements:
> - **POST /auth/register** — nickname, password, personalityType (I or E). Hash with bcrypt, return JWT.
> - **POST /auth/login** — username or email + password, return JWT.
> - **POST /auth/guest** — create ephemeral guest account with random nickname, no password, `isGuest: true`. Still return a JWT so they can join rooms.
> - **GET /auth/me** — return current user from JWT.
> - JWT strategy using Passport, extract from `Authorization: Bearer <token>`.
> - **JwtAuthGuard** as a reusable `@UseGuards()` decorator.
> - Guest users cannot access account settings or admin endpoints — add a check for that.

---

### 4. Room lifecycle & phases

**User**

> Rooms are the core of this app. I need:
> - **POST /rooms** — create room: topic, mode, maxMembers, isPublic, optional tags. Auto-generate a 6-char alphanumeric room code. Creator becomes OWNER.
> - **POST /rooms/:code/join** — join as MEMBER. Respect maxMembers and isLocked. If room is locked, only owner can admit. Push a SYSTEM ChatMessage on join.
> - **PATCH /rooms/:code/phase** — owner advances phase: LOBBY → ICEBREAK → DISCUSS → REVIEW → CLOSED. Validate progression order (no skipping phases backward).
> - **PATCH /rooms/:code/lock** — toggle isLocked.
> - **DELETE /rooms/:code** — owner only. Cascade-delete members, nodes, edges, messages, files.
> - **GET /rooms** — list public rooms, filterable by mode, phase, tags. Return member count and a preview of the latest chat message.
> - Room serializer that always includes `memberCount`, `currentPhase`, and whether the requesting user is a member.

---

### 5. Real-time chat via Socket.IO

**User**

> Wire up Socket.IO in NestJS. Create a **RoomGateway** that:
> - Authenticates via the same JWT (send token in handshake `auth.token`).
> - On `joinRoom`, the client joins a Socket.IO room named after the room code. Broadcast a SYSTEM message to the room.
> - On `sendMessage`, validate the user is a member, persist to ChatMessage table, broadcast `newMessage` to the room.
> - On `leaveRoom`, update RoomMember status to LEFT, broadcast departure.
> - Support **bot messages**: when the AI companion responds, emit `newMessage` with botName and botEmoji fields so the frontend can style it differently.
> - Track online presence: on disconnect, update `lastSeenAt` and set status to DISCONNECTED.
>
> Frontend already has a `useSocket` hook ready — make sure the gateway namespace matches `/socket.io`.

---

### 6. Mind map CRUD & auto-layout

**User**

> Mind map backend. Create a **MindMapModule** with:
> - **GET /rooms/:code/mindmap** — return all nodes + edges for a room.
> - **POST /rooms/:code/mindmap/nodes** — create a node. Require label + type, optional posX/posY. Validate that type is one of IDEA / QUESTION / FACT / ACTION.
> - **PATCH /rooms/:code/mindmap/nodes/:id** — update label, type, position.
> - **DELETE /rooms/:code/mindmap/nodes/:id** — cascade-delete connected edges.
> - **POST /rooms/:code/mindmap/edges** — connect two nodes with optional label. Validate both nodes exist in this room.
> - **DELETE /rooms/:code/mindmap/edges/:id**
>
> Also broadcast changes via Socket.IO so other room members see real-time updates. Use `room:nodes:updated` and `room:edges:updated` events.

---

### 7. AI module — multi-provider QA & generation

**User**

> Time for the AI layer. I want a **single AiService** that calls any OpenAI-compatible chat completions endpoint. Configuration:
> - `AI_PROVIDER` env (deepseek / openai / custom), `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`
> - If provider is `custom`, use the user-supplied baseUrl directly — but normalize it to strip trailing `/v1` etc.
> - Fallback: if no AI_API_KEY is set, return a friendly "AI not configured" message instead of 500.
>
> Endpoints:
> - **POST /rooms/:code/ai/ask** — `{ question }`. Build context from: recent chat messages (last 30), mind map nodes/edges summary, shared file names. Call the LLM with a system prompt that says "You are a helpful discussion facilitator. Answer based on the provided room context. Always cite which sources informed your answer." Return `{ answer, sources }`.
> - **POST /rooms/:code/ai/mindmap/generate** — ask the LLM to generate mind map nodes/edges from chat history. Return structured JSON with `{ nodes: [...], edges: [...] }` that the frontend applies.
> - **POST /rooms/:code/ai/whiteboard/summarize** — summarize the whiteboard content + chat into a structured summary. Return `{ summary, keyPoints: [...] }`.
>
> The frontend can override provider/model per room via UserAiSettings — merge those with the global config.

---

### 8. WebRTC voice call signaling

**User**

> Remote voice calls need signaling. The backend doesn't handle media — just relay WebRTC offer/answer/ICE candidates between peers via Socket.IO.
>
> Add these events to the RoomGateway:
> - `voice:offer` — sender offers to a specific peer (by socket ID or userId). Relay to that peer.
> - `voice:answer` — relay back.
> - `voice:ice-candidate` — relay.
> - `voice:join` — broadcast to room that a user joined voice, so others can display them.
> - `voice:leave` — broadcast departure.
>
> All voice events are scoped to the room — only members can send/receive them. Validate membership before relaying.

---

### 9. File sharing with AI context

**User**

> Add a file sharing module:
> - **POST /rooms/:code/files/upload** — multipart upload. Store on disk under `uploads/<roomCode>/`, record metadata in a SharedFile table (filename, originalName, mimeType, size, uploadedById, roomId). Return the file record.
> - **GET /rooms/:code/files** — list all files in a room.
> - **GET /rooms/:code/files/:id/download** — stream the file with proper Content-Disposition header.
> - **DELETE /rooms/:code/files/:id** — owner or uploader only.
>
> For the AI context: when building prompts for `/ai/ask` or `/ai/whiteboard/summarize`, include file names and try to extract text content from .txt, .md, .csv files as additional context. Store the extracted text in the InputEvent table as kind=FILE_CONTEXT so it's traceable.

---

### 10. Companion profiles — AI personality system

**User**

> I want users to customize the AI's personality per room. Build:
> - **POST /account/companions** — create a companion profile: kind (CAT/DOG/COMPUTER/DOLPHIN/CUSTOM), slug, name, emoji, description, styleGuide, systemPrompt. Slug must be unique per user.
> - **GET /account/companions** — list user's companions.
> - **PATCH /account/companions/:slug** — update.
> - **DELETE /account/companions/:slug** — can't delete if it's the active companion in any room.
> - **POST /rooms/:code/companion/select** — owner selects a companion for the room (from their own profiles). Stores in RoomCompanionSelection.
>
> When the AI responds in a room, use the selected companion's systemPrompt and emoji. The botName in ChatMessage should be the companion's name, botEmoji its emoji.

---

### 11. Ingestion pipeline & input events

**User**

> We need an audit trail of everything the AI processes. The **InputEvent** table already exists — now wire it up:
> - When a user sends a chat message, create an InputEvent with kind=TEXT.
> - When voice transcription runs (even client-side), POST an InputEvent with kind=VOICE_TRANSCRIPT + source="webrtc".
> - When file text is extracted for AI context, create kind=FILE_CONTEXT.
> - When the periodic "ambient" capture runs (room summary snapshots), create kind=AMBIENT_SLICE.
>
> All InputEvents start at ACCEPTED → PROCESSING → COMPLETED (or FAILED). The IngestionService should have a `processEvent(id)` method that marks PROCESSING, does the work, then COMPLETED.
>
> **GET /rooms/:code/inputs** — list input events for the room, filterable by kind and status.

---

### 12. Admin module

**User**

> Add a basic admin panel backend:
> - **AdminGuard** — checks `user.isAdmin === true`, returns 403 otherwise.
> - **GET /admin/users** — list all users, searchable by nickname/email.
> - **PATCH /admin/users/:id** — toggle isAdmin, force-reset nickname if abuse.
> - **GET /admin/rooms** — list all rooms across the platform, with member counts.
> - **DELETE /admin/rooms/:id** — admin takedown.
> - **GET /admin/stats** — total users, total rooms, active rooms (phase != CLOSED), total messages.

---

### 13. Deploy to Render

**User**

> We're deploying to Render. The backend needs:
> - A **Web Service** for the NestJS app. Build command: `cd backend && npm install && npx prisma generate && npm run build`. Start command: `cd backend && node dist/main.js`.
> - A **PostgreSQL** managed database on Render.
> - Environment variables: `DATABASE_URL` (from Render PostgreSQL), `JWT_SECRET`, `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `CORS_ORIGIN`.
> - CORS should allow the Render frontend domain + localhost for dev.
> - Prisma migrations: run `npx prisma migrate deploy` as part of the start command so schema stays in sync.
> - Health check endpoint at `/api/health` (Fastify replies fast).
>
> The frontend is a **Static Site** on Render (or Vercel) — just `cd frontend && npm install && npm run build`, serve `dist/`.

---

### 14. CORS & API proxy

**User**

> Frontend is on Vercel, backend is on Render — getting CORS errors. In `main.ts`, enable CORS with the frontend origin. Also, configure the Vite dev server to proxy `/api` and `/socket.io` to `http://localhost:3000` so local dev works without CORS issues. The frontend's `api.ts` should use a runtime config that checks `window.location.hostname` to decide the API base URL.

---

## Frontend

### 1. React + Vite project setup

**User**

> Set up the React frontend with Vite 5, TypeScript, and Tailwind CSS. Include:
> - React Router v6 with routes for: `/` (home/workspace), `/lobby` (group lobby), `/room/:code/lobby`, `/room/:code/icebreak`, `/room/:code/discuss`, `/room/:code/review`, `/room/:code/history`, `/settings/ai`, `/admin`.
> - Tailwind configured with a dark theme (slate-950 background), custom colors for room phases.
> - `api.ts` lib — wrapper around fetch that auto-attaches JWT from localStorage and handles 401 by clearing auth.
> - `auth.ts` lib — store/retrieve JWT, decode payload, sync user into Zustand store.
> - `runtime-config.ts` — determine API_BASE_URL from env or hostname detection.

---

### 2. Zustand stores

**User**

> Create Zustand stores for all the real-time state:
> - **useUserStore** — current user, isAuthenticated, login/logout actions.
> - **useRoomStore** — current room, members, phase, mode. Actions: joinRoom, leaveRoom, advancePhase.
> - **useChatStore** — messages array, sendMessage (optimistic append + Socket.IO emit), addSystemMessage.
> - **useMindMapStore** — nodes + edges arrays, addNode, updateNode, deleteNode, addEdge, deleteEdge, applyAILayout (takes AI-generated nodes/edges).
> - **useWhiteboardStore** — whiteboard content string, snapshots array. Actions: updateContent, saveSnapshot, restoreSnapshot.
> - **useLanguageStore** — current locale ('zh' | 'en'), translations map, toggle action. Persist to localStorage.

---

### 3. MindMap component with @xyflow/react

**User**

> Build the MindMap component using **@xyflow/react** (React Flow). It needs:
> - `<ReactFlow>` with custom node types: idea (yellow bulb), question (blue ?), fact (green check), action (red target).
> - Each node renders an editable label (inline text input on double-click).
> - Edge creation by dragging from node handles. On connect, call `POST /rooms/:code/mindmap/edges`.
> - `<Controls>`, `<MiniMap>`, and `<Background>` from @xyflow.
> - **Auto-layout button** — calls a force-directed or dagre layout on the current nodes/edges.
> - **AI Generate button** — calls `POST /rooms/:code/ai/mindmap/generate`, then applies the returned nodes/edges.
> - Listen for Socket.IO `room:nodes:updated` / `room:edges:updated` — update the graph reactively for all room members.
> - Export: download mind map as JSON snapshot or text outline.

---

### 4. DiscussPage — multi-panel workspace

**User**

> This is the main screen. I need a resizable multi-panel layout on **DiscussPage**:
> - 4 panels: Chat (left), Mind Map (center), Whiteboard (right), AI QA (bottom or slide-over).
> - Panels should be collapsible — user can go fullscreen on mind map or whiteboard independently.
> - Draggable dividers between panels (CSS or a lightweight library).
> - Mobile: stack panels vertically in a swipeable carousel or tab bar — single panel at a time.
> - Room header bar at top: room topic, phase badge, member avatars, voice call button, layout toggle.
> - **Layout toggle button** cycles between: grid (4-panel), focus-mindmap (fullscreen), focus-whiteboard, focus-chat.
> - The phase controls which panels are relevant — e.g., during ICEBREAK, emphasize chat; during DISCUSS, emphasize mind map; during REVIEW, show whiteboard snapshots.

---

### 5. GroupLobby — public room browser

**User**

> Build the Group Lobby page. It should:
> - Fetch `GET /rooms` and display rooms as cards in a grid.
> - Each card shows: topic, room code, mode badge (ONSITE/REMOTE), phase indicator, member count, tags as colored chips.
> - **Create Room** button — opens a modal with form: topic, mode select, maxMembers, isPublic toggle, tags input (comma-separated).
> - **Search/filter** — text search on topic, filter by mode, phase, tags.
> - **Join button** — calls `POST /rooms/:code/join`, navigates to the room's lobby page on success.
> - Show "Room full" or "Room locked" states on the card when applicable.
> - Empty state: if no public rooms, show a friendly illustration + "Create the first room" CTA.

---

### 6. Room lifecycle pages

**User**

> Wire up the room stage pages:
> - **LobbyPage** — waiting area. Shows room topic, members list (with presence status indicators — green dot for ACTIVE). Owner sees "Start Icebreak" button that advances phase. Join link/code to share.
> - **IceBreakPage** — quick intro round. Each member gets a prompt card (generated based on room topic and personality types). Chat panel for casual intro messages. Owner advances to DISCUSS when ready.
> - **DiscussPage** (already built) — the main workspace.
> - **ReviewPage** — post-discussion summary. Shows AI-generated whiteboard summary, mind map outline, key decisions extracted. Download buttons for whiteboard snapshot and mind map export.
> - **RoomHistoryPage** — archived view. Chat search (full-text search across messages), whiteboard snapshots gallery, mind map timeline, shared files download list.

---

### 7. AI QA panel

**User**

> Build the AiQaPanel component that sits alongside the chat:
> - Text input for a question + "Ask AI" button.
> - Response area showing the AI's answer (markdown rendered) and a **"Sources"** section listing which chat messages / files informed the answer.
> - **Mind Map actions**: "Generate mind map" (from chat context), "Expand node" (select a node, AI suggests child nodes), "Optimize layout" (AI restructures the current graph).
> - **Whiteboard actions**: "Summarize board" (AI reads whiteboard content + chat → structured summary).
> - Loading state: animated dots while waiting for AI response.
> - Error state: if AI is not configured or provider is down, show a friendly message instead of breaking.
> - The panel uses the room's selected companion profile — show the companion's emoji and name in the header.

---

### 8. Voice call panel

**User**

> Build the VoicePanel for in-room voice calls:
> - "Join Voice" / "Leave Voice" toggle button in the room header.
> - When joined: show participant list with speaking indicator, mute/unmute button, hang up button.
> - Use browser `RTCPeerConnection` — create offer, set local description, send via Socket.IO `voice:offer`. On receiving answer, set remote description.
> - ICE candidate handling: on `icecandidate` event, send via `voice:ice-candidate`.
> - Remote stream: on `track` event, attach to an `<audio>` element.
> - **RemoteVoiceCallPanel** variant: simplified UI for REMOTE-mode rooms, emphasizing voice-first layout with minimal chat.
> - Microphone permission: request `navigator.mediaDevices.getUserMedia({ audio: true })` on join. If denied, show a permission error toast.

---

### 9. FileShare panel

**User**

> FileSharePanel component:
> - **Upload zone** — drag-and-drop area (or click to browse). Accept any file type. Show upload progress bar.
> - **File list** — grid of file cards showing: filename, uploader name, upload time, file size, download button.
> - **Delete** — owner or uploader sees a trash icon.
> - **Preview** — for images, show thumbnail; for text/md/csv, show inline preview on click.
> - Files appear in the AI context automatically — show a small "AI can read this" badge on text-based files.
> - Real-time: new uploads appear via Socket.IO event `file:uploaded` without manual refresh.

---

### 10. Companion settings page

**User**

> Account AI Settings page with companion management:
> - **Provider config** — select AI provider (DeepSeek / OpenAI / Custom), enter API key (masked), base URL, model name. "Test connection" button that calls a lightweight completion to verify.
> - **Companion list** — cards for each saved companion showing emoji, name, kind badge. Click to edit.
> - **Companion editor** — form: kind (select: Cat/Dog/Computer/Dolphin/Custom), slug (auto-generated from name), name, emoji picker, description, style guide textarea, system prompt textarea (with token counter).
> - **Set as default** — radio toggle on one companion. The default is pre-selected when creating a room.
> - Delete confirmation modal — warn if the companion is active in any rooms.

---

### 11. i18n — Chinese / English

**User**

> The platform is used by Chinese-speaking students but should support English too. Add i18n:
> - A translations map with keys for every UI string (button labels, placeholders, error messages, phase names, etc.).
> - `zh` and `en` variants in a single file or per-module.
> - `<LanguageSwitcher>` component — a small toggle in the header (中/EN).
> - Persist choice to localStorage.
> - Use a `useLanguageStore` Zustand store with a `t(key)` function.
> - Default to `zh` (since it's a Chinese university context), but respect saved preference.

---

### 12. Mobile responsive & touch-friendly

**User**

> We're presenting this on phones. Mobile optimisation:
> - Stack panels vertically instead of grid — one panel visible at a time, swipe or tab bar to switch.
> - Bottom navigation bar on mobile: Chat | Mind Map | Whiteboard | Files | AI.
> - Touch-friendly node dragging on the mind map — @xyflow/react supports touch already, but increase hit areas.
> - Room cards in lobby: stack to single column on narrow screens.
> - Forms (create room, companion editor, settings) — full-width inputs on mobile, larger touch targets (min 44px).
> - Voice call: persistent bottom bar when in call, so users can navigate panels while talking.
> - Test with Chrome DevTools mobile viewport (iPhone SE, Pixel 5, iPad).

---

### 13. Home workspace dashboard

**User**

> The landing page after login. HomeWorkspacePage should:
> - Show a welcome message with the user's nickname and personality badge (I/E).
> - **My Rooms** section — rooms the user is a member of, sorted by last activity. Click to rejoin.
> - **Quick Join** — input for room code, "Join" button. Validates code format (6 chars).
> - **Create Room** CTA — prominent button leading to the create room flow.
> - **Recent Activity** — last few chat messages across all user's rooms (like a mini-inbox).
> - If guest user: show a banner suggesting they register to keep their rooms.
> - Pull-to-refresh on mobile, auto-refresh on focus.

---

### 14. Room layout toggle & fullscreen modes

**User**

> The workspace needs flexible layouts. Add a **layout toggle** in the DiscussPage header:
> - **Grid mode** — all panels visible, resizable dividers.
> - **Focus: Mind Map** — mind map fills the screen, other panels collapse to a slim sidebar.
> - **Focus: Whiteboard** — whiteboard fullscreen.
> - **Focus: Chat** — chat full-width.
> - **Presentation mode** — mind map only, no UI chrome (for screensharing / projector).
>
> Store the user's layout preference per room in a local state (or localStorage keyed by room code).
> On mobile, the layout toggle becomes a panel switcher (Chat | Map | Board | Files | AI tabs at bottom).

---

### 15. Single-panel mind map fix & UX polish

**User**

> When only one panel is visible (fullscreen mind map mode), the mind map rendering breaks — nodes cluster at origin. It seems like the ReactFlow viewport doesn't recalculate when the container goes from `display:none` to visible. Can you add a `ResizeObserver` that calls `fitView()` when the container resizes? Also debounce it so it doesn't fire on every pixel change.

---

## Misc (repo & teammates)

### 1. pnpm monorepo & Docker Compose

**User**

> We're three people — one on Windows, two on Mac. The monorepo uses pnpm workspaces. Can you check:
> - `pnpm-workspace.yaml` includes `backend` and `frontend`.
> - `docker-compose.yml` starts PostgreSQL 16 and Redis 7 with persistent volumes.
> - Root `package.json` has scripts: `dev` (starts both backend + frontend concurrently), `dev:backend`, `dev:frontend`, `db:push` (prisma db push), `db:studio` (prisma studio).
> - The `start-dev.js` script that checks Docker is running, starts containers, waits for PostgreSQL to be healthy, runs `prisma db push`, then starts both dev servers.
> - Add a `start-dev.ps1` for the Windows teammate.

---

### 2. Keeping secrets out of git

**User**

> I just almost committed the `.env` file with the real DATABASE_URL and JWT_SECRET. Can you:
> - Add `.env` to `.gitignore` at root and in `backend/`.
> - Add `*.local` and `*.log` patterns too.
> - In `.env.example`, add a comment at the top: `# Copy this to .env and fill in real values. NEVER commit .env to git.`
> - Double-check: `git status` should not show any `.env` files as tracked.

---

### 3. Render deployment & cold starts

**User**

> The backend keeps dying on Render free tier — cold starts take ~30 seconds because of Prisma generate + migrate. Can we:
> - Pre-build the Prisma client in the build step so the start command is just `node dist/main.js`.
> - Add a **health check** endpoint at `GET /api/health` that Render pings every 30s to keep the service warm?
> - Set `PORT` from `process.env.PORT` (Render sets this) with a fallback to 3000.
> - Check: the PostgreSQL connection string from Render uses `?sslmode=require` — does our Prisma config handle that?
> - Add a `render.yaml` for infrastructure-as-code (blueprint with web service + DB).

---

### 4. Git workflow for a uni group project

**User**

> We're 3 people on this uni project. What's a git workflow that won't cause merge hell?
> - We settled on: `main` is always deployable. Feature branches off main: `feat/mindmap-layout`, `fix/cors-error`, etc.
> - PR to main — at least one teammate reviews before merge.
> - No force-push to main ever.
> - `.gitattributes` with `* text=auto` so line endings don't fight between Mac and Windows.
> - Squash-merge PRs to keep history clean.
>
> Can you add a `.gitattributes` file and a section in README about our git conventions?

---

### 5. Testing setup

**User**

> We need basic tests — nothing fancy, just enough to show we tested things for the course requirements:
> - Backend: Jest config (`jest.config.js`) pointing to `src/`. A couple of unit tests for `RoomsService` (create room, join room, phase validation).
> - Frontend: Vitest (already bundled with Vite). Unit tests for utility functions: `getInitials()`, `roomTags` parsing, `roomUtils` (phase progression validation), `authValidation` (email format, password strength).
> - Add `test` scripts to both `backend/package.json` and `frontend/package.json`.
> - Tests should run in CI (we can add GitHub Actions later, but for now just make the scripts work locally).

---

### 6. README & docs polish

**User**

> The README needs to look good for the CPT208 submission. Can you:
> - Add badges: Frontend (React+Vite), Backend (NestJS+Fastify), Database (PostgreSQL+Prisma), Realtime (Socket.IO), License (MIT).
> - Project preview screenshots (we have them in `docs/assets/`): home page, discussion workspace, group lobby, mobile view.
> - Quick nav links at the top.
> - "Core Highlights" bullet list.
> - "Current Capabilities" — room flow, real-time collaboration, AI, accounts, remote interaction, history.
> - Tech stack table.
> - Quick start section pointing to `QUICKSTART.md` and `SETUP.md`.
> - Link to the Render deployment (if public).
> - Footer: "CPT208 Human-Centric Computing | Topic B1 | Group 6".

---

### 7. Package lock conflicts

**User**

> Teammate pushed `package-lock.json` but we use pnpm. Now there's both `package-lock.json` and `pnpm-lock.yaml`. Should we:
> - Delete `package-lock.json` (it's from npm, we use pnpm).
> - Add `package-lock.json` to `.gitignore` so it doesn't come back.
> - Make sure everyone runs `pnpm install`, not `npm install`.
> - Add an `.npmrc` at root with `engine-strict=true` and `package-manager=pnpm` so npm refuses to install.

---

### 8. Vercel frontend + Render backend split

**User**

> Frontend is on Vercel (fast CDN, free tier), backend is on Render. The Vite build needs:
> - `VITE_API_BASE_URL` env var set in Vercel dashboard to the Render backend URL.
> - The `runtime-config.ts` should read `import.meta.env.VITE_API_BASE_URL` in production, fall back to `http://localhost:3000` in dev.
> - Socket.IO connects to the same API base URL (it auto-negotiates WebSocket on the same host).
> - CORS on the NestJS side must allow the Vercel domain.
> - Test: deploy frontend to Vercel, backend to Render, create a room, join from two tabs, send messages — should sync in real time.
