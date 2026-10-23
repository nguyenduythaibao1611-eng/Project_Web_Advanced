const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Cảnh báo: SUPABASE_URL hoặc SUPABASE_KEY chưa được cấu hình trong .env');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
    auth: {
        persistSession: false
    }
});

module.exports = supabase;
