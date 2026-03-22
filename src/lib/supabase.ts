import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Credenciais do Supabase (somente via variáveis de ambiente)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
  addLog('⚠️ Supabase não configurado — defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Modo offline ativo.');
}

export { supabase, addLog };
