import { supabase } from '../lib/supabase';
import { summarize, byCategory } from '../lib/analytics';
import { toIsoDate } from '../lib/format';

/**
 * Groq-backed assistant with tool calling.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The key is read from VITE_GROQ_API_KEY and has no hardcoded fallback.
 *
 * It previously shipped a literal key in this file as a `||` default. That key
 * was committed, leaked into the public bundle, and is the reason this line was
 * rewritten. A missing key now surfaces as a plain message rather than silently
 * billing a stranger's key.
 *
 * IMPORTANT: VITE_* values are inlined into the deployed JavaScript, so whatever
 * goes in this variable is readable by anyone who loads the site. The assistant
 * calls Groq directly from the browser because the project has no server. Moving
 * the call behind a serverless function is the correct fix and is not done here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const API_KEY = import.meta.env.VITE_GROQ_API_KEY;

/*
 * llama-3.3-70b-versatile, which this app called until now, has been removed
 * from Groq and returns 404 model_not_found. Every assistant reply failed. The
 * default below is a current model with tool-calling support, verified against
 * the API; it can be overridden with VITE_GROQ_MODEL without a code change.
 */
const MODEL = import.meta.env.VITE_GROQ_MODEL || 'openai/gpt-oss-120b';

/** Bounds the tool loop so a model that keeps calling tools still terminates. */
const MAX_TOOL_ROUNDS = 3;

const NOT_CONFIGURED =
  'The AI assistant is not configured. Add VITE_GROQ_API_KEY to your environment ' +
  'and restart — see .env.example. Nothing else in the app is affected.';

// Helper to sync all UI components after AI modification
const notifySync = () => {
  window.dispatchEvent(new Event('tracksimply-ai-sync'));
};

const tools = [
  {
    type: "function",
    function: {
      name: "get_financial_data",
      description: "Get aggregated financial figures for the user: last six months of income, expenses and net, category breakdowns, debts, budgets, inventory and recent transactions. Returns summaries, not raw records.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "add_debt",
      description: "Add a new debt obligation to the tracker",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          total: { type: "number" },
          interest: { type: "number" },
          minPayment: { type: "number" }
        },
        required: ["name", "total"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_transaction",
      description: "Log a new income or expense transaction in bookkeeping",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string" },
          amount: { type: "number" },
          type: { type: "string", enum: ["Income", "Expense"] },
          category: { type: "string" }
        },
        required: ["description", "amount", "type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_budget",
      description: "Set or update a budget for a category",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string" },
          amount: { type: "number" }
        },
        required: ["category", "amount"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_inventory",
      description: "Adjust stock levels for an inventory item (use negative for decrease)",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          delta: { type: "number" }
        },
        required: ["name", "delta"]
      }
    }
  }
];

/** Trims float noise so the payload stays small. */
const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

/** The last n calendar months, newest last. */
function recentMonths(n, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    out.push({
      label: start.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      range: { start: toIsoDate(start), end: toIsoDate(end) },
    });
  }
  return out;
}

