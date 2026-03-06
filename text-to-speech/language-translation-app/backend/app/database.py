"""SQLite database for translation history."""
import aiosqlite
import json
from pathlib import Path
from typing import List, Optional

DB_PATH = Path(__file__).parent.parent / "langly.db"


async def init_db():
    """Initialize database tables."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_text TEXT NOT NULL,
                source_lang TEXT NOT NULL,
                target_lang TEXT NOT NULL,
                translated_text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()


async def add_to_history(
    source_text: str,
    source_lang: str,
    target_lang: str,
    translated_text: str,
):
    """Add a translation to history."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO history (source_text, source_lang, target_lang, translated_text)
            VALUES (?, ?, ?, ?)
            """,
            (source_text, source_lang, target_lang, translated_text),
        )
        await db.commit()


async def get_history(limit: int = 50) -> List[dict]:
    """Get recent translation history."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT id, source_text, source_lang, target_lang, translated_text, created_at
            FROM history ORDER BY created_at DESC LIMIT ?
            """,
            (limit,),
        ) as cursor:
            rows = await cursor.fetchall()
            return [
                {
                    "id": row["id"],
                    "source_text": row["source_text"],
                    "source_lang": row["source_lang"],
                    "target_lang": row["target_lang"],
                    "translated_text": row["translated_text"],
                    "created_at": row["created_at"],
                }
                for row in rows
            ]


async def delete_history_item(item_id: int) -> bool:
    """Delete a history item by ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "DELETE FROM history WHERE id = ?", (item_id,)
        )
        await db.commit()
        return cursor.rowcount > 0
