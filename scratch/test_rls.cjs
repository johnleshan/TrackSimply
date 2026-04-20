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

async function testRLS() {
    console.log('--- Auth & RLS Test ---');
    console.log('Inserting dummy data into transactions...');
    
    // Attempt an insert to transactions
    const { error } = await supabase.from('transactions').insert([{
        description: 'RLS Test',
        amount: 1,
        type: 'Income'
    }]);

    if (error) {
        console.error('Insert Error:', error.message, 'Code:', error.code, 'Details:', error.details);
    } else {
        console.log('Insert SUCCESS. RLS is either disabled or allows inserts.');
        
        // Clean up
        await supabase.from('transactions').delete().eq('description', 'RLS Test');
    }
}
testRLS();
