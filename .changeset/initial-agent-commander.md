---
'@link-assistant/image-to-number': minor
---

Refactor the tool to read numbers from images through the
[`agent-commander`](https://github.com/link-assistant/agent-commander) library
instead of invoking the Claude CLI via a raw command stream. Add unit tests
(mocked, offline), integration tests (real haiku calls), a `curl | sh`
bootstrap (`image-to-number.sh`), CI/CD workflows, and full documentation.
