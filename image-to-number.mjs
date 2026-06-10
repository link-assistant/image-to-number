#!/usr/bin/env node

import { copyFile, mkdir, rm, writeFile } from 'fs/promises';
import { randomBytes } from 'crypto';
import { pathToFileURL } from 'url';

/**
 * image-to-number
 * ----------------
 * A tiny tool that reads the number drawn in an image by asking the
 * Anthropic Claude Code CLI (via the `agent-commander` library) to look at it.
 *
 * It can be used three ways:
 *   1. As a CLI:                node image-to-number.mjs <image-path-or-url>
 *   2. As an imported function: import { imageToNumber } from './image-to-number.mjs'
 *   3. Straight from GitHub:    curl -fsSL <raw-url>/image-to-number.sh | sh -s -- <image>
 *
 * Dependencies are loaded at runtime from a CDN through `use-m`, so the script
 * works with zero `npm install` — which is what makes the `curl | sh` flow above
 * possible.
 */

// ---------------------------------------------------------------------------
// Runtime dependency loading (lazy, so importing this module never touches the
// network — unit tests can import the pure helpers below without any fetch).
// ---------------------------------------------------------------------------

/**
 * The pinned `agent-commander` version. 0.6.2 is the first release with the
 * fix for issue #37 (a false-positive usage-limit detection caused by the
 * substring `ratelimit` in Anthropic's `anthropic-ratelimit-*` HTTP header
 * names appearing in stream-json output). With the fix, `metadata.success` and
 * `metadata.limitReached` are reliable on successful runs.
 * @see https://github.com/link-assistant/agent-commander/pull/38
 */
export const AGENT_COMMANDER_VERSION = '0.6.2';

let _useM;
let _agentCommander;

/**
 * Load the `use-m` universal module loader from its CDN.
 * Cached after the first call.
 * @returns {Promise<Function>} The `use` function.
 */
export async function loadUse() {
  if (_useM) {
    return _useM;
  }
  const useModule = eval(
    await (await fetch('https://unpkg.com/use-m/use.js')).text()
  );
  _useM = useModule.use;
  return _useM;
}

/**
 * Load the `agent-commander` library (the `agent` factory) via `use-m`.
 * Cached after the first call.
 * @returns {Promise<Function>} The `agent` factory from agent-commander.
 */
export async function loadAgent() {
  if (_agentCommander) {
    return _agentCommander;
  }
  const use = await loadUse();
  // Pin to the version that fixes the usage-limit false positive (issue #37 /
  // PR #38). On that version `metadata.success` and `metadata.limitReached`
  // are trustworthy on successful runs, so we can rely on them below.
  const mod = await use(`agent-commander@${AGENT_COMMANDER_VERSION}`);
  _agentCommander = mod.agent;
  return _agentCommander;
}

// ---------------------------------------------------------------------------
// Pure helpers (no I/O, no network) — easy to unit test.
// ---------------------------------------------------------------------------

/**
 * Determine whether a string is an HTTP(S) URL.
 * @param {string} value - Path or URL.
 * @returns {boolean} True when the value looks like an http(s) URL.
 */
export function isUrl(value) {
  return (
    typeof value === 'string' &&
    (value.startsWith('http://') || value.startsWith('https://'))
  );
}

/**
 * Extract the file extension (including the leading dot) from a path or URL.
 * Query strings are ignored. Defaults to `.png` when none is found.
 * @param {string} imagePathOrUrl - File path or URL to the image.
 * @returns {string} The extension, e.g. `.png`.
 */
export function resolveExtension(imagePathOrUrl) {
  const withoutQuery = String(imagePathOrUrl).split('?')[0];
  const match = withoutQuery.match(/\.\w+$/);
  return match ? match[0] : '.png';
}

/**
 * Concatenate the assistant text from agent-commander parsed messages.
 * The Claude stream-json output is an array of message objects; assistant
 * turns carry `message.content` blocks, and text blocks have a `text` field.
 * @param {Array|null} messages - Parsed messages from `result.output.parsed`.
 * @returns {string|null} The combined assistant text, or null if none found.
 */
