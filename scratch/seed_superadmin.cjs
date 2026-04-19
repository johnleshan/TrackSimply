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

async function seed() {
    console.log('Inserting superadmin user...');
    const { data, error } = await supabase
        .from('site_users')
        .insert([{ username: 'superadmin', password: 'password', role: 'superadmin', active: true }]);

    if (error) {
        console.error('Error inserting superadmin:', error.message);
    } else {
        console.log('Superadmin user successfully created.');
    }
}

seed();
