import { mkdir, copyFile, rm } from 'fs/promises';
import { randomBytes } from 'crypto';
import { loadAgent, buildPrompt } from '../image-to-number.mjs';

const agent = await loadAgent();
const dir = `/tmp/itn-probe-${randomBytes(8).toString('hex')}`;
await mkdir(dir, { recursive: true });
await copyFile('../images/a.png', `${dir}/image.png`);
const c = agent({ tool: 'claude', workingDirectory: dir, prompt: buildPrompt('image.png'), model: 'haiku', json: true });
await c.start({ attached: false });
const r = await c.stop();
const out = {
  exitCode: r.exitCode,
  parsedAnswer: (r.output?.parsed ?? []).filter(m => m.type === 'assistant').flatMap(m => m.message?.content ?? []).filter(b => b.type === 'text').map(b => b.text).join(''),
  metadata: r.metadata,
  note: 'metadata.success=false / limitReached=true despite exitCode 0 and a correct answer. Root cause: detectUsageLimit() regex /rate[_\\s-]?limit.../i matches the substring "ratelimit" in the anthropic-ratelimit-* HTTP header names printed in stream-json. Reported as agent-commander#37.',
};
console.log(JSON.stringify(out, null, 2));
await rm(dir, { recursive: true, force: true });
