/**
 * Integration tests for image-to-number.
 *
 * These make REAL calls to the Anthropic Claude CLI (haiku model) through
 * agent-commander, loaded over the network via use-m. They require:
 *   - the `claude` CLI to be installed and authenticated, and
 *   - outbound network access (to load use-m / agent-commander).
 *
 * When `claude` is not on PATH the whole suite is skipped, so CI runners
 * without Claude credentials stay green instead of failing.
 *
 * Run with: node --test tests/integration.test.mjs
 * Force-skip with: SKIP_INTEGRATION=1 node --test tests/integration.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = join(__dirname, '..', 'images');

/** Detect whether the `claude` CLI is available on PATH. */
function claudeAvailable() {
  if (process.env.SKIP_INTEGRATION === '1') {
    return false;
  }
  try {
    execSync('command -v claude', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const skip = !claudeAvailable();
const skipReason = skip
  ? 'claude CLI not available (or SKIP_INTEGRATION=1) — skipping real haiku calls'
  : false;

// A small, fast subset of the labelled sample images.
const SAMPLES = [
  { file: 'a.png', expected: 7 },
  { file: 'b.png', expected: 4 },
  { file: 'n.png', expected: 1 },
];

for (const { file, expected } of SAMPLES) {
  test(
    `imageToNumber reads ${file} as ${expected} via real haiku`,
    { skip: skipReason },
    async () => {
      const { imageToNumber } = await import('../image-to-number.mjs');
      const result = await imageToNumber(join(IMAGES_DIR, file), 'haiku');
      assert.equal(result, expected);
    }
  );
}

test(
  'imageToNumber downloads and reads an image from a URL via real haiku',
  { skip: skipReason },
  async () => {
    const { imageToNumber } = await import('../image-to-number.mjs');
    const url =
      'https://raw.githubusercontent.com/link-assistant/image-to-number/main/images/a.png';
    const result = await imageToNumber(url, 'haiku');
    assert.equal(result, 7);
  }
);
