// Capture full metadata from agent-commander@0.6.2 (post-#37-fix) for the
// case-study evidence file.
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
await rm(dir, { recursive: true, force: true });

console.log(
  JSON.stringify(
    { exitCode: r.exitCode, parsedAnswer: r.metadata?.resultSummary, metadata: r.metadata },
    null,
    2
  )
);
