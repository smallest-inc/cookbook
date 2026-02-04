"""
Knowledge Base Setup

Two ways to add content to a Knowledge Base:
1. PDF Upload - Upload PDF files via API
2. URL Scraping - Scrape web pages via API

Usage:
    python setup_kb.py
"""

import os
from dotenv import load_dotenv
from smallestai.atoms import KB

load_dotenv()


def example_pdf_upload():
    """Upload a PDF file to Knowledge Base."""
    
    print("=" * 50)
    print("PDF UPLOAD EXAMPLE")
    print("=" * 50)
    
    kb = KB()
    
    # Create KB
    result = kb.create(
        name="Starbucks Menu",
        description="Coffee drinks, food, and prices"
    )
    kb_id = result["data"]["_id"]
    print(f"Created KB: {kb_id}")
    
    # Create sample PDF
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
        
        pdf_path = "/tmp/menu.pdf"
        c = canvas.Canvas(pdf_path, pagesize=letter)
        
        c.setFont("Helvetica-Bold", 24)
        c.drawString(200, 750, "STARBUCKS MENU")
        
        c.setFont("Helvetica", 12)
        items = [
            "Caffe Latte: $5.25",
            "Cappuccino: $4.95", 
            "Frappuccino: $6.25",
            "Cold Brew: $4.75",
            "Croissant: $3.75",
            "Banana Bread: $3.95",
        ]
        y = 700
        for item in items:
            c.drawString(60, y, item)
            y -= 25
        
        c.save()
        
        # Upload PDF
        kb.add_file(kb_id, pdf_path)
        print(f"Uploaded: {pdf_path}")
        
    except ImportError:
        print("Install reportlab for PDF creation: pip install reportlab")
    
    # Check status
    items = kb.get_items(kb_id)
    for item in items.get("data", []):
        print(f"  {item['fileName']}: {item['processingStatus']}")
    
    return kb_id


def example_url_scrape():
    """Scrape a URL into Knowledge Base."""
    
    print("\n" + "=" * 50)
    print("URL SCRAPING EXAMPLE")
    print("=" * 50)
    
    kb = KB()
    
    # Create KB
    result = kb.create(
        name="Python Docs",
        description="Python programming documentation"
    )
    kb_id = result["data"]["_id"]
    print(f"Created KB: {kb_id}")
    
    # Scrape URL
    url = "https://en.wikipedia.org/wiki/Python_(programming_language)"
    print(f"Scraping: {url}")
    
    kb.scrape_urls(kb_id, [url])
    print("Scrape initiated")
    
    # Check scraped URLs
    scraped = kb.get_scraped_urls(kb_id)
    for host in scraped.get("data", []):
        for u in host.get("scrapedUrls", []):
            print(f"  {u['url']}: {u['processingStatus']}")
    
    return kb_id


if __name__ == "__main__":
    print("\nKnowledge Base Examples\n")
    
    pdf_kb = example_pdf_upload()
    url_kb = example_url_scrape()
    
    print("\n" + "=" * 50)
    print("DONE")
    print("=" * 50)
    print(f"PDF KB:  {pdf_kb}")
    print(f"URL KB:  {url_kb}")
    print("\nLink these to your agent in the dashboard.")
