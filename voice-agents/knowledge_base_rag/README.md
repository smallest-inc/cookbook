# Knowledge Base RAG

Create and populate Knowledge Bases for RAG-powered agents.

## Overview

Two ways to add content to a Knowledge Base:
1. **PDF Upload** - Upload PDF files via API
2. **URL Scraping** - Scrape web pages via API

## Quick Start

```bash
pip install smallestai python-dotenv reportlab

# Set up .env with SMALLEST_API_KEY
python setup_kb.py
```

## PDF Upload

```python
from smallestai.atoms import KB

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

## URL Scraping

```python
from smallestai.atoms import KB

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

## KB Management

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

## Next Steps

Link the KB to your agent in the dashboard to enable RAG.
