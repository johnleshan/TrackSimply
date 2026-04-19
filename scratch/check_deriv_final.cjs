const { createClient } = require('@supabase/supabase-js');

const derivUrl = 'https://dtftgjimjpbkdgkphftl.supabase.co';
const derivKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZnRnamltanBia2Rna3BoZnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDg0NzQsImV4cCI6MjA5MjEyNDQ3NH0.0muHpi8y5UtjXj-VBEfLKkLxtLp2flbpgEXhd0hRihQ';

const supabase = createClient(derivUrl, derivKey);

async function check() {
    console.log('--- Checking Deriv Database ---');
    const { data: users, error } = await supabase.from('site_users').select('*');
    if (error) {
        console.log('✖ site_users NOT found in Deriv:', error.message);
    } else {
        console.log(`✔ Found ${users.length} users in Deriv.`);
        users.forEach(u => console.log(`- ${u.username} : ${u.password}`));
    }
}

check();
