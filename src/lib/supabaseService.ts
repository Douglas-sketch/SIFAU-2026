import { supabase, addLog } from './supabase';
import { Profile, Denuncia, Relatorio, AutoInfracao, HistoricoAtividade, Mensagem, EvidenciaFoto } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

/* eslint-disable @typescript-eslint/no-explicit-any */

let supabaseReady = false;


function appendMatriculaToDescricao(descricao: string, matricula?: string): string {
  if (!matricula) return descricao || '';
  const clean = matricula.trim().toUpperCase();
  if (!clean) return descricao || '';
  const prefix = `[MATRICULA:${clean}]`;
  if ((descricao || '').startsWith(prefix)) return descricao || '';
  return `${prefix} ${descricao || ''}`.trim();
}

function extractMatriculaFromDescricao(descricao: string): { matricula?: string; descricaoLimpa: string } {
  const text = descricao || '';
  const match = text.match(/^\[MATRICULA:([A-Z0-9-]+)\]\s*/);
  if (!match) return { descricaoLimpa: text };
  return { matricula: match[1], descricaoLimpa: text.replace(match[0], '').trim() };
}


// ============================================
// HEALTH CHECK
// ============================================
export async function checkConnection(): Promise<boolean> {
  if (!supabase) {
    addLog('❌ Cliente Supabase não existe');
    return false;
  }

  try {
    addLog('🔍 Testando conexão...');

    // Preferir user_accounts (contas de e-mail), com fallback para profiles.
    const { data: uaData, error: uaError } = await supabase
      .from('user_accounts')
      .select('id, email')
      .limit(1);

    if (!uaError) {
      addLog(`✅ Supabase OK via user_accounts (${uaData?.length || 0} registro(s) lido(s)).`);
      supabaseReady = true;
      return true;
    }

    const { data: pfData, error: pfError } = await supabase
      .from('profiles')
      .select('id, nome')
      .limit(1);

    if (!pfError) {
      addLog(`✅ Supabase OK via profiles (${pfData?.length || 0} registro(s) lido(s)).`);
      supabaseReady = true;
      return true;
    }

    const error = pfError || uaError;
    addLog(`❌ Erro: ${error?.message || 'Falha desconhecida'}`);
    if (error?.code === '42P01' || (error?.message || '').includes('relation')) {
      addLog('⚠️ Tabelas esperadas não encontradas (profiles/user_accounts). Verifique o schema no projeto atual.');
    }
    if ((error?.message || '').includes('FetchError') || (error?.message || '').includes('fetch')) {
      addLog('⚠️ Servidor não acessível. Verifique URL/projeto/rede.');
    }
    if ((error?.message || '').includes('JWT') || (error?.message || '').includes('apikey')) {
      addLog('⚠️ Chave API inválida ou sem permissão.');
    }
    supabaseReady = false;
    return false;
  } catch (e: any) {
    addLog(`❌ Exceção: ${e?.message || String(e)}`);
    supabaseReady = false;
    return false;
  }
}

function ok() {
  return !!supabase;
}

// ============================================
// PROFILES
// ============================================
export async function loginUser(matricula: string, senha: string): Promise<Profile | null> {
  if (!ok()) return null;
  try {
    const { data, error } = await supabase!
      .from('profiles')
      .select('*')
      .ilike('matricula', matricula)
      .eq('senha', senha)
      .single();

    if (error || !data) {
      addLog(`⚠️ Login Supabase falhou: ${matricula}`);
      return null;
    }

    await supabase!.from('profiles').update({ status: 'online' }).eq('id', data.id);
    addLog(`✅ Login Supabase OK: ${data.nome}`);
    return mapProfile(data);
  } catch (e: any) {
    addLog(`❌ Erro login: ${e?.message}`);
    return null;
  }
}

export async function logoutUser(userId: string): Promise<void> {
  if (!ok()) return;
  try {
    await supabase!.from('profiles').update({ status: 'offline' }).eq('id', userId);
  } catch { /* */ }
}

export async function getAllProfiles(): Promise<Profile[]> {
  if (!ok()) return [];
  try {
    const { data } = await supabase!.from('profiles').select('*').order('nome');
    return (data || []).map(mapProfile);
  } catch { return []; }
}

