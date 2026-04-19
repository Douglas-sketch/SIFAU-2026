import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X, MapPin, Camera, Plus, ChevronRight, Clock, CheckCircle, AlertCircle, Eye, Search, ArrowLeft, Shield, Mic, MicOff, User, UserX, Settings, Loader, Navigation, Copy, Share2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DenunciaTipo } from '../types';
import { PhotoGallery } from './PhotoViewer';
import { compressPhoto } from '../lib/photoCompressor';

const statusLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: <Clock size={16} /> },
  designada: { label: 'Designada', color: 'bg-blue-100 text-blue-800', icon: <AlertCircle size={16} /> },
  em_vistoria: { label: 'Em Vistoria', color: 'bg-orange-100 text-orange-800', icon: <Eye size={16} /> },
  aguardando_aprovacao: { label: 'Aguardando Aprovação', color: 'bg-purple-100 text-purple-800', icon: <Clock size={16} /> },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-800', icon: <CheckCircle size={16} /> },
};



function getStatusGuidance(status: string): { title: string; text: string; tone: string } {
  switch (status) {
    case 'pendente':
      return {
        title: 'Aguardando triagem',
        text: 'Sua denúncia foi recebida. Em breve ela será designada para fiscalização.',
        tone: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      };
    case 'designada':
      return {
        title: 'Fiscal designado',
        text: 'A denúncia já tem responsável e deve avançar para vistoria em breve.',
        tone: 'bg-blue-50 border-blue-200 text-blue-800',
      };
    case 'em_vistoria':
      return {
        title: 'Vistoria em andamento',
        text: 'A equipe está apurando os fatos em campo.',
        tone: 'bg-orange-50 border-orange-200 text-orange-800',
      };
    case 'aguardando_aprovacao':
      return {
        title: 'Análise final',
        text: 'O relatório técnico foi enviado e aguarda aprovação do gerente.',
        tone: 'bg-purple-50 border-purple-200 text-purple-800',
      };
    case 'concluida':
      return {
        title: 'Processo concluído',
        text: 'A denúncia foi finalizada com sucesso.',
        tone: 'bg-green-50 border-green-200 text-green-800',
      };
    default:
      return {
        title: 'Em processamento',
        text: 'Sua denúncia está em andamento.',
        tone: 'bg-gray-50 border-gray-200 text-gray-700',
      };
  }
}

function getSlaProgress(createdAt: string, slaDias: number): number {
  const totalMs = Math.max(1, slaDias * 24 * 60 * 60 * 1000);
  const elapsed = Math.max(0, Date.now() - new Date(createdAt).getTime());
  return Math.min(100, Math.round((elapsed / totalMs) * 100));
}

const chatResponses: Record<string, string> = {
  'anonimato': 'Sim! Você pode fazer denúncias de forma totalmente anônima. Seus dados pessoais não serão compartilhados com ninguém.',
  'prazo': 'O prazo médio de atendimento é de 3 a 5 dias úteis, dependendo da gravidade da denúncia. Casos urgentes como desmatamento têm prioridade.',
  'acompanhar': 'Você pode acompanhar sua denúncia usando o número de protocolo na seção "Acompanhar Denúncia" da tela inicial.',
  'multa': 'As multas variam de acordo com o tipo de infração. Por exemplo, construções irregulares podem gerar multas de R$ 321,67 a R$ 13.785,74.',
  'como': 'Para fazer uma denúncia, clique no botão "Nova Denúncia" na tela inicial e siga os 3 passos simples!',
};

function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ from: string; text: string }[]>([
    { from: 'bot', text: 'Olá! 👋 Sou o assistente virtual do SIFAU. Como posso ajudá-lo?\n\nPergunte sobre:\n• Anonimato\n• Prazos\n• Como denunciar\n• Acompanhamento\n• Multas' },
  ]);
  const [input, setInput] = useState('');
  const messagesEnd = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { from: 'user', text: userMsg }]);
    setInput('');
    setTimeout(() => {
      const lower = userMsg.toLowerCase();
      let response = 'Desculpe, não entendi. Tente perguntar sobre: anonimato, prazos, como denunciar, acompanhamento ou multas.';
      for (const [key, val] of Object.entries(chatResponses)) {
        if (lower.includes(key)) { response = val; break; }
      }
      setMessages(prev => [...prev, { from: 'bot', text: response }]);
      messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-96 lg:w-[420px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden border border-gray-200"
            style={{ maxHeight: '70vh' }}
          >
            <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle size={20} />
                <span className="font-semibold">Assistente SIFAU</span>
              </div>
              <button onClick={() => setOpen(false)}><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: '250px' }}>
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-line ${m.from === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEnd} />
            </div>
            <div className="p-3 border-t flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Digite sua dúvida..."
                className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={handleSend} className="bg-blue-600 text-white rounded-xl p-2 hover:bg-blue-700 transition">
                <Send size={18} />
              </button>
            </div>
            <div className="px-3 pb-3">
              <button disabled className="w-full text-xs text-gray-400 bg-gray-100 rounded-lg py-2 cursor-not-allowed">
                💬 Falar com Atendente (Indisponível)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 lg:bottom-8 lg:right-8 bg-blue-600 text-white rounded-full p-4 shadow-lg z-50 hover:bg-blue-700 transition"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </motion.button>
    </>
  );
}

