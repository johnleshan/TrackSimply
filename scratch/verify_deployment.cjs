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

async function verify() {
    const tables = ['site_users', 'inventory', 'debts', 'budgets', 'transactions'];
    console.log('--- Database Verification ---');
    
    for (const table of tables) {
        const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
        if (error) {
            console.error(`✖ Table "${table}" error: ${error.message}`);
        } else {
            console.log(`✔ Table "${table}" exists.`);
        }
    }
    
    const { data: user, error: userError } = await supabase
        .from('site_users')
        .select('*')
        .eq('username', 'superadmin')
        .single();
        
    if (userError) {
        console.error('✖ Superadmin user NOT found.');
    } else {
        console.log('✔ Superadmin user exists and is ready.');
    }
}

verify();
