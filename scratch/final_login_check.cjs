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

async function finalDiagnostic() {
    console.log('--- Final Login Diagnostic ---');
    console.log('URL:', supabaseUrl);
    
    // Check if table exists
    const { data: users, error } = await supabase.from('site_users').select('*');
    
    if (error) {
        console.error('✖ Error fetching site_users:', error.message);
        if (error.message.includes('not found')) {
            console.log('The table site_users is MISSING. Ensure you used an UNDERSCORE (_) and not a hyphen (-).');
        }
        return;
    }
    
    if (!users || users.length === 0) {
        console.log('✖ The site_users table is EMPTY. No users to log in with.');
        return;
    }
    
    console.log(`✔ Found ${users.length} users.`);
    users.forEach(u => {
        console.log(`- User: "${u.username}", Password: "${u.password}", Active: ${u.active}`);
    });
}

finalDiagnostic();
