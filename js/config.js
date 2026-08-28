// Paste these from your Supabase project: Settings → API.
// The anon key is meant to be public — row level security is what keeps one
// account out of another's data, so run db/schema.sql before signing up.
// Leave them empty and the app just stays local.
const CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
};

CONFIG.ready = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
