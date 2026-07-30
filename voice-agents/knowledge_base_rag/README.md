# Knowledge Base RAG

Create and populate Knowledge Bases for RAG-powered agents.

## Features

- **PDF Upload** — Upload PDF files via API
- **URL Scraping** — Scrape web pages via API
- **KB Management** — Create, list, get, delete Knowledge Bases
- **Item Status Tracking** — Monitor processing status of uploaded content

## Requirements

> Make sure you've run `uv venv && uv pip install -r requirements.txt` at the repo root first. See the [main README](../../README.md#usage).

## Usage

```bash
uv pip install -r requirements.txt
uv run setup_kb.py
```

## Recommended Usage

- Giving your voice agent access to custom documents and web content for RAG-powered answers
- PDF upload, URL scraping, and KB lifecycle management via API

## Key Snippets

### PDF Upload

```python
from smallestai.atoms.helpers import KB

kb = KB()

# Create KB
result = kb.create(name="My KB", description="My docs")
kb_id = result["data"]["_id"]

# Upload PDF
kb.add_file(kb_id, "document.pdf")

# Check status
items = kb.get_items(kb_id)
for item in items["data"]:
    print(f"{item['fileName']}: {item['processingStatus']}")
```

### URL Scraping

```python
from smallestai.atoms.helpers import KB

kb = KB()

# Create KB
result = kb.create(name="My KB")
kb_id = result["data"]["_id"]

# Scrape URLs
kb.scrape_urls(kb_id, [
    "https://example.com/docs",
    "https://example.com/faq"
])

# Check status
scraped = kb.get_scraped_urls(kb_id)
```

### KB Management

```python
kb = KB()

# List all KBs
kb.list()

# Get KB details  
kb.get(kb_id)

# Get items
kb.get_items(kb_id)

# Delete KB
kb.delete(kb_id)
```

## Notes

- Only PDF files are supported for upload
- Text upload is not yet available via API (use dashboard)
- Link KB to agent via `globalKnowledgeBaseId` in dashboard

## API Reference

- [Atoms SDK — Quick Start](https://docs.smallest.ai/atoms/developer-guide/get-started/quickstart)

## Next Steps

- Link the KB to your agent in the dashboard to enable RAG
- See [Agent with Tools](../agent_with_tools/) for adding function tools alongside KB
