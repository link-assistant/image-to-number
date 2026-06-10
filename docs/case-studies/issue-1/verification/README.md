# Verification evidence

Reproducible evidence backing the claims in the [case study](../README.md).

| File                                           | What it shows                                                                                                                                                                                                                                                                             | How to reproduce                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`integration-run.txt`](./integration-run.txt) | 4/4 integration tests passing with **real haiku** (3 local images + 1 URL).                                                                                                                                                                                                               | `node --test tests/integration.test.mjs` (needs the `claude` CLI)                             |
| [`metadata-quirk.json`](./metadata-quirk.json) | **Before the fix:** a successful call (`exitCode: 0`, answer `"7"`, `errorDuringExecution: false`) where agent-commander still reported `metadata.success: false` / `limitReached: true`. Evidence for [agent-commander#37](https://github.com/link-assistant/agent-commander/issues/37). | `node experiments/metadata-quirk-probe.mjs` (run from `experiments/`; needs the `claude` CLI) |
| [`metadata-fixed.json`](./metadata-fixed.json) | **After the fix (v0.6.2):** the same call now reports `metadata.success: true` / `limitReached: false`. Evidence that [agent-commander#38](https://github.com/link-assistant/agent-commander/pull/38) resolved #37.                                                                       | `node experiments/capture-fixed-metadata.mjs` (needs the `claude` CLI)                        |

The offline unit suite (`node --test tests/unit.test.mjs`, 21 tests) needs no
Claude CLI and runs in CI.
