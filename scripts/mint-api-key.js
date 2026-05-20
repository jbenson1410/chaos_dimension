import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import readline from 'node:readline';
import { verifyPassword } from '../src/lib/passwords.js';
import { mintTokenLogic } from '../api/agent-tokens/index.js';
import { getDb } from '../src/db/client.js';

function prompt(q, { masked = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (masked) {
    rl._writeToOutput = () => {};
  }
  return new Promise((res) => rl.question(q, (a) => {
    rl.close();
    if (masked) process.stdout.write('\n');
    res(a);
  }));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--label' && argv[i + 1]) out.label = argv[i + 1];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const label = args.label || (await prompt('Token label (e.g. macbook): ')).trim();
  if (!label) {
    console.error('Label is required.');
    process.exit(1);
  }

  const password = await prompt('Owner password: ', { masked: true });
  const ok = await verifyPassword(password, process.env.CHAOS_PASSWORD_HASH);
  if (!ok) {
    console.error('Invalid password.');
    process.exit(1);
  }

  const db = getDb();
  const result = await mintTokenLogic({ db, body: { label } });
  if (result.status !== 201) {
    console.error('Mint failed:', result.body);
    process.exit(1);
  }

  console.log('\nMCP API key minted. Add this block to ~/.claude/.mcp.json under mcpServers:\n');
  console.log(JSON.stringify({
    'chaos-dimension': {
      url: 'https://chaosdimension.fyi/api/mcp',
      headers: { Authorization: `Bearer ${result.body.token}` },
    },
  }, null, 2));
  console.log('\nThis token is shown ONCE. Copy it now.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
