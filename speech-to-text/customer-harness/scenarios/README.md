# Scenario WAVs

Drop 16 kHz mono `.wav` files here. Each becomes one row in `run_matrix.py`.

Suggested minimal set (record with `mic_record.py`):

| filename                    | what to say                                                |
| --------------------------- | ---------------------------------------------------------- |
| `yes.wav`                   | "yes"                                                      |
| `no.wav`                    | "no"                                                       |
| `four.wav`                  | "four"                                                     |
| `rahul_choudhary.wav`       | "Rahul Choudhary"                                          |
| `twenty_five_thousand.wav`  | "twenty five thousand rupees"                              |
| `open_ended_query.wav`      | "please transfer twenty five thousand to Rahul Choudhary"  |
| `long_dictation.wav`        | any ~30 s reading                                          |

Example recording command:

```
python ../mic_record.py -o yes.wav --seconds 2
```
