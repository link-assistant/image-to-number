# Verification evidence

Reproducible evidence backing the claims in the [case study](../README.md).

| File                                           | What it shows                                                                                                                                                                                                                                                        | How to reproduce                                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`integration-run.txt`](./integration-run.txt) | 4/4 integration tests passing with **real haiku** (3 local images + 1 URL).                                                                                                                                                                                          | `node --test tests/integration.test.mjs` (needs the `claude` CLI)                             |
| [`metadata-quirk.json`](./metadata-quirk.json) | A successful call (`exitCode: 0`, answer `"7"`, `errorDuringExecution: false`) where agent-commander still reports `metadata.success: false` / `limitReached: true`. Evidence for [agent-commander#37](https://github.com/link-assistant/agent-commander/issues/37). | `node experiments/metadata-quirk-probe.mjs` (run from `experiments/`; needs the `claude` CLI) |

The offline unit suite (`node --test tests/unit.test.mjs`, 17 tests) needs no
Claude CLI and runs in CI.
