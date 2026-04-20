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

async function testFull() {
    console.log('--- Testing schema ---');
    const { data: users } = await supabase.from('site_users').select('id').limit(1);
    if (!users || users.length === 0) { console.log('No users found.'); return; }
    
    // Testing insert with all columns
    const { error } = await supabase.from('transactions').insert([{
        user_id: users[0].id,
        description: 'Schema Test',
        amount: 200,
        type: 'Income',
        category: 'Test',
        source: 'business',
        vehicle_reg: 'KAA123'
    }]);

    if(error){
        console.error('Insert error (might be RLS):', error.message, 'Code:', error.code);
    } else {
        console.log('Insert complete! The schema is perfect.');
    }
}
testFull();
