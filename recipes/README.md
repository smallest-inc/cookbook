# Recipes

End-to-end use cases you can clone, point at your own business or data by editing one file, and run in three commands. Each one is built so a person or a coding agent can pick it up cold.

| Recipe | Outcome |
|--------|---------|
| [stt-wer-bench](./stt-wer-bench/) | Score Pulse speech to text on your own recordings, in your language, and on public benchmarks, then share one summary table |

## Layout

Every recipe uses the same layout:

| Path | What goes there |
|------|-----------------|
| `README.md` | The outcome in one line, the demo video, and a three-command run |
| `AGENTS.md` | For coding agents: what this is, how to run and test it, which files to edit to make it yours, what not to touch |
| `CLAUDE.md` | Points to `AGENTS.md` |
| `.env.example` | `SMALLEST_API_KEY` and any other keys, never real values |
| `config/` | The best-known settings, with a comment on every choice. Agent recipes have `config/agent.yaml`, plus `config/business.yaml` for the business data you swap to make it yours |
| `src/` | The code, and `src/tools/` for agent tools |
| `tests/` | Tests. Offline tests run with no key; call tests place real calls to an agent you created |
| `Makefile` | `make run` and `make test`, plus `make call` for agents |
| `docs/how-i-built-it.md` | The written walkthrough |

Known-good agent configs that are not full recipes live in [best-practices](../best-practices/).
