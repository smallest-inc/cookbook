"""Dataset loaders. Every loader yields Sample objects with 16 kHz mono float32 audio.

Suites
  esb        English. The 8 Open ASR Leaderboard (ESB) test sets, read directly
             from the Hugging Face Hub (hf-audio/open-asr-leaderboard).
  fleurs     google/fleurs test split for any FLEURS locale (ko_kr by default).
             Carries speaker gender labels, so it doubles as a gender check.
  manifest   Your own audio: a JSONL manifest (see README / examples/).
"""
from __future__ import annotations

import io
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

import librosa
import numpy as np
import soundfile as sf

SR = 16000

ESB_REPO = "datasets/hf-audio/open-asr-leaderboard"
# name -> (config dir on the Hub, split file prefix)
ESB_SETS = {
    "ami":                ("ami", "test"),
    "earnings22":         ("earnings22", "test"),
    "gigaspeech":         ("gigaspeech", "test"),
    "librispeech_clean":  ("librispeech", "test.clean"),
    "librispeech_other":  ("librispeech", "test.other"),
    "spgispeech":         ("spgispeech", "test"),
    "tedlium":            ("tedlium", "test"),
    "voxpopuli":          ("voxpopuli", "test"),
}

FLEURS_REPO = "datasets/google/fleurs"
FLEURS_GENDER = {0: "male", 1: "female"}

LANG_TO_FLEURS = {"ko": "ko_kr", "en": "en_us", "ja": "ja_jp", "zh": "cmn_hans_cn"}


@dataclass
class Sample:
    id: str
    audio: np.ndarray
    text: str | None
    language: str | None = None
    emotion: str | None = None
    gender: str | None = None
    tags: list[str] = field(default_factory=list)


def decode_audio(blob: bytes | None = None, path: str | Path | None = None) -> np.ndarray:
    """Decode wav/flac/ogg/mp3 to mono float32 @16 kHz."""
    try:
        data, sr = sf.read(io.BytesIO(blob) if blob is not None else str(path),
                           dtype="float32", always_2d=False)
        if data.ndim > 1:
            data = data.mean(axis=1)
    except Exception:
        # fallback for formats libsndfile can't read (e.g. some mp3/m4a)
        src = str(path) if path is not None else io.BytesIO(blob)
        data, sr = librosa.load(src, sr=None, mono=True)
    if sr != SR:
        data = librosa.resample(data, orig_sr=sr, target_sr=SR)
    return data.astype(np.float32)


def _iter_parquet_rows(fs, files: list[str], limit: int | None):
    """Yield rows from Hub parquet files.

    With a limit, rows are sampled evenly across the whole split rather than
    taken from the top: the ESB files are sorted by clip length, so the first
    N rows would be only the longest clips. Only the row groups that hold a
    sampled row are downloaded.
    """
    import numpy as np
    import pyarrow.parquet as pq

    pfs = [pq.ParquetFile(fs.open(f)) for f in files]
    if limit is None:
        for pf in pfs:
            for batch in pf.iter_batches(batch_size=8):
                yield from batch.to_pylist()
        return

    # (file, row_group, rows) in order, then pick evenly spaced global indices
    groups = [(pf, rg, pf.metadata.row_group(rg).num_rows)
              for pf in pfs for rg in range(pf.num_row_groups)]
    total = sum(n for _, _, n in groups)
    wanted = sorted(set(np.linspace(0, total - 1, num=min(limit, total)).round().astype(int)))
    offset, w = 0, 0
    for pf, rg, n in groups:
        local = []
        while w < len(wanted) and wanted[w] < offset + n:
            local.append(wanted[w] - offset)
            w += 1
        if local:
            table = pf.read_row_group(rg)
            for i in local:
                yield table.slice(i, 1).to_pylist()[0]
            del table
        offset += n
        if w >= len(wanted):
            return


def load_esb(subset: str, limit: int | None = None) -> Iterator[Sample]:
    from huggingface_hub import HfFileSystem
    if subset not in ESB_SETS:
        raise ValueError(f"unknown ESB subset {subset!r}; choose from {list(ESB_SETS)}")
    cfg, prefix = ESB_SETS[subset]
    fs = HfFileSystem()
    try:
        files = sorted(p for p in fs.ls(f"{ESB_REPO}/{cfg}", detail=False)
                       if p.split("/")[-1].startswith(prefix) and p.endswith(".parquet"))
    except FileNotFoundError:
        files = []
    if not files:
        raise FileNotFoundError(
            f"ESB subset '{subset}' is not currently published on the Hub "
            f"({ESB_REPO}/{cfg}). Skipping it.")
    for row in _iter_parquet_rows(fs, files, limit):
        a = row["audio"]
        yield Sample(id=str(row.get("id") or a.get("path")),
                     audio=decode_audio(blob=a["bytes"]),
                     text=row["text"], language="en", tags=[subset])


def load_fleurs(locale: str = "ko_kr", limit: int | None = None) -> Iterator[Sample]:
    from huggingface_hub import HfFileSystem
    fs = HfFileSystem()
    files = sorted(fs.glob(f"{FLEURS_REPO}/parquet-data/{locale}/test-*.parquet"))
    if not files:
        raise FileNotFoundError(f"FLEURS locale '{locale}' not found on the Hub")
    lang = locale.split("_")[0] if locale != "cmn_hans_cn" else "zh"
    for row in _iter_parquet_rows(fs, files, limit):
        a = row["audio"]
        g = row.get("gender")
        yield Sample(id=str(row["id"]) + "_" + str(a.get("path", "")),
                     audio=decode_audio(blob=a["bytes"]),
                     text=row["raw_transcription"], language=lang,
                     gender=FLEURS_GENDER.get(int(g)) if g is not None else None,
                     tags=[f"fleurs_{locale}"])


def load_manifest(manifest: Path, limit: int | None = None) -> Iterator[Sample]:
    """JSONL, one clip per line. Required: "audio". Optional: "text", "language",
    "emotion", "gender", "tags" (list) and "id". Relative audio paths resolve
    against the manifest's folder."""
    root = manifest.parent
    with manifest.open(encoding="utf-8") as f:
        n = 0
        for i, line in enumerate(f):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            row = json.loads(line)
            ap = Path(row["audio"])
            if not ap.is_absolute():
                ap = root / ap
            tags = row.get("tags") or []
            if isinstance(tags, str):
                tags = [tags]
            yield Sample(id=str(row.get("id") or row["audio"]),
                         audio=decode_audio(path=ap),
                         text=row.get("text"), language=row.get("language"),
                         emotion=row.get("emotion"), gender=row.get("gender"),
                         tags=tags)
            n += 1
            if limit is not None and n >= limit:
                return
