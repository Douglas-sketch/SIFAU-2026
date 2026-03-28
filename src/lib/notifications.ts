export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function emitInAppNotification(title: string, body: string) {
  try {
    window.dispatchEvent(new CustomEvent('sifau-inapp-notification', {
      detail: { title, body }
    }));
  } catch {
    // ignore
  }
}

export function sendNotification(title: string, body: string, icon?: string) {
  if (!('Notification' in window)) {
    emitInAppNotification(title, body);
    return;
  }
  if (Notification.permission !== 'granted') {
    emitInAppNotification(title, body);
    return;
  }
  
  try {
    new Notification(title, {
      body,
      icon: icon || '/sifau-icon.svg',
      badge: '/sifau-icon.svg',
      tag: 'sifau-' + Date.now(),
    });
  } catch {
    // Fallback for environments that don't support Notification constructor
    console.log('Notification:', title, body);
  }
}

export function playTaskAlertSound() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const now = ctx.currentTime;
      const makeBeep = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.09, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration + 0.02);
      };
      makeBeep(880, now, 0.16);
      makeBeep(1174, now + 0.2, 0.2);
    }
  } catch {
    // ignore audio issues
  }

  try {
    if (navigator.vibrate) navigator.vibrate([120, 80, 180]);
  } catch {
    // ignore vibration issues
  }
}

export function notifyNewTask(fiscalName: string, protocolo: string, tipo: string) {
  sendNotification(
    '📋 Nova Tarefa Designada',
    `${fiscalName}, você recebeu uma nova tarefa: ${tipo} (${protocolo})`
  );
}

export async function notifyNewTaskWithAlert(fiscalName: string, protocolo: string, tipo: string) {
  playTaskAlertSound();
  await requestNotificationPermission();
  notifyNewTask(fiscalName, protocolo, tipo);
}

export function notifyStatusChange(protocolo: string, newStatus: string) {
  const statusNames: Record<string, string> = {
    pendente: 'Pendente',
    designada: 'Designada a um fiscal',
    em_vistoria: 'Em vistoria',
    aguardando_aprovacao: 'Aguardando aprovação',
    concluida: 'Concluída',
    devolvida: 'Devolvida para revisão',
  };
  sendNotification(
    '🔔 Status Atualizado',
    `Denúncia ${protocolo}: ${statusNames[newStatus] || newStatus}`
  );
}

export function notifyPoints(fiscalName: string, points: number, reason: string) {
  sendNotification(
    '⭐ Pontos Creditados!',
    `${fiscalName}: +${points} pts — ${reason}`
  );
}
