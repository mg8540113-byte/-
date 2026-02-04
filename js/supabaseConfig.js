// Supabase Configuration
const SUPABASE_URL = 'https://wnooqfntgkeoeolpzckm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gqXM5VZ6Q0ozAcjAULlACg_BGv_jFho';

// Initialize client
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
