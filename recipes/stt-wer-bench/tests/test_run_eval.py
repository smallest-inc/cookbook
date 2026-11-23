import asyncio
import csv
import json
import os
import subprocess
import sys

import pytest

import pulse_client
import run_eval
from conftest import FIXTURES, KIT

FAKE_KEY = "test-key-not-real-for-offline-tests"

# What a perfect model would say for each fixture clip
REFERENCE = {json.loads(line)["id"]: json.loads(line)["text"]
             for line in (FIXTURES / "manifest.jsonl").read_text(encoding="utf-8").splitlines()}
CLIP_BY_LENGTH = {}


class FakePulse:
    """Stands in for the network. Returns the reference for every clip except
    en_02, where it drops one word."""

    def __init__(self):
        self.stream_calls = 0
        self.http_calls = 0
        self.keys = set()

    def _text_for(self, audio):
        clip = CLIP_BY_LENGTH[len(audio)]
        text = REFERENCE[clip]
        return text.replace("elaborate ", "") if clip == "en_02" else text

    async def stream(self, audio, api_key, model="pulse", language="en", realtime=False,
                     eot_mode=False, trailing_silence_s=2.0, extra_params=None):
        self.stream_calls += 1
        self.keys.add(api_key)
        text = self._text_for(audio)
        finals = [{"t": 1.2, "word_start": 0.1, "word_end": 1.0, "transcript": " " + text,
                   "eot_finalized": eot_mode, "is_last": True,
                   "emotion": {"label": "neutral", "confidence": 0.9},
                   "gender": {"scores": {"female": 0.8, "male": 0.2}}}]
        return {"transcript": text, "finals": finals, "events": [], "first_partial_t": 0.4}

    def http(self, audio, api_key, model="pulse-pro", language="en", extra_params=None):
        self.http_calls += 1
        self.keys.add(api_key)
        return {"transcript": self._text_for(audio), "finals": [], "events": [],
                "first_partial_t": None, "request_s": 0.25}


@pytest.fixture
def fake(monkeypatch):
    import loaders
    for s in loaders.load_manifest(FIXTURES / "manifest.jsonl"):
        CLIP_BY_LENGTH[len(s.audio)] = s.id
    f = FakePulse()
    monkeypatch.setattr(run_eval, "stream_transcribe", f.stream)
    monkeypatch.setattr(run_eval, "http_transcribe", f.http)
    monkeypatch.setenv("SMALLEST_API_KEY", FAKE_KEY)
    return f


def run(argv):
    asyncio.run(run_eval.main(argv))


def manifest_args(tmp_path, *extra):
    return ["--suite", "manifest", "--manifest", str(FIXTURES / "manifest.jsonl"),
            "--out", str(tmp_path), "--run-name", "t", "--concurrency", "2", *extra]


def test_manifest_run_writes_markdown_csv_and_jsonl(tmp_path, fake):
    run(manifest_args(tmp_path))
    run_dir = tmp_path / "t"
    ds = run_dir / "custom" / "fixtures"
    for f in ("summary.md", "summary.csv", "summary.json"):
        assert (run_dir / f).is_file()
    for f in ("results.jsonl", "results.csv", "summary.json"):
        assert (ds / f).is_file()

    summary = json.loads((ds / "summary.json").read_text(encoding="utf-8"))
    acc = summary["accuracy"]
    # one deleted word out of 3 + 12 English reference words
    assert acc["en"]["metric"] == "wer" and acc["en"]["value"] == pytest.approx(100 / 15, abs=0.01)
    assert acc["ko"]["metric"] == "cer" and acc["ko"]["value"] == 0.0
    assert acc["hi"]["metric"] == "wer" and acc["hi"]["value"] == 0.0
    assert set(summary["by_tag"]) == {"en", "hi", "ko", "fleurs", "librispeech"}
    assert summary["gender"]["n"] == 2 and summary["gender"]["accuracy"] == 100.0

    with (ds / "results.csv").open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == 4
    assert {r["metric"] for r in rows} == {"wer", "cer"}
    assert {r["id"] for r in rows} == set(REFERENCE)

    with (run_dir / "summary.csv").open(encoding="utf-8", newline="") as f:
        srows = list(csv.DictReader(f))
    assert {r["language"] for r in srows} == {"en", "ko", "hi"}

    md = (run_dir / "summary.md").read_text(encoding="utf-8")
    assert "| custom/fixtures (en) | 2 | WER | 6.67% | 0 |" in md
    assert "\u2014" not in md


def test_key_is_used_but_never_written(tmp_path, fake, capsys):
    run(manifest_args(tmp_path))
    assert fake.keys == {FAKE_KEY}
    out = capsys.readouterr()
    assert FAKE_KEY not in out.out + out.err
    for p in tmp_path.rglob("*"):
        if p.is_file():
            assert FAKE_KEY not in p.read_text(encoding="utf-8")


