# image-to-number

A small tool that reads the number drawn in an image. It hands the image to the
[Claude Code CLI](https://docs.claude.com/en/docs/claude-code) (the fast `haiku`
model by default) through the
[`agent-commander`](https://github.com/link-assistant/agent-commander) library
and returns the digits Claude sees.

```console
$ node image-to-number.mjs images/a.png
7
```

It works three ways — straight from GitHub with no install, as a CLI, or as an
imported function.

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer.
- The [Claude Code CLI](https://docs.claude.com/en/docs/claude-code) installed
  and authenticated (`claude` must be on your `PATH`). This is what actually
  looks at the image.

Runtime dependencies (`agent-commander`, `yargs`) are fetched on demand from a
CDN via [`use-m`](https://github.com/link-foundation/use-m), so **no
`npm install` is required** to run the tool.

## Usage

### 1. Straight from GitHub (`curl | sh`) — zero install

A POSIX bootstrap script downloads `image-to-number.mjs` and runs it with Node,
forwarding every argument:

```sh
curl -fsSL https://raw.githubusercontent.com/link-assistant/image-to-number/main/image-to-number.sh | sh -s -- images/a.png
```

`wget` works too:

```sh
wget -qO- https://raw.githubusercontent.com/link-assistant/image-to-number/main/image-to-number.sh | sh -s -- https://example.com/a.png
```

Everything after `--` is passed to the tool, so options work as usual:

```sh
curl -fsSL .../image-to-number.sh | sh -s -- images/a.png --model sonnet
```

You can pin a different ref or source with environment variables:

```sh
IMAGE_TO_NUMBER_REF=v0.1.0 curl -fsSL .../image-to-number.sh | sh -s -- images/a.png
```

### 2. As a CLI

```sh
# Local file
node image-to-number.mjs images/a.png

# Remote URL (downloaded automatically)
node image-to-number.mjs https://example.com/number.png

# Pick a model
node image-to-number.mjs images/a.png --model sonnet
```

Options:

| Option                  | Default | Description                              |
| ----------------------- | ------- | ---------------------------------------- |
| `--model`, `-m`         | `haiku` | Claude model: `haiku`, `sonnet`, `opus`. |
| `--keep-temporary-file` | `false` | Keep the temp working directory.         |
| `--help`, `-h`          |         | Show help.                               |

The tool prints just the number to `stdout` and exits `0` on success, or prints
an error to `stderr` and exits `1`.

If you install it (`npm install -g @link-assistant/image-to-number`), the
`image-to-number` binary is available directly:

```sh
image-to-number images/a.png
```

### 3. As an imported function

```js
import { imageToNumber } from './image-to-number.mjs';

const n = await imageToNumber('images/a.png');
console.log(n); // 7

// Options form
await imageToNumber('https://example.com/a.png', { model: 'sonnet' });
```

`imageToNumber(imagePathOrUrl, options?)` returns a `Promise<number>` and throws
on failure (bad file, non-zero Claude exit, or a non-digit answer). The `options`
object accepts `{ model, keepTemporaryFile, agent }`; the legacy positional form
`imageToNumber(path, model, keepTemporaryFile)` is still supported.

## How it works

1. A private temporary directory is created and the image is copied (or
   downloaded) into it under a neutral name (`image.<ext>`) — so the file name
   never leaks the answer to the model.
2. `agent-commander` launches the Claude Code CLI with that directory as its
   working directory and a prompt asking for the digits only.
3. The Claude `stream-json` output is parsed, the assistant's text is collected,
   and the first run of digits is returned.
4. The temporary directory is removed (unless `--keep-temporary-file`).

> **Note:** this tool pins **`agent-commander@0.6.2`**. Earlier versions
> reported `metadata.success: false` / `limitReached: true` on otherwise-
> successful Claude runs, because the usage-limit detector matched the substring
> `ratelimit` inside Anthropic's `anthropic-ratelimit-*` HTTP header names. We
> reported it as
> [agent-commander#37](https://github.com/link-assistant/agent-commander/issues/37);
> it was fixed in
> [#38](https://github.com/link-assistant/agent-commander/pull/38) and released
> as v0.6.2. The tool now trusts that metadata: it raises a clear "usage limit
> reached" error when `metadata.limitReached` is set, in addition to checking the
> process exit code and a parseable digit. See the
> [case study](docs/case-studies/issue-1/README.md) for the full root cause.

## Development

```sh
npm install        # install dev tooling (eslint, prettier, jscpd, changesets…)

npm test           # unit tests (offline) + integration tests (needs claude CLI)
npm run test:unit  # offline unit tests only
npm run test:integration  # real haiku calls (needs the claude CLI)
npm run test:samples      # run every images/*.png end-to-end

npm run lint       # ESLint
npm run format     # Prettier (write)
npm run check      # lint + format:check + duplication
```

- **Unit tests** ([`tests/unit.test.mjs`](tests/unit.test.mjs)) run fully offline
  using an injected fake agent — no network, no Claude.
- **Integration tests** ([`tests/integration.test.mjs`](tests/integration.test.mjs))
  make real `haiku` calls and **auto-skip** when the `claude` CLI is absent (or
  when `SKIP_INTEGRATION=1`).

### Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs a fast-fail syntax
check, then lint / format / duplication / secret scanning, then the offline unit
tests on a Node 20 + 22 matrix. Releases are handled by
[`.github/workflows/release.yml`](.github/workflows/release.yml) via
[changesets](https://github.com/changesets/changesets) with npm OIDC trusted
publishing.

## Case study

A deep analysis of the requirements behind this tool, the library survey, the
template comparison, and the verification evidence lives in
[`docs/case-studies/issue-1`](docs/case-studies/issue-1/README.md).

## License

[The Unlicense](https://unlicense.org/) — public domain. See
[`package.json`](package.json).
