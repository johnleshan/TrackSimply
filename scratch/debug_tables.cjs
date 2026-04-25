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

async function debug() {
    console.log('--- Supabase Debug (Detailed) ---');
    
    const tables = ['site_users', 'inventory', 'debts', 'budgets', 'transactions', 'vehicles'];
    
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`✖ ${table} failed select * : ${error.message} (${error.code})`);
        } else {
            console.log(`✔ ${table} exists. Columns: ${data.length > 0 ? Object.keys(data[0]).join(', ') : 'Empty Table'}`);
        }
    }
}

debug();
