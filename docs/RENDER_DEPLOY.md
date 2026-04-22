# Render Deployment Guide

## Recommended Architecture

- Frontend: Render `Static Site`
- Backend: Render `Web Service`
- Database: Render PostgreSQL or an external PostgreSQL instance

This project uses a long-running NestJS backend with Socket.IO, so deploying both services on Render is simpler than mixing Vercel and a separate backend host.

## 1. Deploy the Backend

Create a new `Web Service` in Render with these settings:

- Root Directory: `backend`
- Environment: `Node`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`

Set these environment variables in the backend service:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
JWT_SECRET=replace-with-a-long-random-string
```

If you use AI providers, also add the corresponding API keys required by your project.

## 2. Run Prisma on Render

The backend uses Prisma, so after the database is ready you should run migrations:

```bash
npx prisma migrate deploy
npx prisma generate
```

You can run them in the Render shell for the backend service, or add `npx prisma migrate deploy && npm run start` to the start flow after confirming it matches your workflow.

## 3. Deploy the Frontend

Create a new `Static Site` in Render with these settings:

- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

Set these frontend environment variables:

```env
VITE_API_BASE_URL=https://your-backend-service.onrender.com/api
VITE_SOCKET_URL=https://your-backend-service.onrender.com
```

`VITE_API_BASE_URL` should include the `/api` prefix because the NestJS backend sets a global API prefix.

## 4. Verify Backend CORS and Networking

The backend currently enables CORS for all origins, so the Render frontend can connect without extra CORS changes.

Socket.IO uses:

- Namespace: `/room`
- Path: `/socket.io`

The frontend now reads the backend origin from `VITE_SOCKET_URL`.

## 5. Recommended Deployment Order

1. Create the PostgreSQL database
2. Deploy the backend service
3. Configure backend environment variables
4. Run Prisma migrations
5. Deploy the frontend static site
6. Configure frontend environment variables
7. Open the frontend and test login, room APIs, and real-time features

## 6. Troubleshooting

### `prisma: command not found`

If Render skips dev dependencies in your environment, move `prisma` from `devDependencies` to `dependencies` in `backend/package.json`.

### Frontend can open but API requests fail

Check that:

- `VITE_API_BASE_URL` points to the backend Render URL with `/api`
- the backend service is running
- the backend exposes the correct port from `process.env.PORT`

### WebSocket cannot connect

Check that:

- `VITE_SOCKET_URL` matches the backend Render origin without `/room`
- the backend service is not sleeping
- the backend domain is reachable over HTTPS

### First request is slow

This is common on free-tier hosting when the backend has gone idle.