const TIPOS: DenunciaTipo[] = ['Construção Irregular', 'Ocupação Irregular', 'Comércio Irregular', 'Desmatamento', 'Lixo/Entulho', 'Outros'];

function NovaDenuncia({ onBack, onSuccess }: { onBack: () => void; onSuccess: (protocolo: string) => void }) {
  const { addDenuncia, authEmail } = useApp();
  const [step, setStep] = useState(1);
  const [anonimo, setAnonimo] = useState(false);
  const [isServidor, setIsServidor] = useState(false);
  const [nome, setNome] = useState('');
  const [matriculaServidor, setMatriculaServidor] = useState('');
  const [tipo, setTipo] = useState<DenunciaTipo>('Construção Irregular');
  const [endereco, setEndereco] = useState('');
  const [descricao, setDescricao] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{lat: number; lng: number} | null>(null);
  const [transcript, setTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isMicPermissionGranted, setIsMicPermissionGranted] = useState<boolean | null>(null);
  const [permissionsRequested, setPermissionsRequested] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const draftKey = `sifau_denuncia_draft_${(authEmail || 'anonymous').toLowerCase()}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft) return;

      const shouldRestore = window.confirm('Encontramos um rascunho de denúncia não enviado. Deseja restaurar?');
      if (!shouldRestore) {
        localStorage.removeItem(draftKey);
        return;
      }

      setStep(draft.step || 1);
      setAnonimo(!!draft.anonimo);
      setNome(draft.nome || '');
      setTipo(draft.tipo || 'Construção Irregular');
      setEndereco(draft.endereco || '');
      setDescricao(draft.descricao || '');
      setFotos(Array.isArray(draft.fotos) ? draft.fotos : []);
      setGpsCoords(draft.gpsCoords || null);
    } catch { /* ignore draft parse */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    const hasContent = !!(nome.trim() || endereco.trim() || descricao.trim() || fotos.length > 0);
    if (!hasContent) {
      localStorage.removeItem(draftKey);
      return;
    }

    const payload = {
      step, anonimo, nome, tipo, endereco, descricao, fotos, gpsCoords, updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch { /* ignore quota */ }
  }, [draftKey, step, anonimo, nome, tipo, endereco, descricao, fotos, gpsCoords]);

  // Check if Speech Recognition is supported
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  // GPS - Get real location + reverse geocoding for street name
  const handleGetGPS = useCallback(async () => {
    setGpsLoading(true);
    setGpsError('');
    
    if (!navigator.geolocation) {
      setGpsError('GPS não disponível neste dispositivo');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setGpsCoords({ lat, lng });

        try {
          // Reverse geocoding with OpenStreetMap Nominatim (free, no API key)
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=pt-BR`,
            { headers: { 'User-Agent': 'SIFAU-App/2.0' } }
          );
          const data = await response.json();
          
          if (data && data.address) {
            const addr = data.address;
            const parts: string[] = [];
            
            // Build address: Street + Number
            if (addr.road) parts.push(addr.road);
            if (addr.house_number) parts[parts.length - 1] += `, ${addr.house_number}`;
            
            // Neighborhood
            if (addr.suburb || addr.neighbourhood) {
              parts.push(addr.suburb || addr.neighbourhood);
            }
            
            // City + State
            if (addr.city || addr.town || addr.village) {
              parts.push(addr.city || addr.town || addr.village);
            }
            if (addr.state) {
              parts.push(addr.state);
            }
            
            const fullAddress = parts.join(' - ');
            setEndereco(fullAddress || `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
          } else {
            setEndereco(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
          }
        } catch {
          // If reverse geocoding fails, use coordinates
          setEndereco(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
        }
        
        setGpsLoading(false);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Permissão de localização negada. Ative o GPS nas configurações.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('Localização indisponível. Verifique se o GPS está ativo.');
            break;
          case error.TIMEOUT:
            setGpsError('Tempo esgotado. Tente novamente.');
            break;
          default:
            setGpsError('Erro ao obter localização.');
        }
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  const requestRequiredPermissions = useCallback(async () => {
    setPermissionsRequested(true);

    try {
      if (navigator.permissions?.query) {
        const locPerm = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (locPerm.state === 'prompt' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            () => {},
            () => {},
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          );
        }
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => {},
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      }
    } catch {
      // ignore
    }

  }, []);

  const ensureMicrophonePermission = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setIsMicPermissionGranted(false);
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setIsMicPermissionGranted(true);
      return true;
    } catch {
      setIsMicPermissionGranted(false);
      alert('Permissão de microfone negada. Ative o microfone para transcrever a descrição.');
      return false;
    }
  }, []);

  useEffect(() => {
    if (step === 2 && !permissionsRequested) {
      requestRequiredPermissions();
    }
  }, [step, permissionsRequested, requestRequiredPermissions]);

  // Speech Recognition - Real voice to text
  const handleRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SR) {
      alert('Gravação de voz não suportada neste navegador. Use o Chrome ou Edge.');
      return;
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    let finalTranscript = '';

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscript('');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + ' ';
        } else {
          interim = t;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech error:', event.error);
      if (event.error === 'not-allowed') ensureMicrophonePermission();
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (finalTranscript.trim()) {
        setDescricao(prev => {
          const separator = prev.trim() ? '\n' : '';
          return prev + separator + finalTranscript.trim();
        });
      }
      setTranscript('');
    };

    recognition.start();
  }, [isRecording, ensureMicrophonePermission]);

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop?.(); } catch { /* ignore */ }
    };
  }, []);

  // compressPhoto imported from lib/photoCompressor

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const compressed = await compressPhoto(files[i], 100);
      setFotos(prev => [...prev, compressed]);
    }
  };

  const handleSubmit = () => {
    const d = addDenuncia({
      tipo,
      endereco: endereco || 'Endereço não informado',
      lat: gpsCoords?.lat || -22.9068 + Math.random() * 0.05,
      lng: gpsCoords?.lng || -43.1729 + Math.random() * 0.05,
      descricao,
      status: 'pendente',
      sla_dias: tipo === 'Desmatamento' ? 1 : 5,
      denunciante_nome: anonimo ? undefined : nome,
      denunciante_matricula: anonimo || !isServidor ? undefined : matriculaServidor.trim().toUpperCase(),
      denunciante_anonimo: anonimo,
      pontos_provisorio: 0,
      fotos,
    });
    localStorage.removeItem(draftKey);
    onSuccess(d.protocolo);
  };

  return (
    <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-4 lg:p-6 flex items-center gap-3">
        <button onClick={onBack}><ArrowLeft size={24} /></button>
        <h2 className="text-lg md:text-xl font-bold">Nova Denúncia</h2>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2 p-4 md:p-6">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm md:text-base font-bold ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{s}</div>
            {s < 3 && <div className={`w-8 md:w-16 lg:w-24 h-1 rounded ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>
      <div className="text-center text-xs md:text-sm text-gray-500 mb-4">
        {step === 1 ? 'Identificação' : step === 2 ? 'Local & Descrição' : 'Fotos & Envio'}
      </div>

      <div className="p-4 md:p-6 space-y-4 max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Shield className="text-blue-600 mt-1 shrink-0" size={20} />
                <p className="text-sm md:text-base text-blue-800">Sua identidade é protegida. Escolha se deseja se identificar ou permanecer anônimo.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <button
                  onClick={() => setAnonimo(false)}
                  className={`p-4 md:p-6 rounded-xl border-2 transition flex flex-col items-center gap-2 ${!anonimo ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <User size={28} className={!anonimo ? 'text-blue-600' : 'text-gray-400'} />
                  <span className="text-sm md:text-base font-medium">Identificado</span>
                </button>
                <button
                  onClick={() => setAnonimo(true)}
                  className={`p-4 md:p-6 rounded-xl border-2 transition flex flex-col items-center gap-2 ${anonimo ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <UserX size={28} className={anonimo ? 'text-blue-600' : 'text-gray-400'} />
                  <span className="text-sm md:text-base font-medium">Anônimo</span>
                </button>
              </div>
              {!anonimo && (
                <div className="space-y-3">
                  <input
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full border rounded-xl px-4 py-3 md:py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 md:text-lg"
                  />

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={isServidor} onChange={e => setIsServidor(e.target.checked)} />
                    Sou servidor(a) público(a)
                  </label>

                  {isServidor && (
                    <div>
                      <input
                        value={matriculaServidor}
                        onChange={e => setMatriculaServidor(e.target.value.toUpperCase())}
                        placeholder="Matrícula do servidor (ex: FSC-013)"
                        className="w-full border rounded-xl px-4 py-3 md:py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 md:text-lg"
                      />
                      <p className="text-[11px] text-gray-500 mt-1">Opcional para identificar que o denunciante também é servidor.</p>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setStep(2)}
                disabled={!anonimo && (!nome.trim() || (isServidor && !matriculaServidor.trim()))}
                className="w-full bg-blue-600 text-white rounded-xl py-3 md:py-4 font-semibold disabled:opacity-50 flex items-center justify-center gap-2 md:text-lg"
              >
                Próximo <ChevronRight size={18} />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs md:text-sm text-blue-800">
                  O app solicita localização nesta etapa. Câmera e microfone serão solicitados somente quando você usar fotos ou ditado por voz.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm md:text-base font-medium text-gray-700 mb-1 block">Tipo da Denúncia</label>
                  <select value={tipo} onChange={e => setTipo(e.target.value as DenunciaTipo)} className="w-full border rounded-xl px-4 py-3 md:py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white md:text-lg">
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm md:text-base font-medium text-gray-700 mb-1 block">Endereço / Local</label>
                  <div className="relative">
                    <MapPin size={18} className="absolute left-3 top-3.5 md:top-4.5 text-gray-400" />
                    <input
                      value={endereco}
                      onChange={e => setEndereco(e.target.value)}
                      placeholder="Rua, número, bairro..."
                      className="w-full border rounded-xl pl-10 pr-4 py-3 md:py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 md:text-lg"
                    />
                  </div>
                  
                  {/* GPS Button - Real geolocation + reverse geocoding */}
                  <button 
                    onClick={handleGetGPS}
                    disabled={gpsLoading}
                    className={`mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
                      gpsLoading 
                        ? 'bg-blue-100 text-blue-500 cursor-wait' 
                        : gpsCoords 
                          ? 'bg-green-100 text-green-700 border border-green-300' 
                          : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    {gpsLoading ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Obtendo localização...
                      </>
                    ) : gpsCoords ? (
                      <>
                        <Navigation size={16} />
                        ✅ Localização obtida — Toque para atualizar
                      </>
                    ) : (
                      <>
                        <Navigation size={16} />
                        📍 Usar minha localização atual (GPS)
                      </>
                    )}
                  </button>

                  {/* GPS Error */}
                  {gpsError && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-start gap-2">
                      <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-red-600">{gpsError}</p>
                    </div>
                  )}

                  {/* GPS Coordinates Info */}
                  {gpsCoords && (
                    <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2.5">
                      <p className="text-xs text-green-700 font-medium">📍 Coordenadas: {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm md:text-base font-medium text-gray-700 mb-1 block">Descrição</label>
                <div className="relative">
                  <textarea
                    value={descricao}
                    onChange={e => setDescricao(e.target.value)}
                    placeholder="Descreva a situação em detalhes..."
                    rows={4}
                    className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none md:text-base"
                  />
                </div>

                {/* Voice Transcription - Real Speech Recognition */}
                {isRecording && transcript && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs text-blue-500 font-medium mb-1">🎙️ Transcrevendo em tempo real:</p>
                    <p className="text-sm text-blue-800 italic">"{transcript}"</p>
                  </div>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={ensureMicrophonePermission}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                      isMicPermissionGranted === true
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    <Mic size={16} />
                    {isMicPermissionGranted === true ? '✅ Microfone ativo' : 'Ativar microfone'}
                  </button>

                  <button
                    onClick={handleRecording}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                      isRecording 
                        ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200' 
                        : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    {isRecording ? (
                      <>
                        <MicOff size={16} />
                        ⏹ Parar Gravação
                      </>
                    ) : (
                      <>
                        <Mic size={16} />
                        🎙️ Ditar por voz
                      </>
                    )}
                  </button>

                  {!speechSupported && (
                    <span className="text-xs text-amber-600">⚠️ Use Chrome ou Edge para gravar voz</span>
                  )}
                  
                  {isRecording && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                      <span className="text-xs text-red-600 font-medium">Ouvindo...</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-400 mt-1">
                  {speechSupported 
                    ? '💡 Fale naturalmente. O texto será adicionado à descrição automaticamente.'
                    : '💡 Gravação de voz disponível no Chrome, Edge ou Safari.'}
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 rounded-xl py-3 md:py-4 font-semibold md:text-lg">Voltar</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!descricao.trim()}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-3 md:py-4 font-semibold disabled:opacity-50 flex items-center justify-center gap-2 md:text-lg"
                >
                  Próximo <ChevronRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 md:p-10 text-center">
                <Camera size={40} className="mx-auto text-gray-400 mb-2 md:w-14 md:h-14" />
                <p className="text-sm md:text-base text-gray-600 mb-3">Adicione fotos como evidência</p>
                <button onClick={() => fileRef.current?.click()} className="bg-blue-600 text-white rounded-xl px-6 py-2 md:py-3 text-sm md:text-base font-semibold">
                  <Plus size={16} className="inline mr-1" /> Selecionar Fotos
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
              </div>
              <div>
                <div className="flex justify-between text-xs md:text-sm text-gray-500 mb-1">
                  <span>{fotos.length} foto(s) adicionada(s)</span>
                  <span>{fotos.length >= 2 ? '✅ Ideal' : 'Recomendado: 2+'}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 md:h-3">
                  <div className={`h-full rounded-full transition-all ${fotos.length >= 2 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${Math.min(100, fotos.length * 50)}%` }} />
                </div>
              </div>
              {fotos.length > 0 && (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {fotos.map((f, i) => (
                    <div key={i} className="relative">
                      <img src={f} alt="" className="w-full h-24 md:h-32 object-cover rounded-lg" />
                      <button
                        onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs md:text-sm text-gray-500 text-center">📸 Fotos são comprimidas e recebem marca d'água automática (data, hora, GPS)</p>
              <button
                onClick={() => {
                  localStorage.removeItem(draftKey);
                  setStep(1);
                  setAnonimo(false);
                  setNome('');
                  setTipo('Construção Irregular');
                  setEndereco('');
                  setDescricao('');
                  setFotos([]);
                  setGpsCoords(null);
                }}
                className="w-full border border-amber-300 text-amber-700 bg-amber-50 rounded-xl py-2 text-sm font-medium"
              >
                Limpar rascunho
              </button>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 border border-gray-300 rounded-xl py-3 md:py-4 font-semibold md:text-lg">Voltar</button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 bg-green-600 text-white rounded-xl py-3 md:py-4 font-semibold flex items-center justify-center gap-2 md:text-lg"
                >
                  Enviar Denúncia
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function AcompanharDenuncia({ onBack }: { onBack: () => void }) {
  const { denuncias, authEmail, editMinhaDenuncia } = useApp();
  const [busca, setBusca] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editTipo, setEditTipo] = useState<DenunciaTipo>('Outros');
  const [editEndereco, setEditEndereco] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editNome, setEditNome] = useState('');

  const cleanAuthEmail = (authEmail || '').toLowerCase();
  const minhasDens = denuncias.filter(d => !!cleanAuthEmail && cleanAuthEmail !== 'anonymous' && d.auth_email === cleanAuthEmail);
  const filtered = minhasDens.filter(d => d.protocolo.includes(busca) || d.endereco.toLowerCase().includes(busca.toLowerCase()));
  const selected = selectedId ? minhasDens.find(d => d.id === selectedId) || null : null;

  const openDetail = (id: string) => {
    const alvo = minhasDens.find(d => d.id === id);
    if (!alvo) return;
    setSelectedId(id);
    setEditMode(false);
    setEditTipo(alvo.tipo);
    setEditEndereco(alvo.endereco);
    setEditDescricao(alvo.descricao);
    setEditNome(alvo.denunciante_nome || '');
  };

  const canEdit = (d: { status: string } | null) => {
    if (!d) return false;
    return !['aguardando_aprovacao', 'concluida'].includes(d.status);
  };

  const handleSaveEdit = () => {
    if (!selected) return;
    const ok = editMinhaDenuncia(selected.id, {
      tipo: editTipo,
      endereco: editEndereco,
      descricao: editDescricao,
      denunciante_nome: selected.denunciante_anonimo ? undefined : editNome,
    });
    if (ok) setEditMode(false);
  };

  const copyProtocol = async (protocolo: string) => {
    try {
      await navigator.clipboard.writeText(`#${protocolo}`);
    } catch {
      // ignore
    }
  };

  const shareDenuncia = async (protocolo: string, tipo: string, status: string) => {
    const text = `Denúncia ${protocolo}
Tipo: ${tipo}
Status: ${statusLabels[status]?.label || status}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Protocolo ${protocolo}`, text });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // ignore
    }
  };

  const statusOrder: string[] = ['pendente', 'designada', 'em_vistoria', 'aguardando_aprovacao', 'concluida'];

  return (
    <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-4 lg:p-6 flex items-center gap-3">
        <button onClick={() => selected ? setSelectedId(null) : onBack()}><ArrowLeft size={24} /></button>
        <h2 className="text-lg md:text-xl font-bold">{selected ? 'Detalhes da Denúncia' : 'Acompanhar Denúncia'}</h2>
      </div>

      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {!selected && (
          <>
            <div className="relative mb-4 md:mb-6">
              <Search size={18} className="absolute left-3 top-3 md:top-4 text-gray-400" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por protocolo ou endereço..."
                className="w-full border rounded-xl pl-10 pr-4 py-3 md:py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 md:text-lg"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
              {filtered.map((d, i) => {
                const st = statusLabels[d.status];
                const currentIdx = statusOrder.indexOf(d.status);
                return (
                  <motion.button
                    type="button"
                    key={d.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white rounded-xl p-4 md:p-5 shadow-sm border text-left"
                    onClick={() => openDetail(d.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs md:text-sm font-mono text-gray-500">#{d.protocolo}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.color} flex items-center gap-1`}>
                        {st.icon} {st.label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-800 text-sm md:text-base">{d.tipo}</h3>
                    <p className="text-xs md:text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <MapPin size={12} /> {d.endereco}
                    </p>
                    <div className="mt-3 flex items-center gap-1">
                      {statusOrder.map((s, si) => (
                        <React.Fragment key={s}>
                          <div className={`w-3 h-3 rounded-full ${si <= currentIdx ? 'bg-blue-600' : 'bg-gray-200'}`} />
                          {si < statusOrder.length - 1 && (
                            <div className={`flex-1 h-0.5 ${si < currentIdx ? 'bg-blue-600' : 'bg-gray-200'}`} />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <p className="text-[10px] md:text-xs text-gray-400 mt-2">Toque para ver detalhes</p>
                    <div className={`mt-2 border rounded-lg px-2 py-1.5 ${getStatusGuidance(d.status).tone}`}>
                      <p className="text-[11px] md:text-xs font-semibold">{getStatusGuidance(d.status).title}</p>
                    </div>
                  </motion.button>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-center py-10 text-gray-400 md:col-span-2 xl:col-span-3">
                  <Search size={40} className="mx-auto mb-2" />
                  <p>Nenhuma denúncia encontrada</p>
                </div>
              )}
            </div>
          </>
        )}

        {selected && (
          <div className="bg-white rounded-2xl border shadow-sm p-4 md:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs md:text-sm font-mono text-gray-500">#{selected.protocolo}</p>
                <h3 className="text-lg md:text-2xl font-bold text-gray-800">{selected.tipo}</h3>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusLabels[selected.status].color} flex items-center gap-1`}>
                {statusLabels[selected.status].icon} {statusLabels[selected.status].label}
              </span>
            </div>

            {!editMode ? (
              <>
                <div className="space-y-2 text-sm md:text-base">
                  <p><span className="text-gray-500">Endereço:</span> {selected.endereco}</p>
                  <p className="whitespace-pre-wrap"><span className="text-gray-500">Descrição:</span> {selected.descricao}</p>
                  <p><span className="text-gray-500">Denunciante:</span> {selected.denunciante_anonimo ? 'Anônimo' : selected.denunciante_nome || 'Não informado'}</p>
                  {selected.denunciante_matricula && <p><span className="text-gray-500">Matrícula:</span> {selected.denunciante_matricula}</p>}
                  <p className="text-xs text-gray-500">Última atualização: {new Date(selected.updated_at).toLocaleString('pt-BR')}</p>
                </div>

                <div className={`border rounded-xl p-3 ${getStatusGuidance(selected.status).tone}`}>
                  <p className="text-sm font-semibold">Próxima etapa: {getStatusGuidance(selected.status).title}</p>
                  <p className="text-xs md:text-sm mt-1">{getStatusGuidance(selected.status).text}</p>
                </div>

                <div className="bg-gray-50 border rounded-xl p-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Andamento do SLA</span>
                    <span>{getSlaProgress(selected.created_at, selected.sla_dias)}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full">
                    <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${getSlaProgress(selected.created_at, selected.sla_dias)}%` }} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => copyProtocol(selected.protocolo)} className="flex-1 border rounded-xl px-3 py-2 text-sm font-medium flex items-center justify-center gap-1.5">
                    <Copy size={14} /> Copiar protocolo
                  </button>
                  <button onClick={() => shareDenuncia(selected.protocolo, selected.tipo, selected.status)} className="flex-1 border rounded-xl px-3 py-2 text-sm font-medium flex items-center justify-center gap-1.5">
                    <Share2 size={14} /> Compartilhar
                  </button>
                </div>

                {selected.fotos.length > 0 && (
                  <PhotoGallery
                    photos={selected.fotos}
                    label="Suas Fotos Enviadas"
                    maxPreview={6}
                    metadata={{
                      protocolo: selected.protocolo,
                      tipo: selected.tipo,
                      endereco: selected.endereco,
                      data: new Date(selected.created_at).toLocaleString('pt-BR'),
                    }}
                  />
                )}

                {canEdit(selected) && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="w-full md:w-auto bg-blue-600 text-white rounded-xl px-5 py-3 font-semibold"
                  >
                    Editar denúncia
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Tipo</label>
                  <select value={editTipo} onChange={e => setEditTipo(e.target.value as DenunciaTipo)} className="w-full border rounded-xl px-3 py-2">
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Endereço</label>
                  <input value={editEndereco} onChange={e => setEditEndereco(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Descrição</label>
                  <textarea value={editDescricao} onChange={e => setEditDescricao(e.target.value)} rows={4} className="w-full border rounded-xl px-3 py-2" />
                </div>
                {!selected.denunciante_anonimo && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Nome do denunciante</label>
                    <input value={editNome} onChange={e => setEditNome(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setEditMode(false)} className="flex-1 border rounded-xl px-4 py-2 font-medium">Cancelar</button>
                  <button onClick={handleSaveEdit} className="flex-1 bg-green-600 text-white rounded-xl px-4 py-2 font-semibold">Salvar alterações</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function CidadaoModule({ onLogin, onOpenSettings }: { onLogin: () => void; onOpenSettings: () => void; theme: string }) {
  const [view, setView] = useState<'home' | 'nova' | 'acompanhar'>('home');
  const [successProtocolo, setSuccessProtocolo] = useState<string | null>(null);
  const { denuncias, authEmail } = useApp();

  // Filtrar denúncias pelo email do usuário autenticado
  const cleanAuthEmail = (authEmail || '').toLowerCase();
  const minhasDenuncias = denuncias.filter(d => !!cleanAuthEmail && cleanAuthEmail !== 'anonymous' && d.auth_email === cleanAuthEmail);

  if (successProtocolo) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="min-h-screen bg-gradient-to-b from-green-500 to-green-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 md:p-12 text-center max-w-sm md:max-w-md w-full shadow-2xl">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}>
            <CheckCircle size={80} className="mx-auto text-green-500 mb-4" />
          </motion.div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Denúncia Enviada!</h2>
          <p className="text-gray-600 mb-4 md:text-lg">Seu protocolo é:</p>
          <div className="bg-gray-100 rounded-xl p-4 mb-4">
            <span className="text-2xl md:text-3xl font-mono font-bold text-blue-700">#{successProtocolo}</span>
          </div>
          <p className="text-sm md:text-base text-gray-500 mb-6">Use este número para acompanhar o andamento.</p>
          <button onClick={() => { setSuccessProtocolo(null); setView('home'); }} className="w-full bg-blue-600 text-white rounded-xl py-3 md:py-4 font-semibold md:text-lg">
            Voltar ao Início
          </button>
        </div>
      </motion.div>
    );
  }

  if (view === 'nova') {
    return <NovaDenuncia onBack={() => setView('home')} onSuccess={(p) => setSuccessProtocolo(p)} />;
  }

  if (view === 'acompanhar') {
    return <AcompanharDenuncia onBack={() => setView('home')} />;
  }

  const pendentes = minhasDenuncias.filter(d => d.status === 'pendente').length;
  const andamento = minhasDenuncias.filter(d => ['designada', 'em_vistoria', 'aguardando_aprovacao'].includes(d.status)).length;
  const concluidas = minhasDenuncias.filter(d => d.status === 'concluida').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-blue-900 text-white px-4 md:px-8 lg:px-12 pt-6 md:pt-10 pb-10 md:pb-14 rounded-b-3xl">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">SIFAU</h1>
              <p className="text-blue-200 text-sm md:text-base lg:text-lg">Fiscalização Urbana Inteligente</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onOpenSettings} className="bg-white/15 backdrop-blur rounded-xl p-2.5 md:p-3 hover:bg-white/25 transition" title="Configurações">
                <Settings size={20} className="md:w-5 md:h-5" />
              </button>
              <button onClick={onLogin} className="bg-white/20 backdrop-blur rounded-xl px-4 py-2 md:px-6 md:py-3 text-sm md:text-base font-medium hover:bg-white/30 transition">
                Área do Servidor
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 md:gap-4 lg:gap-6">
            <div className="bg-white/10 backdrop-blur rounded-xl p-3 md:p-5 text-center">
              <p className="text-2xl md:text-3xl lg:text-4xl font-bold">{pendentes}</p>
              <p className="text-xs md:text-sm text-blue-200">Pendentes</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-3 md:p-5 text-center">
              <p className="text-2xl md:text-3xl lg:text-4xl font-bold">{andamento}</p>
              <p className="text-xs md:text-sm text-blue-200">Em Andamento</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-3 md:p-5 text-center">
              <p className="text-2xl md:text-3xl lg:text-4xl font-bold">{concluidas}</p>
              <p className="text-xs md:text-sm text-blue-200">Concluídas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 -mt-6 space-y-3 md:space-y-4 pb-24">
        {/* Dashboard Estatísticas Pessoais */}
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border">
          <h3 className="font-bold text-gray-700 mb-3 md:text-lg">📊 Suas Estatísticas</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-2xl md:text-3xl font-bold text-blue-700">{minhasDenuncias.length}</p>
              <p className="text-xs text-blue-600 mt-1">Total</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
              <p className="text-2xl md:text-3xl font-bold text-yellow-700">{pendentes}</p>
              <p className="text-xs text-yellow-600 mt-1">Pendentes</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
              <p className="text-2xl md:text-3xl font-bold text-orange-700">{andamento}</p>
              <p className="text-xs text-orange-600 mt-1">Em Andamento</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-2xl md:text-3xl font-bold text-green-700">{concluidas}</p>
              <p className="text-xs text-green-600 mt-1">Concluídas</p>
            </div>
          </div>
          {minhasDenuncias.length > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Taxa de resolução</span>
                <span>{minhasDenuncias.length > 0 ? Math.round((concluidas / minhasDenuncias.length) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${minhasDenuncias.length > 0 ? (concluidas / minhasDenuncias.length) * 100 : 0}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Action cards — side by side on larger screens */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setView('nova')}
            className="w-full bg-white rounded-2xl p-5 md:p-6 shadow-md border flex items-center gap-4 text-left"
          >
            <div className="bg-green-100 rounded-xl p-3 md:p-4">
              <Plus size={24} className="text-green-600 md:w-7 md:h-7" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-800 md:text-lg">Nova Denúncia</h3>
              <p className="text-xs md:text-sm text-gray-500">Registre uma irregularidade urbana</p>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setView('acompanhar')}
            className="w-full bg-white rounded-2xl p-5 md:p-6 shadow-md border flex items-center gap-4 text-left"
          >
            <div className="bg-blue-100 rounded-xl p-3 md:p-4">
              <Search size={24} className="text-blue-600 md:w-7 md:h-7" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-800 md:text-lg">Acompanhar Denúncia</h3>
              <p className="text-xs md:text-sm text-gray-500">Consulte o status pelo protocolo</p>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </motion.button>
        </div>

        {/* Recent */}
        <div className="mt-6">
          <h3 className="font-bold text-gray-700 mb-3 md:text-lg">Denúncias Recentes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
            {minhasDenuncias.slice(0, 6).map((d, i) => {
              const st = statusLabels[d.status];
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white rounded-xl p-3 md:p-4 shadow-sm border flex items-center gap-3"
                >
                  <div className={`w-2 h-10 rounded-full ${d.status === 'concluida' ? 'bg-green-500' : d.status === 'pendente' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-base font-medium text-gray-800 truncate">{d.tipo} - {d.endereco}</p>
                    <p className="text-xs md:text-sm text-gray-400">#{d.protocolo}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{getStatusGuidance(d.status).title}</p>
                  </div>
                  <span className={`text-[10px] md:text-xs px-2 py-1 rounded-full font-medium ${st.color} shrink-0`}>
                    {st.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <Chatbot />
    </div>
  );
}
