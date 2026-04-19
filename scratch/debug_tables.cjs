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
    console.log('--- Supabase Debug ---');
    
    // Try to see if we can get anything from site_users
    const { data: d1, error: e1 } = await supabase.from('site_users').select('*').limit(1);
    console.log('site_users:', e1 ? e1.message : 'Exists (Rows: ' + d1.length + ')');
    
    // Check for another common table from the app
    const { error: e2 } = await supabase.from('inventory').select('*').limit(1);
    console.log('inventory:', e2 ? e2.message : 'Exists');

    const { error: e3 } = await supabase.from('debts').select('*').limit(1);
    console.log('debts:', e3 ? e3.message : 'Exists');
}

debug();
