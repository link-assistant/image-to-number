/**
 * Unit tests for image-to-number.
 *
 * These tests never touch the network or the real Claude CLI. The pure helpers
 * are tested directly, and `imageToNumber` is tested with an injected fake
 * agent so the whole flow (temp dir, copy, parse, extract) is exercised offline.
 *
 * Run with: node --test tests/unit.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  isUrl,
  resolveExtension,
  extractAnswerText,
  extractNumber,
  buildPrompt,
  assertNotUsageLimited,
  imageToNumber,
} from '../image-to-number.mjs';

// ---------------------------------------------------------------------------
// isUrl
// ---------------------------------------------------------------------------

test('isUrl recognizes http and https URLs', () => {
  assert.equal(isUrl('http://example.com/a.png'), true);
  assert.equal(isUrl('https://example.com/a.png'), true);
});

test('isUrl rejects local paths and non-strings', () => {
  assert.equal(isUrl('images/a.png'), false);
  assert.equal(isUrl('/tmp/a.png'), false);
  assert.equal(isUrl('ftp://example.com/a.png'), false);
  assert.equal(isUrl(null), false);
  assert.equal(isUrl(42), false);
});

// ---------------------------------------------------------------------------
// resolveExtension
// ---------------------------------------------------------------------------

test('resolveExtension extracts known extensions', () => {
  assert.equal(resolveExtension('images/a.png'), '.png');
  assert.equal(resolveExtension('/tmp/photo.JPG'), '.JPG');
  assert.equal(resolveExtension('pic.jpeg'), '.jpeg');
  assert.equal(resolveExtension('art.webp'), '.webp');
});

test('resolveExtension ignores query strings', () => {
  assert.equal(resolveExtension('https://example.com/a.png?token=abc'), '.png');
});

test('resolveExtension defaults to .png when none is present', () => {
  assert.equal(resolveExtension('https://example.com/image'), '.png');
  assert.equal(resolveExtension('noext'), '.png');
});

// ---------------------------------------------------------------------------
// extractAnswerText
// ---------------------------------------------------------------------------

test('extractAnswerText concatenates assistant text blocks', () => {
  const messages = [
    { type: 'system', subtype: 'init' },
    {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: '4' },
          { type: 'text', text: '2' },
        ],
      },
    },
    { type: 'result', subtype: 'success' },
  ];
  assert.equal(extractAnswerText(messages), '42');
});

test('extractAnswerText ignores tool_use and non-assistant blocks', () => {
  const messages = [
    {
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', name: 'Read', input: {} },
          { type: 'text', text: '7' },
        ],
      },
    },
  ];
  assert.equal(extractAnswerText(messages), '7');
});

test('extractAnswerText returns null when no assistant text exists', () => {
  assert.equal(extractAnswerText([{ type: 'system' }]), null);
  assert.equal(extractAnswerText(null), null);
  assert.equal(extractAnswerText('not an array'), null);
});

// ---------------------------------------------------------------------------
// extractNumber
// ---------------------------------------------------------------------------

test('extractNumber parses single and multi digit answers', () => {
  assert.equal(extractNumber('7'), 7);
  assert.equal(extractNumber('  42 '), 42);
  assert.equal(extractNumber('The number is 9.'), 9);
});

test('extractNumber throws on answers without digits', () => {
  assert.throws(() => extractNumber('no digits here'), /non-digit/);
  assert.throws(() => extractNumber(''), /non-digit/);
});

// ---------------------------------------------------------------------------
// buildPrompt
// ---------------------------------------------------------------------------

test('buildPrompt references the file name and asks for digits only', () => {
  const prompt = buildPrompt('image.png');
  assert.match(prompt, /^image\.png/);
  assert.match(prompt, /ONLY the digits/);
});

// ---------------------------------------------------------------------------
// assertNotUsageLimited
// ---------------------------------------------------------------------------

test('assertNotUsageLimited is a no-op without limit metadata', () => {
  assert.doesNotThrow(() => assertNotUsageLimited(undefined));
  assert.doesNotThrow(() => assertNotUsageLimited({}));
  assert.doesNotThrow(() => assertNotUsageLimited({ limitReached: false }));
});

test('assertNotUsageLimited throws when the usage limit was reached', () => {
  assert.throws(
    () => assertNotUsageLimited({ limitReached: true }),
    /usage limit reached/i
  );
});

test('assertNotUsageLimited includes the reset time when available', () => {
  assert.throws(
    () =>
      assertNotUsageLimited({
        limitReached: true,
        limitResetTime: '3pm',
        limitTimezone: 'UTC',
      }),
    /resets 3pm UTC/
  );
});

// ---------------------------------------------------------------------------
// imageToNumber with an injected fake agent (no network, no Claude)
// ---------------------------------------------------------------------------

/**
 * Build a fake agent factory that records the options it was called with and
 * returns a controller yielding a canned stream-json response.
 * @param {string} answer - The digit string the fake assistant "sees".
 * @param {object} [opts] - { exitCode }.
 * @returns {{ factory: Function, calls: object[] }}
 */