export function extractAnswerText(messages) {
  if (!Array.isArray(messages)) {
    return null;
  }

  let answer = null;
  for (const data of messages) {
    if (data?.type === 'assistant' && Array.isArray(data.message?.content)) {
      for (const block of data.message.content) {
        if (block?.type === 'text' && typeof block.text === 'string') {
          answer = (answer ?? '') + block.text;
        }
      }
    }
  }
  return answer;
}

/**
 * Extract the number from a free-form answer string.
 * Captures the first contiguous run of digits, so both "7" and "42" work.
 * @param {string} answer - The raw answer text.
 * @returns {number} The parsed integer.
 * @throws {Error} When the answer contains no digits.
 */
export function extractNumber(answer) {
  const trimmed = String(answer ?? '').trim();
  const match = trimmed.match(/\d+/);
  if (!match) {
    throw new Error(`Claude returned a non-digit answer: ${trimmed}`);
  }
  return parseInt(match[0], 10);
}

/**
 * Throw a clear error when agent-commander reports that Claude's usage limit
 * was reached. This relies on `metadata.limitReached`, which only became
 * trustworthy in agent-commander 0.6.2 (issue #37 fixed a false positive that
 * fired on every successful run). The check is a no-op when no metadata is
 * provided, so injected fake agents in unit tests are unaffected.
 * @param {object|undefined} metadata - `result.metadata` from agent-commander.
 * @throws {Error} When `metadata.limitReached` is true.
 */
export function assertNotUsageLimited(metadata) {
  if (metadata?.limitReached) {
    const when = metadata.limitResetTime
      ? ` (resets ${metadata.limitResetTime}${metadata.limitTimezone ? ` ${metadata.limitTimezone}` : ''})`
      : '';
    throw new Error(`Claude usage limit reached${when}. Try again later.`);
  }
}

/**
 * Build the prompt asking Claude to read the number from a given file.
 * @param {string} imageFileName - File name (relative to the working dir).
 * @returns {string} The prompt text.
 */
export function buildPrompt(imageFileName) {
  return `${imageFileName}\n\nWhat number do you see in this image? Output ONLY the digits you see, nothing else.`;
}

/**
 * Place the source image (local path or URL) at `destPath`.
 * @param {string} imagePathOrUrl - Source path or URL.
 * @param {string} destPath - Absolute destination path.
 * @returns {Promise<void>}
 * @throws {Error} When the download or copy fails.
 */
