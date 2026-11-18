"""Print a latency waterfall for runs.json from measure.py.

usage: python report.py [runs/runs.json]
"""

import json
import sys
from pathlib import Path

ROWS = [
    ("endpointing", "Pulse: waiting to be sure you stopped"),
    ("llm_first_token", "Electron: first token"),
    ("llm_first_sentence", "Electron: first full sentence"),
    ("tts_first_audio", "Lightning: first audio"),
]
WIDTH = 40


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "runs/runs.json")
    d = json.loads(path.read_text())
    ok = [r for r in d["runs"] if "stages_ms" in r]
    if not ok:
        sys.exit(f"no successful runs in {path}")
    med = d["median_ms"]
    total = med["total"]
    print(f"\n{len(ok)} of {d['of']} runs, median per stage, ms after you stopped talking\n")
    if total <= 0:
        r = ok[0]
        print(f"The agent started {abs(total) / 1000:.1f} s BEFORE you finished.")
        print(f"It replied to: {r['heard_before_reply']!r}")
        print(f"You said:      {r['transcript']!r}\n")
        return
    scale = WIDTH / max(total, 1)
    start = 0.0
    for key, label in ROWS:
        ms = med[key]
        pad, size = round(start * scale), max(1, round(ms * scale))
        print(f"{label:<38} {' ' * pad}{'█' * size}{' ' * max(0, WIDTH - pad - size)} {ms:>6.0f}")
        start += ms
    share = 100 * med["endpointing"] / total
    rtt = sorted(r.get("network_rtt_ms", 0) for r in ok)[len(ok) // 2]
    print(f"{'total to first audio':<38} {' ' * WIDTH} {total:>6.0f}")
    print(f"\n{share:.0f}% of the wait is end-of-turn detection. Network round trip: {rtt} ms.\n")


if __name__ == "__main__":
    main()
