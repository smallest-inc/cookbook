# How I Built It

The walkthrough behind the STT WER bench. It doubles as the draft for the blog post.

## The ask

Sales and prospects kept asking for "your WER". One number on someone else's audio does not answer the real question, which is how Pulse does on their calls, in their language, with their product names. Harshita Jain had already written an evaluation kit for a customer: four tracks, one summary table. This recipe puts it in the cookbook so the answer is a link.

## The four tracks

1. English accuracy on the Open ASR Leaderboard (ESB) sets, streamed from the Hugging Face Hub
2. Other languages on Google FLEURS. CER for Korean, Japanese, Chinese and Thai, WER for the rest
3. Your own audio: a folder of clips with `.txt` transcripts, broken down per sub-folder
4. Pulse 2.0 real time: latency, end-of-turn, emotion and gender

Track 3 is the one that matters. Public sets tell you the model works; your own clips tell you whether it works for you.

## Decisions

**Score the corpus, not the average clip.** WER is summed errors over summed reference words, so a long clip counts more than a two-word one. Averaging per-clip WER lets short clips swing the number.

**Normalize before scoring, and say how.** English uses Whisper's normalizer, the Open ASR Leaderboard method. Other scripts get Unicode NFC, lower case, native digits mapped to 0-9 and punctuation removed. Script mixing is not normalized: `पिरामिड` against `pyramid` is one error, and the Hindi fixture shows exactly that.

**Sample evenly.** The Hub files are sorted by clip length, so `--limit 200` takes clips spread across each set instead of the first 200, which would all be the longest.

**Fail loudly, per language.** If an account cannot use a language or a model, the API says so (`LANGUAGE_NOT_ENABLED_IN_REGION`, `MODEL_NOT_ENABLED`). The bench stops retrying those, counts them on that language's row, and prints the reason in the report.

**Keep the key in the environment.** No `--api-key` flag, so keys stay out of shell history, and the endpoints are fixed to `api.smallest.ai`.

**One settings file.** `config/bench.yaml` holds the run settings with a comment on each, so changing the bench is editing one file. Flags still override it.

## Testing

The tests replace the network client with a fake that returns the reference text (minus one word on one clip), so WER, CSV escaping, resumable runs, the end-of-turn report and the config file are all checked offline. `make test` needs no key.

## What I measured

On 23 Nov 2026 with `pulse` over streaming: the two English fixture clips at 13.33% WER and the Hindi fixture at 15.38%, and 10 clips each of LibriSpeech clean and other at 0.91% and 0.77%. Ten clips is a smoke test, not a benchmark. The Korean fixture and `pulse-2` were refused for the test account, so end-of-turn scoring is covered by the offline tests only.
