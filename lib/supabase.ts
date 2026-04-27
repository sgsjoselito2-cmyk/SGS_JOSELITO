import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'YOUR_SUPABASE_URL');

export const debugConfig = {
  hasUrl: !!supabaseUrl && supabaseUrl !== 'YOUR_SUPABASE_URL',
  urlStart: supabaseUrl ? supabaseUrl.substring(0, 15) + '...' : '',
  hasKey: !!supabaseAnonKey && supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY',
  keyLength: supabaseAnonKey ? supabaseAnonKey.length : 0,
  isVitePrefix: true, // They are since we access them via import.meta.env
  hasDbUrl: !!(import.meta as any).env?.DATABASE_URL
};
