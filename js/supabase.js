const SUPABASE_URL = "https://rraooqedkpyhokattwdz.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_A-EAWmU0kIcDFKMb4YispA_ucX6uOOK";

export const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
