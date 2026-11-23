import json

import numpy as np
import pytest

import loaders
import make_manifest
from conftest import FIXTURES


def test_folder_layout_becomes_tags_and_references(tmp_path):
    (tmp_path / "calls" / "noisy").mkdir(parents=True)
    (tmp_path / "calls" / "noisy" / "a.wav").write_bytes(b"x")
    (tmp_path / "calls" / "noisy" / "a.txt").write_text(" hello there \n", encoding="utf-8")
    (tmp_path / "b.mp3").write_bytes(b"x")
    (tmp_path / "notes.md").write_text("ignored", encoding="utf-8")

    assert make_manifest.main([str(tmp_path), "--language", "en"]) == 0
    rows = [json.loads(line) for line in (tmp_path / "manifest.jsonl").read_text(encoding="utf-8").splitlines()]
    assert rows[0] == {"audio": "b.mp3", "language": "en", "tags": []}
    assert rows[1] == {"audio": "calls/noisy/a.wav", "language": "en", "tags": ["calls", "noisy"],
                       "text": "hello there"}


def test_benchmarks_metadata_csv_is_converted(tmp_path):
    (tmp_path / "audio").mkdir()
    (tmp_path / "metadata.csv").write_text(
        "audio_filename,transcript\nclip_001.wav,नमस्ते दुनिया\nclip_002.wav,\n", encoding="utf-8")
    out = tmp_path / "m.jsonl"
    assert make_manifest.main([str(tmp_path), "--language", "hi", "--from-metadata-csv", "--out", str(out)]) == 0
    rows = [json.loads(line) for line in out.read_text(encoding="utf-8").splitlines()]
    assert rows[0] == {"audio": "audio/clip_001.wav", "language": "hi", "tags": [], "text": "नमस्ते दुनिया"}
    assert rows[1]["text"] == ""


@pytest.mark.parametrize("csv_text", [
    "file,text\na.wav,hi\n",                        # wrong header
    "audio_filename,transcript\n../secret.wav,hi\n",  # not a bare file name
])
def test_bad_metadata_csv_fails_clearly(tmp_path, capsys, csv_text):
    (tmp_path / "metadata.csv").write_text(csv_text, encoding="utf-8")
    assert make_manifest.main([str(tmp_path), "--from-metadata-csv"]) == 2
    assert "error:" in capsys.readouterr().err


def test_empty_or_missing_folder_fails(tmp_path, capsys):
    assert make_manifest.main([str(tmp_path)]) == 2
    assert make_manifest.main([str(tmp_path / "nope")]) == 2
    assert "error:" in capsys.readouterr().err


def test_fixture_folder_round_trips_through_make_manifest(tmp_path):
    out = tmp_path / "en.jsonl"
    assert make_manifest.main([str(FIXTURES / "audio" / "en"), "--out", str(out)]) == 0
    rows = [json.loads(line) for line in out.read_text(encoding="utf-8").splitlines()]
    assert [r["audio"] for r in rows] == ["en_01.flac", "en_02.flac"]
    assert all(r["text"] for r in rows)


def test_fixture_manifest_loads_as_16k_mono():
    samples = list(loaders.load_manifest(FIXTURES / "manifest.jsonl"))
    assert [s.language for s in samples] == ["en", "en", "ko", "hi"]
    for s in samples:
        assert s.audio.dtype == np.float32 and s.audio.ndim == 1
        assert 2.0 < len(s.audio) / loaders.SR < 8.0
    assert samples[2].gender == "female"


def test_manifest_limit_and_comments(tmp_path):
    src = (FIXTURES / "manifest.jsonl").read_text(encoding="utf-8")
    m = FIXTURES / "manifest.jsonl"
    limited = list(loaders.load_manifest(m, limit=2))
    assert len(limited) == 2
    commented = tmp_path / "audio"
    commented.symlink_to(FIXTURES / "audio")
    (tmp_path / "manifest.jsonl").write_text("# a comment\n\n" + src, encoding="utf-8")
    assert len(list(loaders.load_manifest(tmp_path / "manifest.jsonl"))) == 4


def test_unknown_esb_subset_is_rejected():
    with pytest.raises(ValueError):
        next(loaders.load_esb("not_a_set"))
