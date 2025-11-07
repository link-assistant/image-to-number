#!/usr/bin/env node

import { copyFile, mkdir, rm, writeFile } from 'fs/promises';
import { randomBytes } from 'crypto';

// Use use-m to load command-stream and yargs
const { use } = eval(await (await fetch('https://unpkg.com/use-m/use.js')).text());
const { $ } = await use('command-stream');
const yargsModule = await use('yargs@17.7.2');
const yargs = (yargsModule.default || yargsModule);
const { hideBin } = await use('yargs@17.7.2/helpers');

/**
 * Extract number(s) from an image using Claude via command-stream
 * Can be used as a CLI tool or imported as a function
 *
 * @param {string} imagePathOrUrl - File path or URL to the image
 * @param {string} model - Claude model to use: 'haiku', 'sonnet', or 'opus' (default: 'haiku')
 * @param {boolean} keepTemporaryFile - Keep temporary file after processing (default: false)
 * @returns {Promise<number>} - The digit(s) found in the image
 */
export async function imageToNumber(imagePathOrUrl, model = 'haiku', keepTemporaryFile = false) {
  // Create a temporary directory for this operation
  const randomName = randomBytes(16).toString('hex');
  const tempDir = `/tmp/image-to-number-${randomName}`;
  let shouldCleanup = !keepTemporaryFile;

  try {
    // Create temporary directory
    await mkdir(tempDir, { recursive: true });

    let imagePath;
    const isUrl = imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://');

    // Extract extension from original file/URL (default to .png if not found)
    let extension = '.png';
    if (isUrl) {
      const urlPath = imagePathOrUrl.split('?')[0]; // Remove query params
      const match = urlPath.match(/\.\w+$/);
      if (match) extension = match[0];
    } else {
      const match = imagePathOrUrl.match(/\.\w+$/);
      if (match) extension = match[0];
    }

    // Use generic filename to avoid any bias
    imagePath = `${tempDir}/image${extension}`;

    if (isUrl) {
      // Download URL to temp directory
      try {
        const response = await fetch(imagePathOrUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        await writeFile(imagePath, buffer);
      } catch (error) {
        throw new Error(`Failed to download image from URL: ${error.message}`);
      }
    } else {
      // Copy local file to temp directory
      try {
        await copyFile(imagePathOrUrl, imagePath);
      } catch (error) {
        throw new Error(`Failed to copy image file: ${error.message}`);
      }
    }

    const prompt = `${imagePath}\n\nWhat number do you see in this image? Output ONLY the digits you see, nothing else.`;

    // Use command-stream to properly handle stdin with image
    const result = await $({
      cwd: process.cwd(),
      stdin: prompt,
      mirror: false
    })`claude --output-format stream-json --model ${model} --add-dir "${tempDir}"`;

    // Extract output from result object
    const output = result.stdout || result.output || result.toString();

    // Parse NDJSON output
    const lines = output.split('\n');
    let answer = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        // Look for assistant message with content
        if (data.type === 'assistant' && data.message?.content) {
          for (const block of data.message.content) {
            if (block.type === 'text' && block.text) {
              if (answer === null) {
                answer = '';
              }
              answer += block.text;
            }
          }
        }
      } catch (parseError) {
        continue;
      }
    }

    if (answer === null) {
      throw new Error('No answer found in Claude response');
    }

    // Clean up and extract digit
    answer = answer.trim();
    const digitMatch = answer.match(/\d/);

    if (!digitMatch) {
      throw new Error(`Claude returned non-digit answer: ${answer}`);
    }

    return parseInt(digitMatch[0], 10);

  } finally {
    // Clean up temporary directory unless keepTemp is true
    if (shouldCleanup) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 <image-path-or-url> [options]')
    .command('$0 <image>', 'Extract digit from image', (yargs) => {
      yargs.positional('image', {
        describe: 'Path or URL to the image file',
        type: 'string'
      });
    })
    .option('model', {
      alias: 'm',
      type: 'string',
      description: 'Claude model to use',
      default: 'haiku',
      choices: ['haiku', 'sonnet', 'opus']
    })
    .option('keep-temporary-file', {
      type: 'boolean',
      description: 'Keep temporary file after processing',
      default: false
    })
    .help()
    .alias('help', 'h')
    .argv;

  try {
    const digit = await imageToNumber(argv.image, argv.model, argv.keepTemporaryFile);
    console.log(digit);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}
