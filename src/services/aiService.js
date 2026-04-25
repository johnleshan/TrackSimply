import { supabase } from '../lib/supabase';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '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';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Helper to sync all UI components after AI modification
const notifySync = () => {
  window.dispatchEvent(new Event('tracksimply-ai-sync'));
};

const tools = [
  {
    type: "function",
    function: {
      name: "get_financial_data",
      description: "Get all current financial data (debts, transactions, budgets, inventory) for analysis",
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

const toolExecutors = {
  get_financial_data: async (args, userId) => {
    const { data: debts } = await supabase.from('debts').select('*').eq('user_id', userId);
    const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', userId);
    const { data: budgets } = await supabase.from('budgets').select('*').eq('user_id', userId);
    const { data: inventory } = await supabase.from('inventory').select('*').eq('user_id', userId);
    
    return JSON.stringify({ debts, transactions: txs, budgets, inventory });
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
    // Check if exists
    const { data: existing } = await supabase
      .from('budgets')
      .select('id')
      .eq('category', args.category)
      .eq('user_id', userId)
      .single();

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
      .single();

    if (item) {
      const newStock = Math.max(0, (Number(item.stock) || 0) + args.delta);
      await supabase.from('inventory').update({ stock: newStock }).eq('id', item.id);
      notifySync();
      return `Successfully updated ${args.name} stock to ${newStock}`;
    }
    return `Could not find item ${args.name} in inventory.`;
  }
};

export const chatWithAI = async (messages, userId) => {
  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        tools,
        tool_choice: "auto"
      })
    });

    const data = await response.json();
    const message = data.choices[0].message;

    if (message.tool_calls) {
      const toolResults = [];
      for (const call of message.tool_calls) {
        const executor = toolExecutors[call.function.name];
        if (executor) {
          const result = await executor(JSON.parse(call.function.arguments), userId);
          toolResults.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: result
          });
        }
      }

      // Final chain
      const nextResponse = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [...messages, message, ...toolResults]
        })
      });

      const finalData = await nextResponse.json();
      return finalData.choices[0].message.content;
    }

    return message.content;
  } catch (error) {
    console.error('Groq AI Error:', error);
    return `I'm having trouble connecting to my central brain. Error: ${error.message}. Please verify your API key in .env (VITE_GROQ_API_KEY).`;
  }
};