export async function updateProfileStatus(userId: string, status: string): Promise<void> {
  if (!ok()) return;
  try {
    await supabase!.from('profiles').update({ status }).eq('id', userId);
  } catch { /* */ }
}

export async function updateProfilePontos(userId: string, pontos: number): Promise<void> {
  if (!ok()) return;
  try {
    await supabase!.from('profiles').update({ pontos }).eq('id', userId);
  } catch { /* */ }
}


export async function getProfileById(profileId: string): Promise<Profile | null> {
  if (!ok()) return null;
  try {
    const { data } = await supabase!
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .maybeSingle();
    return data ? mapProfile(data) : null;
  } catch { return null; }
}

export async function upsertProfile(profile: Profile): Promise<void> {
  if (!ok()) return;
  try {
    await supabase!.from('profiles').upsert({
      id: profile.id,
      nome: profile.nome,
      tipo: profile.tipo,
      matricula: profile.matricula,
      senha: profile.senha,
      status: profile.status_online,
      pontos: profile.pontos_total,
      latitude: profile.lat || null,
      longitude: profile.lng || null,
      updated_at: new Date().toISOString(),
    });
  } catch { /* */ }
}

// ============================================
// DENÚNCIAS
// ============================================
export async function getAllDenuncias(): Promise<Denuncia[]> {
  if (!ok()) return [];
  try {
    const { data } = await supabase!
      .from('denuncias')
      .select('*')
      .order('created_at', { ascending: false });

    const mapped = (data || []).map(mapDenuncia);
    if (!mapped.length) return mapped;

    const fotosMap = await getFotosMap(mapped.map(d => d.id));
    return mapped.map(d => ({ ...d, fotos: fotosMap.get(d.id) || d.fotos || [] }));
  } catch { return []; }
}

export async function createDenuncia(d: Denuncia): Promise<Denuncia | null> {
  if (!ok()) return null;
  try {
    const insertData: Record<string, any> = {
      id: d.id,
      protocolo: d.protocolo,
      tipo: d.tipo,
      descricao: appendMatriculaToDescricao(d.descricao || '', d.denunciante_matricula),
      endereco: d.endereco || '',
      latitude: d.lat || 0,
      longitude: d.lng || 0,
      status: d.status || 'pendente',
      denunciante_nome: d.denunciante_nome || null,
      denunciante_anonimo: d.denunciante_anonimo || false,
      sla_horas: (d.sla_dias || 3) * 24,
      pontos_provisorio: d.pontos_provisorio || 0,
      auth_email: d.auth_email || null,
      ia_tipo_sugerido: d.ia_tipo_sugerido || null,
      ia_urgencia_sugerida: d.ia_urgencia_sugerida || null,
    };
    addLog(`📝 Criando denúncia: ${d.protocolo} (email: ${d.auth_email || 'N/A'})`);
    const { data, error } = await supabase!.from('denuncias').insert(insertData).select().single();
    if (error) { addLog(`❌ Erro criar denúncia: ${error.message} | Code: ${error.code}`); return null; }

    if (Array.isArray(d.fotos) && d.fotos.length > 0) {
      const fotosRows = d.fotos.map((base64, idx) => ({
        id: `foto-${d.id}-${idx}-${Date.now()}`,
        denuncia_id: d.id,
        base64,
        tipo: 'denuncia',
      }));
      const { error: fotosError } = await supabase!.from('fotos').insert(fotosRows);
      if (fotosError) addLog(`⚠️ Erro ao salvar fotos da denúncia ${d.protocolo}: ${fotosError.message}`);
    }

    addLog(`✅ Denúncia criada no Supabase: ${d.protocolo}`);
    return data ? { ...mapDenuncia(data), fotos: d.fotos || [] } : null;
  } catch (e: any) { addLog(`❌ Exceção criar denúncia: ${e?.message}`); return null; }
}

