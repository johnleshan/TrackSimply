/**
 * Serves /api/assistant from the Vite dev server.
 *
 * Vercel runs the functions in api/ in production; Vite does not run them at
 * all. Without this, local development and the demo would have no assistant and
 * the only way to exercise it would be to deploy — which is not a way to test.
 *
 * Deliberately calls the same handleAssistant used by the deployed function, so
 * local behaviour and production behaviour cannot drift apart.
 */

import { handleAssistant } from '../api/assistant.js';

const MAX_BODY_BYTES = 256 * 1024;

export function devApiPlugin({ apiKey, model } = {}) {
  return {
    name: 'tracksimply-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/assistant')) return next();

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'method_not_allowed' }));
        }

        let raw = '';
        let aborted = false;
        req.on('data', (chunk) => {
          raw += chunk;
          if (raw.length > MAX_BODY_BYTES) {
            aborted = true;
            res.statusCode = 413;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'payload_too_large' }));
            req.destroy();
          }
        });

        req.on('end', async () => {
          if (aborted) return;

          let payload = null;
          try {
            payload = raw ? JSON.parse(raw) : null;
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'bad_json' }));
          }

          try {
            const result = await handleAssistant(payload, { apiKey, model });
            res.statusCode = result.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result.body));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'dev_proxy_failed', message: error.message }));
          }
        });
      });
    },
  };
}
