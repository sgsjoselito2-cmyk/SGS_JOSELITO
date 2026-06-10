import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
  return (import.meta as any).env?.[key] || (typeof process !== 'undefined' ? (process as any).env?.[key] : '') || '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL') {
  console.warn('⚠️ VITE_SUPABASE_URL no configurada. Las llamadas a Supabase fallarán con error HTML/JSON.');
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

export const isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'YOUR_SUPABASE_URL');

export const debugConfig = {
  hasUrl: !!supabaseUrl && supabaseUrl !== 'YOUR_SUPABASE_URL',
  urlStart: supabaseUrl ? supabaseUrl.substring(0, 15) + '...' : '',
  hasKey: !!supabaseAnonKey && supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY',
  keyLength: supabaseAnonKey ? supabaseAnonKey.length : 0,
  isVitePrefix: true, // They are since we access them via import.meta.env
  hasDbUrl: !!(import.meta as any).env?.DATABASE_URL
};
