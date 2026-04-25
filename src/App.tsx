import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppProvider, useApp } from './context/AppContext';
import CidadaoModule from './components/Cidadao';
import FiscalModule from './components/Fiscal';
import GerenteModule from './components/Gerente';
import Settings, { AppTheme, applyTheme, applyAccessibility, loadSettings } from './components/Settings';
import { Lock, ArrowLeft, AlertCircle, ChevronDown, Eye, EyeOff, Mail, Users, LogIn, UserPlus, Loader2, BadgeCheck } from 'lucide-react';
import { supabase, getSupabaseConfigStatus } from './lib/supabase';
import * as supa from './lib/supabaseService';
import { getProfilePhoto } from './lib/profilePhoto';
import { requestEssentialPermissions } from './lib/appPermissions';
import Logo from './components/Logo';

const THEME_GRADIENTS: Record<AppTheme, string> = {
  default: 'from-blue-800 via-blue-900 to-slate-900',
  dark: 'from-gray-800 via-gray-900 to-black',
};
type AccessType = 'denunciante' | 'servidor';

// ═══════════════════════════════════════════════════════════════
//  SISTEMA DE CONTAS — Supabase-first
// ═══════════════════════════════════════════════════════════════
type AccessType = 'denunciante' | 'servidor';

function clearSession() {}

