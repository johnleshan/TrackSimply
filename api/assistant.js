/**
 * Serverless proxy for the AI assistant.
 *
 * The browser never sees the Groq key. It posts the conversation here and this
 * function makes the upstream call, because VITE_-prefixed variables are inlined
 * into the public bundle by Vite and cannot be kept private — regardless of how
 * they are labelled in the Vercel dashboard.
 *
 * Requires GROQ_API_KEY (no VITE_ prefix, so it stays server-side). Optionally
 * GROQ_MODEL.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS DOES AND DOES NOT FIX
 *
 * It removes the key from the browser entirely. Someone reading the deployed
 * JavaScript can no longer extract it and spend against the account elsewhere.
 *
 * It does NOT make the endpoint private. /api/assistant is reachable by anyone
 * who can reach the site, so a stranger could still burn AI quota through it.
 * The model and token budget are pinned server-side to bound the damage, but the
 * real fix is requiring an authenticated session — which needs the same Supabase
 * Auth migration that Row Level Security needs. Until then this is strictly
 * better than a public key, not equivalent to a locked door.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const DEFAULT_MODEL = 'openai/gpt-oss-120b';

/* Only models this assistant is known to work with. The client cannot choose.
   Without this, anyone hitting the endpoint could select a far more expensive
   model than the one intended. */
const ALLOWED_MODELS = new Set([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
]);

const LIMITS = {
  messages: 30,
  tools: 12,
  maxTokens: 2048,
  bodyBytes: 256 * 1024,
};

function bad(status, error, message) {
  return { status, body: { error, message } };
}

/**
 * Pure of any HTTP framework, so both the Vercel function and the Vite dev
 * middleware can call it with the same behaviour.
 */
export async function handleAssistant(payload, config = {}) {
  const apiKey = config.apiKey || process.env.GROQ_API_KEY;
  const requested = config.model || process.env.GROQ_MODEL || DEFAULT_MODEL;
  const model = ALLOWED_MODELS.has(requested) ? requested : DEFAULT_MODEL;

  if (!apiKey) {
    return bad(503, 'not_configured',
      'The AI assistant is not configured on the server. Set GROQ_API_KEY and redeploy.');
  }

  const { messages, tools } = payload || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return bad(400, 'bad_request', 'messages must be a non-empty array.');
  }
  if (messages.length > LIMITS.messages) {
    return bad(400, 'too_many_messages', `At most ${LIMITS.messages} messages are accepted.`);
  }
  if (tools !== undefined && (!Array.isArray(tools) || tools.length > LIMITS.tools)) {
    return bad(400, 'bad_tools', `tools must be an array of at most ${LIMITS.tools} entries.`);
  }

  try {
    const upstream = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: LIMITS.maxTokens,
        ...(tools && tools.length ? { tools, tool_choice: 'auto' } : {}),
      }),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok || data?.error) {
      // Pass the upstream message through: "model not found" and "rate limit
      // exceeded" need very different responses from whoever is looking.
      return {
        status: upstream.status,
        body: data?.error ? data : { error: 'upstream_error', message: `Groq returned ${upstream.status}.` },
      };
    }

    return { status: 200, body: data };
  } catch (error) {
    return bad(502, 'upstream_unreachable', `Could not reach Groq: ${error.message}`);
  }
}

/** Vercel Node runtime entry point. */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed', message: 'Use POST.' });
  }

  let payload = req.body;
  if (typeof payload === 'string') {
    if (payload.length > LIMITS.bodyBytes) {
      return res.status(413).json({ error: 'payload_too_large' });
    }
    try { payload = JSON.parse(payload); } catch { payload = null; }
  }

  const result = await handleAssistant(payload);
  return res.status(result.status).json(result.body);
}
