const { createClient } = require('@supabase/supabase-js');

async function test(name, url, key) {
    console.log(`--- Testing Project: ${name} (${url}) ---`);
    const supabase = createClient(url, key);
    
    console.log('1. Testing select head...');
    const { error: e1 } = await supabase.from('site_users').select('id', { head: true, count: 'exact' });
    console.log('   Head result:', e1 ? e1.message : 'Success (Table found)');

    console.log('2. Testing select * ...');
    const { error: e2 } = await supabase.from('site_users').select('*').limit(1);
    console.log('   Select * result:', e2 ? e2.message : 'Success');
}

(async () => {
    // Project TrackSimply
    await test('TrackSimply', 'https://igdkkueacjpjngfzdofw.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnZGtrdWVhY2pwam5nZnpkb2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDc4MDcsImV4cCI6MjA5MjEyMzgwN30.AYtBku2FPmQIrmqfJosa3VwvYewdaqo9pIkQSyoUoww');
    
    // Project Deriv
    await test('Deriv', 'https://dtftgjimjpbkdgkphftl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZnRnamltanBia2Rna3BoZnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDg0NzQsImV4cCI6MjA5MjEyNDQ3NH0.0muHpi8y5UtjXj-VBEfLKkLxtLp2flbpgEXhd0hRihQ');
})();
