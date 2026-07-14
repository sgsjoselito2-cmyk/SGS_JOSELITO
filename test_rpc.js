import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const rpcs = ['exec_sql', 'execute_sql', 'run_sql', 'sql'];
  for (const rpc of rpcs) {
    try {
      const { data, error } = await supabase.rpc(rpc, { sql: 'SELECT NOW();' });
      if (error) {
        // Also try with 'query' parameter
        const { data: data2, error: error2 } = await supabase.rpc(rpc, { query: 'SELECT NOW();' });
        if (error2) {
          console.log(`RPC ${rpc} failed:`, error.message, error2.message);
        } else {
          console.log(`RPC ${rpc} SUCCESS with 'query':`, data2);
          return;
        }
      } else {
        console.log(`RPC ${rpc} SUCCESS with 'sql':`, data);
        return;
      }
    } catch (e) {
      console.log(`RPC ${rpc} threw error:`, e.message);
    }
  }
}

run();
