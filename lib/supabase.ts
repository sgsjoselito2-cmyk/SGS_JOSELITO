import { createClient } from '@supabase/supabase-js';

// Access variables statically so Vite AST replacement works in both dev server and prod builds
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : '') ||
  (typeof window !== 'undefined' ? localStorage.getItem('custom_supabase_url') : '') ||
  '';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : '') ||
  (typeof window !== 'undefined' ? localStorage.getItem('custom_supabase_anon_key') : '') ||
  '';

export const isConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'YOUR_SUPABASE_URL' &&
  !supabaseUrl.includes('placeholder')
);

if (!isConfigured) {
  console.warn('⚠️ Supabase URL o Anon Key no configurada. Las operaciones se manejarán en modo local.');
}

export const supabase = createClient(
  isConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isConfigured ? supabaseAnonKey : 'placeholder'
);

export const debugConfig = {
  hasUrl: isConfigured,
  urlStart: supabaseUrl ? supabaseUrl.substring(0, 15) + '...' : '',
  hasKey: !!supabaseAnonKey && supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY',
  keyLength: supabaseAnonKey ? supabaseAnonKey.length : 0,
  isVitePrefix: true,
  hasDbUrl: !!(import.meta.env.VITE_DATABASE_URL || (typeof process !== 'undefined' ? process.env?.DATABASE_URL : ''))
};

