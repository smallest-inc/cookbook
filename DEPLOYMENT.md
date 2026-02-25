# Smallest AI Showcase — Deployment Guide

Step-by-step instructions for deploying and maintaining the showcase app.

---

## Architecture Overview

The cookbook repo uses a **two-branch pattern**:

| Branch | Purpose | Contents |
|--------|---------|----------|
| `main` | Cookbook examples | Python/JS code, READMEs, example scripts |
| `showcase` | Showcase website | Next.js app (the app lives at the root) |

The `showcase` branch is an **orphan branch** — it has no shared history with `main`. This keeps the cookbook clean while letting you deploy the website from the same repo.

---

## Prerequisites

- Node.js 18+ installed
- A [Vercel](https://vercel.com) account (free tier works)
- The Vercel CLI (optional, for local preview): `npm i -g vercel`
- Access to push to `smallest-inc/cookbook` on GitHub

---

## Step 1: Push the Showcase Branch

The `showcase` branch is already created locally. Push it to GitHub:

```bash
git checkout showcase
git push -u origin showcase
```

Verify it's on GitHub:

```bash
gh browse --branch showcase
# or visit https://github.com/smallest-inc/cookbook/tree/showcase
```

---

## Step 2: Connect Vercel

### Option A: Vercel Dashboard (recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select `smallest-inc/cookbook`
4. **Important** — Change these settings before deploying:
   - **Branch**: Change from `main` to `showcase`
   - **Framework Preset**: Should auto-detect as **Next.js**
   - **Root Directory**: Leave as `/` (the app is at the root of the showcase branch)
5. Click **Deploy**

### Option B: Vercel CLI

```bash
git checkout showcase
vercel --prod
```

Follow the prompts. When asked for the project directory, use `.` (current directory).

---

## Step 3: Environment Variables (Optional)

The app works **without any environment variables**. Analytics just won't fire.

To enable Mixpanel analytics, add these in **Vercel → Project → Settings → Environment Variables**:

| Variable | Value | Required? |
|----------|-------|-----------|
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | Your Mixpanel project token | Optional |
| `MIXPANEL_TOKEN` | Same Mixpanel token (for server-side proxy) | Optional |

You can also add them to a local `.env.local` file for development (never commit this):

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

---

## Step 4: Verify Deployment

After Vercel finishes building:

1. Visit the deployment URL Vercel gives you (e.g., `cookbook-showcase.vercel.app`)
2. Check that the homepage loads with project cards
3. Click into a project — verify the detail page renders
4. Test the TTS audio samples — they should play without an API key
5. Toggle dark/light mode
6. Try the search and category filters

---

## Step 5: Custom Domain (Optional)

1. Go to **Vercel → Project → Settings → Domains**
2. Add your domain (e.g., `showcase.smallest.ai`)
3. Update DNS as instructed by Vercel:
   - **CNAME** record pointing to `cname.vercel-dns.com`
   - Or an **A** record if using apex domain
4. Wait for SSL certificate provisioning (usually < 5 minutes)

---

## Local Development

```bash
git checkout showcase
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

---

## Adding a New Project

All projects are defined in `lib/projects.ts`. To add one:

1. Switch to the showcase branch:
   ```bash
   git checkout showcase
   ```

2. Add a new entry to the `projects` array in `lib/projects.ts`:
   ```typescript
   {
     slug: "my-new-project",
     title: "My New Project",
     description: "One-line description.",
     longDescription: "Detailed paragraph about what it does.",
     category: "text-to-speech",  // or "speech-to-text", "voice-agents", "community"
     tags: ["tag1", "tag2"],
     difficulty: "beginner",       // "beginner" | "intermediate" | "advanced"
     status: "code-only",          // "code-only" | "demo" | "interactive"
     cookbookPath: "text-to-speech/my-new-project",
     githubUrl: "https://github.com/smallest-inc/cookbook/tree/main/text-to-speech/my-new-project",
     techStack: ["Python", "Smallest SDK"],
     apiProducts: ["lightning-tts"],
     features: ["Feature 1", "Feature 2"],
     audioSamples: [],             // Add TTS samples if applicable
   }
   ```

3. If adding audio samples, place WAV files in `public/audio-samples/` and reference them:
   ```typescript
   audioSamples: [
     { label: "Voice — Description", src: "/audio-samples/filename.wav" },
   ]
   ```

4. Commit and push:
   ```bash
   git add -A
   git commit -m "Add my-new-project to showcase"
   git push origin showcase
   ```

Vercel will auto-deploy on push.

---

## Adding a Thumbnail or GIF

If a project has a visual demo:

1. Place the image/GIF in `public/thumbnails/` (create the directory if needed)
2. Add the URL to the project entry:
   ```typescript
   thumbnailUrl: "/thumbnails/my-project.png",
   // or
   gifUrl: "/thumbnails/my-project.gif",
   ```

If no thumbnail is provided, the app renders a dynamic cover card with the project title, category icon, and tech stack.

---

## Updating the Showcase After Cookbook Changes

When you add a new cookbook example on `main`, update the showcase separately:

```bash
# 1. Add the example on main
git checkout main
# ... add your cookbook code, commit, push ...

# 2. Update the showcase
git checkout showcase
# Edit lib/projects.ts to add the new project entry
git add -A
git commit -m "Add new-example to showcase"
git push origin showcase
```

The two branches are independent — changes to one don't affect the other.

---

## Community Contributions

Community members can add projects via PR:

1. Fork the repo
2. Switch to the `showcase` branch
3. Add their project entry to `lib/projects.ts` with `category: "community"`
4. Open a PR targeting the `showcase` branch
5. After review and merge, Vercel auto-deploys

---

## Troubleshooting

### Build fails on Vercel
- Ensure the branch is set to `showcase` (not `main`) in Vercel project settings
- Check that `package-lock.json` is committed
- Verify Node.js version is 18+ in Vercel settings

### Audio samples don't play
- Audio files are static assets in `public/audio-samples/` — no API key needed
- Check browser console for 404 errors on the audio file paths
- Ensure WAV files are committed to the `showcase` branch

### Analytics not tracking
- Verify `NEXT_PUBLIC_MIXPANEL_TOKEN` is set in Vercel environment variables
- The `NEXT_PUBLIC_` prefix is required for client-side access
- Check browser console for Mixpanel initialization messages

### Local dev shows stale content
- Run `rm -rf .next && npm run dev` to clear the cache

---

## Quick Reference

| Task | Command |
|------|---------|
| Switch to showcase | `git checkout showcase` |
| Run locally | `npm install && npm run dev` |
| Deploy | Push to `showcase` branch (auto-deploys via Vercel) |
| Switch back to cookbook | `git checkout main` |
| Check which branch | `git branch --show-current` |
