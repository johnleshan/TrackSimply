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

async function resetPassword() {
    console.log('Fetching users to verify table...');
    const { data: users, error: fetchError } = await supabase.from('site_users').select('*');
    
    if (fetchError) {
        console.error('Fetch Error:', fetchError.message);
        return;
    }
    
    console.log('Current users:', users.map(u => u.username));
    
    const superadmin = users.find(u => u.username === 'superadmin');
    if (!superadmin) {
        console.log('Superadmin user not found. Attempting to seed...');
        const { error: insertError } = await supabase.from('site_users').insert([
            { username: 'superadmin', password: 'password', role: 'superadmin', active: true }
        ]);
        if (insertError) console.error('Insert Error:', insertError.message);
        else console.log('Superadmin seeded successfully.');
    } else {
        console.log('Updating superadmin password...');
        const { error: updateError } = await supabase
            .from('site_users')
            .update({ password: 'password' })
            .eq('username', 'superadmin');

        if (updateError) console.error('Update Error:', updateError.message);
        else console.log('Password successfully reset to "password" for user: superadmin');
    }
}

resetPassword();
