# Hosted phone-draw board

Optional. The local `board.py` in the parent folder is enough for development, and a Cloudflare quick tunnel in front of it is enough for a real call. Use this app when you want the board to stay up without a laptop.

This is a Next.js app that speaks the same paths as `board.py` (`/frame`, `/status`, `/state`). Pictures are stored in Vercel Blob. It will not run on Cloudflare Pages as-is, because `lib/store.ts` depends on `@vercel/blob`.

## Prerequisites

- A Vercel account
- The same `BOARD_TOKEN` you put in the parent folder's `.env`

## Deploy on Vercel

```bash
cd hosted-board
npm install
npx vercel login
npx vercel          # follow the prompts for a new project
```

In the Vercel dashboard, or with the CLI:

1. Attach a [Blob store](https://vercel.com/docs/storage/vercel-blob) to the project. Vercel sets `BLOB_READ_WRITE_TOKEN` automatically.
2. Set `BOARD_TOKEN` to the same token the agent uses. POSTs without this bearer token are rejected. `GET /state` stays public.

```bash
npx vercel env add BOARD_TOKEN
npx vercel --prod
```

Copy the production URL, set `BOARD_URL` in the parent folder's `.env` to that origin with no trailing slash, and redeploy the agent:

```bash
cd ..
smallestai agent-crew deploy
```

## Local preview

```bash
npx vercel env pull .env.local
npm install
npm run dev
```

`.env.local` should contain `BOARD_TOKEN` and `BLOB_READ_WRITE_TOKEN`. Do not commit it.

## Public state

`GET /state` (and `GET /api/state`) is unauthenticated. Anyone with the URL can see the latest picture and caption. Share the board URL only when that is acceptable.