function AuthScreen({ onAuthenticated, theme }: { onAuthenticated: (email?: string, accessType?: AccessType) => void; theme: AppTheme }) {
  const supabaseStatus = getSupabaseConfigStatus();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [, setGoogleLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accessType, setAccessType] = useState<AccessType>('denunciante');
  const [serverType, setServerType] = useState<'fiscal' | 'gerente'>('fiscal');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatedMatricula, setGeneratedMatricula] = useState<string | null>(null);
  const [pendingServerAuth, setPendingServerAuth] = useState<{ email: string; role: AccessType } | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const finishAuth = (userEmail: string, _provider: string = 'email', _userPassword?: string, profileType?: AccessType) => {
    const cleanEmail = userEmail.toLowerCase().trim();
    const resolvedType = profileType || 'denunciante';
    console.log('✅ Auth completo:', cleanEmail);
    onAuthenticated(cleanEmail, resolvedType);
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Preencha todos os campos');
      return;
    }
    setError('');
    setLoading(true);
    const e = email.trim().toLowerCase();
    const p = password.trim();

    try {
      if (supabase) {
        // 1) Login principal via tabela do app (Supabase DB), sem depender de confirmação de e-mail do Auth
        const legacyStatus = await supa.checkUserAccountCredentials(e, p);
        if (legacyStatus === 'ok') {
          const roleInfo = await supa.getAccountAccessByEmail(e);
          finishAuth(e, 'email', undefined, roleInfo.accessType);
          await supa.registerUserAccount(e, 'email', undefined, {
            accessType: roleInfo.accessType,
            serverType: roleInfo.serverType,
          });
          return;
        }

        // 2) Compatibilidade: contas que existem apenas no Supabase Auth
        const { error: authError } = await supabase.auth.signInWithPassword({ email: e, password: p });
        if (!authError) {
          const roleInfo = await supa.getAccountAccessByEmail(e);
          finishAuth(e, 'email', undefined, roleInfo.accessType);
          await supa.registerUserAccount(e, 'email', undefined, {
            accessType: roleInfo.accessType,
            serverType: roleInfo.serverType,
          });
          return;
        }

        const msg = (authError.message || '').toLowerCase();
        if (msg.includes('invalid login credentials')) {
          setError(
            legacyStatus === 'wrong_password'
              ? 'Senha incorreta. Verifique e tente novamente.'
              : 'Conta não encontrada no Auth. Se sua conta é antiga, confirme variáveis do Supabase e tabela user_accounts.'
          );
          return;
        }
        if (msg.includes('email not confirmed')) {
          setError('Conta encontrada, mas o Supabase Auth está exigindo confirmação. Para este app, entre com a senha cadastrada em user_accounts.');
          return;
        }

        setError('Não foi possível validar seu login agora. Tente novamente em instantes.');
        return;
      }
      setError('Supabase não configurado para autenticação.');
    } catch {
      setError('Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Preencha todos os campos');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    if (!privacyAccepted) {
      setError('Você precisa aceitar a Política de Privacidade para continuar.');
      return;
    }
    setError('');
    setLoading(true);
    const e = email.trim().toLowerCase();
    const p = password.trim();

    try {
      if (supabase) {
        const existsRemote = await supa.userAccountExists(e);
        if (existsRemote) {
          setError('Este e-mail já está cadastrado. Faça login.');
          return;
        }
        
        // Cadastro direto no banco do app (user_accounts/app_users), sem exigir confirmação do Auth
        await supa.registerUserAccount(e, 'email', p, {
          accessType,
          serverType: accessType === 'servidor' ? serverType : null,
          lgpdConsentAt: new Date().toISOString(),
        });
        let serverMsg = '';
        let createdMatricula: string | null = null;
        if (accessType === 'servidor') {
          const created = await supa.ensureServerAccessByEmail(e, p, serverType);
          if (created?.matricula) {
            createdMatricula = created.matricula;
            serverMsg = ` Matrícula única gerada: ${created.matricula}.`;
          }
        }
        if (accessType === 'servidor' && createdMatricula) {
          setGeneratedMatricula(createdMatricula);
          setPendingServerAuth({ email: e, role: accessType });
          setSuccess(`Conta de servidor criada com sucesso!${serverMsg}`);
          setPassword('');
          setConfirmPassword('');
          return;
        }

        finishAuth(e, 'email', undefined, accessType);
        return;
      }
      setError('Supabase não configurado para cadastro.');
    } catch (_error) {
      setError('Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Digite seu e-mail para recuperar a senha');
      return;
    }
    setError('');
    setLoading(true);
    const trimmedEmail = email.trim().toLowerCase();
    try {
      if (supabase) {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: window.location.origin + window.location.pathname,
        });
        if (authError) {
          setError(authError.message);
        } else {
          setSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
          setTimeout(() => { setMode('login'); setSuccess(''); }, 4000);
        }
      } else {
        setError('Recuperação de senha indisponível sem Supabase.');
      }
    } catch (e: any) {
      setError(e?.message || 'Erro ao enviar e-mail de recuperação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`min-h-screen bg-gradient-to-br ${THEME_GRADIENTS[theme]} flex flex-col`}
    >
      <div className="flex-1 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-sm md:max-w-md">
          {/* Logo */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10, delay: 0.1 }}
            className="text-center mb-6 md:mb-8"
          >
            <Logo size={100} showText={false} className="md:hidden" />
            <Logo size={130} showText={false} className="hidden md:flex" />
            <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight mt-3">SIFAU</h1>
            <p className="text-blue-300 text-xs md:text-sm mt-1">Sistema Inteligente de Fiscalização e Atividades Urbanas</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/5 backdrop-blur-lg rounded-2xl p-5 md:p-6 border border-white/10"
          >
            {/* Tabs */}
            {mode !== 'forgot' && (
              <div className="flex bg-white/5 rounded-xl p-1 mb-5">
                <button
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); setGeneratedMatricula(null); setPendingServerAuth(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    mode === 'login' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/60 hover:text-white/80'
                  }`}
                >
                  <LogIn size={16} /> Entrar
                </button>
                <button
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); setGeneratedMatricula(null); setPendingServerAuth(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    mode === 'register' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/60 hover:text-white/80'
                  }`}
                >
                  <UserPlus size={16} /> Criar Conta
                </button>
              </div>
            )}

            {/* Title */}
            <div className="text-center mb-4">
              <h2 className="text-lg md:text-xl font-bold text-white">
                {mode === 'login' && 'Bem-vindo de volta!'}
                {mode === 'register' && 'Crie sua conta'}
                {mode === 'forgot' && 'Recuperar Senha'}
              </h2>
              <p className="text-white/50 text-xs mt-1">
                {mode === 'login' && 'Entre para acessar o SIFAU'}
                {mode === 'register' && 'Cadastre-se para usar o aplicativo'}
                {mode === 'forgot' && 'Enviaremos um link de recuperação'}
              </p>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 flex items-center gap-2 text-red-200 text-sm mb-4"
              >
                <AlertCircle size={16} className="shrink-0" /> {error}
              </motion.div>
            )}

            {!supabaseStatus.configured && (
              <div className="bg-amber-500/20 border border-amber-400/30 rounded-xl p-3 text-amber-100 text-xs mb-4">
                Supabase não configurado neste build. Defina <strong>VITE_SUPABASE_URL</strong> e <strong>VITE_SUPABASE_ANON_KEY</strong> no build
                ou configure em <code>public/runtime-config.js</code> (window.__SIFAU_SUPABASE_URL / window.__SIFAU_SUPABASE_ANON_KEY)
                ou salve no localStorage as chaves <code>sifau_supabase_url</code> e <code>sifau_supabase_anon_key</code>.
              </div>
            )}

            {/* Success */}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-500/20 border border-green-400/30 rounded-xl p-3 flex items-center gap-2 text-green-200 text-sm mb-4"
              >
                <Mail size={16} className="shrink-0" /> {success}
              </motion.div>
            )}

            {/* Form */}
            <div className="space-y-3">
              {/* Email */}
              <div>
                <label className="text-xs text-blue-200/80 mb-1 block">E-mail</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    onKeyDown={e => e.key === 'Enter' && (mode === 'forgot' ? handleForgotPassword() : mode === 'login' ? handleEmailLogin() : handleEmailRegister())}
                    className="w-full bg-white/10 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                  />
                </div>
              </div>

              {/* Password */}
              {mode !== 'forgot' && (
                <div>
                  <label className="text-xs text-blue-200/80 mb-1 block">Senha</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : 'Sua senha'}
                      onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleEmailLogin() : handleEmailRegister())}
                      className="w-full bg-white/10 border border-white/15 rounded-xl pl-10 pr-12 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              {mode === 'register' && (
                <div>
                  <label className="text-xs text-blue-200/80 mb-1 block">Confirmar Senha</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repita a senha"
                      onKeyDown={e => e.key === 'Enter' && handleEmailRegister()}
                      className="w-full bg-white/10 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                    />
                  </div>
                </div>
              )}

              {mode === 'register' && accessType === 'servidor' && (
                <div>
                  <label className="text-xs text-blue-200/80 mb-1 block">Perfil de servidor</label>
                  <select
                    value={serverType}
                    onChange={e => setServerType(e.target.value as 'fiscal' | 'gerente')}
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                  >
                    <option value="fiscal" className="text-black">Fiscal</option>
                    <option value="gerente" className="text-black">Gerente</option>
                  </select>
                </div>
              )}

              {/* Access Type */}
              {mode === 'register' && (
                <div>
                  <label className="text-xs text-blue-200/80 mb-1 block">Tipo de acesso</label>
                  <select
                    value={accessType}
                    onChange={e => setAccessType(e.target.value as AccessType)}
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                  >
                    <option value="denunciante" className="text-black">Apenas Denunciante</option>
                    <option value="servidor" className="text-black">Servidor (Fiscal/Gerente)</option>
                  </select>
                  <p className="text-[11px] text-blue-200/70 mt-1">
                    Denunciantes usam o módulo cidadão. Servidores também podem acessar área restrita com matrícula e senha.
                  </p>
                </div>
              )}

              {mode === 'register' && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                  <label className="flex items-start gap-2 text-xs text-blue-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Li e aceito a{' '}
                      <a href="/privacidade" className="underline text-blue-300 hover:text-blue-200" target="_blank" rel="noreferrer">
                        Política de Privacidade
                      </a>
                      .
                    </span>
                  </label>
                  <p className="text-[11px] text-blue-200/80">
                    Seus dados são usados apenas para registro e acompanhamento de denúncias urbanas conforme a LGPD (Lei 13.709/2018).
                  </p>
                </div>
              )}

              {/* Submit button */}
              <button
                onClick={mode === 'forgot' ? handleForgotPassword : mode === 'login' ? handleEmailLogin : handleEmailRegister}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl py-3 font-semibold transition flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> Aguarde...</>
                ) : (
                  <>
                    {mode === 'login' && <><LogIn size={18} /> Entrar</>}
                    {mode === 'register' && <><UserPlus size={18} /> Criar Conta</>}
                    {mode === 'forgot' && <><Mail size={18} /> Enviar Link</>}
                  </>
                )}
              </button>

              {generatedMatricula && (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 p-4 text-emerald-100">
                  <div className="flex items-center gap-2 mb-1">
                    <BadgeCheck size={16} className="text-emerald-300" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Matrícula gerada</span>
                  </div>
                  <p className="text-2xl font-black tracking-wider text-white">{generatedMatricula}</p>
                  <p className="text-[11px] text-emerald-100/80 mt-1">
                    Guarde esta matrícula para acesso da área de servidor.
                  </p>
                  {pendingServerAuth && (
                    <button
                      onClick={() => finishAuth(pendingServerAuth.email, 'email', undefined, pendingServerAuth.role)}
                      className="mt-3 w-full rounded-lg bg-emerald-500/80 hover:bg-emerald-400 text-emerald-950 font-semibold py-2 text-sm transition"
                    >
                      Entrar agora como servidor
                    </button>
                  )}
                </div>
              )}

              {/* Forgot password link */}
              {mode === 'login' && (
                <button
                  onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                  className="w-full text-blue-300/70 hover:text-blue-200 text-xs transition py-1"
                >
                  Esqueci minha senha
                </button>
              )}

              {/* Back to login from forgot */}
              {mode === 'forgot' && (
                <button
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  className="w-full text-blue-300/70 hover:text-blue-200 text-xs transition py-1 flex items-center justify-center gap-1"
                >
                  <ArrowLeft size={14} /> Voltar ao login
                </button>
              )}
            </div>

          </motion.div>

          {/* Footer info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-center"
          >
            <p className="text-white/20 text-[10px]">
              Ao continuar, você concorda com os Termos de Uso e Política de Privacidade do SIFAU.
            </p>
            <p className="text-white/15 text-[10px] mt-1">
              SIFAU v2.0 — Fiscalização Inteligente
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  RECUPERAR SENHA (do servidor — matrícula)
// ═══════════════════════════════════════════════════════════════
function RecuperarSenha({ onBack, theme }: { onBack: () => void; theme: AppTheme }) {
  const [email, setEmail] = useState('');
  const [matricula, setMatricula] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (email.trim() && matricula.trim()) {
      setSent(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className={`min-h-screen bg-gradient-to-br ${THEME_GRADIENTS[theme]} flex flex-col`}
    >
      <div className="p-4 lg:p-6">
        <button onClick={onBack} className="text-white/70 flex items-center gap-1 text-sm hover:text-white transition">
          <ArrowLeft size={18} /> Voltar ao Login
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm md:max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail size={32} className="text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Recuperar Senha</h1>
            <p className="text-blue-300 text-sm mt-1">Informe seus dados para recuperação</p>
          </div>

          {!sent ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-blue-200 mb-1 block">Matrícula</label>
                <input
                  value={matricula}
                  onChange={e => setMatricula(e.target.value)}
                  placeholder="Ex: FSC-001 ou GER-001"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-sm text-blue-200 mb-1 block">E-mail cadastrado</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!email.trim() || !matricula.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-60 text-white rounded-xl py-3 font-semibold transition"
              >
                Enviar Solicitação
              </button>

              <div className="bg-white/5 rounded-xl p-4 border border-white/10 mt-4">
                <p className="text-xs text-blue-300/80">
                  <strong className="text-blue-200">📧 Como funciona:</strong><br />
                  Sua solicitação será enviada ao administrador do sistema que irá redefinir sua senha e entrar em contato.
                </p>
                <p className="text-xs text-blue-300/60 mt-2">
                  Contato direto: <a href="mailto:douglasgabriel9628@gmail.com" className="text-blue-400 underline">douglasgabriel9628@gmail.com</a>
                </p>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <Mail size={40} className="text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Solicitação Enviada!</h2>
              <p className="text-blue-300 text-sm">
                Sua solicitação de recuperação de senha para a matrícula <strong className="text-white">{matricula.toUpperCase()}</strong> foi registrada.
              </p>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-left">
                <p className="text-xs text-blue-300">
                  <strong>⏱ Prazo:</strong> Até 48 horas úteis<br />
                  <strong>📧 Resposta para:</strong> {email}<br />
                  <strong>📞 Urgente:</strong> (81) 98477-6800
                </p>
              </div>
              <button
                onClick={onBack}
                className="w-full bg-white/10 border border-white/20 text-white rounded-xl py-3 font-semibold hover:bg-white/20 transition"
              >
                Voltar ao Login
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  LOGIN DO SERVIDOR (Matrícula + Senha)
// ═══════════════════════════════════════════════════════════════
function LoginScreen({ onBack, onSuccess, theme }: { onBack: () => void; onSuccess: () => void; theme: AppTheme }) {
  const { login, registerFiscalAutomatico } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [matricula, setMatricula] = useState('');
  const [emailFiscal, setEmailFiscal] = useState('');
  const [nomeFiscal, setNomeFiscal] = useState('');
  const [tipoServidor, setTipoServidor] = useState<'fiscal' | 'gerente'>('fiscal');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecuperar, setShowRecuperar] = useState(false);

  const handleLogin = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const user = await login(matricula, senha);
      if (user) {
        onSuccess();
      } else {
        setError('Matrícula ou senha inválida');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterFiscal = async () => {
    if (!emailFiscal.trim() || !senha.trim()) {
      setError('Informe e-mail e senha para criar o acesso.');
      return;
    }
    if (senha.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (senha !== confirmSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const created = await registerFiscalAutomatico(emailFiscal, senha, nomeFiscal, tipoServidor);
      if (!created) {
        setError('Não foi possível criar o acesso agora.');
        return;
      }

      setMatricula(created.matricula);
      setSuccess(`Acesso ${tipoServidor} criado com sucesso! Matrícula gerada: ${created.matricula}`);
      setMode('login');
      setConfirmSenha('');
    } catch {
      setError('Erro ao criar acesso do fiscal. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (showRecuperar) {
    return <RecuperarSenha onBack={() => setShowRecuperar(false)} theme={theme} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className={`min-h-screen bg-gradient-to-br ${THEME_GRADIENTS[theme]} flex flex-col`}
    >
      <div className="p-4 lg:p-6">
        <button onClick={onBack} className="text-white/70 flex items-center gap-1 text-sm hover:text-white transition">
          <ArrowLeft size={18} /> Voltar
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm md:max-w-md lg:max-w-lg">
          <div className="text-center mb-8">
            <Logo size={80} showText={false} className="mx-auto mb-2" />
            <h1 className="text-2xl md:text-3xl font-bold text-white">Acesso do Servidor</h1>
            <p className="text-blue-300 text-sm md:text-base mt-1">SIFAU — Fiscais e Gerentes</p>
            
            {/* Connection info removed for cleaner UI */}
          </div>

          <div className="flex bg-white/5 rounded-xl p-1 mb-4">
            <button
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-white/70'}`}
            >
              Entrar
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === 'register' ? 'bg-blue-600 text-white' : 'text-white/70'}`}
            >
              Novo Servidor
            </button>
          </div>

          <div className="space-y-4 md:space-y-5">
            {mode === 'login' ? (
              <>
                <div>
                  <label className="text-sm md:text-base text-blue-200 mb-1 block">Matrícula</label>
                  <input
                    value={matricula}
                    onChange={e => setMatricula(e.target.value)}
                    placeholder="Ex: FSC-001 ou GER-001"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 md:py-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 md:text-lg"
                  />
                </div>
                <div className="relative">
                  <label className="text-sm md:text-base text-blue-200 mb-1 block">Senha</label>
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="Digite sua senha"
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 md:py-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 md:text-lg pr-12"
                  />
                  <button
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-3 top-9 md:top-10 text-white/50 hover:text-white/80 transition"
                  >
                    {showSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm md:text-base text-blue-200 mb-1 block">E-mail do fiscal</label>
                  <input
                    type="email"
                    value={emailFiscal}
                    onChange={e => setEmailFiscal(e.target.value)}
                    placeholder="fiscal@prefeitura.gov.br"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 md:py-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 md:text-lg"
                  />
                </div>
                <div>
                  <label className="text-sm md:text-base text-blue-200 mb-1 block">Tipo de servidor</label>
                  <select
                    value={tipoServidor}
                    onChange={e => setTipoServidor(e.target.value as 'fiscal' | 'gerente')}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 md:py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 md:text-lg"
                  >
                    <option value="fiscal" className="text-black">Fiscal</option>
                    <option value="gerente" className="text-black">Gerente</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm md:text-base text-blue-200 mb-1 block">Nome (opcional)</label>
                  <input
                    value={nomeFiscal}
                    onChange={e => setNomeFiscal(e.target.value)}
                    placeholder="Nome do fiscal"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 md:py-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 md:text-lg"
                  />
                </div>
                <div className="relative">
                  <label className="text-sm md:text-base text-blue-200 mb-1 block">Senha</label>
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="Defina uma senha"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 md:py-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 md:text-lg pr-12"
                  />
                  <button
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-3 top-9 md:top-10 text-white/50 hover:text-white/80 transition"
                  >
                    {showSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <div>
                  <label className="text-sm md:text-base text-blue-200 mb-1 block">Confirmar senha</label>
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={confirmSenha}
                    onChange={e => setConfirmSenha(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 md:py-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 md:text-lg"
                  />
                </div>
              </>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 flex items-center gap-2 text-red-200 text-sm"
              >
                <AlertCircle size={16} /> {error}
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-500/20 border border-green-400/30 rounded-xl p-3 text-green-100 text-sm"
              >
                {success}
              </motion.div>
            )}

            <button
              onClick={mode === 'login' ? handleLogin : handleRegisterFiscal}
              disabled={loading || (mode === 'login' ? (!matricula.trim() || !senha.trim()) : (!emailFiscal.trim() || !senha.trim() || !confirmSenha.trim()))}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-60 text-white rounded-xl py-3 md:py-4 font-semibold transition mt-2 md:text-lg"
            >
              {loading ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar acesso fiscal'}
            </button>

            {/* Forgot password */}
            {mode === 'login' && (
              <button
                onClick={() => setShowRecuperar(true)}
                className="w-full text-blue-300/80 hover:text-blue-200 text-sm transition py-2"
              >
                Esqueci minha senha
              </button>
            )}
          </div>

          {/* Login info removed */}

          <div className="mt-6 bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-xs text-blue-300/60 text-center">
              🛡️ Acesso para servidores. Novos fiscais podem ser cadastrados automaticamente pelo e-mail.
            </p>
            <p className="text-[10px] text-blue-300/40 text-center mt-2">
              Problemas de acesso? Contate o administrador:<br />
              <a href="mailto:douglasgabriel9628@gmail.com" className="text-blue-400/60 hover:text-blue-300">
                douglasgabriel9628@gmail.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  HOME SCREEN (Cidadão ou Servidor)
// ═══════════════════════════════════════════════════════════════
function HomeScreen({ onLogin, onCidadao, onOpenSettings, onLogoutAuth, theme, canAccessServer, warning }: { 
  onLogin: () => void; 
  onCidadao: () => void; 
  onOpenSettings: () => void;
  onLogoutAuth: () => void;
  theme: AppTheme;
  canAccessServer: boolean;
  warning?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`min-h-screen bg-gradient-to-br ${THEME_GRADIENTS[theme]} flex flex-col`}
    >
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm md:max-w-lg text-center">
          {/* Logo */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10, delay: 0.2 }}
            className="mb-8"
          >
            <Logo size={120} showText={false} className="mx-auto md:hidden" />
            <Logo size={160} showText={false} className="mx-auto hidden md:flex" />
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mt-4">SIFAU</h1>
            <p className="text-blue-300 text-sm md:text-base mt-2">Sistema Inteligente de Fiscalização<br />e Atividades Urbanas</p>
          </motion.div>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3 md:space-y-4"
          >
            {/* Citizen button */}
            <button
              onClick={onCidadao}
              className="w-full bg-white/10 backdrop-blur border border-white/20 hover:bg-white/20 text-white rounded-2xl py-4 md:py-5 px-6 transition group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:bg-green-500/30 transition">
                  <Users size={24} className="text-green-400" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-base md:text-lg">Sou Cidadão</p>
                  <p className="text-xs md:text-sm text-blue-300/80">Fazer denúncia ou acompanhar</p>
                </div>
                <ChevronDown size={20} className="text-white/40 -rotate-90" />
              </div>
            </button>

            {/* Server button */}
            <button
              onClick={onLogin}
              className={`w-full backdrop-blur border rounded-2xl py-4 md:py-5 px-6 transition group ${
                canAccessServer
                  ? 'bg-blue-600/80 border-blue-500/30 hover:bg-blue-600 text-white'
                  : 'bg-slate-700/60 border-slate-500/20 text-slate-300 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-white/20 transition">
                  <Lock size={24} className="text-white" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-base md:text-lg">Sou Servidor</p>
                  <p className="text-xs md:text-sm text-blue-200/80">
                    {canAccessServer
                      ? 'Fiscal ou Gerente — Login necessário'
                      : 'Disponível somente para contas com perfil Servidor'}
                  </p>
                </div>
                <ChevronDown size={20} className="text-white/40 -rotate-90" />
              </div>
            </button>
            {!!warning && (
              <div className="bg-amber-500/20 border border-amber-400/30 rounded-xl p-3 text-amber-100 text-xs text-left">
                {warning}
              </div>
            )}
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 space-y-3"
          >
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={onOpenSettings}
                className="text-white/40 hover:text-white/70 text-xs transition flex items-center gap-1"
              >
                ⚙️ Configurações
              </button>
              <button
                onClick={onLogoutAuth}
                className="text-white/40 hover:text-red-300 text-xs transition flex items-center gap-1"
              >
                🚪 Sair da Conta
              </button>
            </div>
            <p className="text-white/30 text-[10px]">
              SIFAU v2.0 — Fiscalização Inteligente
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function PrivacyPolicyScreen({ theme }: { theme: AppTheme }) {
  return (
    <div className={`min-h-screen bg-gradient-to-br ${THEME_GRADIENTS[theme]} px-4 py-8 md:px-8`}>
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border p-6 md:p-10 space-y-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Política de Privacidade — SIFAU Ouvidoria Municipal</h1>
          <p className="text-sm text-gray-500 mt-1">Última atualização: 25/04/2026</p>
        </div>

        <section>
          <h2 className="font-semibold text-gray-900">1. Dados coletados</h2>
          <p className="text-sm text-gray-700 mt-1">
            Coletamos dados de cadastro (e-mail, perfil de acesso e registros de consentimento), dados das denúncias urbanas (conteúdo, endereço,
            anexos, status, protocolo, histórico de tramitação) e dados técnicos de acesso para segurança e auditoria.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900">2. Finalidade do tratamento</h2>
          <p className="text-sm text-gray-700 mt-1">
            Os dados são tratados para registrar, analisar e acompanhar denúncias urbanas, viabilizar comunicação com o cidadão, cumprir dever legal
            da administração pública e proteger a integridade do serviço de ouvidoria.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900">3. Retenção e descarte</h2>
          <p className="text-sm text-gray-700 mt-1">
            Os dados são mantidos pelo tempo necessário para execução do serviço público e cumprimento de obrigações legais/regulatórias. Solicitações
            de exclusão são analisadas em até 15 dias úteis, observadas hipóteses de guarda obrigatória e defesa de direitos.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900">4. Direitos do titular</h2>
          <p className="text-sm text-gray-700 mt-1">
            Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade quando aplicável, eliminação de dados tratados
            com consentimento, informação sobre compartilhamentos e revisão de decisões automatizadas, nos termos da LGPD (Lei nº 13.709/2018).
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900">5. Contato do Encarregado (DPO)</h2>
          <p className="text-sm text-gray-700 mt-1">
            E-mail: <a className="text-blue-700 underline" href="mailto:dpo@sifau.prefeitura.gov.br">dpo@sifau.prefeitura.gov.br</a><br />
            Assunto sugerido: “LGPD — Solicitação do Titular”.
          </p>
        </section>

        <div className="pt-2">
          <a href="/" className="inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800 underline">
            Voltar para o SIFAU
          </a>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  APP CONTENT — Fluxo principal
// ═══════════════════════════════════════════════════════════════
function AppContent() {
  const { currentUser, logout, setAuthEmail, authEmail } = useApp();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = checking
  const [accessType, setAccessType] = useState<AccessType>('denunciante');
  const [homeError, setHomeError] = useState('');
  const [screen, setScreen] = useState<'home' | 'login' | 'cidadao'>(() => {
    // Restaurar tela salva para não voltar à home
    const saved = sessionStorage.getItem('sifau_screen');
    if (saved === 'cidadao' || saved === 'login') return saved;
    return 'home';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('sifau_theme');
    return (saved as AppTheme) || 'default';
  });
  const isPrivacyRoute = typeof window !== 'undefined' && window.location.pathname === '/privacidade';

  // Check if user is already authenticated on load
  useEffect(() => {
    const settings = loadSettings();
    applyTheme(settings.theme || theme);
    applyAccessibility(settings);
    if (settings.theme) setTheme(settings.theme);

    async function checkAuth() {
      // Verificar sessão Supabase Auth
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.email) {
            const sessionEmail = session.user.email;
            console.log('🔄 Sessão Supabase restaurada:', sessionEmail);
            const roleInfo = await supa.getAccountAccessByEmail(sessionEmail);
            setAuthEmail(sessionEmail);
            setAccessType(roleInfo.accessType);
            supa.registerUserAccount(sessionEmail, 'session', undefined, {
              accessType: roleInfo.accessType,
              serverType: roleInfo.serverType,
            }).catch(() => {});
            setIsAuthenticated(true);
            return;
          }
        } catch { /* continue */ }
      }
      
      setIsAuthenticated(false);
    }

    checkAuth();

    // Listen for auth state changes
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user?.email) {
          const sessionEmail = session.user.email;
          supa.getAccountAccessByEmail(sessionEmail).then((roleInfo) => {
            setAuthEmail(sessionEmail);
            setAccessType(roleInfo.accessType);
            supa.registerUserAccount(sessionEmail, session.user?.app_metadata?.provider || 'email', undefined, {
              accessType: roleInfo.accessType,
              serverType: roleInfo.serverType,
            }).catch(() => {});
            setIsAuthenticated(true);
          }).catch(() => {
            setAuthEmail(sessionEmail);
            setAccessType('denunciante');
            setIsAuthenticated(true);
          });
        }
      });
      return () => subscription.unsubscribe();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistir tela atual para não resetar
  useEffect(() => {
    sessionStorage.setItem('sifau_screen', screen);
  }, [screen]);

  // Handle device back button — navigate within app instead of exiting
  useEffect(() => {
    const handlePopState = () => {
      if (showSettings) {
        setShowSettings(false);
      } else if (currentUser) {
        logout();
        setScreen('home');
      } else if (screen === 'login') {
        setScreen('home');
      } else if (screen === 'cidadao') {
        setScreen('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showSettings, currentUser, screen, logout]);

  // Android (Capacitor): intercept hardware back to avoid closing app
  useEffect(() => {
    let removeListener: (() => void) | undefined;

    const setupBackButton = async () => {
      const isCapacitor = !!(window as any).Capacitor;
      if (!isCapacitor) return;

      try {
        const { App: CapApp } = await import('@capacitor/app');
        const listener = await CapApp.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          }
          // Se não houver histórico, não fecha o app.
        });
        removeListener = () => listener.remove();
      } catch {
        // plugin indisponível no ambiente web
      }
    };

    setupBackButton();
    return () => removeListener?.();
  }, []);

  // Push history state when navigating
  const navigateTo = (newScreen: typeof screen) => {
    window.history.pushState({ screen: newScreen }, '');
    setScreen(newScreen);
  };
  const openSettings = () => {
    window.history.pushState({ settings: true }, '');
    setShowSettings(true);
  };

  useEffect(() => {
    localStorage.setItem('sifau_theme', theme);
    applyTheme(theme);
  }, [theme]);

  if (isPrivacyRoute) {
    return <PrivacyPolicyScreen theme={theme} />;
  }

  // Request essential runtime permissions once per authenticated session
  useEffect(() => {
    if (!isAuthenticated) return;

    const permissionsKey = 'sifau_permissions_requested_v1';
    if (sessionStorage.getItem(permissionsKey) === '1') return;

    sessionStorage.setItem(permissionsKey, '1');
    requestEssentialPermissions()
      .then((result) => {
        console.log('🔐 Permissões solicitadas:', result);
      })
      .catch(() => {
        console.warn('⚠️ Não foi possível solicitar permissões essenciais agora.');
      });
  }, [isAuthenticated]);

  const handleLogoutAuth = async () => {
    if (supabase) {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
    }
    clearSession();
    sessionStorage.removeItem('sifau_screen');
    setIsAuthenticated(false);
    setAuthEmail('anonymous');
    setAccessType('denunciante');
    setHomeError('');
    setScreen('home');
    logout();
  };

  // Loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${THEME_GRADIENTS[theme]} flex items-center justify-center`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Logo size={100} showText={false} className="mx-auto mb-2" />
          <Loader2 size={24} className="text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-white/60 text-sm">Carregando SIFAU...</p>
        </motion.div>
      </div>
    );
  }

  // Not authenticated — show auth screen
  if (!isAuthenticated) {
    return (
      <AnimatePresence mode="wait">
        <AuthScreen
          key="auth"
          onAuthenticated={(email?: string, role?: AccessType) => {
            if (email) setAuthEmail(email);
            if (role) setAccessType(role);
            setIsAuthenticated(true);
          }}
          theme={theme}
        />
      </AnimatePresence>
    );
  }

  // Authenticated — show app
  if (showSettings) {
    return (
      <AnimatePresence mode="wait">
        <Settings
          key="settings"
          onBack={() => setShowSettings(false)}
          currentTheme={theme}
          onThemeChange={setTheme}
          authEmail={authEmail}
          onLogoutAuth={handleLogoutAuth}
          onDeleteAccount={async () => {
            // Delete account with 30-day recovery
            const deleted = await supa.deleteUserAccount(authEmail);
            if (deleted) {
              console.log('🗑️ Conta agendada para exclusão:', authEmail);
            }
            // Clear all local data for this email
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
              if (key.includes(authEmail)) localStorage.removeItem(key);
            });
            // Logout from auth
            handleLogoutAuth();
          }}
        />
      </AnimatePresence>
    );
  }

  // If logged in as fiscal
  if (currentUser?.tipo === 'fiscal') {
    return (
      <AnimatePresence mode="wait">
        <motion.div key="fiscal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <FiscalModule
            onLogout={() => { logout(); navigateTo('home'); }}
            onOpenSettings={openSettings}
            theme={theme}
            profilePhoto={getProfilePhoto(authEmail) || undefined}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  // If logged in as gerente
  if (currentUser?.tipo === 'gerente') {
    return (
      <AnimatePresence mode="wait">
        <motion.div key="gerente" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <GerenteModule
            onLogout={() => { logout(); navigateTo('home'); }}
            onOpenSettings={openSettings}
            theme={theme}
            profilePhoto={getProfilePhoto(authEmail) || undefined}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  // Login screen
  if (screen === 'login') {
    if (accessType !== 'servidor') {
      return (
        <AnimatePresence mode="wait">
          <HomeScreen
            key="home-locked"
            onLogin={() => {
              setHomeError('Seu perfil é apenas denunciante. Para acessar área restrita, entre com uma conta de servidor.');
            }}
            onCidadao={() => navigateTo('cidadao')}
            onOpenSettings={openSettings}
            onLogoutAuth={handleLogoutAuth}
            theme={theme}
            canAccessServer={false}
            warning={homeError || 'Seu cadastro atual é apenas denunciante.'}
          />
        </AnimatePresence>
      );
    }
    return (
      <AnimatePresence mode="wait">
        <LoginScreen
          key="login"
          onBack={() => navigateTo('home')}
          onSuccess={() => {}}
          theme={theme}
        />
      </AnimatePresence>
    );
  }

  // Cidadão screen (no login needed)
  if (screen === 'cidadao') {
    return (
      <AnimatePresence mode="wait">
        <motion.div key="cidadao" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <CidadaoModule
            onLogin={() => navigateTo('login')}
            onOpenSettings={openSettings}
            theme={theme}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  // Home screen — choose role
  return (
    <AnimatePresence mode="wait">
      <HomeScreen
        key="home"
        onLogin={() => {
          if (accessType !== 'servidor') {
            setHomeError('Seu perfil é apenas denunciante. Cadastre-se como Servidor para usar matrícula/senha.');
            return;
          }
          setHomeError('');
          navigateTo('login');
        }}
        onCidadao={() => navigateTo('cidadao')}
        onOpenSettings={openSettings}
        onLogoutAuth={handleLogoutAuth}
        theme={theme}
        canAccessServer={accessType === 'servidor'}
        warning={homeError}
      />
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <AppContent />
      </div>
    </AppProvider>
  );
}
