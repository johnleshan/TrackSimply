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

async function checkConnection() {
    console.log('Checking Supabase connection...');
    // Try to select from a common table or just a health check
    const { data, error } = await supabase.from('site_users').select('count', { count: 'exact', head: true });
    if (error) {
        console.error('Supabase Error:', error.message);
        console.error('Full Error:', JSON.stringify(error, null, 2));
    } else {
        console.log('Successfully connected. Table site_users exists.');
    }
}

checkConnection();
