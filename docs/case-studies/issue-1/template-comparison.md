# Template comparison (Requirement R5)

The issue asks us to "use all the best practices from CI/CD templates (check full
file tree to compare for all GitHub workflow and CI/CD scripts file)" across the
four `link-foundation/*-ai-driven-development-pipeline-template` repos
(js, rust, python, csharp), and to "report issue also in templates" if the same
defect is found there.

This note records the file-by-file comparison and the adoption decisions.

## Method

All four templates were cloned and their full trees inspected, with emphasis on
`.github/workflows/**` and the root CI/CD config files. `image-to-number` is a
**single-file `.mjs` tool**, so the js template is the natural reference; the
rust/python/csharp variants were cross-checked to confirm which practices are
universal (and therefore worth carrying) versus language-specific.

## Workflow inventory

| Template | Workflows present                             |
| -------- | --------------------------------------------- |
| js       | `release.yml`, `links.yml`, `example-app.yml` |
| rust     | `release.yml`                                 |
| python   | `release.yml`, `docs.yml`                     |
| csharp   | `release.yml`, `docs.yml`                     |

`release.yml` is the common spine across all four. The shared best practices it
encodes (and which we adopted):

- **Concurrency group** `${{ github.workflow }}-${{ github.ref }}` with
  `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}` — cancel stale PR
  runs, never cancel an in-flight `main` release.
- **Per-job `timeout-minutes`** so a hung step fails fast instead of burning the
  6-hour default.
- **Fast-fail ordering** — cheap checks (syntax, lint) gate the slow ones (test
  matrix, release).
- **npm OIDC trusted publishing** — `permissions: id-token: write`, no
  `NPM_TOKEN`; provenance emitted automatically.
- **Changesets** as the versioning/release mechanism.

## Root config inventory

| File                      | js  | rust | python | csharp | Adopted here            |
| ------------------------- | --- | ---- | ------ | ------ | ----------------------- |
| `eslint.config.js`        | ✅  | —    | —      | —      | ✅ (js only)            |
| `.prettierrc` / ignore    | ✅  | —    | —      | —      | ✅                      |
| `.jscpd.json`             | ✅  | —    | —      | —      | ✅                      |
| `.secretlintrc.json`      | ✅  | —    | —      | —      | ✅                      |
| `.changeset/`             | ✅  | —    | —      | ✅     | ✅                      |
| `.husky/`                 | ✅  | —    | —      | —      | ✅                      |
| `.pre-commit-config.yaml` | —   | ✅   | ✅     | ✅     | n/a (husky)             |
| `.ruff.toml`              | —   | —    | ✅     | —      | n/a (JS)                |
| `.editorconfig`           | —   | —    | —      | ✅     | not adopted             |
| `.lycheeignore`           | ✅  | —    | —      | —      | not adopted (see below) |

The rust/python/csharp pre-commit + linter configs are language-specific
(`pre-commit`, `ruff`, `clippy`, `dotnet format`); their _intent_ — a pre-commit
lint gate — is carried here by **husky + lint-staged**, matching the js template.

## Deliberately not adopted, with rationale

- **The `scripts/*.mjs` release machinery** (~25 scripts in the js template:
  `detect-code-changes`, `validate-changeset`, `version-and-commit`,
  `publish-to-npm`, `create-github-release`, `check-web-archive`, …). These
  orchestrate a multi-job, multi-runtime release for a multi-file package. For a
  single `.mjs` the same outcome is achieved by the upstream
  `changesets/action@v1` directly. Carrying the scripts would add unused
  complexity and more surface to keep lint-clean.
- **`links.yml` (lychee broken-link checker) + `.lycheeignore`**. Valuable, but
  its template form depends on `scripts/check-web-archive.mjs` and a Wayback
  fallback flow. Given the docs are small and the links are checked manually,
  this was left out to avoid importing that script chain. It is the most
  reasonable _next_ best-practice to add if the docs grow.
- **`example-app.yml` / `docs.yml` (docfx, mkdocs)** — there is no example app or
  generated documentation site to build.
- **Multi-runtime test matrix (Bun + Deno)** — the js template tests on
  Node × Bun × Deno. `image-to-number` drives an external CLI through `use-m`;
  Node 20 + 22 is the meaningful matrix. Bun/Deno can be added later if the tool
  is ever used as a library under those runtimes.

## Defects found in the templates themselves

**None.** The file comparison did not surface a bug that is present in the
templates. The one real defect found during this work was in **`agent-commander`**
(false-positive usage-limit detection from `anthropic-ratelimit-*` header names),
which is unrelated to the templates. It was reported as
[agent-commander#37](https://github.com/link-assistant/agent-commander/issues/37)
per R1 and fixed upstream in
[#38](https://github.com/link-assistant/agent-commander/pull/38) (released as
v0.6.2, which this repo now pins).

Should a template-side issue be identified later (e.g. the Node version used for
OIDC publishing — see note below), it will be filed against the relevant
`link-foundation/*-ai-driven-development-pipeline-template` repository as R5
requires.

## Note carried back into our own config

While adopting the template's OIDC release flow we confirmed (via npm docs) that
trusted publishing requires **npm ≥ 11.5.1**, which ships with **Node ≥ 22.14 /
24**. Our `release.yml` therefore uses Node 24 and an explicit
`npm install -g npm@latest` step before publishing. The js template pins
`node-version: '24.x'` and runs `scripts/setup-npm.mjs` for the same reason —
consistent with this finding.
