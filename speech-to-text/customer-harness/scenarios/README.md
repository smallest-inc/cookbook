# Scenario WAVs

Drop 16 kHz mono 16-bit `.wav` files here. Each file becomes one scenario in
`run_matrix.py` (one row per profile and augmentation).

To get started without recording, generate the set below with Smallest TTS:

```
python ../generate_scenarios.py
```

For real tuning, record the same phrases yourself (with `mic_record.py`) or use
real call audio. `*.wav` in this folder is git-ignored.

Suggested minimal set:

| filename                    | what to say                                                |
| --------------------------- | ---------------------------------------------------------- |
| `yes.wav`                   | "yes"                                                      |
| `no.wav`                    | "no"                                                       |
| `four.wav`                  | "four"                                                     |
| `rahul_choudhary.wav`       | "Rahul Choudhary"                                          |
| `twenty_five_thousand.wav`  | "twenty five thousand rupees"                              |
| `open_ended_query.wav`      | "please transfer twenty five thousand to Rahul Choudhary"  |
| `long_dictation.wav`        | any 20 to 30 s reading                                     |

Example recording command:

```
python ../mic_record.py -o yes.wav --seconds 2
```