function makeFakeAgent(answer, opts = {}) {
  const calls = [];
  const factory = (options) => {
    calls.push(options);
    return {
      start: async () => {},
      stop: async () => ({
        exitCode: opts.exitCode ?? 0,
        metadata: opts.metadata,
        output: {
          plain: answer,
          parsed: [
            { type: 'system', subtype: 'init' },
            {
              type: 'assistant',
              message: { content: [{ type: 'text', text: answer }] },
            },
            { type: 'result', subtype: 'success' },
          ],
        },
      }),
    };
  };
  return { factory, calls };
}

/** Create a throwaway image file and return its path. */
async function makeTempImage() {
  const dir = await mkdtemp(join(tmpdir(), 'itn-unit-'));
  const file = join(dir, 'sample.png');
  await writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG magic
  return file;
}

test('imageToNumber returns the parsed number using an injected agent', async () => {
  const { factory, calls } = makeFakeAgent('7');
  const image = await makeTempImage();

  const result = await imageToNumber(image, { agent: factory });

  assert.equal(result, 7);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tool, 'claude');
  assert.equal(calls[0].model, 'haiku');
  assert.equal(calls[0].json, true);
  // The prompt references the generic in-temp filename, never the source name.
  assert.match(calls[0].prompt, /^image\.png/);
  assert.doesNotMatch(calls[0].prompt, /sample/);
});

test('imageToNumber passes the model from the options object', async () => {
  const { factory, calls } = makeFakeAgent('5');
  const image = await makeTempImage();

  await imageToNumber(image, { model: 'opus', agent: factory });

  assert.equal(calls[0].model, 'opus');
});

test('imageToNumber throws when Claude exits non-zero', async () => {
  const { factory } = makeFakeAgent('', { exitCode: 1 });
  const image = await makeTempImage();

  await assert.rejects(
    () => imageToNumber(image, { agent: factory }),
    /exited with code 1/
  );
});

test('imageToNumber throws a clear error when the usage limit is reached', async () => {
  const { factory } = makeFakeAgent('7', {
    metadata: { limitReached: true, limitResetTime: 'later' },
  });
  const image = await makeTempImage();

  await assert.rejects(
    () => imageToNumber(image, { agent: factory }),
    /usage limit reached/i
  );
});

test('imageToNumber cleans up the temp dir by default', async () => {
  const { factory } = makeFakeAgent('8');
  const image = await makeTempImage();

  // Capture which itn temp dirs exist before/after to confirm cleanup.
  const before = (await readdir('/tmp')).filter((n) =>
    n.startsWith('image-to-number-')
  );
  await imageToNumber(image, { agent: factory });
  const after = (await readdir('/tmp')).filter((n) =>
    n.startsWith('image-to-number-')
  );

  assert.deepEqual(after, before);
});

test('imageToNumber surfaces a clear error for a missing local file', async () => {
  const { factory } = makeFakeAgent('1');
  await assert.rejects(
    () => imageToNumber('/does/not/exist.png', { agent: factory }),
    /Failed to copy image file/
  );
});

// Helper sanity: makeTempImage actually creates a readable file.
test('makeTempImage produces a real file (test fixture sanity)', async () => {
  const image = await makeTempImage();
  await assert.doesNotReject(() => access(image));
});
