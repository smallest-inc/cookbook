# Phone Draw

Call or chat with a voice agent, describe a picture, and watch it appear on a board while you are still talking.

## Features

- Image generation as a tool (`draw_new` and `edit_current`) on an Atoms crew agent
- A local board that updates while you are still on the call or in the chat
- Edits stay on the same picture
- Local chat first, then a phone number via Atoms deploy and a tunnel to the local board
- Optional hosted board on Vercel, if you do not want to leave a laptop running

## Demo

<!-- Add a short video or gif of a call (or local chat) with the board updating. -->

## Requirements

Base dependencies are already installed from the root [`requirements.txt`](../../requirements.txt). This example also needs:

- `smallestai>=5.14.0` (newer than the root pin of 5.3.1)
- `httpx`

Copy `.env.sample` to `.env` and set:

- `SMALLEST_API_KEY` for the `smallestai` CLI
- `OPENAI_API_KEY` for the image model and the chat model that calls the draw tools
- `BOARD_URL` (default `http://localhost:8765`)
- `BOARD_TOKEN` (required once the board is on a public URL)
- Optional `IMAGE_MODEL`, `IMAGE_QUALITY`, and `CHAT_MODEL`

Install the extras from the repo root:

```bash
uv pip install -r voice-agents/phone_draw/requirements.txt
```

## Usage

### 1. Run it locally

This is the first test. The agent and the board both run on your machine. You chat in the terminal. No phone number and no public URL yet.

From `voice-agents/phone_draw/`:

```bash
cp .env.sample .env
# put your keys in .env
# generate a board token with: openssl rand -hex 16

uv run smoke_test.py          # offline check, no API calls
uv run board.py               # terminal A, then open http://localhost:8765
uv run server.py              # terminal B, local crew at ws://localhost:8080/ws
smallestai agent-crew chat    # terminal C, talks to the local crew
```

In the chat, try:

```text
draw a corgi astronaut, flat illustration
```

The board should flip to `drawing: …` and then show the picture. Then:

```text
give the corgi a red scarf
```

`board.py` is standard library plus `python-dotenv`. It reads the same `.env` as `server.py`. Leave `BOARD_URL` as `http://localhost:8765` for this step.

If OpenAI rejects a prompt, the board status becomes `couldn't draw: …` and the agent should apologize and ask for different wording. It must not stay stuck on `drawing: …`.

### 2. Put it on a phone number

The deployed agent runs on Smallest AI's platform, not on your laptop. It cannot reach `localhost`. Keep `board.py` running locally, expose it with a public tunnel, point `BOARD_URL` at that tunnel, and redeploy.

