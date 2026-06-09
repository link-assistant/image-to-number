// Probe: can we load agent-commander via use-m and make a real haiku call?
import { copyFile, mkdir, rm } from 'fs/promises';
import { randomBytes } from 'crypto';

const { use } = eval(await (await fetch('https://unpkg.com/use-m/use.js')).text());
console.log('use-m loaded');
const ac = await use('agent-commander');
console.log('agent-commander loaded, keys:', Object.keys(ac));
const { agent } = ac;

const tempDir = `/tmp/probe-${randomBytes(8).toString('hex')}`;
await mkdir(tempDir, { recursive: true });
await copyFile(new URL('../images/a.png', import.meta.url), `${tempDir}/image.png`);

const a = agent({
  tool: 'claude',
  workingDirectory: tempDir,
  prompt: 'image.png\n\nWhat number do you see in this image? Output ONLY the digits you see, nothing else.',
  model: 'haiku',
  json: true,
});
const t0 = Date.now();
await a.start({ attached: false });
const result = await a.stop();
console.log('exitCode:', result.exitCode, 'elapsed(s):', (Date.now()-t0)/1000);
console.log('parsed messages count:', result.output.parsed?.length);
let answer = '';
for (const msg of result.output.parsed || []) {
  if (msg.type === 'assistant' && msg.message?.content) {
    for (const block of msg.message.content) {
      if (block.type === 'text') answer += block.text;
    }
  }
}
console.log('ANSWER TEXT:', JSON.stringify(answer.trim()));
console.log('metadata.success:', result.metadata?.success);
await rm(tempDir, { recursive: true, force: true });
