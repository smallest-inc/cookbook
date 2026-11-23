"""Metrics: WER / CER, emotion & gender F1, latency and end-of-turn stats."""
from __future__ import annotations

import re
import unicodedata

import jiwer
import numpy as np

# Languages scored on characters instead of words.
CER_LANGS = {"ko", "ja", "zh", "yue", "th"}

_en_norm = None


def _english():
    global _en_norm
    if _en_norm is None:
        from whisper_normalizer.english import EnglishTextNormalizer
        _en_norm = EnglishTextNormalizer()
    return _en_norm


def _ascii_digits(text: str) -> str:
    """Map any Unicode decimal digit (Devanagari, Arabic-Indic, full-width, ...)
    to 0-9, so "२०११" in a reference and "2011" in a hypothesis count as equal."""
    out = []
    for ch in text:
        if not ch.isascii() and ch.isdecimal():
            out.append(str(unicodedata.decimal(ch)))
        else:
            out.append(ch)
    return "".join(out)


def normalize(text: str, language: str | None) -> str:
    """Normalize a reference or hypothesis before scoring.

    English: Whisper's EnglishTextNormalizer (the Open ASR Leaderboard method),
    which also writes spoken numbers as digits, expands contractions and
    unifies British and American spelling.
    Everything else: NFC, lower-case, Unicode digits to ASCII, punctuation and
    symbols removed, whitespace collapsed. Combining marks are kept, so Hindi
    matras and Korean jamo survive.
    """
    text = text or ""
    if (language or "en").startswith("en"):
        # Whisper's normalizer deletes anything inside brackets. ESB references
        # have none, but other references (e.g. FLEURS) put spoken words in
        # parentheses, so keep the words and drop only the bracket characters.
        return _english()(re.sub(r"[()\[\]{}]", " ", text))
    text = _ascii_digits(unicodedata.normalize("NFC", text).lower())
    # strip punctuation / symbols (this includes the Devanagari danda),
    # keep letters, marks and digits
    text = "".join(" " if unicodedata.category(ch)[0] in "PS" else ch for ch in text)
    return re.sub(r"\s+", " ", text).strip()


def metric_for(language: str | None, override: str | None = None) -> str:
    """CER for Korean, Japanese, Chinese, Cantonese and Thai; WER otherwise."""
    if override:
        return override
    return "cer" if (language or "en").split("-")[0].split("_")[0] in CER_LANGS else "wer"


def error_rate(refs: list[str], hyps: list[str], language: str | None,
               metric: str | None = None) -> dict | None:
    """Corpus-level WER (or CER for CJK/Thai), after normalization. Percent.

    Corpus-level means total errors over total reference words, not the mean of
    per-clip rates, so long clips weigh more than short ones.
    """
    metric = metric_for(language, metric)
    pairs = [(normalize(r, language), normalize(h, language)) for r, h in zip(refs, hyps, strict=True)]
    if metric == "cer":
        # Korean spacing is inconsistent between annotators -> score without spaces
        pairs = [(r.replace(" ", ""), h.replace(" ", "")) for r, h in pairs]
    pairs = [(r, h) for r, h in pairs if r.strip()]
    if not pairs:
        return None
    rs, hs = map(list, zip(*pairs, strict=True))
    if metric == "cer":
        out = jiwer.process_characters(rs, hs)
        rate = out.cer
    else:
        out = jiwer.process_words(rs, hs)
        rate = out.wer
    return {"metric": metric, "value": round(rate * 100, 2), "n": len(rs),
            "substitutions": out.substitutions, "deletions": out.deletions,
            "insertions": out.insertions}


def utterance_error(ref: str, hyp: str, language: str | None,
                    metric: str | None = None) -> float | None:
    r = error_rate([ref], [hyp], language, metric)
    return r["value"] if r else None


