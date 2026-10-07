function getSupabaseConfig() {
  return {
    projectRef: process.env.SUPABASE_PROJECT_REF || '',
    url: process.env.SUPABASE_URL || '',
    hasAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
  };
}

module.exports = { getSupabaseConfig };
