import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Send, Mic, MicOff, Volume2, VolumeX, Trash2, Loader2, Globe } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useProfileStore } from '../../store/profileStore';
import { api } from '../../lib/api';
import { useAiResource } from '../../store/aiStore';
import { aiProfile } from '../../lib/profileKey';
import { Disclaimer, EmptyState, Skeleton } from '../ui/primitives';

interface Msg { role: 'user' | 'model'; content: string; tools?: string[]; error?: boolean }
interface ChatStore { msgs: Msg[]; busy: boolean; set: (p: Partial<ChatStore>) => void }
const useChat = create<ChatStore>((set) => ({ msgs: [], busy: false, set: (p) => set(p) }));

/** Tiny safe markdown: **bold** and "- " / "* " bullets. No HTML injection (React escapes everything). */
function Md({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const bold = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p);
  const flush = () => { if (list.length) { out.push(<ul key={out.length}>{list.map((l, i) => <li key={i}>{bold(l)}</li>)}</ul>); list = []; } };
  lines.forEach((ln) => { const m = ln.match(/^\s*[-*•]\s+(.*)/); if (m) list.push(m[1]); else { flush(); if (ln.trim()) out.push(<p key={out.length}>{bold(ln)}</p>); } });
  flush();
  return <div className="chat-md text-sm leading-relaxed">{out}</div>;
}

const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

export default function Chat() {
  const { t } = useTranslation();
  const { profile } = useProfileStore();
  const { airQuality: aq, weather } = useDataStore();
  const { msgs, busy, set } = useChat();
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<any>(null);
  const loc = profile.locations[profile.activeLocationIndex];

  const sqKey = aq ? `${loc.lat.toFixed(2)}|${Math.round(aq.current.pm2_5 / 10)}|${profile.language}|${JSON.stringify(profile.household)}` : null;
  const sq = useAiResource<{ questions: string[] }>('sq', sqKey, () => api.ai.suggestedQuestions({ airQuality: aq, profile: aiProfile(profile) }));

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs]);
  useEffect(() => () => { abortRef.current?.abort(); recRef.current?.stop?.(); window.speechSynthesis?.cancel(); }, []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    const history = useChat.getState().msgs.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    const base: Msg[] = [...useChat.getState().msgs, { role: 'user', content: q }, { role: 'model', content: '', tools: [] }];
    set({ msgs: base, busy: true });
    const patch = (fn: (m: Msg) => Msg) => { const cur = [...useChat.getState().msgs]; cur[cur.length - 1] = fn(cur[cur.length - 1]); set({ msgs: cur }); };
    abortRef.current = new AbortController();
    await api.ai.chatStream(
      { message: q, history, profile: aiProfile(profile), airQuality: aq, weather, placeName: loc.name },
      {
        onText: (x) => patch((m) => ({ ...m, content: m.content + x })),
        onTool: (name, args) => patch((m) => ({ ...m, tools: [...(m.tools || []), `${name === 'fetch_forecast' ? 'Fetching forecast' : 'Fetching live AQI'} for ${args?.city ?? '…'}`] })),
        onDone: () => set({ busy: false }),
        onError: (e) => { patch((m) => ({ ...m, content: m.content || e, error: !m.content })); set({ busy: false }); },
      }, abortRef.current.signal);
    set({ busy: false });
  };

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return; }
    const r = new SR();
    r.lang = profile.language === 'hi' ? 'hi-IN' : 'en-IN';
    r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = (e: any) => setInput(Array.from(e.results).map((x: any) => x[0].transcript).join(' '));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r; setListening(true); r.start();
  };

  const speak = (i: number, text: string) => {
    if (speakingIdx === i) { window.speechSynthesis.cancel(); setSpeakingIdx(null); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, '').replace(/^\s*[-*•]\s+/gm, ''));
    u.lang = profile.language === 'hi' ? 'hi-IN' : 'en-IN';
    u.onend = () => setSpeakingIdx(null);
    setSpeakingIdx(i); window.speechSynthesis.speak(u);
  };

  if (!aq) return <EmptyState icon={<Globe size={32} />} title="Waiting for live air data" hint="Open the Dashboard first so I can see your air." />;

  return (
    <div className="mx-auto max-w-4xl px-4 pt-5 flex flex-col" style={{ minHeight: 'calc(100dvh - 9rem)' }}>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-extrabold">💬 {t('chat.title')}</h1>
        {msgs.length > 0 && <button className="btn-ghost" onClick={() => { abortRef.current?.abort(); window.speechSynthesis?.cancel(); set({ msgs: [], busy: false }); }} aria-label="Clear chat"><Trash2 size={14} /></button>}
      </div>

      <div className="flex-1 space-y-3 pb-3" aria-live="polite">
        {msgs.length === 0 && (
          <div className="glass p-4 text-sm">
            <p className="font-semibold mb-1">Hi! I can see your live air: US AQI {aq.current.usAqi}, PM2.5 {aq.current.pm2_5.toFixed(0)} µg/m³ in {loc.name}.</p>
            <p className="text-fg/70">Ask me about kids’ play, masks vs purifiers, opening windows — or the air in another city (I’ll fetch it live).</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 ${m.role === 'user' ? 'bg-fg text-canvas' : m.error ? 'border border-red-400/40 bg-red-500/10' : 'glass'}`}>
              {m.tools?.map((x, k) => <p key={k} className="text-xs text-brand font-semibold flex items-center gap-1.5 mb-1"><Globe size={12} />{x}…</p>)}
              {m.role === 'user' ? <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                : m.content ? <Md text={m.content} />
                : <span className="flex items-center gap-2 text-sm text-fg/60"><Loader2 size={14} className="animate-spin" />Thinking…</span>}
              {m.role === 'model' && m.content && !m.error && canSpeak && !(busy && i === msgs.length - 1) && (
                <button className="mt-1 text-fg/50 hover:text-fg" onClick={() => speak(i, m.content)} aria-label={speakingIdx === i ? 'Stop reading' : 'Read aloud'}>
                  {speakingIdx === i ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-[4.25rem] lg:bottom-0 bg-gradient-to-t from-canvas via-canvas/80 to-transparent pt-4 pb-2">
        {msgs.length === 0 && (
          <div className="mb-2" aria-label={t('chat.suggestions')}>
            {sq.loading && <div className="flex gap-2"><Skeleton className="h-8 w-40" /><Skeleton className="h-8 w-48" /></div>}
            {sq.data && <div className="flex flex-wrap gap-2">{sq.data.questions.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}</div>}
            {sq.error && <p className="text-xs text-fg/50">Suggestions unavailable ({sq.error.slice(0, 80)}).</p>}
          </div>
        )}
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? t('chat.listening') : t('chat.placeholder')} aria-label="Message" maxLength={1200} disabled={busy} />
          {SR && <button type="button" className={`btn-ghost !px-3 ${listening ? '!bg-red-500/30' : ''}`} onClick={toggleMic} aria-label={listening ? 'Stop voice input' : 'Start voice input'} aria-pressed={listening}>{listening ? <MicOff size={16} /> : <Mic size={16} />}</button>}
          <button className="btn-primary !px-3" disabled={busy || !input.trim()} aria-label={t('chat.send')}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
        </form>
        <Disclaimer />
      </div>
    </div>
  );
}
