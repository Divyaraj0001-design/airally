import { useTranslation } from 'react-i18next';

export default function Footer({ onAbout }: { onAbout: () => void }) {
  const { t } = useTranslation();
  return (
    <footer className="mx-auto max-w-[1320px] lg:px-6 px-4 pt-6 pb-4 text-xs text-fg/60 space-y-2">
      <p>⚕️ {t('disclaimer')}</p>
      <p>
        Air &amp; weather data: <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0) ·
        Map &amp; places: © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> ·
        AI: <a className="underline" href="https://groq.com/" target="_blank" rel="noreferrer">Groq</a> ·
        Ground stations: <a className="underline" href="https://waqi.info/" target="_blank" rel="noreferrer">WAQI</a>
      </p>
      <button onClick={onAbout} className="underline font-semibold">Data sources &amp; methodology</button>
    </footer>
  );
}
