export function formatRs(amount: number, showDecimals = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const isNegative = safe < 0;
  const abs = Math.abs(safe);
  const formatted = abs.toLocaleString('en-PK', {
    minimumFractionDigits: showDecimals ? 2 : abs % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-Rs. ${formatted}` : `Rs. ${formatted}`;
}

export function formatPKDate(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  });
}

export function formatPKTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi',
  });
}

export function formatPKDateTime(isoOrDate: string | Date): string {
  return `${formatPKDate(isoOrDate)} · ${formatPKTime(isoOrDate)}`;
}

export function getPKDateKey(isoOrDate: string | Date = new Date()): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Karachi',
  }).formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function generateInvoiceNumber(existingCount: number, prefix = 'AK'): string {
  const dateKey = getPKDateKey(new Date()).replace(/-/g, '');
  const seq = String(existingCount + 1).padStart(4, '0');
  return `${prefix}-${dateKey}-${seq}`;
}

export function playCounterBeep(type: 'scan' | 'success' | 'error' = 'scan'): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'scan') {
      osc.frequency.setValueAtTime(1480, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } else {
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    }
  } catch {
    // Ignore audio context restrictions
  }
}
