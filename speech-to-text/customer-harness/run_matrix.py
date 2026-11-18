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


# Profiles come from presets.json, the same file stream_client.py and
# live.html read. Each profile runs as `stream_client.py --preset=<name>`, so
# its knobs (including keywords) are defined in one place only.
PRESETS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "presets.json")


def load_profiles() -> dict[str, list[str]]:
    with open(PRESETS_PATH) as f:
        raw = json.load(f)
    return {
        name: [f"--preset={name}"]
        for name, spec in raw.items()
        if not name.startswith("_") and spec.get("cli")
    }


def matrix_profile_names() -> list[str]:
    with open(PRESETS_PATH) as f:
        raw = json.load(f)
    names = [n for n, s in raw.items() if not n.startswith("_") and s.get("matrix")]
    # The matrix runs presets through stream_client.py, which only offers "cli" presets.
    not_cli = [n for n in names if not raw[n].get("cli")]
    if not_cli:
        raise SystemExit(f"presets.json: {not_cli} set \"matrix\": true but not \"cli\": true")
    return names


PROFILES = load_profiles()


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
    # No API key on the command line: argv is visible to every local user via
    # `ps`. The child reads SMALLEST_API_KEY from the inherited environment.
    return cmd


def run_one(
    wav: str,
    url: str,
    profile_flags: list[str],
    aug_flags: list[str],
    timeout_s: float,
) -> dict:
    with tempfile.NamedTemporaryFile("r", suffix=".jsonl", delete=False) as tmp:
        jsonl = tmp.name
    cmd = _build_cmd(wav, url, jsonl, profile_flags, aug_flags)
    t0 = time.monotonic()
    error = ""
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s, check=False)
        exit_code: int | str = proc.returncode
        if proc.returncode != 0:
            tail = (proc.stderr or "").strip().splitlines()
            error = tail[-1][:200] if tail else f"exit {proc.returncode}"
    except subprocess.TimeoutExpired:
        # Record the failure and keep sweeping instead of aborting the run.
        exit_code = "timeout"
        error = f"no result within {timeout_s:g}s"
    walltime_ms = int((time.monotonic() - t0) * 1000)

    summary = _summarize(_load_events(jsonl))
    summary["walltime_ms"] = walltime_ms
    summary["exit_code"] = exit_code
    summary["error"] = error
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
        "--timeout",
        type=float,
        default=60.0,
        help="Seconds allowed per run. A run that exceeds it is recorded as a failed row.",
    )
    p.add_argument("--out-csv", default="run_matrix_results.csv")
    p.add_argument(
        "--profile",
        default="all",
        help=f"one of {list(PROFILES.keys())} or 'all'",
    )
    args = p.parse_args()
    if not os.getenv("SMALLEST_API_KEY"):
        print("note: SMALLEST_API_KEY is not set; runs will connect without auth", file=sys.stderr)

    wavs = sorted(glob.glob(os.path.join(args.scenarios, "*.wav")))
    if not wavs:
        print(f"no WAVs found in {args.scenarios}", file=sys.stderr)
        return 1

    if args.profile == "all":
        profiles = {name: PROFILES[name] for name in matrix_profile_names()}
    elif args.profile in PROFILES:
        profiles = {args.profile: PROFILES[args.profile]}
    else:
        print(f"unknown profile {args.profile!r}; choose from {list(PROFILES)} or 'all'", file=sys.stderr)
        return 2

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
        "error",
    ]
    with open(args.out_csv, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for wav in wavs:
            scenario = os.path.splitext(os.path.basename(wav))[0]
            for pname, pflags in profiles.items():
                for aname, aflags in AUGMENTATIONS.items():
                    print(f"[{scenario}] {pname} × {aname}", flush=True)
                    result = run_one(wav, args.url, pflags, aflags, args.timeout)
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
