#!/usr/bin/env python3
"""Pulse STT evaluation kit: score Pulse and Pulse 2.0 on public test sets or your own audio.

Examples
  # 1) Quick check: 200 LibriSpeech clips, streaming
  uv run run_eval.py --suite esb --subset librispeech_clean --limit 200

  # 2) English accuracy on the ESB sets (WER)
  uv run run_eval.py --suite esb --model pulse --limit 500

  # 3) Korean and other languages on FLEURS (CER for ko/ja/zh, WER otherwise)
  uv run run_eval.py --suite fleurs --locale ko_kr --model pulse
  uv run run_eval.py --suite fleurs --locale hi_in,es_419 --model pulse --limit 100

  # 4) Your own recordings
  uv run make_manifest.py my_audio --language en
  uv run run_eval.py --suite manifest --manifest my_audio/manifest.jsonl --model pulse

  # 5) Pulse 2.0 real-time checks: latency, end-of-turn, emotion, gender
  uv run run_eval.py --suite manifest --manifest my_audio/manifest.jsonl --model pulse-2 --eot

Reads SMALLEST_API_KEY from the environment (or a .env file). The key is never
printed or written to disk.

Outputs go to results/<run-name>/<dataset>/ : results.jsonl (one line per clip,
resumable), results.csv and summary.json, plus results/<run-name>/summary.md,
summary.csv and summary.json for the whole run.
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
import sys
import time
from collections import defaultdict
from pathlib import Path

import loaders
import scoring
from pulse_client import http_transcribe, join_finals, speech_bounds, stream_transcribe

MODELS = ["pulse", "pulse-2", "pulse-pro"]
HTTP_ONLY_MODELS = {"pulse-pro"}
STREAMING_ONLY_MODELS = {"pulse-2"}


def parse_params(items: list[str]) -> dict:
    out = {}
    for it in items or []:
        if "=" not in it:
            sys.exit(f"--param expects key=value, got {it!r}")
        k, v = it.split("=", 1)
        out[k] = {"true": True, "false": False}.get(v.lower(), v)
    return out


def build_jobs(args) -> list[tuple[str, callable]]:
    """[(dataset_name, () -> iterator[Sample])]"""
    if args.suite == "esb":
        names = list(loaders.ESB_SETS) if args.subset in (None, "all") else args.subset.split(",")
        return [(f"esb/{n}", (lambda n=n: loaders.load_esb(n, args.limit))) for n in names]
    if args.suite == "fleurs":
        locales = args.locale.split(",")
        return [(f"fleurs/{loc}", (lambda loc=loc: loaders.load_fleurs(loc, args.limit))) for loc in locales]
    if args.suite == "manifest":
        if not args.manifest:
            sys.exit("--suite manifest requires --manifest path/to/manifest.jsonl")
        m = Path(args.manifest)
        name = args.name or m.parent.name or m.stem
        return [(f"custom/{name}", lambda: loaders.load_manifest(m, args.limit))]
    sys.exit(f"unknown suite {args.suite}")


async def run_clip(sample: loaders.Sample, args, params: dict) -> dict:
    language = args.language or sample.language or "en"
    if args.model == "pulse-2" and not language.startswith("en"):
        raise ValueError(f"pulse-2 is English-only; use --model pulse for language '{language}'")
    s_start, s_end = speech_bounds(sample.audio)
    dur = len(sample.audio) / loaders.SR
    row = {"id": sample.id, "language": language, "duration_s": round(dur, 3),
           "reference": sample.text, "tags": sample.tags}
    if sample.emotion:
        row["emotion_ref"] = sample.emotion
    if sample.gender:
        row["gender_ref"] = sample.gender

    t_wall = time.perf_counter()
    if args.mode == "http":
        res = await asyncio.to_thread(http_transcribe, sample.audio, args.api_key, args.model,
                                      language, params)
        row["latency"] = {"request_s": round(res["request_s"], 3)}
    else:
        res = await stream_transcribe(sample.audio, args.api_key, model=args.model,
                                      language=language, realtime=args.realtime or args.eot,
                                      eot_mode=args.eot, trailing_silence_s=args.trailing_silence,
                                      extra_params=params)
        if args.realtime or args.eot:
            nonempty = [f for f in res["finals"] if f["transcript"].strip()]
            # Prefer the API's word timestamps (audio time == wall time when
            # streaming at 1x); fall back to the energy VAD.
            ws_ = [f["word_start"] for f in nonempty if f.get("word_start") is not None]
            we_ = [f["word_end"] for f in nonempty if f.get("word_end") is not None]
            if ws_ and we_:
                s_start, s_end = min(ws_), max(we_)
            lat = {
                "first_partial_s": (res["first_partial_t"] - s_start) if res["first_partial_t"] else None,
                "final_after_speech_end_s": (nonempty[-1]["t"] - s_end) if nonempty else None,
            }
            if args.eot:
                # turn closed by the end-of-turn model (not by our close_stream flush)
                eot_ok = bool(nonempty) and nonempty[-1]["eot_finalized"]
                lat.update({
                    "eot_detected": eot_ok,
                    # end-of-turn fired, but the speaker kept talking afterwards
                    "eot_premature": any(f["eot_finalized"] for f in nonempty[:-1]),
                    "eot_delay_s": (nonempty[-1]["t"] - s_end) if eot_ok else None,
                })
            row["latency"] = {k: (round(v, 3) if isinstance(v, float) else v) for k, v in lat.items()}
        row["finals"] = res["finals"]
        row["events"] = res["events"]
        emo = scoring.clip_label(res["finals"], "emotion")
        gen = scoring.clip_label(res["finals"], "gender")
        if emo:
            row["emotion_pred"] = emo
        if gen:
            row["gender_pred"] = gen
    row["hypothesis"] = res["transcript"]
    row["wall_s"] = round(time.perf_counter() - t_wall, 3)
    if sample.text:
        row["error_rate"] = scoring.utterance_error(sample.text, res["transcript"], language, args.metric)
    return row


async def transcribe_dataset(name: str, make_iter, out_dir: Path, args, params: dict) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    res_path = out_dir / "results.jsonl"
    done = set()
    if res_path.exists():
        for line in res_path.open(encoding="utf-8"):
            try:
                r = json.loads(line)
                if "error" not in r:
                    done.add(r["id"])
            except json.JSONDecodeError:
                pass
    try:
        it = make_iter()
    except Exception as e:  # noqa: BLE001 - dataset missing, offline, or Hub error: skip with a clear note
        print(f"  ! {name}: skipped, could not open the dataset ({type(e).__name__}: {str(e)[:200]})")
        return

    sem = asyncio.Semaphore(args.concurrency)
    lock = asyncio.Lock()
    tasks, n_new, n_err, t0 = [], 0, 0, time.time()
    fout = res_path.open("a", encoding="utf-8")
    _end = object()

    async def worker(sample):
        nonlocal n_new, n_err
        try:
            row = await run_clip(sample, args, params)
        except Exception as e:  # noqa: BLE001 - keep going; failed clips are retried on the next run
            row = {"id": sample.id, "error": str(e)[:500], "reference": sample.text, "tags": sample.tags}
            n_err += 1
            print(f"    [err] {sample.id}: {str(e)[:160]}", file=sys.stderr, flush=True)
        async with lock:
            fout.write(json.dumps(row, ensure_ascii=False) + "\n")
            fout.flush()
            n_new += 1
            if n_new % 25 == 0:
                rate = n_new / max(time.time() - t0, 1e-9)
                print(f"    {name}: {n_new} clips ({rate:.1f}/s, {n_err} errors)", flush=True)
        sem.release()

    print(f"  → {name}" + (f" (resuming, {len(done)} already done)" if done else ""), flush=True)
    try:
        while True:
            try:
                sample = await asyncio.to_thread(next, it, _end)
            except Exception as e:  # noqa: BLE001 - e.g. the Hub went away mid-run; keep what we have
                print(f"  ! {name}: stopped reading the dataset ({type(e).__name__}: {str(e)[:200]})")
                break
            if sample is _end:
                break
            if sample.id in done:
                continue
            await sem.acquire()
            tasks.append(asyncio.create_task(worker(sample)))
        await asyncio.gather(*tasks)
    finally:
        fout.close()
    print(f"  ✓ {name}: {n_new} new clips, {n_err} errors, {time.time() - t0:.0f}s", flush=True)


CSV_FIELDS = ["dataset", "id", "language", "tags", "duration_s", "metric", "error_rate",
              "reference", "hypothesis", "emotion_ref", "emotion_pred", "gender_ref", "gender_pred",
              "first_partial_ms", "final_after_speech_end_ms", "eot_detected", "eot_premature",
              "eot_delay_ms", "request_ms", "wall_s", "error"]


def _csv_safe(value):
    """Keep spreadsheet apps from running a transcript as a formula."""
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return value


def _ms(seconds):
    return None if seconds is None else round(seconds * 1000)


def clip_csv_row(dataset: str, r: dict, metric: str | None = None) -> dict:
    lat = r.get("latency") or {}
    row = {
        "dataset": dataset, "id": r.get("id"), "language": r.get("language"),
        "tags": "|".join(r.get("tags") or []), "duration_s": r.get("duration_s"),
        "metric": scoring.metric_for(r.get("language"), metric) if r.get("reference") else None,
        "error_rate": r.get("error_rate"), "reference": r.get("reference"),
        "hypothesis": r.get("hypothesis"),
        "emotion_ref": r.get("emotion_ref"), "emotion_pred": r.get("emotion_pred"),
        "gender_ref": r.get("gender_ref"), "gender_pred": r.get("gender_pred"),
        "first_partial_ms": _ms(lat.get("first_partial_s")),
        "final_after_speech_end_ms": _ms(lat.get("final_after_speech_end_s")),
        "eot_detected": lat.get("eot_detected"), "eot_premature": lat.get("eot_premature"),
        "eot_delay_ms": _ms(lat.get("eot_delay_s")), "request_ms": _ms(lat.get("request_s")),
        "wall_s": r.get("wall_s"), "error": r.get("error"),
    }
    return {k: _csv_safe(v) for k, v in row.items()}


def write_csv(path: Path, fields: list[str], rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def summarize_dataset(name: str, res_path: Path, metric: str | None = None) -> dict | None:
    if not res_path.exists():
        return None
    rows = {}
    for line in res_path.open(encoding="utf-8"):
        r = json.loads(line)
        if "error" in r and r["id"] in rows:
            continue
        if r.get("finals") is not None and "error" not in r:
            r["hypothesis"] = join_finals(r["finals"])  # keeps --rescore consistent
            if r.get("reference"):
                r["error_rate"] = scoring.utterance_error(r["reference"], r["hypothesis"], r["language"], metric)
        rows[r["id"]] = r  # last successful write wins
    ok = [r for r in rows.values() if "error" not in r]
    failed = len(rows) - len(ok)
    summ = {"dataset": name, "clips": len(ok), "failed": failed}
    if failed:
        # distinct reasons, so "model not enabled" or "language not enabled" is visible in the report
        summ["errors"] = sorted({r["error"][:240] for r in rows.values() if "error" in r})[:5]

    by_lang = defaultdict(list)
    for r in ok:
        if r.get("reference"):
            by_lang[r["language"]].append(r)
    summ["accuracy"] = {}
    for lang, rs in by_lang.items():
        summ["accuracy"][lang] = scoring.error_rate([r["reference"] for r in rs],
                                                    [r["hypothesis"] for r in rs], lang, metric)
    # per-tag breakdown (useful for your own audio grouped into folders)
    tags = sorted({t for r in ok for t in r.get("tags", [])})
    if len(tags) > 1:
        summ["by_tag"] = {}
        for t in tags:
            rs = [r for r in ok if t in r.get("tags", []) and r.get("reference")]
            if rs:
                lang = rs[0]["language"]
                summ["by_tag"][t] = scoring.error_rate([r["reference"] for r in rs],
                                                       [r["hypothesis"] for r in rs], lang, metric)
    emo = scoring.classification_report(
        [scoring.canon(r.get("emotion_ref"), scoring.EMOTION_ALIASES) for r in ok],
        [r.get("emotion_pred") for r in ok])
    gen = scoring.classification_report(
        [scoring.canon(r.get("gender_ref"), scoring.GENDER_ALIASES) for r in ok],
        [r.get("gender_pred") for r in ok])
    # only report a task if the model actually returned predictions (pulse-2)
    if emo and any(r.get("emotion_pred") for r in ok):
        summ["emotion"] = emo
    if gen and any(r.get("gender_pred") for r in ok):
        summ["gender"] = gen
    lat = scoring.latency_summary(ok)
    if lat:
        summ["latency"] = lat
    (res_path.parent / "summary.json").write_text(json.dumps(summ, indent=2, ensure_ascii=False),
                                                 encoding="utf-8")
    write_csv(res_path.parent / "results.csv", CSV_FIELDS,
              [clip_csv_row(name, r, metric) for r in rows.values()])
    return summ


def fmt(v, suffix=""):
    return "n/a" if v is None else f"{v}{suffix}"


SUMMARY_FIELDS = ["dataset", "language", "clips", "failed", "metric", "error_rate_pct",
                  "substitutions", "deletions", "insertions",
                  "first_partial_ms_p50", "first_partial_ms_p95",
                  "final_after_speech_end_ms_p50", "final_after_speech_end_ms_p95",
                  "eot_detect_rate_pct", "eot_premature_cutoff_pct", "eot_delay_ms_p50", "eot_delay_ms_p95",
                  "emotion_accuracy_pct", "emotion_macro_f1_pct", "gender_accuracy_pct", "gender_macro_f1_pct"]


def summary_csv_rows(summaries: list[dict]) -> list[dict]:
    rows = []
    for s in summaries:
        lat = s.get("latency") or {}
        emo, gen = s.get("emotion") or {}, s.get("gender") or {}
        extra = {k: lat.get(k) for k in SUMMARY_FIELDS if k in lat}
        extra.update({"emotion_accuracy_pct": emo.get("accuracy"), "emotion_macro_f1_pct": emo.get("macro_f1"),
                      "gender_accuracy_pct": gen.get("accuracy"), "gender_macro_f1_pct": gen.get("macro_f1")})
        accs = [(lang, a) for lang, a in (s.get("accuracy") or {}).items() if a] or [(None, None)]
        for lang, acc in accs:
            acc = acc or {}
            rows.append({"dataset": s["dataset"], "language": lang, "clips": acc.get("n", s["clips"]),
                         "failed": s["failed"],
                         "metric": acc.get("metric"), "error_rate_pct": acc.get("value"),
                         "substitutions": acc.get("substitutions"), "deletions": acc.get("deletions"),
                         "insertions": acc.get("insertions"), **extra})
    return rows


def write_report(summaries: list[dict], run_dir: Path, args) -> str:
    lines = [f"# Pulse STT evaluation: {args.run_name}", "",
             f"Model: `{args.model}` · mode: `{args.mode}`"
             + (" · real-time pacing" if (args.realtime or args.eot) else "")
             + (" · end-of-turn mode" if args.eot else ""), ""]
    lines += ["## Accuracy (lower is better)", "",
              "| Dataset | Clips | Metric | Error rate | Failed |", "|---|---:|---|---:|---:|"]
    all_wer = []
    for s in summaries:
        for lang, acc in (s.get("accuracy") or {}).items():
            if not acc:
                continue
            lines.append(f"| {s['dataset']} ({lang}) | {acc['n']} | {acc['metric'].upper()} | "
                         f"{acc['value']:.2f}% | {s['failed']} |")
            if s["dataset"].startswith("esb/") and acc["metric"] == "wer":
                all_wer.append(acc["value"])
    for s in summaries:
        if not any(s.get("accuracy", {}).values()) and s["failed"]:
            lines.append(f"| {s['dataset']} | {s['clips']} | n/a | n/a | {s['failed']} |")
    if len(all_wer) > 1:
        lines.append(f"| **ESB average ({len(all_wer)} sets)** | | WER | "
                     f"**{sum(all_wer) / len(all_wer):.2f}%** | |")
    tagged = [s for s in summaries if s.get("by_tag")]
    for s in tagged:
        lines += ["", f"### {s['dataset']} by tag", "", "| Tag | Clips | Metric | Error rate |",
                  "|---|---:|---|---:|"]
        for t, acc in s["by_tag"].items():
            if acc:
                lines.append(f"| {t} | {acc['n']} | {acc['metric'].upper()} | {acc['value']:.2f}% |")
    cls = [s for s in summaries if s.get("emotion") or s.get("gender")]
    if cls:
        lines += ["", "## Emotion & gender (scored on clips that returned a prediction)", "",
                  "| Dataset | Task | Labeled clips | Coverage | Accuracy | Macro F1 |",
                  "|---|---|---:|---:|---:|---:|"]
        for s in cls:
            for task in ("emotion", "gender"):
                c = s.get(task)
                if c:
                    lines.append(f"| {s['dataset']} | {task} | {c['n']} | {c['coverage']}% | "
                                 f"{c['accuracy']}% | {c['macro_f1']}% |")
    lat = [s for s in summaries if s.get("latency") and "first_partial_ms_p50" in s["latency"]]
    if lat:
        lines += ["", "## Latency & end-of-turn (ms)", "",
                  ("| Dataset | First partial p50 / p95 | Final after speech end p50 / p95 "
                   "| EOT detected | Premature cut-off | EOT delay p50 / p95 |"),
                  "|---|---|---|---:|---:|---|"]
        for s in lat:
            L = s["latency"]
            lines.append(
                f"| {s['dataset']} | {fmt(L.get('first_partial_ms_p50'))} / {fmt(L.get('first_partial_ms_p95'))} "
                f"| {fmt(L.get('final_after_speech_end_ms_p50'))} / {fmt(L.get('final_after_speech_end_ms_p95'))} "
                f"| {fmt(L.get('eot_detect_rate_pct'), '%')} | {fmt(L.get('eot_premature_cutoff_pct'), '%')} "
                f"| {fmt(L.get('eot_delay_ms_p50'))} / {fmt(L.get('eot_delay_ms_p95'))} |")
    errs = [(s["dataset"], e) for s in summaries for e in s.get("errors", [])]
    if errs:
        lines += ["", "## Failed clips (first reasons; re-run the same command to retry them)", ""]
        lines += [f"- `{d}`: {e}" for d, e in errs]
    md = "\n".join(lines) + "\n"
    (run_dir / "summary.md").write_text(md, encoding="utf-8")
    (run_dir / "summary.json").write_text(json.dumps(summaries, indent=2, ensure_ascii=False),
                                          encoding="utf-8")
    write_csv(run_dir / "summary.csv", SUMMARY_FIELDS, summary_csv_rows(summaries))
    return md


def positive_int(value: str) -> int:
    n = int(value)
    if n < 1:
        raise argparse.ArgumentTypeError("must be 1 or more")
    return n


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--suite", required=True, choices=["esb", "fleurs", "manifest"])
    ap.add_argument("--subset", default="all", help="ESB subsets, comma-separated (default: all 8)")
    ap.add_argument("--locale", default="ko_kr", help="FLEURS locale(s), comma-separated (default ko_kr)")
    ap.add_argument("--manifest", help="JSONL manifest for --suite manifest")
    ap.add_argument("--name", help="dataset name for --suite manifest (default: folder name)")
    ap.add_argument("--model", default="pulse", choices=MODELS)
    ap.add_argument("--mode", choices=["streaming", "http"], help="default: http for pulse-pro, else streaming")
    ap.add_argument("--language", help="force a language code (default: from dataset)")
    ap.add_argument("--metric", choices=["wer", "cer"],
                    help="force the metric (default: CER for ko/ja/zh/yue/th, WER otherwise)")
    ap.add_argument("--realtime", action="store_true", help="stream at 1x speed and record latency")
    ap.add_argument("--eot", action="store_true",
                    help="pulse-2 end-of-turn test: real-time, no manual finalize, trailing silence")
    ap.add_argument("--trailing-silence", type=float, default=2.0, help="seconds of silence after speech in --eot")
    ap.add_argument("--param", action="append", default=[],
                    help="extra API query param, e.g. --param keywords=... --param itn_normalize=true")
    ap.add_argument("--limit", type=positive_int, help="max clips per dataset")
    ap.add_argument("--concurrency", type=positive_int, default=8)
    ap.add_argument("--out", default="results")
    ap.add_argument("--run-name", help="results sub-folder (default: <suite>_<model>)")
    ap.add_argument("--rescore", action="store_true", help="skip transcription; rebuild summaries only")
    return ap


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse and validate flags. Exits with a one-line message on a bad combination."""
    args = build_parser().parse_args(argv)
    if args.mode is None:
        args.mode = "http" if args.model in HTTP_ONLY_MODELS else "streaming"
    if args.model in HTTP_ONLY_MODELS and args.mode != "http":
        sys.exit(f"{args.model} is available on the pre-recorded (HTTP) endpoint only; use --mode http")
    if args.mode == "http" and args.model in STREAMING_ONLY_MODELS:
        sys.exit("pulse-2 is streaming-only; use --mode streaming")
    if args.eot and args.model != "pulse-2":
        sys.exit("--eot uses the built-in end-of-turn model, which is part of pulse-2")
    if args.eot and args.mode == "http":
        sys.exit("--eot requires streaming")
    if args.trailing_silence < 0:
        sys.exit("--trailing-silence must be 0 or more")
    if args.model == "pulse-2" and args.suite == "fleurs" and \
            any(not loc.startswith("en_") for loc in args.locale.split(",")):
        sys.exit("pulse-2 is English-only; for Korean use --model pulse (e.g. --suite fleurs --locale ko_kr)")
    if args.suite == "manifest":
        if not args.manifest:
            sys.exit("--suite manifest requires --manifest path/to/manifest.jsonl")
        if not Path(args.manifest).is_file():
            sys.exit(f"manifest not found: {args.manifest}")
    args.run_name = args.run_name or f"{args.suite}_{args.model}" + ("_eot" if args.eot else "")
    return args


async def main(argv: list[str] | None = None) -> None:
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
    args = parse_args(argv)
    # The key stays in memory only: it is never printed, logged or written to results.
    args.api_key = os.environ.get("SMALLEST_API_KEY", "").strip()
    if not args.rescore and not args.api_key:
        sys.exit("Set SMALLEST_API_KEY in your environment or a .env file "
                 "(create one at app.smallest.ai/dashboard/api-keys).")

    params = parse_params(args.param)
    run_dir = Path(args.out) / args.run_name
    jobs = build_jobs(args)
    print(f"Run: {run_dir}  ·  model={args.model}  mode={args.mode}  concurrency={args.concurrency}")

    if not args.rescore:
        for name, make_iter in jobs:
            await transcribe_dataset(name, make_iter, run_dir / name, args, params)

    summaries = [s for name, _ in jobs
                 if (s := summarize_dataset(name, run_dir / name / "results.jsonl", args.metric))]
    if not summaries:
        sys.exit("No results to summarize.")
    print("\n" + write_report(summaries, run_dir, args))
    print(f"Saved: {run_dir / 'summary.md'} (also summary.csv, and results.csv per dataset)")


if __name__ == "__main__":
    asyncio.run(main())
