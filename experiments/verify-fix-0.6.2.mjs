// Probe: verify agent-commander@0.6.2 fixes #37 (metadata.success now true on
// successful runs) using a real haiku call on images/a.png.
import { mkdir, copyFile, rm } from 'fs/promises';
import { randomBytes } from 'crypto';

const { use } = eval(await (await fetch('https://unpkg.com/use-m/use.js')).text());
const { agent } = await use('agent-commander@0.6.2');

const dir = `/tmp/probe-${randomBytes(8).toString('hex')}`;
await mkdir(dir, { recursive: true });
await copyFile(new URL('../images/a.png', import.meta.url), `${dir}/image.png`);

const a = agent({
  tool: 'claude',
  workingDirectory: dir,
  prompt: 'image.png\n\nWhat number do you see in this image? Output ONLY the digits you see, nothing else.',
  model: 'haiku',
  json: true,
});
await a.start({ attached: false });
const r = await a.stop();

console.log('exitCode:', r.exitCode);
console.log('metadata.success:', r.metadata?.success);
console.log('metadata.limitReached:', r.metadata?.limitReached);
console.log('metadata keys:', Object.keys(r.metadata ?? {}));

await rm(dir, { recursive: true, force: true });
