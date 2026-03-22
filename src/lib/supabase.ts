import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Credenciais do Supabase
// 1) Variáveis de ambiente (build-time)
// 2) Fallback runtime via localStorage (útil para builds já gerados)
const runtimeUrl = (() => {
  try {
    const win = window as any;
    return win.__SIFAU_SUPABASE_URL || localStorage.getItem('sifau_supabase_url') || '';
    return localStorage.getItem('sifau_supabase_url') || '';
  } catch {
    return '';
  }
})();
const runtimeAnonKey = (() => {
  try {
    const win = window as any;
    return win.__SIFAU_SUPABASE_ANON_KEY || localStorage.getItem('sifau_supabase_anon_key') || '';
    return localStorage.getItem('sifau_supabase_anon_key') || '';
  } catch {
    return '';
  }
})();

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || runtimeUrl;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || runtimeAnonKey;

let supabase: SupabaseClient | null = null;
export const diagnosticLog: string[] = [];

function addLog(msg: string) {
  const time = new Date().toLocaleTimeString('pt-BR');
  diagnosticLog.push(`[${time}] ${msg}`);
  console.log(msg);
  if (diagnosticLog.length > 20) diagnosticLog.shift();
}

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'sifau_auth',
      },
      realtime: {
        params: { eventsPerSecond: 10 }
      },
    });
    addLog('✅ Cliente Supabase criado');
  } catch (e: any) {
    addLog(`❌ Erro ao criar cliente: ${e?.message || e}`);
    supabase = null;
  }
} else {
  addLog('⚠️ Supabase não configurado — defina VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ou salve em localStorage (sifau_supabase_url/sifau_supabase_anon_key). Modo offline ativo.');
}

export { supabase, addLog };

export function getSupabaseConfigStatus() {
  return {
    configured: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
    url: SUPABASE_URL || '',
    usingRuntimeFallback: !!(!import.meta.env.VITE_SUPABASE_URL && runtimeUrl),
  };
}
