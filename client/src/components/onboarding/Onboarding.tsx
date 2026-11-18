import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { useProfileStore, HouseholdMember } from '../../store/profileStore';
import LocationPicker from './LocationPicker';
import { LogoMark } from '../ui/TopBar';
import { Field, ChoiceChips, Toggle, Counter, NumberInput } from '../ui/fields';

const AGES: { v: HouseholdMember['ageGroup']; l: string; sub: string }[] = [
  { v: 'infant', l: 'Infants', sub: '0–1 yr' }, { v: 'toddler', l: 'Toddlers', sub: '1–3 yrs' },
  { v: 'child', l: 'Kids', sub: '3–12 yrs' }, { v: 'teen', l: 'Teens', sub: '12–18 yrs' },
  { v: 'adult', l: 'Adults', sub: '18–65 yrs' }, { v: 'senior', l: 'Seniors', sub: '65+ yrs' },
];
const SENS = [
  { v: 'respiratory', l: 'Asthma / respiratory' }, { v: 'heart', l: 'Heart condition' }, { v: 'pregnancy', l: 'Pregnancy' },
];

export default function Onboarding() {
  const { t } = useTranslation();
  const { profile, setProfile, setLanguage, completeOnboarding } = useProfileStore();
  const [step, setStep] = useState(0);
  const L = profile.lifestyle;
  const setL = (patch: Partial<typeof L>) => setProfile({ lifestyle: { ...L, ...patch } });
  const count = (g: string) => profile.household.members.find((m) => m.ageGroup === g)?.count ?? 0;
  const setCount = (g: HouseholdMember['ageGroup'], n: number) => {
    const rest = profile.household.members.filter((m) => m.ageGroup !== g);
    setProfile({ household: { ...profile.household, members: n > 0 ? [...rest, { ageGroup: g, count: n }] : rest } });
  };
  const toggleSens = (v: string) => {
    const s = profile.household.sensitivities;
    setProfile({ household: { ...profile.household, sensitivities: s.includes(v) ? s.filter((x) => x !== v) : [...s, v] } });
  };
  const totalMembers = profile.household.members.reduce((a, m) => a + m.count, 0);
  const canNext = step === 0 ? profile.locations.length > 0 : step === 1 ? totalMembers > 0 : true;

  const titles = [t('onboarding.step1'), t('onboarding.step2'), t('onboarding.step3')];
  return (
    <main className="min-h-dvh mx-auto max-w-xl px-4 py-6 flex flex-col">
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight"><LogoMark size={38} /><span className="text-gradient">{t('app.name')}</span></h1>
        <button onClick={() => setLanguage(profile.language === 'en' ? 'hi' : 'en')} className="px-3 py-1 rounded-lg border border-fg/15 text-sm font-bold" aria-label="Switch language">
          {profile.language === 'en' ? 'हिंदी' : 'English'}
        </button>
      </div>
      <div className="mb-6">
        <p className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">Breathe smarter. <span className="text-gradient">Live smog, personal plan.</span></p>
        <p className="text-fg/70 text-sm mt-2">{t('app.tagline')} — personal, location-aware guidance powered by live data and Gemini.</p>
      </div>

      <ol className="flex gap-2 mb-6" aria-label="Progress">
        {titles.map((x, i) => (
          <li key={i} className="flex-1" aria-current={i === step ? 'step' : undefined}>
            <div className={`h-1.5 rounded-full transition-all duration-500 ${i <= step ? 'bg-gradient-to-r from-brand to-accent shadow-[0_0_12px_rgb(var(--brand)/0.5)]' : 'bg-fg/15'}`} />
            <p className={`text-xs mt-1 ${i === step ? 'font-bold' : 'text-fg/50'}`}>{i + 1}. {x}</p>
          </li>
        ))}
      </ol>

      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }} className="space-y-5">
            {step === 0 && (<>
              <h2 className="text-xl font-bold">{t('onboarding.step1')}</h2>
              <p className="text-sm text-fg/60">Detect your location or search any city worldwide. Save up to 5 (Home, Office, School…).</p>
              <LocationPicker />
            </>)}

            {step === 1 && (<>
              <h2 className="text-xl font-bold">{t('onboarding.step2')}</h2>
              <p className="text-xs text-fg/60 flex items-center gap-1.5"><Lock size={12} /> Household details stay on this device (browser storage). Only the minimum is sent to the AI to personalise advice, and the server never stores or logs it.</p>
              <Field label={t('onboarding.members')}>
                <div className="grid grid-cols-2 gap-2">
                  {AGES.map((a) => (
                    <div key={a.v} className="glass flex items-center justify-between p-3">
                      <div><p className="text-sm font-semibold">{a.l}</p><p className="text-xs text-fg/50">{a.sub}</p></div>
                      <Counter label={a.l} value={count(a.v)} onChange={(n) => setCount(a.v, n)} />
                    </div>
                  ))}
                </div>
              </Field>
              <Field label={t('onboarding.sensitivities')}>
                <div className="flex flex-wrap gap-2">
                  {SENS.map((s) => (
                    <button key={s.v} aria-pressed={profile.household.sensitivities.includes(s.v)} onClick={() => toggleSens(s.v)}
                      className={`chip ${profile.household.sensitivities.includes(s.v) ? 'chip-on' : ''}`}>{s.l}</button>
                  ))}
                </div>
              </Field>
            </>)}

            {step === 2 && (<>
              <h2 className="text-xl font-bold">{t('onboarding.step3')}</h2>
              <Field label={t('onboarding.commute')}>
                <ChoiceChips label="Commute mode" value={L.commute} onChange={(v) => setL({ commute: v })}
                  options={[{ v: 'walk', l: '🚶 Walk' }, { v: 'bike', l: '🚲 Bike' }, { v: 'bus', l: '🚌 Bus' }, { v: 'metro', l: '🚇 Metro' }, { v: 'car', l: '🚗 Car' }, { v: 'two_wheeler', l: '🛵 Two-wheeler' }, { v: 'wfh', l: '🏠 WFH' }]} />
              </Field>
              {L.commute !== 'wfh' && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="One-way distance"><NumberInput label="Commute km" value={L.commuteKm} min={0} max={200} step={0.5} unit="km" onChange={(n) => setL({ commuteKm: n })} /></Field>
                  <Field label="One-way time"><NumberInput label="Commute minutes" value={L.commuteDuration} min={0} max={240} unit="min" onChange={(n) => setL({ commuteDuration: n })} /></Field>
                </div>
              )}
              <Field label="Work-from-home days / week"><Counter label="WFH days" min={0} max={7} value={L.wfhDays} onChange={(n) => setL({ wfhDays: n })} /></Field>
              <Field label={t('onboarding.cooking')}>
                <ChoiceChips label="Cooking fuel" value={L.cookingFuel} onChange={(v) => setL({ cookingFuel: v })}
                  options={[{ v: 'lpg', l: 'LPG' }, { v: 'induction', l: 'Induction / electric' }, { v: 'biomass', l: 'Wood / dung / coal' }, { v: 'other', l: 'Other' }]} />
              </Field>
              <Field label="Vehicle you own">
                <ChoiceChips label="Vehicle" value={L.vehicle} onChange={(v) => setL({ vehicle: v })}
                  options={[{ v: 'none', l: 'None' }, { v: 'petrol', l: 'Petrol' }, { v: 'diesel', l: 'Diesel' }, { v: 'cng', l: 'CNG' }, { v: 'ev', l: 'Electric' }]} />
              </Field>
              <Field label="Windows at home">
                <ChoiceChips label="Window type" value={L.windowType} onChange={(v) => setL({ windowType: v })}
                  options={[{ v: 'sealed', l: 'Well-sealed' }, { v: 'standard', l: 'Standard' }, { v: 'open', l: 'Often open / leaky' }]} />
              </Field>
              <Field label="Mask you have">
                <ChoiceChips label="Mask" value={L.maskType} onChange={(v) => setL({ maskType: v, hasMask: v !== 'none' })}
                  options={[{ v: 'none', l: 'None' }, { v: 'cloth', l: 'Cloth' }, { v: 'surgical', l: 'Surgical' }, { v: 'n95', l: 'N95 / FFP2' }]} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-2">
                <Toggle label="Air purifier at home" checked={L.hasPurifier} onChange={(b) => setL({ hasPurifier: b })} />
                <Toggle label="Air conditioner" checked={L.hasAC} onChange={(b) => setL({ hasAC: b })} />
                <Toggle label="Smokers at home" checked={L.smokersAtHome} onChange={(b) => setL({ smokersAtHome: b })} />
                <Toggle label="Pets" checked={L.pets} onChange={(b) => setL({ pets: b })} />
                <Toggle label="School-going kids" checked={L.schoolKids} onChange={(b) => setL({ schoolKids: b })} />
              </div>
              {L.schoolKids && (
                <Field label="School pickup time">
                  <input type="time" className="input !w-36" value={L.schoolPickupTime} onChange={(e) => setL({ schoolPickupTime: e.target.value })} aria-label="School pickup time" />
                </Field>
              )}
              <Field label="Outdoor exercise">
                <ChoiceChips label="Exercise habit" value={L.exerciseHabits} onChange={(v) => setL({ exerciseHabits: v })}
                  options={[{ v: 'daily', l: 'Daily' }, { v: 'weekends', l: 'Weekends' }, { v: 'rarely', l: 'Rarely' }, { v: 'none', l: 'Never' }]} />
              </Field>
              <Field label="Budget for air-quality fixes">
                <ChoiceChips label="Budget" value={L.budget} onChange={(v) => setL({ budget: v })}
                  options={[{ v: 'low', l: 'Low' }, { v: 'medium', l: 'Medium' }, { v: 'high', l: 'High' }]} />
              </Field>
            </>)}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex gap-3 mt-8 sticky bottom-0 py-3 bg-gradient-to-t from-canvas via-canvas/70 to-transparent">
        {step > 0 && <button className="btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={16} />Back</button>}
        <button className="btn-primary flex-1" disabled={!canNext}
          onClick={() => (step < 2 ? setStep(step + 1) : completeOnboarding())}>
          {step < 2 ? t('onboarding.continue') : t('onboarding.finish')}<ArrowRight size={16} />
        </button>
      </div>
      <p className="text-xs text-fg/50 text-center mt-2">⚕️ {t('disclaimer')}</p>
    </main>
  );
}
