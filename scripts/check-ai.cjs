/**
 * Checks the AI assistant's configuration without touching any business data.
 *
 * Answers the three questions that actually break the assistant:
 *   1. Is a key present and accepted?
 *   2. Does the configured model still exist on this Groq account?
 *   3. Does the model support tool calling, which the assistant depends on for
 *      every read and every write?
 *
 * Run with:  node scripts/check-ai.cjs
 *
 * Sends one short prompt with a single tool definition. No client records are
 * transmitted.
 */

const fs = require('fs');
const path = require('path');

const URL_CHAT = 'https://api.groq.com/openai/v1/chat/completions';
const URL_MODELS = 'https://api.groq.com/openai/v1/models';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

function loadEnv() {
  const out = {};
  for (const name of ['.env.local', '.env']) {
    const file = path.join(__dirname, '..', name);
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      if (out[key] !== undefined) continue;
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  }
  return out;
}

(async () => {
  const fileEnv = loadEnv();
  // GROQ_API_KEY is the server-side name and has no VITE_ prefix on purpose, so
  // it is never inlined into the browser bundle.
  const key = process.env.GROQ_API_KEY || fileEnv.GROQ_API_KEY
    || process.env.VITE_GROQ_API_KEY || fileEnv.VITE_GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || fileEnv.GROQ_MODEL
    || process.env.VITE_GROQ_MODEL || fileEnv.VITE_GROQ_MODEL || DEFAULT_MODEL;

  if (!key) {
    console.error('No GROQ_API_KEY found in the environment or .env.local.');
    console.error('The assistant will report that it is not configured until one is set.');
    process.exit(1);
  }
  if (!key.startsWith('gsk_')) {
    console.warn(`Warning: the key does not look like a Groq key (expected it to start with "gsk_").`);
  }

  console.log(`Model in use: ${model}\n`);

  // 1. Is the key accepted, and what can it reach?
  const modelsRes = await fetch(URL_MODELS, { headers: { Authorization: `Bearer ${key}` } });
  if (!modelsRes.ok) {
    console.error(`Key rejected: HTTP ${modelsRes.status}`);
    process.exit(1);
  }
  const models = (await modelsRes.json()).data || [];
  const ids = models.map((m) => m.id).sort();
  console.log(`Key accepted. ${ids.length} models available to this account.`);

  if (!ids.includes(model)) {
    console.error(`\n"${model}" is NOT available on this account.`);
    console.error('Available models:');
    for (const id of ids) console.error(`  ${id}`);
    console.error('\nSet VITE_GROQ_MODEL to one of the above. The assistant is broken until you do.');
    process.exit(1);
  }
  console.log(`"${model}" is available.`);

  // 2. Does it actually perform a tool call? Everything the assistant does
  //    depends on this.
  const chatRes = await fetch(URL_CHAT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      tools: [{
        type: 'function',
        function: {
          name: 'add_debt',
          description: 'Add a debt',
          parameters: {
            type: 'object',
            properties: { name: { type: 'string' }, total: { type: 'number' } },
            required: ['name', 'total'],
          },
        },
      }],
      tool_choice: 'auto',
      messages: [{ role: 'user', content: 'I owe 50000 on a car loan.' }],
    }),
  });

  const chat = await chatRes.json();
  if (!chatRes.ok || chat.error) {
    console.error(`\nCall failed: ${chat.error?.message || `HTTP ${chatRes.status}`}`);
    process.exit(1);
  }

  const calls = chat.choices?.[0]?.message?.tool_calls || [];
  if (calls.length) {
    console.log(`Tool calling works: ${calls[0].function.name}(${calls[0].function.arguments})`);
  } else {
    console.error('\nThe model replied without calling the tool.');
    console.error('The assistant will answer questions but will not be able to read or change records.');
    console.error(`It said: ${JSON.stringify((chat.choices?.[0]?.message?.content || '').slice(0, 160))}`);
    process.exit(1);
  }

  console.log('\nThe AI assistant is configured correctly. No business data was sent.');
})().catch((err) => {
  console.error('Check failed:', err.message);
  process.exit(1);
});
