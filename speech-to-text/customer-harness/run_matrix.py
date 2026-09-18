"""Run each scenario WAV × each augmentation × each config profile.

Emits a CSV with per-run:
  scenario, profile, augmentation, first_final_ms, final_transcript,
  duplicate_final_count, last_partial_change_after_final_ms
"""

from __future__ import annotations

import argparse
import csv
import glob
import json
import os
import subprocess
import sys
import tempfile
import time


# PROFILES map 1:1 to stream_client.py PRESETS. Kept as flat CLI flags so we
# can pass profile-specific --keywords per row without polluting the preset
# definition itself. When you add a preset there, mirror it here.
PROFILES = {
    "voice_agent_open": [
        "--preset=voice_agent_open",
    ],
    "voice_agent_short_reply": [
        "--preset=voice_agent_short_reply",
        "--keywords=yes:3,no:3,one:2,two:2,three:2,four:2,five:2",
    ],
    "ivr": [
        "--preset=ivr",
        "--keywords=one:2,two:2,three:2,four:2,five:2,six:2,seven:2,eight:2,nine:2,zero:2,star:2,pound:2",
    ],
    "dictation": [
        "--preset=dictation",
    ],
}


AUGMENTATIONS = {
    "baseline": [],
    "clip_head_100ms": ["--clip-head=100"],
    "clip_tail_150ms": ["--clip-tail=150"],
    "noise_10db": ["--snr=10"],
    "jitter_20ms": ["--jitter=20"],
    "early_finalize_400ms": ["--force-finalize-after=400"],
    "bad_resample_8k": ["--bad-resample-hz=8000"],
}


def _event_text(ev: dict) -> str:
    return (ev.get("transcript") or ev.get("text") or "").strip()


def _load_events(jsonl_path: str) -> list[dict]:
    if not os.path.exists(jsonl_path):
        return []
    with open(jsonl_path) as f:
        events = [json.loads(line) for line in f if line.strip()]
    os.unlink(jsonl_path)
    return events


def _last_partial_gap(partials: list[dict], first_final_ms: int | None) -> int | None:
    if first_final_ms is None:
        return None
    later = [p.get("t_ms", 0) for p in partials if p.get("t_ms", 0) > first_final_ms]
    if not later:
        return None
    return max(later) - first_final_ms


def _summarize(events: list[dict]) -> dict:
    finals = [e for e in events if e.get("is_final")]
    partials = [e for e in events if not e.get("is_final") and "transcript" in e]
    final_texts = [t for t in (_event_text(e) for e in finals) if t]
    first_final_ms = finals[0].get("t_ms") if finals else None
    return {
        "first_final_ms": first_final_ms,
        "full_transcript": " ".join(final_texts),
        "last_final": final_texts[-1] if final_texts else "",
        "duplicate_final_count": max(0, len(finals) - 1),
        "last_partial_change_after_final_ms": _last_partial_gap(partials, first_final_ms),
    }


def _build_cmd(
    wav: str,
    url: str,
    api_key: str,
    jsonl: str,
    profile_flags: list[str],
    aug_flags: list[str],
) -> list[str]:
    cmd = [
        sys.executable,
        os.path.join(os.path.dirname(__file__), "stream_client.py"),
        f"--wav={wav}",
        f"--url={url}",
        f"--out-jsonl={jsonl}",
        *profile_flags,
        *aug_flags,
    ]
    if api_key:
        cmd.append(f"--api-key={api_key}")
    return cmd


def run_one(
    wav: str,
    url: str,
    api_key: str,
    profile_flags: list[str],
    aug_flags: list[str],
) -> dict:
    with tempfile.NamedTemporaryFile("r", suffix=".jsonl", delete=False) as tmp:
        jsonl = tmp.name
    cmd = _build_cmd(wav, url, api_key, jsonl, profile_flags, aug_flags)
    t0 = time.monotonic()
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60, check=False)
    walltime_ms = int((time.monotonic() - t0) * 1000)

    summary = _summarize(_load_events(jsonl))
    summary["walltime_ms"] = walltime_ms
    summary["exit_code"] = proc.returncode
    return summary


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--scenarios", default="scenarios", help="dir of WAV scenarios")
    p.add_argument(
        "--url",
        default="wss://api.smallest.ai/waves/v1/stt/live",
        help="Streaming WebSocket URL.",
    )
    p.add_argument(
        "--api-key",
        default="",
        help="Smallest API key. Falls back to SMALLEST_API_KEY env var.",
    )
    p.add_argument("--out-csv", default="run_matrix_results.csv")
    p.add_argument(
        "--profile",
        default="all",
        help=f"one of {list(PROFILES.keys())} or 'all'",
    )
    args = p.parse_args()
    api_key = args.api_key or os.getenv("SMALLEST_API_KEY", "")

    wavs = sorted(glob.glob(os.path.join(args.scenarios, "*.wav")))
    if not wavs:
        print(f"no WAVs found in {args.scenarios}", file=sys.stderr)
        return 1

    profiles = PROFILES if args.profile == "all" else {args.profile: PROFILES[args.profile]}

    fieldnames = [
        "scenario",
        "profile",
        "augmentation",
        "first_final_ms",
        "full_transcript",
        "last_final",
        "duplicate_final_count",
        "last_partial_change_after_final_ms",
        "walltime_ms",
        "exit_code",
    ]
    with open(args.out_csv, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for wav in wavs:
            scenario = os.path.splitext(os.path.basename(wav))[0]
            for pname, pflags in profiles.items():
                for aname, aflags in AUGMENTATIONS.items():
                    print(f"[{scenario}] {pname} × {aname}", flush=True)
                    result = run_one(wav, args.url, api_key, pflags, aflags)
                    row = {
                        "scenario": scenario,
                        "profile": pname,
                        "augmentation": aname,
                        **result,
                    }
                    w.writerow(row)
                    f.flush()
    print(f"→ {args.out_csv}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