1. Create an Atoms agent in the [dashboard](https://app.smallest.ai), or with the CLI:

   ```bash
   smallestai agents create "phone-draw" \
     --first-message "Hi, I'm an AI assistant. What should I draw?" \
     --language en \
     --allow-inbound
   ```

   The first message must disclose that this is an AI. Copy the agent id the command prints.

2. Link this folder to that agent and deploy:

   ```bash
   smallestai agent-crew init --agent-id <your-agent-id>
   smallestai agent-crew deploy
   ```

   `init` writes `.smallestai/config.toml`, which is gitignored on purpose so you do not commit an agent id. If the dashboard shows the new build as a draft, set it live.

3. Expose the local board with a Cloudflare quick tunnel. No Cloudflare account is required:

   ```bash
   cloudflared tunnel --url http://localhost:8765
   ```

   It prints a `https://….trycloudflare.com` URL. Put that URL in `.env` as `BOARD_URL`, keep the same `BOARD_TOKEN` you already set, and deploy again so the cloud agent picks up the new URL:

   ```bash
   smallestai agent-crew deploy
   ```

   Set a `BOARD_TOKEN` before you go public. Without one, anyone who can POST to the tunnel can overwrite the board.

4. Attach a phone number to the agent in the Atoms dashboard. If you do not have a number, place a web call from the agent's page in the dashboard instead.

`agent-crew deploy` packs `.env` into the deployment even though `.env` is gitignored. That is how the cloud agent gets `OPENAI_API_KEY`, `BOARD_URL`, and `BOARD_TOKEN`. Do not keep any other secrets in this folder.

### Optional. Host the board

A tunnel to `board.py` is enough. If you would rather not leave a laptop running, you can host the board as a website. The Next.js app in `hosted-board/` speaks the same `/frame`, `/status`, and `/state` paths, and stores state in [Vercel Blob](https://vercel.com/docs/storage/vercel-blob).

Deploy that folder to Vercel, attach a Blob store (Vercel sets `BLOB_READ_WRITE_TOKEN` for you), and set `BOARD_TOKEN` on the Vercel project to the same value as in this folder's `.env`. Then set `BOARD_URL` to the Vercel URL (no trailing slash) and run `smallestai agent-crew deploy` again.

This app depends on Vercel Blob, so it will not run on Cloudflare Pages without a rewrite of `hosted-board/lib/store.ts`. Use Vercel for the hosted board, or keep the Cloudflare tunnel in front of local `board.py`.

`GET /state` is public on both `board.py` and the hosted app. Anyone with the board URL can see the latest picture. Do not point people at a board you want to keep private, and set `BOARD_TOKEN` so only the agent can POST.

See `hosted-board/README.md` for the exact Vercel steps.

Voice, language, and the first message are set on the Atoms agent in the dashboard, or with `smallestai agents create` / `smallestai agents update`. Keep an AI disclosure in the first message. `SYSTEM_PROMPT` in `server.py` is the spoken style and tool rules. Image size is the `size="1024x1024"` argument on the OpenAI calls in `server.py`. Switch to `gpt-image-2.6-sunburst` and `IMAGE_QUALITY=medium` in `.env` if you want more detail.

## Recommended Usage

- A live demo where you describe a picture on a call and the audience watches the board update
- A local walkthrough or workshop, using `smallestai agent-crew chat` and `board.py`, with no phone number
- For function tools that do not generate images, see [Agent with Tools](../agent_with_tools/)

## Key Snippets

The agent exposes two tools. `draw_new` starts a picture. `edit_current` changes the one already on the board.

```python
@function_tool()
async def draw_new(self, prompt: str) -> str:
    """Start a brand new picture. Await the result so failures reach the caller.

    Args:
        prompt: A clear visual description of the picture to draw.
                Do not include trademarked character names.
    """
    return json.dumps(await self.studio.generate(prompt))

@function_tool()
async def edit_current(self, change: str) -> str:
    """Change the picture that is already on screen, keeping everything else the same.

    Args:
        change: Only the change the caller asked for, e.g. "give the dog a red hat".
    """
    return json.dumps(await self.studio.edit(change))
```

`Studio.generate` calls the OpenAI image API, then POSTs the PNG to the board:

```python
r = await self.oa.images.generate(
    model=IMAGE_MODEL, prompt=prompt,
    quality=IMAGE_QUALITY, size="1024x1024")
self.current_png = base64.b64decode(r.data[0].b64_json)
await self._push(self.current_png, prompt)
return {"status": "done", "prompt": prompt}
```

## Structure

```
phone_draw/
├── server.py          # Atoms crew. One node, two tools
├── board.py           # Local board. Open it in a browser
├── smoke_test.py      # Offline stub check
├── requirements.txt   # Extras beyond the repo root
├── .env.sample
└── hosted-board/      # Optional Vercel app
    ├── app/
    ├── lib/store.ts
    └── package.json
```

## Example Output

```
You:        draw a corgi astronaut, flat illustration
[board]     drawing: a corgi astronaut, flat illustration
Assistant:  The picture should be on your screen now. What should I change?
You:        give the corgi a red scarf
[board]     done, say what to change
Assistant:  Done. What would you like to change next?
```

The board page shows the PNG and the caption. `uv run smoke_test.py` prints:

```
tools: ['draw_new', 'edit_current']
edit with no picture: error
draw: {'status': 'done', 'prompt': 'a corgi astronaut, flat illustration'}
edit: {'status': 'done', 'change': 'give the corgi a red scarf'}
board version: 2 caption: give the corgi a red scarf
OK
```

## Documentation

- [Agent Crew CLI Quickstart](https://docs.smallest.ai/voice-agents/developer-guide/get-started/quickstart)
- [Defining Tools](https://docs.smallest.ai/voice-agents/developer-guide/build/agent-crews/tools/defining-tools)
- [Tool Execution](https://docs.smallest.ai/voice-agents/developer-guide/build/agent-crews/tools/executing-tools)
- [Versioning Lifecycle](https://docs.smallest.ai/voice-agents/developer-guide/build/agent-crews/versioning-lifecycle)
- [Phone Numbers](https://docs.smallest.ai/voice-agents/telephony/phone-numbers)
- [API Keys](https://docs.smallest.ai/overview/administration/api-keys)

## Next Steps

- [Agent with Tools](../agent_with_tools/) - function tools without image generation
- [Getting Started](../getting_started/) - the smallest Atoms crew
- [Nodes](https://docs.smallest.ai/voice-agents/developer-guide/get-started/agent-crew-core-concepts/nodes)