def test_runs_resume_and_rescore_needs_no_key(tmp_path, fake, monkeypatch):
    run(manifest_args(tmp_path))
    assert fake.stream_calls == 4
    run(manifest_args(tmp_path))
    assert fake.stream_calls == 4  # every clip already done
    monkeypatch.delenv("SMALLEST_API_KEY")
    run(manifest_args(tmp_path, "--rescore", "--metric", "cer"))
    summary = json.loads((tmp_path / "t" / "custom" / "fixtures" / "summary.json").read_text(encoding="utf-8"))
    assert summary["accuracy"]["en"]["metric"] == "cer"


def test_http_mode_for_pulse_pro(tmp_path, fake):
    run(manifest_args(tmp_path, "--model", "pulse-pro", "--limit", "2"))
    assert fake.http_calls == 2 and fake.stream_calls == 0
    with (tmp_path / "t" / "custom" / "fixtures" / "results.csv").open(encoding="utf-8", newline="") as f:
        assert {r["request_ms"] for r in csv.DictReader(f)} == {"250"}


def test_pulse2_eot_reports_latency_and_rejects_non_english(tmp_path, fake):
    run(manifest_args(tmp_path, "--model", "pulse-2", "--eot"))
    ds = tmp_path / "t" / "custom" / "fixtures"
    summary = json.loads((ds / "summary.json").read_text(encoding="utf-8"))
    assert summary["clips"] == 2 and summary["failed"] == 2  # ko and hi are refused for pulse-2
    lat = summary["latency"]
    assert lat["eot_detect_rate_pct"] == 100.0
    assert lat["first_partial_ms_p50"] == 300.0
    errors = [json.loads(line) for line in (ds / "results.jsonl").read_text(encoding="utf-8").splitlines()
              if "error" in json.loads(line)]
    assert all("English-only" in e["error"] for e in errors)
    md = (tmp_path / "t" / "summary.md").read_text(encoding="utf-8")
    assert "Latency & end-of-turn" in md
    # failures are counted on their own language's row, not repeated on the English row
    assert summary["failed_by_language"] == {"hi": 1, "ko": 1}
    assert "| custom/fixtures (en) | 2 | WER | " in md
    assert md.split("| custom/fixtures (en) |")[1].splitlines()[0].endswith("| 0 |")
    assert "| custom/fixtures (ko) | 0 | n/a | n/a | 1 |" in md
    with (tmp_path / "t" / "summary.csv").open(encoding="utf-8", newline="") as f:
        by_lang = {r["language"]: r for r in csv.DictReader(f)}
    assert by_lang["en"]["failed"] == "0"
    assert by_lang["ko"]["failed"] == "1"
    assert by_lang["ko"]["clips"] == "0"


def test_a_dataset_that_cannot_be_opened_is_skipped_not_fatal(tmp_path, fake, capsys):
    def broken(limit=None):
        raise ConnectionError("Hub unreachable")

    args = run_eval.parse_args(manifest_args(tmp_path))
    args.api_key = FAKE_KEY
    asyncio.run(run_eval.transcribe_dataset("esb/x", broken, tmp_path / "x", args, {}))
    assert "skipped" in capsys.readouterr().out


def test_csv_cells_cannot_start_a_formula():
    row = run_eval.clip_csv_row("d", {"id": "1", "hypothesis": "=HYPERLINK(1)", "reference": "+1"})
    assert row["hypothesis"].startswith("'=") and row["reference"] == "'+1"


@pytest.mark.parametrize("argv, message", [
    (["--suite", "esb", "--model", "pulse-2", "--mode", "http"], "streaming-only"),
    (["--suite", "esb", "--model", "pulse-pro", "--mode", "streaming"], "HTTP"),
    (["--suite", "esb", "--eot"], "pulse-2"),
    (["--suite", "fleurs", "--locale", "ko_kr", "--model", "pulse-2"], "English-only"),
    (["--suite", "manifest"], "requires --manifest"),
    (["--suite", "manifest", "--manifest", "nope.jsonl"], "not found"),
])
def test_bad_flag_combinations_exit_with_a_message(argv, message):
    with pytest.raises(SystemExit) as e:
        run_eval.parse_args(argv)
    assert message in str(e.value.code)


def test_limit_must_be_positive():
    with pytest.raises(SystemExit):
        run_eval.parse_args(["--suite", "esb", "--limit", "0"])


def test_param_parsing():
    assert run_eval.parse_params(["keywords=Pulse:2", "itn_normalize=true"]) == \
        {"keywords": "Pulse:2", "itn_normalize": True}
    with pytest.raises(SystemExit):
        run_eval.parse_params(["oops"])


