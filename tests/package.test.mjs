import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

test(
  'packed CLI prints its version directly and through the installed bin',
  {
    timeout: 120000,
  },
  async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'itn-package with spaces-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const options = { cwd: dir, encoding: 'utf8', timeout: 60000 };
    const [{ filename }] = JSON.parse(
      execFileSync(
        npm,
        ['pack', root, '--json', '--pack-destination', dir],
        options
      )
    );
    execFileSync(
      npm,
      [
        'install',
        join(dir, filename),
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
      ],
      options
    );

    const installed = join(
      dir,
      'node_modules',
      '@link-assistant',
      'image-to-number'
    );
    const { version } = JSON.parse(
      await readFile(join(installed, 'package.json'), 'utf8')
    );
    const entry = join(installed, 'image-to-number.mjs');
    const bin = join(dir, 'node_modules', '.bin', 'image-to-number');

    for (const path of [entry, bin]) {
      await t.test(`node ${path} --version`, () => {
        assert.equal(
          execFileSync(process.execPath, [path, '--version'], options),
          `${version}\n`
        );
      });
    }
    if (process.platform !== 'win32') {
      await t.test('installed executable --version', () => {
        assert.equal(execFileSync(bin, ['--version'], options), `${version}\n`);
      });
    }

    await t.test('importing the installed module does not run the CLI', () => {
      const script = `await import(${JSON.stringify(entry)}); console.log('imported');`;
      assert.equal(
        execFileSync(
          process.execPath,
          ['--input-type=module', '--eval', script],
          options
        ),
        'imported\n'
      );
    });
  }
);
