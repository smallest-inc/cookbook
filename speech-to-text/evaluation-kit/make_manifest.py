#!/usr/bin/env python3
"""Build a manifest.jsonl from a folder of audio files.

Each audio file can have a sidecar transcript with the same name and a .txt
extension (clip_0001.wav + clip_0001.txt). Sub-folder names become tags,
so a layout like

    my_audio/group_a/subgroup/clip01.wav
    my_audio/group_a/subgroup/clip01.txt

gets tags ["group_a", "subgroup"].

    python make_manifest.py my_audio --language en
"""
import argparse
import json
from pathlib import Path

AUDIO_EXT = {".wav", ".flac", ".mp3", ".ogg", ".m4a", ".opus"}

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("folder", type=Path)
ap.add_argument("--language", default="en")
ap.add_argument("--out", type=Path, help="default: <folder>/manifest.jsonl")
args = ap.parse_args()

out = args.out or args.folder / "manifest.jsonl"
n = missing = 0
with out.open("w", encoding="utf-8") as f:
    for p in sorted(args.folder.rglob("*")):
        if p.suffix.lower() not in AUDIO_EXT:
            continue
        rel = p.relative_to(args.folder)
        row = {"audio": str(rel), "language": args.language, "tags": list(rel.parent.parts)}
        txt = p.with_suffix(".txt")
        if txt.exists():
            row["text"] = txt.read_text(encoding="utf-8").strip()
        else:
            missing += 1
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
        n += 1
print(f"wrote {n} clips to {out}" + (f" ({missing} without a transcript; they are transcribed but not scored)" if missing else ""))
