# Contributing to Smallest AI Cookbook

Thanks for your interest in contributing! This guide will help you add new examples or improve existing ones.

---

## Adding a New Example

### 1. Create the Directory Structure

```
speech-to-text/your-example-name/
├── python/
│   └── (your python files)
├── javascript/
│   └── (your js files)
├── app/
│   └── (if example has a UI, e.g. Gradio, Streamlit, or web app)
├── .env.sample
└── README.md
```

### 2. Code Guidelines

**Python:**
- Use `#!/usr/bin/env python3` shebang
- Add a docstring with usage and output description
- Read API keys from environment variables using `os.environ.get()`
- Use `requests` for HTTP, `websockets` for WebSocket
- Include type hints where helpful

**JavaScript:**
- Use ES modules or CommonJS consistently
- Read API keys from `process.env`
- Use `node-fetch` for HTTP, `ws` for WebSocket
- Include a `package.json` if dependencies are needed

### 3. Environment Variables

Create a `.env.sample` file listing all required variables:

```bash
# Smallest AI API Key
# Get yours at https://smallest.ai/console
SMALLEST_API_KEY=your-smallest-api-key-here

# Any other keys needed
OTHER_API_KEY=your-other-api-key-here
```

### 4. README Template

Your README should include:

```markdown
# Example Name

One-line description of what this example does.

## Requirements

\`\`\`bash
pip install requests  # or npm install
\`\`\`

## Setup

\`\`\`bash
cp .env.sample .env
# Edit .env with your API keys
\`\`\`

## Usage

\`\`\`bash
python python/script.py <args>
\`\`\`

## Output

Describe what files or output the example produces.
```

### 5. Update Root README

Add your example to the table in the root `README.md`.

---

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-example-name`
3. Make your changes
4. Test your example works end-to-end
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

```bash
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

- [Discord Community](https://discord.gg/5evETqguJs)
- [Open an Issue](https://github.com/smallest-ai/cookbook/issues)

