# Fixtures

Four short public clips so the kit can be tried, and its tests run, without
downloading a dataset.

| Clip | Language | Source | License |
|---|---|---|---|
| `audio/en/en_01.flac`, `audio/en/en_02.flac` | English | LibriSpeech test-clean (utterances 4970-29095-0010 and 3570-5694-0012), read from `hf-audio/open-asr-leaderboard` | CC BY 4.0, Panayotov et al., 2015 |
| `audio/ko/ko_03.flac` | Korean | Google FLEURS `ko_kr` test split | CC BY 4.0, Conneau et al., 2022 |
| `audio/hi/hi_04.flac` | Hindi | Google FLEURS `hi_in` test split | CC BY 4.0, Conneau et al., 2022 |

Audio is 16 kHz mono FLAC. Each clip has its reference transcript next to it
as a `.txt` file, and `manifest.jsonl` lists all four with their language,
tags and (for FLEURS) the speaker gender label.

No customer or private audio is stored here. Do not add any.
