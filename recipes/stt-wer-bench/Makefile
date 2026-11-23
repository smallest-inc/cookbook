# Run from this folder. Needs SMALLEST_API_KEY in your environment or .env.
PY ?= python
AUDIO ?= my_audio
CLIP_LANG ?= en

.PHONY: help setup run smoke manifest esb fleurs eot test

help:
	@echo "make setup                       install dependencies"
	@echo "make manifest AUDIO=my_audio CLIP_LANG=en build a manifest from clips plus .txt transcripts"
	@echo "make run                         score your audio with config/bench.yaml"
	@echo "make smoke                       score the 4 bundled clips"
	@echo "make esb                         English benchmark, 200 LibriSpeech clips"
	@echo "make fleurs LOCALE=ko_kr         FLEURS in one locale, 100 clips"
	@echo "make eot                         pulse-2 end-of-turn on your audio (English)"
	@echo "make test                        offline tests, no key needed"

setup:
	uv pip install -r requirements.txt

manifest:
	$(PY) src/make_manifest.py $(AUDIO) --language $(CLIP_LANG)

run:
	$(PY) src/run_eval.py --config config/bench.yaml

smoke:
	$(PY) src/run_eval.py --suite manifest --manifest fixtures/manifest.jsonl --model pulse --run-name smoke

esb:
	$(PY) src/run_eval.py --suite esb --subset librispeech_clean --limit 200

LOCALE ?= ko_kr
fleurs:
	$(PY) src/run_eval.py --suite fleurs --locale $(LOCALE) --limit 100

eot:
	$(PY) src/run_eval.py --config config/bench.yaml --model pulse-2 --eot --run-name my_audio_pulse2_eot

test:
	env -u SMALLEST_API_KEY $(PY) -m pytest -q tests