# ── emotion / gender ────────────────────────────────────────────────────────
EMOTION_ALIASES = {
    "neutral": "neutral", "calm": "neutral", "neu": "neutral",
    "happy": "happy", "happiness": "happy", "joy": "happy", "hap": "happy",
    "angry": "angry", "anger": "angry", "ang": "angry",
    "sad": "sad", "sadness": "sad",
    "fear": "fear", "fearful": "fear", "fea": "fear",
    "disgust": "disgust", "disgusted": "disgust", "dis": "disgust",
}
GENDER_ALIASES = {"male": "male", "m": "male", "man": "male",
                  "female": "female", "f": "female", "woman": "female"}


def canon(label: str | None, aliases: dict) -> str | None:
    if label is None:
        return None
    return aliases.get(str(label).strip().lower())


def clip_label(finals: list[dict], key: str) -> str | None:
    """One label per clip: sum per-final score distributions, weighted by
    transcript length, and take the argmax."""
    total: dict[str, float] = {}
    for f in finals:
        obj = f.get(key)
        if not obj:
            continue
        w = max(len((f.get("transcript") or "").split()), 1)
        scores = obj.get("scores") or {obj.get("label"): obj.get("confidence", 1.0)}
        for k, v in scores.items():
            if k is not None and v is not None:
                total[k] = total.get(k, 0.0) + w * float(v)
    return max(total, key=total.get) if total else None


def classification_report(gold: list[str | None], pred: list[str | None]) -> dict | None:
    """Scored on labeled clips that returned a prediction; `coverage` is the
    share of labeled clips that got one (the API omits emotion/gender for very
    short utterances or when classification times out)."""
    labeled = [(g, p) for g, p in zip(gold, pred, strict=True) if g is not None]
    if not labeled:
        return None
    pairs = [(g, p) for g, p in labeled if p is not None]
    labels = sorted({g for g, _ in labeled})
    per = {}
    for lab in labels:
        tp = sum(1 for g, p in pairs if g == lab and p == lab)
        fp = sum(1 for g, p in pairs if g != lab and p == lab)
        fn = sum(1 for g, p in pairs if g == lab and p != lab)
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
        per[lab] = {"precision": round(prec, 3), "recall": round(rec, 3), "f1": round(f1, 3),
                    "support": tp + fn}
    acc = sum(1 for g, p in pairs if g == p) / len(pairs) if pairs else 0.0
    return {"n": len(labeled), "predicted": len(pairs),
            "coverage": round(100 * len(pairs) / len(labeled), 1),
            "accuracy": round(acc * 100, 2),
            "macro_f1": round(100 * float(np.mean([v["f1"] for v in per.values()])), 2),
            "no_prediction": len(labeled) - len(pairs), "per_class": per}


# ── latency / end-of-turn ───────────────────────────────────────────────────
def pct(values: list[float], q: float) -> float | None:
    v = [x for x in values if x is not None]
    return round(float(np.percentile(v, q)) * 1000, 0) if v else None


def latency_summary(rows: list[dict]) -> dict | None:
    """rows carry 'latency' dicts produced by run_eval (seconds)."""
    lat = [r.get("latency") or {} for r in rows]
    if not any(lat):
        return None
    ttfp = [x.get("first_partial_s") for x in lat]
    fin = [x.get("final_after_speech_end_s") for x in lat]
    out = {
        "first_partial_ms_p50": pct(ttfp, 50), "first_partial_ms_p95": pct(ttfp, 95),
        "final_after_speech_end_ms_p50": pct(fin, 50), "final_after_speech_end_ms_p95": pct(fin, 95),
    }
    eot = [x for x in lat if "eot_detected" in x]
    if not eot and all(v is None for v in out.values()):
        return None  # e.g. HTTP mode or non-real-time streaming
    if eot:
        n = len(eot)
        delays = [x.get("eot_delay_s") for x in eot if x.get("eot_detected")]
        out.update({
            "eot_clips": n,
            "eot_detect_rate_pct": round(100 * sum(x["eot_detected"] for x in eot) / n, 1),
            "eot_premature_cutoff_pct": round(100 * sum(x["eot_premature"] for x in eot) / n, 1),
            "eot_delay_ms_p50": pct(delays, 50), "eot_delay_ms_p95": pct(delays, 95),
        })
    return out
