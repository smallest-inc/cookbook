#!/usr/bin/env python3
"""Build a manifest.jsonl from a folder of audio files.

Each audio file can have a sidecar transcript with the same name and a .txt
extension (clip_0001.wav + clip_0001.txt). Sub-folder names become tags,
so a layout like

    my_audio/group_a/subgroup/clip01.wav
    my_audio/group_a/subgroup/clip01.txt

gets tags ["group_a", "subgroup"], and the report breaks results down per tag.

    uv run make_manifest.py my_audio --language en

Already using the older speech-to-text/benchmarks layout (DATA_DIR/audio/ plus
a metadata.csv with audio_filename,transcript)? Convert it in one step:

    uv run make_manifest.py DATA_DIR --language hi --from-metadata-csv

Output: <folder>/manifest.jsonl (or --out). Clips without a transcript are
listed too; they are transcribed but not scored.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

AUDIO_EXT = {".wav", ".flac", ".mp3", ".ogg", ".m4a", ".opus", ".webm"}


def rows_from_folder(folder: Path, language: str) -> list[dict]:
    """One row per audio file under folder, with the sidecar .txt as the reference."""
    rows = []
    for p in sorted(folder.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in AUDIO_EXT:
            continue
        rel = p.relative_to(folder)
        row = {"audio": rel.as_posix(), "language": language, "tags": list(rel.parent.parts)}
        txt = p.with_suffix(".txt")
        if txt.exists():
            row["text"] = txt.read_text(encoding="utf-8").strip()
        rows.append(row)
    return rows


def rows_from_metadata_csv(folder: Path, language: str) -> list[dict]:
    """Rows from the benchmarks layout: folder/audio/<file> + folder/metadata.csv."""
    meta = folder / "metadata.csv"
    if not meta.is_file():
        raise ValueError(f"{meta} not found")
    with meta.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != ["audio_filename", "transcript"]:
            raise ValueError(f"{meta} must have the header audio_filename,transcript "
                             f"(found {reader.fieldnames})")
        rows = []
        for rec in reader:
            name = (rec["audio_filename"] or "").strip()
            if not name or Path(name).name != name:
                raise ValueError(f"audio_filename must be a bare file name, got {name!r}")
            rows.append({"audio": f"audio/{name}", "language": language, "tags": [],
                         "text": (rec["transcript"] or "").strip()})
    return rows


def write_manifest(rows: list[dict], out: Path) -> None:
    with out.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", type=Path)
    ap.add_argument("--language", default="en", help="language code of the clips, e.g. en, hi, ko (default en)")
    ap.add_argument("--out", type=Path, help="default: <folder>/manifest.jsonl")
    ap.add_argument("--from-metadata-csv", action="store_true",
                    help="read <folder>/metadata.csv + <folder>/audio/ (the speech-to-text/benchmarks layout)")
    args = ap.parse_args(argv)

    if not args.folder.is_dir():
        print(f"error: {args.folder} is not a folder", file=sys.stderr)
        return 2
    try:
        rows = (rows_from_metadata_csv(args.folder, args.language) if args.from_metadata_csv
                else rows_from_folder(args.folder, args.language))
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    if not rows:
        print(f"error: no audio files ({', '.join(sorted(AUDIO_EXT))}) under {args.folder}", file=sys.stderr)
        return 2

    out = args.out or args.folder / "manifest.jsonl"
    write_manifest(rows, out)
    missing = sum(1 for r in rows if not r.get("text"))
    note = f" ({missing} without a transcript; they are transcribed but not scored)" if missing else ""
    print(f"wrote {len(rows)} clips to {out}{note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
