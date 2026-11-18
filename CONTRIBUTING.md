# Contributing to Smallest AI Cookbook

Thanks for your interest in contributing! This guide will help you add new examples or improve existing ones.

---

## Adding a New Example

### 1. Create the Directory Structure

If your example has **only Python** code, put files directly in the example root:

```
speech-to-text/your-example-name/
├── your_script.py
├── .env.sample
├── requirements.txt      # only if extra deps are needed
└── README.md
```

If your example has **both Python and JavaScript**, use subdirectories:

```
speech-to-text/your-example-name/
├── python/
│   └── your_script.py
├── javascript/
│   └── your_script.js
│   └── package.json
├── .env.sample
├── requirements.txt      # only if extra deps are needed
└── README.md
```

### 2. Dependencies

Common libraries are already installed from the root `requirements.txt` (`requests`, `websockets`, `python-dotenv`, `smallestai`, `openai`, `groq`, `loguru`, `streamlit`, `gradio`). **Do not duplicate these.**

If your example needs **extra** packages beyond the root, add a local `requirements.txt` with only those packages:

```txt
# System dependency: sudo apt install ffmpeg (Linux) / brew install ffmpeg (macOS) / winget install ffmpeg (Windows)

yt-dlp>=2024.0.0
```

If your example has **no extra dependencies**, do not create a `requirements.txt`.

### 3. Environment Variables

Create a `.env.sample` listing all required variables:

```bash
# Smallest AI API Key
# Get yours at https://smallest.ai/console
SMALLEST_API_KEY=your-smallest-api-key-here

# Any other keys needed
OTHER_API_KEY=your-other-api-key-here
```

### 4. Code Guidelines

**Python:**
- Use `#!/usr/bin/env python3` shebang
- Add a docstring with usage and output description
- Read API keys from environment variables using `os.environ.get()` or `python-dotenv`
- Use `requests` for HTTP, `websockets` for WebSocket
- Include type hints where helpful
- Run with `uv run your_script.py`

**JavaScript:**
- Use ES modules or CommonJS consistently
- Read API keys from `process.env`
- Use `node-fetch` for HTTP, `ws` for WebSocket
- Include a `package.json` if dependencies are needed

### 5. README Template

Follow this structure (you can slightly deviate but keep the major sections):

```markdown
# Example Name

One-line description of what this example does.

## Features

- Feature 1
- Feature 2
- Feature 3

## Demo

<!-- gif or screenshot if applicable -->

## Requirements

Base dependencies are already installed from the root
[`requirements.txt`](../../requirements.txt). Additionally:

- Add `SMALLEST_API_KEY` to your `.env`

<!-- If extra deps are needed: -->
Install example-specific dependencies:

\`\`\`bash
uv pip install -r requirements.txt
\`\`\`

## Usage

\`\`\`bash
uv run your_script.py
\`\`\`

## Recommended Usage

- Use case 1
- Use case 2
- For [alternative use case], see [Other Example](../other-example/)

## Key Snippets

<!-- Use "Key Snippets" when showing code blocks,
     "How It Works" when explaining a process/workflow in prose -->

\`\`\`python
# highlight the most important part of your code
\`\`\`

## Example Output

<!-- terminal output, screenshots, or generated files -->

## Documentation

- [Relevant docs link](https://waves-docs.smallest.ai/...)

## Next Steps

- Link to related examples or docs
```

**Section guidelines:**
- **Requirements** — Reference the root `requirements.txt` for base deps. Only mention extra deps and required API keys.
- **Recommended Usage** — At least 2 actual use-case points, at most 1 alternative suggestion with a link.
- **Key Snippets** vs **How It Works** — Use "Key Snippets" when the section primarily contains code blocks. Use "How It Works" for prose explanations of processes or workflows.
- **Structure** vs **Scripts Included** — If your example has multiple files, use "Scripts Included" for script-heavy examples or "Structure" for application-like examples, with a codeblock directory tree.

### 6. Update the Category README

Add your example to the table in the relevant category README:
- [`speech-to-text/README.md`](./speech-to-text/README.md) for STT examples
- [`voice-agents/README.md`](./voice-agents/README.md) for Voice Agent examples

---

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-example-name`
3. Make your changes
4. Test your example end-to-end with `uv run`
5. Submit a pull request with a clear description

---

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear commit history.

**Format:** `<type>: <description>`

| Type | Description |
|------|-------------|
| `feat` | New example or feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `refactor` | Code restructuring |
| `chore` | Maintenance tasks |

**Examples:**

```
feat: add youtube-summarizer example
fix: correct API endpoint in meeting-notes
docs: update getting-started README
refactor: simplify transcription parsing
chore: add .env.sample files
```

---

## Code Style

- Keep examples simple and focused on one concept
- Prefer clarity over cleverness
- Add comments for non-obvious logic
- Don't over-engineer — these are learning examples

---

## Questions?

- [Discord Community](https://discord.gg/ywShEyXHBW)
- [Open an Issue](https://github.com/smallest-inc/cookbook/issues)
