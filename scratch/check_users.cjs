require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUsers() {
    const { data, error } = await supabase.from('site_users').select('username, password').eq('username', 'superadmin');
    if (error) {
        console.error('Error fetching users:', error);
    } else {
        console.log('Users found:', data);
    }
}

checkUsers();
