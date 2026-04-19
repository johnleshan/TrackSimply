const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Checking the DERIV project database
const supabaseUrl = 'https://dtftgjimjpbkdgkphftl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZnRnamltanBia2Rna3BoZnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDg0NzQsImV4cCI6MjA5MjEyNDQ3NH0.0muHpi8y5UtjXj-VBEfLKkLxtLp2flbpgEXhd0hRihQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDeriv() {
    console.log('--- Checking DERIV Database ---');
    const { error } = await supabase.from('site_users').select('count', { count: 'exact', head: true });
    if (error) {
        console.error('✖ site_users NOT found in Deriv project:', error.message);
    } else {
        console.log('✔ site_users EXISTS in Deriv project.');
    }
}

checkDeriv();
