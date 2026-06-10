#!/usr/bin/env node

import { imageToNumber } from './image-to-number.mjs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Test script for image-to-number.mjs
 * Tests all 26 example images with digits (a.png - z.png)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = join(__dirname, 'images');

// Expected values for each image (identified manually)
const testCases = [
  { file: 'a.png', expected: 7 },
  { file: 'b.png', expected: 4 },
  { file: 'c.png', expected: 7 },
  { file: 'd.png', expected: 9 },
  { file: 'e.png', expected: 7 },
  { file: 'f.png', expected: 2 },
  { file: 'g.png', expected: 7 },
  { file: 'h.png', expected: 5 },
  { file: 'i.png', expected: 5 },
  { file: 'j.png', expected: 9 },
  { file: 'k.png', expected: 8 },
  { file: 'l.png', expected: 4 },
  { file: 'm.png', expected: 8 },
  { file: 'n.png', expected: 1 },
  { file: 'o.png', expected: 7 },
  { file: 'p.png', expected: 2 },
  { file: 'q.png', expected: 6 },
  { file: 'r.png', expected: 5 },
  { file: 's.png', expected: 8 },
  { file: 't.png', expected: 7 },
  { file: 'u.png', expected: 5 },
  { file: 'v.png', expected: 3 },
  { file: 'w.png', expected: 7 },
  { file: 'x.png', expected: 6 },
  { file: 'y.png', expected: 6 },
  { file: 'z.png', expected: 5 },
];

console.log('🧪 Testing image-to-number.mjs');
console.log(`📁 Test images directory: ${IMAGES_DIR}\n`);

let passed = 0;
let failed = 0;
let errors = 0;

for (let i = 0; i < testCases.length; i++) {
  const testCase = testCases[i];
  const testNum = i + 1;
  const imagePath = join(IMAGES_DIR, testCase.file);

  console.log(`Test ${testNum}/${testCases.length}: ${testCase.file}`);

  try {
    const result = await imageToNumber(imagePath);
    console.log(`  Result: ${result}, Expected: ${testCase.expected}`);

    if (result === testCase.expected) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      console.log(`  ❌ FAIL: Got ${result}, expected ${testCase.expected}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error.message}\n`);
    errors++;
  }
}

console.log('='.repeat(50));
console.log('📊 Test Summary');
console.log('='.repeat(50));
console.log(`Total tests: ${testCases.length}`);
console.log(
  `✅ Passed: ${passed} (${Math.round((passed / testCases.length) * 100)}%)`
);
console.log(
  `❌ Failed: ${failed} (${Math.round((failed / testCases.length) * 100)}%)`
);
console.log(
  `⚠️  Errors: ${errors} (${Math.round((errors / testCases.length) * 100)}%)`
);
console.log('='.repeat(50));

if (passed === testCases.length) {
  console.log('\n🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Review the output above.');
  process.exit(1);
}
