import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Configure the Supabase environment before running this diagnostic.");
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  console.log("Calling a dummy RPC...");
  const { data, error } = await supabase.rpc("dummy_rpc_call_that_should_fail");
  console.log("dummy_rpc result:", { data, error });
}

check();
