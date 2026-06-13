(function () {
  const SUPABASE_URL = 'https://tnrfdpnnpmkderevaivm.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_SQHN1pg-jlHBWmvGC6e1LQ_9cWAlVwf';
  const TOTAL_RIDDLES = 100;

  const client = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

  window.CCMasterSupabase = {
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    client,
    totalRiddles: TOTAL_RIDDLES,
  };
})();
