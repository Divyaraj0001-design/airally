import { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useProfileStore } from '../../store/profileStore';

export default function AlertSettings() {
  const { profile, setProfile, setAlertThreshold } = useProfileStore();
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const on = profile.alerts.enabled;

  const toggle = async () => {
    if (!on && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      setPerm(await Notification.requestPermission());
    }
    setProfile({ alerts: { ...profile.alerts, enabled: !on } });
  };

  return (
    <div className="space-y-3">
      <button onClick={toggle} role="switch" aria-checked={on} className={`btn w-full ${on ? 'btn-primary' : 'btn-ghost'}`}>
        {on ? <Bell size={16} /> : <BellOff size={16} />}{on ? 'Alerts on' : 'Turn on alerts'}
      </button>
      <label className="block">
        <span className="label">Alert me when US AQI is above <span className="text-fg font-bold">{profile.alerts.threshold}</span></span>
        <input type="range" min={50} max={300} step={10} value={profile.alerts.threshold} onChange={(e) => setAlertThreshold(+e.target.value)} className="w-full mt-2 accent-[rgb(var(--brand))]" aria-label="Alert threshold AQI" />
      </label>
      <p className="text-xs text-fg/60 leading-relaxed">
        {perm === 'denied' && 'Browser notifications are blocked — you will still see the in-app banner. '}
        {perm === 'unsupported' && 'This browser has no notification support — in-app banner only. '}
        Honest limits: checks run every 10 minutes <strong>while AirAlly is open</strong> (including the installed app). It can’t wake itself in the background without a push server, so close the app and you won’t be notified.
      </p>
    </div>
  );
}
