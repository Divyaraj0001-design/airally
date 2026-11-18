import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import { NearbyPlaces, NearbyPlace } from '../../store/dataStore';

const KINDS: { key: keyof NearbyPlaces; color: string; label: string; icon: string }[] = [
  { key: 'parks', color: '#009E73', label: 'Park', icon: '🌳' },
  { key: 'transit', color: '#0072B2', label: 'Metro / rail', icon: '🚇' },
  { key: 'busStops', color: '#56B4E9', label: 'Bus stop', icon: '🚌' },
  { key: 'bikeRentals', color: '#F0E442', label: 'Cycle rental', icon: '🚲' },
  { key: 'clinics', color: '#D55E00', label: 'Clinic / hospital', icon: '🏥' },
];

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lon]); }, [lat, lon, map]);
  return null;
}

export default function MapView({ lat, lon, nearby, radius = 3000 }: { lat: number; lon: number; nearby: NearbyPlaces | null; radius?: number }) {
  return (
    <div>
      <div className="h-72 rounded-2xl overflow-hidden border border-fg/10">
        <MapContainer center={[lat, lon]} zoom={13} scrollWheelZoom={false} className="h-full w-full" aria-label="Map of nearby parks, transit and clinics">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Recenter lat={lat} lon={lon} />
          <Circle center={[lat, lon]} radius={radius} pathOptions={{ color: '#38bdf8', weight: 1, fillOpacity: 0.04, dashArray: '4 4' }} />
          <CircleMarker center={[lat, lon]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}><Popup>You are here</Popup></CircleMarker>
          {nearby && KINDS.flatMap((k) => ((nearby[k.key] as NearbyPlace[]) || []).map((p, i) => (
            <CircleMarker key={`${k.key}-${i}`} center={[p.lat, p.lon]} radius={7} pathOptions={{ color: '#0f172a', weight: 1.5, fillColor: k.color, fillOpacity: 0.95 }}>
              <Popup><strong>{k.icon} {p.name}</strong><br />{k.label} · {p.dist} km away</Popup>
            </CircleMarker>
          )))}
        </MapContainer>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-fg/70">
        {KINDS.map((k) => <li key={k.key} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-fg/40" style={{ background: k.color }} aria-hidden="true" />{k.icon} {k.label}</li>)}
      </ul>
    </div>
  );
}
