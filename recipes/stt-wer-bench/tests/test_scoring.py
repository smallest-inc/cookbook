import pytest

import scoring


def test_english_normalization_ignores_case_punctuation_and_spelling():
    ref = "Hello, World! It's the colour grey."
    hyp = "hello world it is the color gray"
    assert scoring.utterance_error(ref, hyp, "en") == 0.0


def test_english_keeps_words_inside_parentheses():
    # FLEURS references put spoken words in brackets; they must still be scored
    assert scoring.normalize("the (big) dog", "en") == "the big dog"


def test_hindi_strips_danda_and_maps_devanagari_digits():
    ref = "मैं २०११ में दिल्ली गया।"
    hyp = "मैं 2011 में दिल्ली गया"
    assert scoring.utterance_error(ref, hyp, "hi") == 0.0


def test_hindi_keeps_matras():
    # a dropped matra is a real error, not something to normalize away
    assert scoring.utterance_error("किताब", "कताब", "hi") == 100.0


def test_korean_uses_cer_and_ignores_spacing():
    r = scoring.error_rate(["폭탄 한 발이"], ["폭탄한 발이"], "ko")
    assert r["metric"] == "cer"
    assert r["value"] == 0.0


def test_metric_selection_and_override():
    assert scoring.metric_for("ja") == "cer"
    assert scoring.metric_for("zh") == "cer"
    assert scoring.metric_for("hi") == "wer"
    assert scoring.metric_for(None) == "wer"
    assert scoring.metric_for("hi", "cer") == "cer"
    assert scoring.error_rate(["abcd"], ["abce"], "en", "cer")["metric"] == "cer"


def test_corpus_level_wer_weights_long_clips_more():
    refs = ["a b c d e f g h i j", "x"]
    hyps = ["a b c d e f g h i j", "y"]
    r = scoring.error_rate(refs, hyps, "hi")
    # 1 error over 11 reference words, not the mean of 0% and 100%
    assert r["value"] == pytest.approx(100 / 11, abs=0.01)
    assert r["substitutions"] == 1 and r["n"] == 2


def test_empty_references_are_skipped():
    assert scoring.error_rate(["", "  "], ["a", "b"], "hi") is None


def test_classification_report_coverage_and_accuracy():
    gold = ["happy", "sad", "happy", None]
    pred = ["happy", None, "sad", "angry"]
    rep = scoring.classification_report(gold, pred)
    assert rep["n"] == 3 and rep["predicted"] == 2
    assert rep["coverage"] == pytest.approx(66.7)
    assert rep["accuracy"] == 50.0


def test_canon_aliases():
    assert scoring.canon("Anger", scoring.EMOTION_ALIASES) == "angry"
    assert scoring.canon("F", scoring.GENDER_ALIASES) == "female"
    assert scoring.canon("unknown", scoring.GENDER_ALIASES) is None


def test_clip_label_weights_by_transcript_length():
    finals = [
        {"transcript": "one", "emotion": {"label": "sad", "confidence": 0.9}},
        {"transcript": "one two three four five six", "emotion": {"scores": {"happy": 0.6, "sad": 0.4}}},
    ]
    assert scoring.clip_label(finals, "emotion") == "happy"
    assert scoring.clip_label([{"transcript": "x"}], "gender") is None


def test_latency_summary_with_eot():
    rows = [
        {"latency": {"first_partial_s": 0.2, "final_after_speech_end_s": 0.5,
                     "eot_detected": True, "eot_premature": False, "eot_delay_s": 0.5}},
        {"latency": {"first_partial_s": 0.4, "final_after_speech_end_s": 0.7,
                     "eot_detected": False, "eot_premature": True, "eot_delay_s": None}},
    ]
    s = scoring.latency_summary(rows)
    assert s["eot_clips"] == 2
    assert s["eot_detect_rate_pct"] == 50.0
    assert s["eot_premature_cutoff_pct"] == 50.0
    assert s["first_partial_ms_p50"] == 300.0
    assert scoring.latency_summary([{}, {}]) is None
