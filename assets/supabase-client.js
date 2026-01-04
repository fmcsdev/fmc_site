// assets/supabase-client.js
(function () {
  const { createClient } = window.supabase;

  const SUPABASE_URL  = "https://dsbvgomhugvjruqykbmr.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYnZnb21odWd2anJ1cXlrYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzIwNzksImV4cCI6MjA3ODQ0ODA3OX0.FHX45XbBfpeNtnnCLc9wvoyxOM6w2vIIjOcIZWfb-_I";

  // SINGLETON: only create once
  if (!window.supabaseClient) {
    window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, detectSessionInUrl: true }
    });
  }
})();
