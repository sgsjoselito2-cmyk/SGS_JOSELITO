
import { createClient } from '@supabase/supabase-js';

// Acceso seguro a variables de entorno
const url = import.meta.env.VITE_SUPABASE_URL || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || '';

// Determinar si la configuración es válida
export const isConfigured = url && url.startsWith('https://') && key && key.length > 20 && !url.includes('placeholder');

// Valores para depuración (enmascarados)
export const debugConfig = {
  hasUrl: !!url,
  urlStart: url ? url.substring(0, 15) + '...' : 'N/A',
  hasKey: !!key,
  keyLength: key ? key.length : 0,
  isVitePrefix: url ? true : false, // Si llegamos aquí es que Vite las ha detectado
  hasDbUrl: !!(process.env.DATABASE_URL || import.meta.env.VITE_DATABASE_URL)
};

// Inicializar con valores seguros para evitar excepciones
const safeUrl = isConfigured ? url : 'https://placeholder.supabase.co';
const safeKey = isConfigured ? key : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: (key) => localStorage.removeItem(key),
    }
  }
});
