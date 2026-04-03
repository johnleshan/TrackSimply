const GROQ_API_KEY = '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';
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
  get_financial_data: () => {
    return JSON.stringify({
      debts: JSON.parse(localStorage.getItem('tracksimply_debts') || '[]'),
      transactions: JSON.parse(localStorage.getItem('tracksimply_transactions') || '[]'),
      budgets: JSON.parse(localStorage.getItem('tracksimply_budgets') || '[]'),
      inventory: JSON.parse(localStorage.getItem('tracksimply_inventory') || '[]')
    });
  },
  add_debt: (args) => {
    const debts = JSON.parse(localStorage.getItem('tracksimply_debts') || '[]');
    debts.push({ id: Date.now(), ...args });
    localStorage.setItem('tracksimply_debts', JSON.stringify(debts));
    notifySync();
    return `Successfully added debt: ${args.name}`;
  },
  add_transaction: (args) => {
    const txs = JSON.parse(localStorage.getItem('tracksimply_transactions') || '[]');
    txs.push({ id: Date.now(), date: new Date().toISOString().split('T')[0], ...args });
    localStorage.setItem('tracksimply_transactions', JSON.stringify(txs));
    notifySync();
    return `Successfully logged ${args.type}: ${args.description}`;
  },
  set_budget: (args) => {
    const budgets = JSON.parse(localStorage.getItem('tracksimply_budgets') || '[]');
    const idx = budgets.findIndex(b => b.category.toLowerCase() === args.category.toLowerCase());
    if (idx >= 0) budgets[idx].budget = args.amount;
    else budgets.push({ id: Date.now(), category: args.category, budget: args.amount, actual: 0 });
    localStorage.setItem('tracksimply_budgets', JSON.stringify(budgets));
    notifySync();
    return `Successfully set budget for ${args.category}: ${args.amount}`;
  },
  update_inventory: (args) => {
    const inv = JSON.parse(localStorage.getItem('tracksimply_inventory') || '[]');
    const idx = inv.findIndex(i => i.name.toLowerCase() === args.name.toLowerCase());
    if (idx >= 0) {
      inv[idx].stock = Math.max(0, inv[idx].stock + args.delta);
      localStorage.setItem('tracksimply_inventory', JSON.stringify(inv));
      notifySync();
      return `Successfully updated ${args.name} stock to ${inv[idx].stock}`;
    }
    return `Could not find item ${args.name} in inventory.`;
  }
};

export const chatWithAI = async (messages) => {
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
          const result = executor(JSON.parse(call.function.arguments));
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
    return "I'm having trouble connecting to my central brain. Please check your internet connection.";
  }
};