const toolExecutors = {
  /*
   * Returns an AGGREGATE, not the rows.
   *
   * This tool used to return every transaction, debt, budget and inventory row
   * as JSON. On a real business that is thousands of rows: the second Groq call
   * then exceeded the account's 8,000 tokens-per-minute limit and the assistant
   * failed outright. It could create records but could never read them, which is
   * most of the value gone.
   *
   * Summaries are also better input. A model reasons more reliably about twelve
   * monthly figures than about 1,496 individual rows, and it costs a fraction of
   * the tokens.
   */
  get_financial_data: async (args, userId) => {
    const [debtsRes, txRes, budgetsRes, inventoryRes] = await Promise.all([
      supabase.from('debts').select('*').eq('user_id', userId),
      supabase.from('transactions').select('*').eq('user_id', userId),
      supabase.from('budgets').select('*').eq('user_id', userId),
      supabase.from('inventory').select('*').eq('user_id', userId),
    ]);

    const transactions = txRes.data || [];
    const debts = debtsRes.data || [];
    const budgets = budgetsRes.data || [];
    const inventory = inventoryRes.data || [];

    const months = recentMonths(6);
    const windowRange = { start: months[0].range.start, end: months[months.length - 1].range.end };
    const allTimeTotals = summarize(transactions, { start: '1970-01-01', end: '2099-12-31' });

    return JSON.stringify({
      asOf: toIsoDate(new Date()),
      currency: 'KES',
      note: 'Aggregated figures, not raw records. All amounts in KES. Ask the user for detail if you need it.',
      monthly: months.map((m) => {
        const s = summarize(transactions, m.range);
        return { month: m.label, income: round(s.income), expenses: round(s.expense), net: round(s.net) };
      }),
      last6Months: {
        income: round(summarize(transactions, windowRange).income),
        expenses: round(summarize(transactions, windowRange).expense),
      },
      allTime: {
        income: round(allTimeTotals.income),
        expenses: round(allTimeTotals.expense),
        net: round(allTimeTotals.net),
        transactionCount: allTimeTotals.transactionCount,
      },
      incomeByCategory6m: byCategory(transactions, windowRange, 'income')
        .slice(0, 12).map((c) => ({ category: c.category, amount: round(c.amount) })),
      expenseByCategory6m: byCategory(transactions, windowRange, 'expense')
        .slice(0, 12).map((c) => ({ category: c.category, amount: round(c.amount) })),
      debts: debts.map((d) => ({
        name: d.name,
        balance: round(d.total),
        interestRatePercent: round(d.interest),
        monthlyPayment: round(d.min_payment),
      })),
      budgets: budgets.map((b) => ({
        category: b.category,
        target: round(b.budget),
        recordedActual: round(b.actual),
      })),
      inventory: {
        itemCount: inventory.length,
        lowStock: inventory
          .filter((i) => Number(i.stock) <= Number(i.reorder))
          .slice(0, 20)
          .map((i) => ({ name: i.name, stock: i.stock, reorderPoint: i.reorder })),
      },
      recentTransactions: [...transactions]
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 12)
        .map((t) => ({
          date: t.date, description: t.description,
          amount: round(t.amount), type: t.type, category: t.category,
        })),
    });
  },
  add_debt: async (args, userId) => {
    const { error } = await supabase.from('debts').insert([{ ...args, user_id: userId }]);
    if (error) throw error;
    notifySync();
    return `Successfully added debt: ${args.name}`;
  },
  add_transaction: async (args, userId) => {
    const { error } = await supabase.from('transactions').insert([{
      ...args,
      user_id: userId,
      date: new Date().toISOString().split('T')[0],
      source: 'business'
    }]);
    if (error) throw error;
    notifySync();
    return `Successfully logged ${args.type}: ${args.description}`;
  },
  set_budget: async (args, userId) => {
    // maybeSingle, not single: no existing row is the normal case on first use,
    // and single() reports that as an error rather than as "nothing found".
    const { data: existing } = await supabase
      .from('budgets')
      .select('id')
      .eq('category', args.category)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      await supabase.from('budgets').update({ budget: args.amount }).eq('id', existing.id);
    } else {
      await supabase.from('budgets').insert([{ category: args.category, budget: args.amount, actual: 0, user_id: userId }]);
    }
    notifySync();
    return `Successfully set budget for ${args.category}: ${args.amount}`;
  },
  update_inventory: async (args, userId) => {
    const { data: item } = await supabase
      .from('inventory')
      .select('*')
      .eq('name', args.name)
      .eq('user_id', userId)
      .maybeSingle();

    if (item) {
      const newStock = Math.max(0, (Number(item.stock) || 0) + args.delta);
      await supabase.from('inventory').update({ stock: newStock }).eq('id', item.id).eq('user_id', userId);
      notifySync();
      return `Successfully updated ${args.name} stock to ${newStock}`;
    }
    return `Could not find item ${args.name} in inventory.`;
  }
};

/**
 * The assistant had no system prompt, so it did not know what product it was in,
 * what currency the figures were in, or what today's date was — which matters
 * when someone says "last month".
 */
function systemPrompt() {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  return [
    'You are the assistant inside TrackSimply, bookkeeping software used by small businesses in Kenya.',
    'All amounts are Kenyan Shillings (KES) unless the user says otherwise.',
    `Today is ${today}.`,
    'Use the tools to read and change the user\'s own records. Only ever state a change you actually made through a tool.',
    'If a request is ambiguous or a needed figure is missing, ask one short clarifying question instead of guessing.',
    'Reply in plain sentences, briefly. No markdown headings.',
  ].join(' ');
}

async function callGroq(payload) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, ...payload }),
  });

  const data = await response.json().catch(() => null);

  // Groq reports failures in the body, so check both the status and the payload
  // rather than assuming choices exists.
  if (!response.ok || data?.error) {
    const detail = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(detail);
  }

  const message = data?.choices?.[0]?.message;
  if (!message) throw new Error('Groq returned no message.');
  return message;
}

export const chatWithAI = async (messages, userId) => {
  if (!API_KEY) return NOT_CONFIGURED;

  try {
    // The chat window keeps the whole conversation and resends all of it every
    // turn. Left unbounded that alone exhausts a low token budget, so only the
    // recent turns are sent; standing facts live in the system prompt.
    const recent = messages.slice(-12);
    const conversation = [{ role: 'system', content: systemPrompt() }, ...recent];

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
      // The final round runs without tools, which forces a written answer and
      // guarantees the loop ends even if the model would keep calling them.
      const allowTools = round < MAX_TOOL_ROUNDS;
      const message = await callGroq({
        messages: conversation,
        ...(allowTools ? { tools, tool_choice: 'auto' } : {}),
      });

      const calls = message.tool_calls || [];
      if (!calls.length || !allowTools) {
        return message.content || 'Done.';
      }

      const results = [];
      for (const call of calls) {
        const executor = toolExecutors[call.function.name];
        let content;
        try {
          const args = JSON.parse(call.function.arguments || '{}');
          content = executor
            ? await executor(args, userId)
            : `No such tool: ${call.function.name}`;
        } catch (error) {
          // Report the failure back to the model so it can explain it, rather
          // than throwing the whole conversation away.
          content = `That action failed: ${error.message || 'unknown error'}`;
        }
        results.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.function.name,
          content,
        });
      }

      conversation.push(message, ...results);
    }

    return 'I could not finish that request. Please try rephrasing it.';
  } catch (error) {
    console.error('Groq AI Error:', error);
    const message = String(error?.message || error);
    const modelGone = /model_not_found|does not exist|do not have access/i.test(message);
    if (modelGone) {
      return `The configured model (${MODEL}) is not available on this Groq account. Set VITE_GROQ_MODEL to a model the key can access.`;
    }
    return `I could not reach the assistant. Error: ${message}`;
  }
};
