const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    console.log('--- Column Inspection ---');
    // Using RPC to call a system function or just trying to select specific columns
    const tables = {
        inventory: ['name', 'stock', 'reorder', 'price', 'user_id'],
        debts: ['name', 'total', 'interest', 'min_payment', 'user_id'],
        budgets: ['category', 'budget', 'actual', 'user_id'],
        transactions: ['description', 'amount', 'type', 'date', 'category', 'source', 'vehicle_reg', 'user_id'],
        vehicles: ['reg_no', 'description']
    };

    for (const [table, columns] of Object.entries(tables)) {
        console.log(`Checking table: ${table}`);
        for (const col of columns) {
            const { error } = await supabase.from(table).select(col).limit(1);
            if (error) {
                console.log(`  ✖ Column ${col}: ${error.message} (${error.code})`);
            } else {
                console.log(`  ✔ Column ${col}: Exists`);
            }
        }
    }
}
inspect();