async function materializeImage(imagePathOrUrl, destPath) {
  if (isUrl(imagePathOrUrl)) {
    try {
      const response = await fetch(imagePathOrUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(destPath, buffer);
    } catch (error) {
      throw new Error(`Failed to download image from URL: ${error.message}`);
    }
  } else {
    try {
      await copyFile(imagePathOrUrl, destPath);
    } catch (error) {
      throw new Error(`Failed to copy image file: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry point.
// ---------------------------------------------------------------------------

/**
 * Normalize `imageToNumber`'s overloaded second/third arguments into a single
 * options object. Supports both the legacy positional form
 * (`imageToNumber(path, model, keepTemporaryFile)`) and the options form
 * (`imageToNumber(path, { model, keepTemporaryFile, agent })`).
 * @param {string|Object} modelOrOptions - Model alias or options object.
 * @param {boolean} keepTemporaryFile - Legacy positional flag.
 * @returns {{ model: string, keepTemp: boolean, agentFactory: Function|undefined }}
 */
export function normalizeOptions(modelOrOptions, keepTemporaryFile) {
  if (modelOrOptions && typeof modelOrOptions === 'object') {
    return {
      model: modelOrOptions.model ?? 'haiku',
      keepTemp: modelOrOptions.keepTemporaryFile ?? keepTemporaryFile,
      agentFactory: modelOrOptions.agent,
    };
  }
  return {
    model: typeof modelOrOptions === 'string' ? modelOrOptions : 'haiku',
    keepTemp: keepTemporaryFile,
    agentFactory: undefined,
  };
}

/**
 * Extract the number drawn in an image using Claude via agent-commander.
 *
 * Backward-compatible signature: the second argument may be a model string
 * (legacy) or an options object.
 *
 * @param {string} imagePathOrUrl - File path or URL to the image.
 * @param {string|Object} [modelOrOptions='haiku'] - Model alias, or options.
 * @param {string} [modelOrOptions.model='haiku'] - Claude model alias.
 * @param {boolean} [modelOrOptions.keepTemporaryFile=false] - Keep temp dir.
 * @param {Function} [modelOrOptions.agent] - Inject an agent factory (testing).
 * @param {boolean} [keepTemporaryFile=false] - Legacy positional flag.
 * @returns {Promise<number>} The number found in the image.
 */
export async function imageToNumber(
  imagePathOrUrl,
  modelOrOptions = 'haiku',
  keepTemporaryFile = false
) {
  const {
    model,
    keepTemp,
    agentFactory: injected,
  } = normalizeOptions(modelOrOptions, keepTemporaryFile);

  const agentFactory = injected ?? (await loadAgent());

  // Create an isolated temporary directory for this operation.
  const randomName = randomBytes(16).toString('hex');
  const tempDir = `/tmp/image-to-number-${randomName}`;

  try {
    await mkdir(tempDir, { recursive: true });

    // Copy/download the image under a generic name so the file name itself
    // never hints at the answer.
    const extension = resolveExtension(imagePathOrUrl);
    const imageFileName = `image${extension}`;
    const imagePath = `${tempDir}/${imageFileName}`;

    await materializeImage(imagePathOrUrl, imagePath);

    // Ask Claude (via agent-commander) what number is in the image. The agent
    // runs with the temp dir as its working directory, so it can read the
    // image by its relative name.
    const controller = agentFactory({
      tool: 'claude',
      workingDirectory: tempDir,
      prompt: buildPrompt(imageFileName),
      model,
      json: true,
    });

    await controller.start({ attached: false });
    const result = await controller.stop();

    // With the pinned agent-commander (>= 0.6.2) usage-limit metadata is
    // reliable, so surface a clear message instead of a confusing parse error.
    assertNotUsageLimited(result.metadata);

    if (result.exitCode !== 0) {
      throw new Error(
        `Claude exited with code ${result.exitCode}: ${result.output?.plain ?? ''}`
      );
    }

    const answer = extractAnswerText(result.output?.parsed);
    if (answer === null) {
      throw new Error('No answer found in Claude response');
    }

    return extractNumber(answer);
  } finally {
    if (!keepTemp) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors.
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------

/**
 * Run the command-line interface.
 * @param {string[]} argv - Process arguments (typically `process.argv`).
 * @returns {Promise<number>} Process exit code.
 */
export async function runCli(argv) {
  const use = await loadUse();
  const yargsModule = await use('yargs@17.7.2');
  const yargs = yargsModule.default || yargsModule;
  const { hideBin } = await use('yargs@17.7.2/helpers');

  const args = yargs(hideBin(argv))
    .usage('Usage: $0 <image> [options]')
    .option('model', {
      alias: 'm',
      type: 'string',
      description: 'Claude model to use',
      default: 'haiku',
      choices: ['haiku', 'sonnet', 'opus'],
    })
    .option('keep-temporary-file', {
      type: 'boolean',
      description: 'Keep the temporary file after processing',
      default: false,
    })
    .help()
    .alias('help', 'h').argv;

  const image = args._[0];
  if (!image) {
    console.error('Error: missing required <image> argument.');
    console.error('Usage: image-to-number.mjs <image-path-or-url> [options]');
    return 1;
  }

  try {
    const number = await imageToNumber(String(image), {
      model: args.model,
      keepTemporaryFile: args.keepTemporaryFile,
    });
    console.log(number);
    return 0;
  } catch (error) {
    console.error('Error:', error.message);
    return 1;
  }
}

/**
 * Detect whether this module is being run directly as a script (as opposed to
 * being imported). Works for both `node image-to-number.mjs` and symlinked bins.
 * @returns {boolean} True when run as the entry point.
 */
function isCliEntryPoint() {
  if (!process.argv[1]) {
    return false;
  }
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntryPoint()) {
  const code = await runCli(process.argv);
  process.exit(code);
}