export async function updateDenuncia(id: string, updates: Partial<Record<string, any>>): Promise<boolean> {
  if (!ok()) return false;
  try {
    const { error } = await supabase!.from('denuncias').update(updates).eq('id', id);
    if (error) {
      addLog(`❌ Erro update denúncia: ${error.message}`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ============================================
// RELATÓRIOS
// ============================================
export async function getAllRelatorios(): Promise<Relatorio[]> {
  if (!ok()) return [];
  try {
    const { data } = await supabase!
      .from('relatorios')
      .select('*')
      .order('created_at', { ascending: false });
    return (data || []).map(mapRelatorio);
  } catch { return []; }
}

export async function getRelatorio(denunciaId: string): Promise<Relatorio | null> {
  if (!ok()) return null;
  try {
    const { data } = await supabase!
      .from('relatorios')
      .select('*')
      .eq('denuncia_id', denunciaId)
      .maybeSingle();
    return data ? mapRelatorio(data) : null;
  } catch { return null; }
}

export async function upsertRelatorio(r: Relatorio): Promise<void> {
  if (!ok()) return;
  try {
    await supabase!.from('relatorios').upsert({
      id: r.id,
      denuncia_id: r.denuncia_id,
      fiscal_id: r.fiscal_id,
      texto: r.texto,
      assinatura_base64: r.assinatura_base64,
      dados_extras: {
        os_2_0: r.os_2_0,
        os_4_0: r.os_4_0,
        fotos: r.fotos || [],
        evidencia_fotos: r.evidencia_fotos || [],
      },
      created_at: r.created_at,
    });
  } catch { /* */ }
}

export async function syncFiscalEvidencePhotos(
  denunciaId: string,
  fiscalId: string,
  evidencias: EvidenciaFoto[],
  photosBase64: string[]
): Promise<void> {
  if (!ok() || !denunciaId || !fiscalId || !evidencias.length || !photosBase64.length) return;
  try {
    for (let i = 0; i < Math.min(evidencias.length, photosBase64.length); i++) {
      const ev = evidencias[i];
      const base64 = photosBase64[i];
      const safeName = (ev.file_name || `evidencia-${i + 1}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${denunciaId}/${Date.now()}-${i}-${safeName}`;

      try {
        const raw = base64.includes(',') ? base64.split(',')[1] : base64;
        const bin = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
        await supabase!.storage.from('evidencias').upload(path, bin, { contentType: 'image/jpeg', upsert: true });
      } catch {
        // storage opcional: não interromper fluxo existente
      }

      await supabase!.from('fotos').upsert({
        id: `foto-evid-${denunciaId}-${ev.file_hash.slice(0, 12)}-${i}`,
        denuncia_id: denunciaId,
        base64,
        tipo: 'relatorio',
        file_name: ev.file_name || safeName,
        file_hash: ev.file_hash,
        captured_at: ev.captured_at,
        capture_lat: ev.capture_lat ?? null,
        capture_lng: ev.capture_lng ?? null,
        uploaded_by: fiscalId,
        storage_path: path,
      });
    }
  } catch {
    // silencioso por requisito
  }
}

// ============================================
// AUTOS DE INFRAÇÃO
// ============================================
export async function getAllAutos(): Promise<AutoInfracao[]> {
  if (!ok()) return [];
  try {
    const { data } = await supabase!
      .from('autos_infracao')
      .select('*')
      .order('created_at', { ascending: false });
    return (data || []).map(mapAuto);
  } catch { return []; }
}

export async function getAutosByDenuncia(denunciaId: string): Promise<AutoInfracao[]> {
  if (!ok()) return [];
  try {
    const { data } = await supabase!
      .from('autos_infracao')
      .select('*')
      .eq('denuncia_id', denunciaId);
    return (data || []).map(mapAuto);
  } catch { return []; }
}

export async function createAuto(a: AutoInfracao): Promise<void> {
  if (!ok()) return;
  try {
    await supabase!.from('autos_infracao').insert({
      id: a.id,
      denuncia_id: a.denuncia_id,
      fiscal_id: a.fiscal_id,
      tipo: a.tipo,
      valor: a.valor,
      embargo: a.embargo,
      created_at: a.created_at,
    });
  } catch { /* */ }
}

// ============================================
// HISTÓRICO
// ============================================
export async function getHistoricoByFiscal(fiscalId: string): Promise<HistoricoAtividade[]> {
  if (!ok()) return [];
  try {
    const { data } = await supabase!
      .from('historico_atividades')
      .select('*')
      .eq('fiscal_id', fiscalId)
      .order('created_at', { ascending: false });
    return (data || []).map(mapHistorico);
  } catch { return []; }
}

export async function createHistorico(h: HistoricoAtividade): Promise<void> {
  if (!ok()) return;
  try {
    await supabase!.from('historico_atividades').insert({
      id: h.id,
      fiscal_id: h.fiscal_id,
      denuncia_id: h.denuncia_id,
      tipo: h.tipo_acao,
      descricao: h.descricao,
      pontos: h.pontos,
      created_at: h.created_at,
    });
  } catch { /* */ }
}

export async function getAllHistorico(): Promise<HistoricoAtividade[]> {
  if (!ok()) return [];
  try {
    const { data } = await supabase!
      .from('historico_atividades')
      .select('*')
      .order('created_at', { ascending: false });
    return (data || []).map(mapHistorico);
  } catch { return []; }
}

// ============================================
// FOTOS
// ============================================
export async function getFotosByDenuncia(denunciaId: string): Promise<string[]> {
  if (!ok()) return [];
  try {
    const { data } = await supabase!
      .from('fotos')
      .select('base64')
      .eq('denuncia_id', denunciaId)
      .order('created_at');
    return (data || []).map((f: any) => f.base64);
  } catch { return []; }
}

export async function createFoto(denunciaId: string, base64: string, tipo: string = 'denuncia'): Promise<void> {
  if (!ok()) return;
  try {
    await supabase!.from('fotos').insert({
      id: `foto-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      denuncia_id: denunciaId,
      base64,
      tipo,
    });
  } catch { /* */ }
}

async function getFotosMap(denunciaIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!ok() || !denunciaIds.length) return map;
  try {
    const { data } = await supabase!
      .from('fotos')
      .select('denuncia_id, base64, tipo')
      .in('denuncia_id', denunciaIds)
      .eq('tipo', 'denuncia')
      .order('created_at', { ascending: true });

    (data || []).forEach((row: any) => {
      const current = map.get(row.denuncia_id) || [];
      current.push(row.base64);
      map.set(row.denuncia_id, current);
    });
  } catch { /* */ }
  return map;
}

// ============================================
// MENSAGENS
// ============================================
export async function getMensagens(userId: string): Promise<Mensagem[]> {
  if (!ok()) return [];
  try {
    const { data } = await supabase!
      .from('mensagens')
      .select('*')
      .or(`de_id.eq.${userId},para_id.eq.${userId}`)
      .order('created_at', { ascending: true });
    return (data || []).map(mapMensagem);
  } catch { return []; }
}

export async function enviarMensagem(msg: {
  de_id: string;
  para_id: string;
  de_nome: string;
  para_nome: string;
  texto: string;
  denuncia_id?: string;
}): Promise<Mensagem | null> {
  if (!ok()) return null;
  try {
    const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const { data, error } = await supabase!.from('mensagens').insert({
      id,
      de_id: msg.de_id,
      para_id: msg.para_id,
      de_nome: msg.de_nome,
      para_nome: msg.para_nome,
      texto: msg.texto,
      denuncia_id: msg.denuncia_id || null,
      lida: false,
    }).select().single();
    if (error) { addLog(`❌ Erro enviar msg: ${error.message}`); return null; }
    return data ? mapMensagem(data) : null;
  } catch (e: any) { addLog(`❌ Erro enviar msg: ${e?.message}`); return null; }
}

export async function marcarMensagensComoLidas(userId: string, deId: string): Promise<void> {
  if (!ok()) return;
  try {
    await supabase!
      .from('mensagens')
      .update({ lida: true })
      .eq('para_id', userId)
      .eq('de_id', deId);
  } catch { /* */ }
}

// ============================================
// REALTIME
// ============================================
export function subscribeToMensagens(
  userId: string,
  onNewMessage: (msg: Mensagem) => void
): RealtimeChannel | null {
  if (!ok()) return null;
  try {
    return supabase!
      .channel(`msgs-${userId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensagens',
        filter: `para_id=eq.${userId}`,
      }, (payload) => { onNewMessage(mapMensagem(payload.new)); })
      .subscribe();
  } catch { return null; }
}

export function subscribeToDenuncias(
  onUpdate: (d: Denuncia) => void
): RealtimeChannel | null {
  if (!ok()) return null;
  try {
    return supabase!
      .channel(`den-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'denuncias',
      }, (payload) => {
        if (payload.new) onUpdate(mapDenuncia(payload.new as any));
      })
      .subscribe();
  } catch { return null; }
}

export function unsubscribe(channel: RealtimeChannel | null): void {
  if (channel && supabase) {
    try { supabase.removeChannel(channel); } catch { /* */ }
  }
}

// ============================================
// USER ACCOUNTS (per-email registration)
// ============================================
export async function deleteUserAccount(email: string): Promise<boolean> {
  if (!ok() || !email || email === 'anonymous') return false;
  try {
    // Mark as scheduled for deletion (30 day recovery)
    const { error } = await supabase!.from('user_accounts').update({
      scheduled_deletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('email', email);
    if (error) {
      addLog(`❌ Erro agendar exclusão: ${error.message}`);
      return false;
    }
    // Delete denuncias by this email
    await supabase!.from('denuncias').delete().eq('auth_email', email);
    addLog(`✅ Conta ${email} agendada para exclusão em 30 dias`);
    return true;
  } catch (e: any) {
    addLog(`❌ Exceção exclusão: ${e?.message}`);
    return false;
  }
}

export async function registerUserAccount(
  email: string,
  provider: string = 'email',
  password?: string,
  opts?: { accessType?: 'denunciante' | 'servidor'; serverType?: 'fiscal' | 'gerente' | null }
): Promise<void> {
  // NÃO depende de ok() — tenta SEMPRE salvar no Supabase diretamente
  if (!supabase || !email || email === 'anonymous') {
    addLog(`⚠️ registerUserAccount: sem supabase ou email inválido (${email})`);
    return;
  }
  try {
    addLog(`📧 Registrando conta no Supabase: ${email}...`);
    
    // Tentar upsert direto
    const payload: Record<string, any> = {
      id: `ua-${email.replace(/[^a-z0-9]/gi, '-')}`,
      email: email.toLowerCase(),
      provider,
      ultimo_acesso: new Date().toISOString(),
      dispositivo: navigator.userAgent.substring(0, 100),
    };
    if (provider === 'email' && password) payload.senha = password;
    if (opts?.accessType) payload.access_type = opts.accessType;
    if (opts?.serverType !== undefined) payload.server_type = opts.serverType;

    const { error } = await supabase
      .from('user_accounts')
      .upsert(payload, { onConflict: 'email' });

    if (error) {
      addLog(`⚠️ Upsert falhou: ${error.message}, tentando insert...`);
      // Fallback: tentar insert simples
      const insertPayload: Record<string, any> = {
        id: `ua-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        email: email.toLowerCase(),
        provider,
        dispositivo: navigator.userAgent.substring(0, 100),
      };
      if (provider === 'email' && password) insertPayload.senha = password;
      if (opts?.accessType) insertPayload.access_type = opts.accessType;
      if (opts?.serverType !== undefined) insertPayload.server_type = opts.serverType;

      const { error: insertError } = await supabase
        .from('user_accounts')
        .insert(insertPayload);
      if (insertError) {
        // Pode ser duplicata - tentar update
        if (insertError.message.includes('duplicate') || insertError.code === '23505') {
          const updatePayload: Record<string, any> = {
            ultimo_acesso: new Date().toISOString(),
            dispositivo: navigator.userAgent.substring(0, 100),
          };
          if (provider === 'email' && password) updatePayload.senha = password;
          if (opts?.accessType) updatePayload.access_type = opts.accessType;
          if (opts?.serverType !== undefined) updatePayload.server_type = opts.serverType;

          await supabase
            .from('user_accounts')
            .update(updatePayload)
            .eq('email', email.toLowerCase());
          addLog(`✅ Conta atualizada: ${email}`);
        } else {
          addLog(`❌ Erro insert conta: ${insertError.message}`);
        }
      } else {
        addLog(`✅ Conta inserida: ${email}`);
      }
    } else {
      addLog(`✅ Conta registrada (upsert): ${email}`);
    }
  } catch (e: any) {
    addLog(`❌ Exceção registrar conta: ${e?.message}`);
  }
}

export async function getAccountAccessByEmail(email: string): Promise<{ accessType: 'denunciante' | 'servidor'; serverType: 'fiscal' | 'gerente' | null }> {
  if (!supabase || !email) return { accessType: 'denunciante', serverType: null };
  const cleanEmail = email.trim().toLowerCase();
  try {
    const { data: ua } = await supabase
      .from('user_accounts')
      .select('access_type, server_type')
      .eq('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    if (ua?.access_type === 'servidor') {
      return { accessType: 'servidor', serverType: (ua.server_type as 'fiscal' | 'gerente' | null) || null };
    }

    const { data: appUser } = await supabase
      .from('app_users')
      .select('access_type, server_type')
      .eq('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    if (appUser?.access_type === 'servidor') {
      return { accessType: 'servidor', serverType: (appUser.server_type as 'fiscal' | 'gerente' | null) || null };
    }

    const fiscalId = `fsc-${cleanEmail.replace(/[^a-z0-9]/gi, '-')}`.slice(0, 60);
    const gerenteId = `ger-${cleanEmail.replace(/[^a-z0-9]/gi, '-')}`.slice(0, 60);
    const { data: prof } = await supabase
      .from('profiles')
      .select('tipo')
      .in('id', [fiscalId, gerenteId])
      .limit(1);

    const serverTipo = (prof || []).find((p: any) => p?.tipo === 'fiscal' || p?.tipo === 'gerente')?.tipo;
    if (serverTipo) return { accessType: 'servidor', serverType: serverTipo };

    return { accessType: 'denunciante', serverType: null };
  } catch {
    return { accessType: 'denunciante', serverType: null };
  }
}

export async function userAccountExists(email: string): Promise<boolean> {
  if (!supabase || !email || email === 'anonymous') return false;
  try {
    const { data, error } = await supabase
      .from('user_accounts')
      .select('email')
      .eq('email', email.toLowerCase())
      .limit(1)
      .maybeSingle();
    if (!error && data) return true;

    const { data: appUser, error: appErr } = await supabase
      .from('app_users')
      .select('email')
      .eq('email', email.toLowerCase())
      .limit(1)
      .maybeSingle();

    if (appErr) return false;
    return !!appUser;
  } catch {
    return false;
  }
}

export async function checkUserAccountCredentials(
  email: string,
  password: string
): Promise<'ok' | 'wrong_password' | 'not_found'> {
  if (!supabase || !email || email === 'anonymous') return 'not_found';
  try {
    const { data, error } = await supabase
      .from('user_accounts')
      .select('email, senha')
      .eq('email', email.toLowerCase())
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      if ((data.senha || '') !== password) return 'wrong_password';
      return 'ok';
    }

    const { data: appData, error: appError } = await supabase
      .from('app_users')
      .select('email, senha_legacy')
      .eq('email', email.toLowerCase())
      .limit(1)
      .maybeSingle();

    if (appError || !appData) return 'not_found';
    if ((appData.senha_legacy || '') !== password) return 'wrong_password';
    return 'ok';
  } catch {
    return 'not_found';
  }
}

export async function ensureServerAccessByEmail(
  email: string,
  password: string,
  tipo: 'fiscal' | 'gerente' = 'fiscal'
): Promise<{ matricula: string; profileId: string } | null> {
  if (!supabase || !email || !password) return null;
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanSenha = password.trim();
    const prefix = tipo === 'gerente' ? 'GER' : 'FSC';
    const profileId = `${prefix.toLowerCase()}-${cleanEmail.replace(/[^a-z0-9]/gi, '-')}`.slice(0, 60);
    const nome = cleanEmail.split('@')[0] || (tipo === 'gerente' ? 'Gerente' : 'Fiscal');

    const { data: existing } = await supabase
      .from('profiles')
      .select('id, matricula')
      .eq('id', profileId)
      .maybeSingle();

    if (existing?.matricula) {
      await supabase.from('profiles').update({ senha: cleanSenha, tipo }).eq('id', profileId);
      return { matricula: existing.matricula, profileId };
    }

    const { data: rows } = await supabase
      .from('profiles')
      .select('matricula')
      .ilike('matricula', `${prefix}-%`);

    const maxCode = (rows || []).reduce((acc: number, row: any) => {
      const m = (row?.matricula || '').toUpperCase().match(new RegExp(`^${prefix}-(\\d+)$`));
      if (!m) return acc;
      return Math.max(acc, Number(m[1]));
    }, 0);

    const matricula = `${prefix}-${String(maxCode + 1).padStart(3, '0')}`;
    const payload = {
      id: profileId,
      nome,
      tipo,
      matricula,
      senha: cleanSenha,
      status: 'offline',
      pontos: 0,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').upsert(payload);
    if (error) {
      addLog(`❌ ensureServerAccessByEmail: ${error.message}`);
      return null;
    }

    addLog(`✅ Acesso servidor criado para ${cleanEmail}: ${matricula}`);
    return { matricula, profileId };
  } catch (e: any) {
    addLog(`❌ ensureServerAccessByEmail exceção: ${e?.message || e}`);
    return null;
  }
}

export async function listRegisteredAccounts(): Promise<Array<{
  email: string;
  provider?: string;
  access_type?: string;
  server_type?: string | null;
}>> {
  if (!supabase) return [];
  try {
    const { data: uaData, error: uaError } = await supabase
      .from('user_accounts')
      .select('email, provider, access_type, server_type')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!uaError && Array.isArray(uaData) && uaData.length > 0) {
      return uaData.map((r: any) => ({
        email: r.email,
        provider: r.provider,
        access_type: r.access_type,
        server_type: r.server_type,
      }));
    }

    const { data: appData, error: appError } = await supabase
      .from('app_users')
      .select('email, provider, access_type, server_type')
      .order('created_at', { ascending: false })
      .limit(100);

    if (appError || !Array.isArray(appData)) return [];
    return appData.map((r: any) => ({
      email: r.email,
      provider: r.provider,
      access_type: r.access_type,
      server_type: r.server_type,
    }));
  } catch {
    return [];
  }
}

// ============================================
// MAPPERS
// ============================================
function mapProfile(r: any): Profile {
  return {
    id: r.id,
    nome: r.nome,
    tipo: r.tipo,
    matricula: r.matricula,
    senha: r.senha,
    status_online: r.status || 'offline',
    pontos_total: r.pontos || 0,
    lat: r.latitude,
    lng: r.longitude,
  };
}

function mapDenuncia(r: any): Denuncia {
  const parsed = extractMatriculaFromDescricao(r.descricao || '');
  return {
    id: r.id,
    protocolo: r.protocolo,
    tipo: r.tipo,
    endereco: r.endereco || '',
    lat: r.latitude || 0,
    lng: r.longitude || 0,
    descricao: parsed.descricaoLimpa,
    status: r.status || 'pendente',
    sla_dias: r.sla_horas ? Math.ceil(r.sla_horas / 24) : 3,
    fiscal_id: r.fiscal_id || undefined,
    gerente_id: r.gerente_id || undefined,
    denunciante_nome: r.denunciante_nome,
    denunciante_matricula: parsed.matricula,
    denunciante_anonimo: r.denunciante_anonimo || false,
    created_at: r.created_at,
    updated_at: r.updated_at || r.created_at,
    pontos_provisorio: r.pontos_provisorio || 0,
    fotos: [],
    motivo_rejeicao: r.motivo_rejeicao,
    auth_email: r.auth_email || '',
    ia_tipo_sugerido: r.ia_tipo_sugerido || undefined,
    ia_urgencia_sugerida: r.ia_urgencia_sugerida || undefined,
  };
}

function mapRelatorio(r: any): Relatorio {
  const extras = r.dados_extras || {};
  return {
    id: r.id,
    denuncia_id: r.denuncia_id,
    fiscal_id: r.fiscal_id,
    texto: r.texto,
    assinatura_base64: r.assinatura_base64,
    fotos: extras.fotos || [],
    os_2_0: extras.os_2_0 || false,
    os_4_0: extras.os_4_0 || false,
    evidencia_fotos: extras.evidencia_fotos || [],
    created_at: r.created_at,
  };
}

function mapAuto(r: any): AutoInfracao {
  return {
    id: r.id,
    denuncia_id: r.denuncia_id,
    fiscal_id: r.fiscal_id,
    valor: Number(r.valor),
    tipo: r.tipo,
    embargo: r.embargo,
    created_at: r.created_at,
  };
}

function mapHistorico(r: any): HistoricoAtividade {
  return {
    id: r.id,
    fiscal_id: r.fiscal_id,
    denuncia_id: r.denuncia_id || '',
    tipo_acao: r.tipo,
    descricao: r.descricao,
    pontos: r.pontos || 0,
    created_at: r.created_at,
  };
}

function mapMensagem(r: any): Mensagem {
  return {
    id: r.id,
    de_id: r.de_id,
    para_id: r.para_id,
    de_nome: r.de_nome || '',
    para_nome: r.para_nome || '',
    texto: r.texto,
    lida: r.lida,
    created_at: r.created_at,
    denuncia_id: r.denuncia_id,
  };
}
