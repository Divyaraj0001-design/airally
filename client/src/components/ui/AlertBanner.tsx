import { useEffect, useRef, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { useProfileStore } from '../../store/profileStore';
import { useDataStore } from '../../store/dataStore';

/** In-app alert + optional browser notification when AQI crosses the user's threshold or a better window opens.
 *  Works while the app (or installed PWA) is open — browsers don't allow reliable background polling without a push server. */
export default function AlertBanner() {
  const { profile } = useProfileStore();
  const aq = useDataStore((s) => s.airQuality);
  const [msg, setMsg] = useState<string | null>(null);
  const lastKey = useRef<string>('');

  useEffect(() => {
    if (!aq || !profile.alerts.enabled) { setMsg(null); return; }
    const th = profile.alerts.threshold;
    const aqi = aq.current.usAqi;
    const idx = aq.hourly.time.indexOf(aq.current.time.slice(0, 13) + ':00');
    let text: string | null = null;
    if (aqi > th) {
      text = `US AQI is ${aqi} — above your alert level of ${th}.`;
      if (idx >= 0) {
        const next = aq.hourly.usAqi.slice(idx + 1, idx + 13);
        const j = next.findIndex((v) => v != null && v <= th);
        if (j >= 0) {
          const t = aq.hourly.time[idx + 1 + j].slice(11, 16);
          text += ` A better window opens around ${t} (forecast AQI ${next[j]}).`;
        }
      }
    } else if (idx >= 0 && aqi <= th) {
      const nxt = aq.hourly.usAqi.slice(idx + 1, idx + 7);
      const j = nxt.findIndex((v) => v != null && v > th);
      if (j >= 0) text = `Heads-up: AQI is forecast to cross ${th} around ${aq.hourly.time[idx + 1 + j].slice(11, 16)}.`;
    }
    setMsg(text);
    const key = text ? text.slice(0, 40) + aq.current.time.slice(0, 13) : '';
    if (text && key !== lastKey.current) {
      lastKey.current = key;
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        navigator.serviceWorker?.ready
          .then((r) => r.showNotification('AirAlly', { body: text!, icon: '/icon-192.png', tag: 'airally-alert' }))
          .catch(() => { try { new Notification('AirAlly', { body: text! }); } catch { /* ignore */ } });
      }
    }
  }, [aq, profile.alerts.enabled, profile.alerts.threshold]);

  if (!msg) return null;
  return (
    <div role="status" className="bg-amber-500/20 border-b border-amber-400/40 text-sm">
      <div className="mx-auto max-w-3xl flex items-start gap-2 px-4 py-2">
        <BellRing size={16} className="mt-0.5 shrink-0 text-amber-400" />
        <p className="flex-1">{msg}</p>
        <button onClick={() => setMsg(null)} aria-label="Dismiss alert" className="p-1"><X size={14} /></button>
      </div>
    </div>
  );
}
