# Case study — Issue #1: Adopt `agent-commander`

> Deep analysis, requirements breakdown, solution plans, library survey, and
> verification evidence for
> [issue #1](https://github.com/link-assistant/image-to-number/issues/1)
> (resolved in [PR #2](https://github.com/link-assistant/image-to-number/pull/2)).

Raw collected data lives in [`./data`](./data); reproducible verification
evidence lives in [`./verification`](./verification).

---

## 1. Issue at a glance

| Field    | Value                                                                   |
| -------- | ----------------------------------------------------------------------- |
| Title    | _Make sure we use here `agent-commander` once it is ready_              |
| Repo     | `link-assistant/image-to-number`                                        |
| Issue    | [#1](https://github.com/link-assistant/image-to-number/issues/1)        |
| PR       | [#2](https://github.com/link-assistant/image-to-number/pull/2)          |
| Comments | none (see [`data/issue-1-comments.json`](./data/issue-1-comments.json)) |

### What the project does

`image-to-number` is a single-file Node.js (`.mjs`) CLI that reads the number
drawn in an image. It hands the image to the **Claude Code CLI** (the `haiku`
model) and returns the digits Claude reports. Before this issue the tool drove
Claude through a hand-rolled `command-stream` invocation; the issue asks us to
route that call through the **`agent-commander`** library instead.

---

## 2. Requirements (verbatim, decomposed)

The issue body bundles several distinct requirements. They are enumerated here
so each can be tracked to a solution and a verification.

| ID  | Requirement                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Use [`agent-commander`](https://github.com/link-assistant/agent-commander) for the Claude call. If it doesn't work, **report issues** there.                                  |
| R2  | Test **locally with an actual call to haiku** via the `claude` tool through `agent-commander`.                                                                                |
| R3  | Have **unit, integration, and CI/CD tests**.                                                                                                                                  |
| R4  | Keep the ability to run the script directly via `curl`/`wget` `+ \| bash` from a raw GitHub download; **document everything in README.md**.                                   |
| R5  | Adopt **all best practices** from the four AI-driven-development-pipeline templates (js, rust, python, csharp); compare files; **report** any shared issue upstream.          |
| R6  | Collect issue data into `./docs/case-studies/issue-1`, do a **deep case study** (incl. online research), list all requirements, propose solutions, survey existing libraries. |
| R7  | Plan and execute **everything in this single PR** (#2) until every requirement is fully addressed.                                                                            |

---

## 3. Per-requirement analysis & solution

### R1 — Route the Claude call through `agent-commander`

**Library survey.** `agent-commander` is a JS/Rust library that gives a unified
controller over CLI agents (`claude`, `codex`, `opencode`, `qwen`, `gemini`,
`agent`). The relevant surface:

```js
const controller = agent({
  tool: 'claude',
  workingDirectory: tempDir, // agent runs here; image referenced by relative name
  prompt,
  model: 'haiku', // alias → claude-haiku-4-5-20251001
  json: true, // stream-json output
});
await controller.start({ attached: false });
const result = await controller.stop();
// result: { exitCode, output: { plain, parsed }, sessionId, usage, metadata }
```

Internally agent-commander runs roughly
`bash -c "cd <workingDirectory> && <prompt-on-stdin> | claude --dangerously-skip-permissions --model <id> --output-format stream-json"`.
The image therefore must live **inside** `workingDirectory` and be referenced by
a relative filename so Claude can open it with its `Read` tool.

**Solution.** `imageToNumber()` now:

1. creates an isolated temp dir,
2. copies/downloads the image into it under a neutral name (`image.<ext>`) — so
   the filename never leaks the answer,
3. calls `agent({ tool: 'claude', workingDirectory, prompt, model, json: true })`,
4. reads `result.output.parsed`, concatenates the assistant text blocks, and
   extracts the first run of digits.

The raw `command-stream` plumbing is gone. See
[`image-to-number.mjs`](../../../image-to-number.mjs).

**Did it work? Mostly — with one real bug, now reported.** The call succeeds and
returns the correct digit, but `result.metadata.success` comes back `false` and
`metadata.limitReached` comes back `true` on a **fully successful** run. Root
cause (traced in the agent-commander source): `detectUsageLimit()` regex-scans
the entire raw stream-json output, and the pattern
`/rate[_\s-]?limit(?:ed| reached| exceeded)?/i` matches the substring
`ratelimit` inside Anthropic's HTTP **header name**
`anthropic-ratelimit-unified-5h-reset`, which Claude prints in stream-json mode.

- Reported upstream as
  **[link-assistant/agent-commander#37](https://github.com/link-assistant/agent-commander/issues/37)**
  (per R1's "report issues" instruction).
- Mitigation in this repo: we treat success as `exitCode === 0` **plus** a
  parseable digit in the assistant text, and never read `metadata.success`.
  Evidence: [`verification/metadata-quirk.json`](./verification/metadata-quirk.json).

### R2 — Real local haiku call

The integration tests ([`tests/integration.test.mjs`](../../../tests/integration.test.mjs))
make real `haiku` calls through agent-commander against the labelled sample
images **and** a remote image URL. Verified locally:

| Input                              | Expected | Got | Time   |
| ---------------------------------- | -------- | --- | ------ |
| `images/a.png`                     | 7        | 7   | ~5–7 s |
| `images/b.png`                     | 4        | 4   | ~6 s   |
| `images/n.png`                     | 1        | 1   | ~5.5 s |
| `…/main/images/a.png` (downloaded) | 7        | 7   | ~7 s   |

Full evidence: [`verification/integration-run.txt`](./verification/integration-run.txt).

### R3 — Unit, integration & CI/CD tests

- **Unit** ([`tests/unit.test.mjs`](../../../tests/unit.test.mjs)) — 17 tests,
  fully offline. Pure helpers (`isUrl`, `resolveExtension`, `extractAnswerText`,
  `extractNumber`, `buildPrompt`, `normalizeOptions`) are tested directly, and
  `imageToNumber` is exercised end-to-end with an **injected fake agent**
  (`{ agent }` option) so the copy → call → parse → extract flow runs with no
  network and no Claude.
- **Integration** ([`tests/integration.test.mjs`](../../../tests/integration.test.mjs))
  — real haiku calls; **auto-skips** when the `claude` CLI is absent (or
  `SKIP_INTEGRATION=1`), so CI without Claude credentials stays green.
- **Samples** ([`test-image-to-number.mjs`](../../../test-image-to-number.mjs))
  — the original 26-image (`a.png`–`z.png`) end-to-end runner, kept as
  `npm run test:samples`.
- **CI/CD** ([`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)) —
  fast-fail syntax check → lint/format/jscpd/secretlint → unit tests on a
  Node 20 + 22 matrix.

### R4 — `curl | sh` usage + README

A POSIX bootstrap, [`image-to-number.sh`](../../../image-to-number.sh),
downloads the `.mjs` from GitHub and runs it with Node, forwarding all
arguments:

```sh
curl -fsSL https://raw.githubusercontent.com/link-assistant/image-to-number/main/image-to-number.sh | sh -s -- <image>
```

The `.mjs` keeps its **zero-install** property: dependencies (`agent-commander`,
`yargs`) are loaded at runtime from a CDN via
[`use-m`](https://github.com/link-foundation/use-m), so no `npm install` is
needed for the `curl | sh` path. Crucially, the dependency load is now **lazy**
(inside `imageToNumber`/`runCli`), so importing the module for unit tests never
touches the network. Everything is documented in
[README.md](../../../README.md).

### R5 — Best practices from the templates

Files compared against
[`js-ai-driven-development-pipeline-template`](https://github.com/link-foundation/js-ai-driven-development-pipeline-template)
and cross-checked with the rust/python/csharp variants. Adopted, scaled to a
single-file tool:

| Practice                                            | Source                           | Adopted as                                              |
| --------------------------------------------------- | -------------------------------- | ------------------------------------------------------- |
| ESLint 9 flat config + prettier plugin              | `eslint.config.js`               | [`eslint.config.js`](../../../eslint.config.js)         |
| Prettier config + ignore                            | `.prettierrc`, `.prettierignore` | same                                                    |
| Duplicate-code gate                                 | `.jscpd.json`                    | [`.jscpd.json`](../../../.jscpd.json)                   |
| Secret scanning                                     | `.secretlintrc.json`             | [`.secretlintrc.json`](../../../.secretlintrc.json)     |
| Changesets versioning                               | `.changeset/`                    | [`.changeset/`](../../../.changeset)                    |
| Husky + lint-staged pre-commit                      | `.husky/`, `package.json`        | same                                                    |
| Concurrency + per-job timeouts + fast-fail ordering | `release.yml`                    | [`ci.yml`](../../../.github/workflows/ci.yml)           |
| npm **OIDC trusted publishing** (no token)          | `release.yml`                    | [`release.yml`](../../../.github/workflows/release.yml) |

**Deliberately not copied:** the template's ~25-script release machinery
(`scripts/*.mjs`) and multi-runtime example apps. They target a multi-file
package; for a single `.mjs` they would be unused complexity. We kept the
underlying _practices_ (changesets + OIDC) via the standard
`changesets/action`.

**Shared issues to report upstream:** the file comparison did not surface a
defect present in the templates themselves (the one real bug found, R1, lives in
`agent-commander`, already reported as #37). See
[`template-comparison.md`](./template-comparison.md) for the file-by-file notes;
if a template-side fix becomes warranted it will be filed against the relevant
`link-foundation/*-ai-driven-development-pipeline-template` repo.

### R6 — This case study

This document, plus the raw [`data/`](./data) snapshots and reproducible
[`verification/`](./verification) evidence, fulfil R6. Online research used:

- npm **trusted publishing / OIDC** — requires `id-token: write` and npm ≥
  11.5.1; provenance is emitted automatically; `changeset publish` honours npm's
  native OIDC. ([npm docs](https://docs.npmjs.com/trusted-publishers/),
  [GitHub changelog](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/))
- agent-commander API & lifecycle confirmed from its
  [repository](https://github.com/link-assistant/agent-commander).

### R7 — Single PR

All work landed on branch `issue-1-dd2620a0391e` in PR #2 as a sequence of
atomic commits.

---

## 4. Library / component survey

| Need                          | Chosen                              | Why                                                             |
| ----------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| Drive the Claude CLI          | **agent-commander**                 | Required by the issue; unified controller, stream-json parsing. |
| Zero-install dependency load  | **use-m**                           | Enables the `curl \| sh` path without `npm install`.            |
| CLI argument parsing          | **yargs**                           | Already used; loaded lazily via use-m.                          |
| Test runner                   | **node:test** (built-in)            | Zero dependency; runs everywhere Node 20+ does.                 |
| Versioning/release            | **@changesets/cli** + OIDC          | Template standard; tokenless publish.                           |
| Lint / format / dup / secrets | eslint, prettier, jscpd, secretlint | Template standard.                                              |

Alternatives considered and rejected: calling the Claude CLI directly with
`command-stream` (the status quo — replaced per R1); using `test-anywhere` for
multi-runtime tests (adds a dependency for marginal benefit on a single file —
`node:test` already runs under Node 20/22 in CI).

---

## 5. Outcome

- ✅ R1 agent-commander integrated; real bug found and reported (#37).
- ✅ R2 real haiku calls verified locally (local + URL inputs).
- ✅ R3 unit + integration + CI/CD tests in place.
- ✅ R4 `curl | sh` bootstrap + documented zero-install usage.
- ✅ R5 template best practices adopted; comparison recorded.
- ✅ R6 this case study with data, verification, and online research.
- ✅ R7 delivered in PR #2.