def _cli(*args, env=None):
    env = {k: v for k, v in (env or os.environ).items() if k != "SMALLEST_API_KEY"}
    # fixed interpreter and arguments from this test file only
    return subprocess.run([sys.executable, *args], cwd=KIT, env=env, capture_output=True,
                          text=True, timeout=120, check=False)


def test_missing_key_is_a_clear_message_not_a_traceback(tmp_path):
    p = _cli("src/run_eval.py", "--suite", "manifest", "--manifest", "fixtures/manifest.jsonl",
             "--out", str(tmp_path), "--limit", "2")
    assert p.returncode != 0
    assert "Set SMALLEST_API_KEY" in p.stderr
    assert "Traceback" not in p.stderr


def test_help_works_for_both_scripts():
    for script in ("src/run_eval.py", "src/make_manifest.py"):
        p = _cli(script, "--help")
        assert p.returncode == 0 and "usage:" in p.stdout


def test_endpoints_are_fixed_to_api_smallest_ai():
    assert pulse_client.WS_URL.startswith("wss://api.smallest.ai/")
    assert pulse_client.HTTP_URL.startswith("https://api.smallest.ai/")


def test_join_finals_keeps_split_words_together():
    finals = [{"transcript": " the scra"}, {"transcript": "pbook is"}, {"transcript": " here"}]
    assert pulse_client.join_finals(finals) == "the scrapbook is here"


def test_speech_bounds_finds_the_tone():
    import numpy as np
    sr = 16000
    audio = np.zeros(sr * 2, dtype=np.float32)
    t = np.arange(int(sr * 0.5)) / sr
    audio[sr // 2: sr // 2 + len(t)] = 0.5 * np.sin(2 * np.pi * 220 * t)
    start, end = pulse_client.speech_bounds(audio)
    assert 0.4 <= start <= 0.55 and 0.95 <= end <= 1.1


def test_http_transcribe_sends_key_only_to_smallest(monkeypatch):
    import numpy as np
    seen = {}

    class Resp:
        status_code = 200
        text = ""

        def raise_for_status(self):
            pass

        def json(self):
            return {"transcription": " hi there "}

    def fake_post(url, params=None, headers=None, data=None, timeout=None):
        seen.update(url=url, params=params, auth=headers["Authorization"], timeout=timeout)
        return Resp()

    monkeypatch.setattr(pulse_client.requests, "post", fake_post)
    out = pulse_client.http_transcribe(np.zeros(1600, dtype=np.float32), FAKE_KEY, "pulse", "hi")
    assert out["transcript"] == "hi there"
    assert seen["url"].startswith("https://api.smallest.ai/")
    assert seen["auth"] == f"Bearer {FAKE_KEY}"
    assert seen["params"] == {"model": "pulse", "language": "hi"}
    assert seen["timeout"]


def _write(tmp_path, text):
    p = tmp_path / "bench.yaml"
    p.write_text(text, encoding="utf-8")
    return str(p)


def test_config_file_sets_defaults_and_flags_override(tmp_path):
    cfg = _write(tmp_path, f"suite: manifest\nmanifest: {FIXTURES / 'manifest.jsonl'}\n"
                           "model: pulse-pro\nlimit: 3\nlocale: [ko_kr, hi_in]\n")
    args = run_eval.parse_args(["--config", cfg])
    assert (args.suite, args.model, args.mode, args.limit) == ("manifest", "pulse-pro", "http", 3)
    assert args.locale == "ko_kr,hi_in"
    args = run_eval.parse_args(["--config", cfg, "--model", "pulse", "--limit", "1"])
    assert (args.model, args.mode, args.limit) == ("pulse", "streaming", 1)


@pytest.mark.parametrize("text", [
    "suite: manifest\nmodle: pulse\n",          # typo in a key
    "suite: manifest\nmodel: whisper\n",        # not a Pulse model
    "suite: everything\n",                      # not a suite
    "suite: esb\nlimit: 0\n",                   # bad number
    "- just\n- a list\n",                       # not key: value
])
def test_bad_config_is_a_clear_exit(tmp_path, text):
    with pytest.raises(SystemExit):
        run_eval.parse_args(["--config", _write(tmp_path, text)])


def test_suite_is_still_required_without_config():
    with pytest.raises(SystemExit):
        run_eval.parse_args([])


def test_shipped_config_parses(tmp_path, monkeypatch):
    # The shipped config points at my_audio/, which you create; check it loads with a stand-in manifest.
    monkeypatch.chdir(tmp_path)
    (tmp_path / "my_audio").mkdir()
    (tmp_path / "my_audio" / "manifest.jsonl").write_text("", encoding="utf-8")
    args = run_eval.parse_args(["--config", str(KIT / "config" / "bench.yaml")])
    assert (args.suite, args.model, args.run_name) == ("manifest", "pulse", "my_audio_pulse")
