---
'@link-assistant/image-to-number': minor
---

Refactor the tool to read numbers from images through the
[`agent-commander`](https://github.com/link-assistant/agent-commander) library
instead of invoking the Claude CLI via a raw command stream. Add unit tests
(mocked, offline), integration tests (real haiku calls), a `curl | sh`
bootstrap (`image-to-number.sh`), CI/CD workflows, and full documentation.

Pin `agent-commander@0.6.2` — the release that fixes the usage-limit
false-positive we reported as agent-commander#37 (fixed in #38). The tool now
trusts the usage-limit metadata and raises a clear "usage limit reached" error
when `metadata.limitReached` is set.
