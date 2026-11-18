import express from 'express';

const router = express.Router();

// ============================================================
// IMPACT ENGINE — Deterministic calculations, NOT AI-generated
// All formulas and emission factors documented here with sources
// ============================================================

// Inhalation rates by age group (m³/day)
// Source: WHO Environmental Health Criteria 237 (2005), Table 4.1
// Also: US EPA Exposure Factors Handbook (2011 Edition), Table 6-2
const INHALATION_RATES_M3_PER_HOUR: Record<string, number> = {
  infant: 0.21,       // 0–1 year: ~5 m³/day ÷ 24
  toddler: 0.29,      // 1–3 years: ~7 m³/day ÷ 24
  child: 0.42,        // 3–12 years: ~10 m³/day ÷ 24  
  teen: 0.58,         // 12–18 years: ~14 m³/day ÷ 24
  adult: 0.63,        // 18–65 years: ~15 m³/day ÷ 24
  adult_active: 1.25, // Adult during moderate exercise: ~30 m³/day ÷ 24
  senior: 0.54,       // 65+ years: ~13 m³/day ÷ 24
};

// Infiltration factors (indoor/outdoor concentration ratio)
// Source: Chen & Zhao (2011) Indoor Air journal, Table 2 average values
// Source: Lunden et al. (2003) Environ Sci Technol; WHO Housing and Health (2018)
const INFILTRATION_FACTORS: Record<string, number> = {
  windows_open_no_purifier: 0.75,     // Windows open, no purifier
  windows_closed_no_purifier: 0.50,   // Well-sealed, no purifier
  windows_closed_with_purifier: 0.15, // Sealed + HEPA purifier running
  windows_open_with_purifier: 0.40,   // Open + purifier (less effective)
};

// Relative exposure by commute mode (dimensionless multiplier vs ambient outdoor)
// Source: Rank et al. (2001) Environ Sci Technol; Zuurbier et al. (2010) Epidemiology
// Source: HEI Research Report 155 (Rider et al. 2010)
const COMMUTE_EXPOSURE_FACTORS: Record<string, { factor: number; description: string }> = {
  walk: {
    factor: 1.0,
    description: 'Walking: at ambient outdoor level (reference)',
  },
  bike: {
    factor: 1.3,
    description: 'Cycling: ~30% higher due to elevated breathing rate and proximity to traffic',
  },
  bus: {
    factor: 0.9,
    description: 'Bus: slightly lower due to some in-vehicle filtering, but exposure to exhaust at stops',
  },
  metro: {
    factor: 0.5,
    description: 'Metro/subway: ~50% of outdoor ambient on average (enclosed, filtered air in modern systems)',
  },
  car_ac_recirc: {
    factor: 0.4,
    description: 'Car with AC on recirculation: significantly lower (recirculation reduces intake of outdoor air)',
  },
  car_windows_open: {
    factor: 0.8,
    description: 'Car with windows open: moderate exposure from traffic',
  },
  two_wheeler: {
    factor: 1.5,
    description: 'Two-wheeler/scooter: ~50% higher — no cabin, elevated near-road concentration',
  },
};

// CO2 and PM emission factors per km per vehicle type
// Source: IPCC AR6 WGIII Transport Chapter emission factors (2022)
// Source: India CPCB Vehicular Emission Standards & MoEFCC inventory (2019)
// Source: Our World in Data - Travel CO2 calculator methodology (using IEA/IPCC)
const EMISSION_FACTORS: Record<string, { co2_g_per_km: number; pm_mg_per_km: number; source: string }> = {
  walk:        { co2_g_per_km: 0,   pm_mg_per_km: 0,    source: 'No direct emissions' },
  bike:        { co2_g_per_km: 0,   pm_mg_per_km: 0,    source: 'No direct emissions' },
  ebike:       { co2_g_per_km: 8,   pm_mg_per_km: 0,    source: 'India grid average 0.82 kgCO2/kWh (CEA 2022-23), ~10 Wh/km' },
  metro:       { co2_g_per_km: 25,  pm_mg_per_km: 0.5,  source: 'India metro average per passenger-km (MoHUA 2022); Delhi Metro ~25 gCO2/pkm' },
  bus:         { co2_g_per_km: 68,  pm_mg_per_km: 15,   source: 'India BS-VI bus per passenger-km (CPCB 2021); avg 20 pax' },
  car_petrol:  { co2_g_per_km: 170, pm_mg_per_km: 2,    source: 'India average petrol car; IPCC AR6 WGIII Table 10.A.1 (2022)' },
  car_diesel:  { co2_g_per_km: 155, pm_mg_per_km: 12,   source: 'India average diesel car; higher PM due to diesel exhaust' },
  car_ev:      { co2_g_per_km: 46,  pm_mg_per_km: 0.5,  source: 'India grid ~0.82 kgCO2/kWh (CEA 2022-23); EV ~0.056 kWh/km; non-exhaust PM from brakes/tyres' },
  car_cng:     { co2_g_per_km: 130, pm_mg_per_km: 1,    source: 'CNG car; lower PM and CO2 vs petrol; CPCB emission norms 2021' },
  two_petrol:  { co2_g_per_km: 68,  pm_mg_per_km: 50,   source: '2-wheeler petrol BS-VI; CPCB vehicular emission inventory 2019' },
  two_ev:      { co2_g_per_km: 25,  pm_mg_per_km: 0.5,  source: '2-wheeler EV; India grid factor; non-exhaust PM only' },
};

// Mask filtration efficiency
// Source: CDC respirator guidance; NIOSH 42 CFR Part 84 standards
// Source: Cherrie et al. (2018) Ann Work Expo Health for cloth masks
const MASK_FILTRATION: Record<string, { efficiency: number; description: string }> = {
  none:   { efficiency: 0,    description: 'No mask' },
  cloth:  { efficiency: 0.50, description: 'Cloth/fabric mask: ~50% filtration for PM2.5 (variable; Clase & Bharat 2021)' },
  surgical: { efficiency: 0.70, description: 'Surgical/medical mask: ~70% when fitted (not sealed)' },
  n95:    { efficiency: 0.95, description: 'N95/FFP2 respirator: 95% filtration efficiency (properly fitted, NIOSH-certified)' },
};

router.post('/exposure', async (req, res) => {
  try {
    const { scenario } = req.body;
    if (!scenario) return res.status(400).json({ error: 'scenario required' });

    const {
      pm2_5_ugm3,          // ambient PM2.5 μg/m³ (from live API)
      ageGroup = 'adult',  // infant|toddler|child|teen|adult|senior
      location = 'outdoor',// outdoor|indoor
      indoorConfig = 'windows_closed_no_purifier',
      commute = 'walk',
      commuteHours = 1,
      mask = 'none',
      activityLevel = 'resting', // resting|active
    } = scenario;

    if (typeof pm2_5_ugm3 !== 'number' || pm2_5_ugm3 < 0) {
      return res.status(400).json({ error: 'pm2_5_ugm3 must be a non-negative number' });
    }

    // 1. Effective concentration based on location
    const infiltration = location === 'indoor'
      ? INFILTRATION_FACTORS[indoorConfig] ?? 0.5
      : 1.0;

    const commuteFactor = COMMUTE_EXPOSURE_FACTORS[commute]?.factor ?? 1.0;
    
    // 2. Concentration at breathing zone
    const effectiveConc = pm2_5_ugm3 * (location === 'outdoor' ? commuteFactor : infiltration);

    // 3. Mask reduction
    const maskEff = MASK_FILTRATION[mask]?.efficiency ?? 0;
    const maskedConc = effectiveConc * (1 - maskEff);

    // 4. Inhalation rate
    const baseRate = activityLevel === 'active'
      ? INHALATION_RATES_M3_PER_HOUR.adult_active
      : INHALATION_RATES_M3_PER_HOUR[ageGroup] ?? INHALATION_RATES_M3_PER_HOUR.adult;

    // 5. Dose = concentration (μg/m³) × inhalation rate (m³/h) × duration (h)
    const dose_ug = maskedConc * baseRate * commuteHours;

    return res.json({
      inputs: { pm2_5_ugm3, ageGroup, location, indoorConfig, commute, commuteHours, mask, activityLevel },
      effectiveConcentration_ugm3: +effectiveConc.toFixed(2),
      maskedConcentration_ugm3: +maskedConc.toFixed(2),
      inhalationRate_m3h: +baseRate.toFixed(3),
      dose_ug: +dose_ug.toFixed(3),
      factors: {
        infiltration: location === 'indoor' ? infiltration : null,
        commuteFactor: location === 'outdoor' ? commuteFactor : null,
        maskEfficiency: maskEff,
        commuteDescription: COMMUTE_EXPOSURE_FACTORS[commute]?.description,
        maskDescription: MASK_FILTRATION[mask]?.description,
      },
      methodology: {
        inhalationSource: 'WHO EHC 237 (2005) Table 4.1; US EPA Exposure Factors Handbook (2011)',
        infiltrationSource: 'Chen & Zhao (2011) Indoor Air; WHO Housing and Health Guidelines (2018)',
        commuteSource: 'Rank et al. (2001) Environ Sci Technol; Zuurbier et al. (2010) Epidemiology; HEI Report 155',
        maskSource: 'NIOSH 42 CFR Part 84; CDC respirator guidance; Cherrie et al. (2018) Ann Work Expo Health',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/emissions', async (req, res) => {
  try {
    const { currentMode, alternativeMode, distanceKm } = req.body;
    if (!currentMode || !alternativeMode || !distanceKm) {
      return res.status(400).json({ error: 'currentMode, alternativeMode, distanceKm required' });
    }

    const current = EMISSION_FACTORS[currentMode];
    const alternative = EMISSION_FACTORS[alternativeMode];

    if (!current) return res.status(400).json({ error: `Unknown mode: ${currentMode}` });
    if (!alternative) return res.status(400).json({ error: `Unknown mode: ${alternativeMode}` });

    const co2_saved_g = (current.co2_g_per_km - alternative.co2_g_per_km) * distanceKm;
    const pm_saved_mg = (current.pm_mg_per_km - alternative.pm_mg_per_km) * distanceKm;

    return res.json({
      currentMode: { ...current, mode: currentMode },
      alternativeMode: { ...alternative, mode: alternativeMode },
      distanceKm,
      co2SavedPerTrip_g: +co2_saved_g.toFixed(1),
      co2SavedPerTrip_kg: +(co2_saved_g / 1000).toFixed(3),
      pmSavedPerTrip_mg: +pm_saved_mg.toFixed(1),
      co2SavedPerWeek_kg: +(co2_saved_g * 10 / 1000).toFixed(2), // 5 days × 2 trips
      co2SavedPerYear_kg: +(co2_saved_g * 500 / 1000).toFixed(1), // 250 days × 2 trips
      methodology: {
        co2Source: 'IPCC AR6 WGIII Transport Ch.10 Table 10.A.1 (2022); CEA India Grid 2022-23; MoHUA Metro Report 2022',
        pmSource: 'CPCB Vehicular Emission Inventory 2019; India BS-VI emission norms',
        note: 'Per-passenger-km for public transport assuming average occupancy. Non-exhaust PM (tyre/brake wear) included for EVs.',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/emission-factors', (_req, res) => {
  return res.json({
    commuteModes: COMMUTE_EXPOSURE_FACTORS,
    emissionFactors: EMISSION_FACTORS,
    maskFiltration: MASK_FILTRATION,
    inhalationRates: INHALATION_RATES_M3_PER_HOUR,
    infiltrationFactors: INFILTRATION_FACTORS,
  });
});



// ============================================================
// CHOICES — before/after exposure & emissions for concrete actions.
// 100% deterministic: dose(µg) = concentration(µg/m³) × inhalation(m³/h) × hours
// ============================================================
const EXERCISE_MULTIPLIER = 2.0; // moderate exercise ≈ 2× resting ventilation (US EPA Exposure Factors Handbook 2011, Ch. 6)

function currentCommuteKey(lifestyle: any): string {
  switch (lifestyle?.commute) {
    case 'walk': return 'walk';
    case 'bike': return 'bike';
    case 'bus': return 'bus';
    case 'metro': return 'metro';
    case 'two_wheeler': return 'two_wheeler';
    case 'car': return lifestyle?.hasAC ? 'car_ac_recirc' : 'car_windows_open';
    default: return 'walk';
  }
}
function emissionKey(lifestyle: any): string | null {
  const v = lifestyle?.vehicle;
  switch (lifestyle?.commute) {
    case 'walk': return 'walk';
    case 'bike': return 'bike';
    case 'bus': return 'bus';
    case 'metro': return 'metro';
    case 'two_wheeler': return v === 'ev' ? 'two_ev' : 'two_petrol';
    case 'car': return v === 'ev' ? 'car_ev' : v === 'diesel' ? 'car_diesel' : v === 'cng' ? 'car_cng' : 'car_petrol';
    default: return null; // wfh
  }
}
function indoorKey(lifestyle: any): string {
  const open = lifestyle?.windowType === 'open';
  const purifier = !!lifestyle?.hasPurifier;
  if (open) return purifier ? 'windows_open_with_purifier' : 'windows_open_no_purifier';
  return purifier ? 'windows_closed_with_purifier' : 'windows_closed_no_purifier';
}
const round = (n: number, d = 1) => +n.toFixed(d);
const rateFor = (ageGroup: string) => INHALATION_RATES_M3_PER_HOUR[ageGroup] ?? INHALATION_RATES_M3_PER_HOUR.adult;

router.post('/choices', (req, res) => {
  const { pm2_5, habitPm2_5, bestPm2_5, lifestyle = {}, ageGroup = 'adult', alternativeMode = 'metro' } = req.body || {};
  if (![pm2_5, habitPm2_5, bestPm2_5].every((x) => typeof x === 'number' && x >= 0)) {
    return res.status(400).json({ error: 'pm2_5, habitPm2_5 and bestPm2_5 must be non-negative numbers' });
  }
  const rate = rateFor(ageGroup);
  const commuteKm = Number(lifestyle.commuteKm) > 0 ? Number(lifestyle.commuteKm) : 0;
  const commuteHours = Math.max(Number(lifestyle.commuteDuration) || 0, 0) / 60 * 2; // round trip
  const curKey = currentCommuteKey(lifestyle);
  const curFactor = COMMUTE_EXPOSURE_FACTORS[curKey].factor;
  const curMaskEff = MASK_FILTRATION[lifestyle.maskType || 'none']?.efficiency ?? 0;
  const choices: any[] = [];

  // 1. Shift outdoor exercise/walk to the cleanest window (1 hour of moderate activity)
  {
    const rateEx = rate * EXERCISE_MULTIPLIER;
    const before = habitPm2_5 * rateEx, after = bestPm2_5 * rateEx;
    choices.push({
      id: 'shift_outdoor', before_ug: round(before, 2), after_ug: round(after, 2),
      doseAvoided_ug: round(Math.max(before - after, 0), 2),
      percent: before > 0 ? round(Math.max((before - after) / before, 0) * 100, 0) : 0,
      co2Avoided_g: 0,
      inputs: { habitPm2_5, bestPm2_5, hours: 1, inhalation_m3h: round(rateEx, 2) },
      formula: 'dose = PM2.5 × (resting rate × 2.0 for exercise) × 1 h; before = your usual hour, after = forecast cleanest window',
    });
  }

  // 2. Wear an N95 on the daily commute (if not already)
  if (commuteHours > 0 && curKey !== 'metro' && curKey !== 'car_ac_recirc') {
    const conc = pm2_5 * curFactor;
    const before = conc * (1 - curMaskEff) * rate * commuteHours;
    const after = conc * (1 - MASK_FILTRATION.n95.efficiency) * rate * commuteHours;
    choices.push({
      id: 'wear_n95', before_ug: round(before, 2), after_ug: round(after, 2),
      doseAvoided_ug: round(Math.max(before - after, 0), 2),
      percent: before > 0 ? round(Math.max((before - after) / before, 0) * 100, 0) : 0,
      co2Avoided_g: 0,
      inputs: { pm2_5, commuteMode: curKey, commuteFactor: curFactor, hours: round(commuteHours, 2), maskNow: lifestyle.maskType || 'none', inhalation_m3h: round(rate, 2) },
      formula: 'dose = PM2.5 × mode factor × (1 − mask efficiency) × inhalation × commute hours (round trip); N95 nominal 95%, fit-dependent',
    });
  }

  // 3. Close windows + run a purifier for 8 indoor hours
  {
    const curIdx = indoorKey(lifestyle);
    const target = 'windows_closed_with_purifier';
    if (curIdx !== target) {
      const before = pm2_5 * INFILTRATION_FACTORS[curIdx] * rate * 8;
      const after = pm2_5 * INFILTRATION_FACTORS[target] * rate * 8;
      choices.push({
        id: 'purifier_closed', before_ug: round(before, 2), after_ug: round(after, 2),
        doseAvoided_ug: round(Math.max(before - after, 0), 2),
        percent: before > 0 ? round(Math.max((before - after) / before, 0) * 100, 0) : 0,
        co2Avoided_g: 0,
        inputs: { pm2_5, indoorNow: curIdx, indoorTarget: target, hours: 8, inhalation_m3h: round(rate, 2) },
        formula: 'dose = outdoor PM2.5 × indoor/outdoor ratio × inhalation × 8 h',
      });
    }
  }

  // 4. Switch commute mode (exposure + emissions)
  if (commuteKm > 0 && EMISSION_FACTORS[alternativeMode]) {
    const altExposureKey = ({ ebike: 'bike', car_ev: 'car_ac_recirc', two_ev: 'two_wheeler', car_cng: 'car_ac_recirc' } as any)[alternativeMode]
      || ({ metro: 'metro', bus: 'bus', walk: 'walk', bike: 'bike' } as any)[alternativeMode] || 'walk';
    const altFactor = COMMUTE_EXPOSURE_FACTORS[altExposureKey]?.factor ?? 1;
    const before = pm2_5 * curFactor * rate * commuteHours;
    const after = pm2_5 * altFactor * rate * commuteHours;
    const ek = emissionKey(lifestyle);
    const co2 = ek ? (EMISSION_FACTORS[ek].co2_g_per_km - EMISSION_FACTORS[alternativeMode].co2_g_per_km) * commuteKm * 2 : 0;
    const pm = ek ? (EMISSION_FACTORS[ek].pm_mg_per_km - EMISSION_FACTORS[alternativeMode].pm_mg_per_km) * commuteKm * 2 : 0;
    if (curKey !== altExposureKey || co2 > 0) {
      choices.push({
        id: 'switch_commute', before_ug: round(before, 2), after_ug: round(after, 2),
        doseAvoided_ug: round(Math.max(before - after, 0), 2),
        percent: before > 0 ? round(Math.max((before - after) / before, 0) * 100, 0) : 0,
        co2Avoided_g: round(Math.max(co2, 0), 0), pmEmissionAvoided_mg: round(Math.max(pm, 0), 1),
        alternativeMode,
        inputs: { from: ek, to: alternativeMode, km_roundTrip: commuteKm * 2, exposureFrom: curKey, exposureTo: altExposureKey },
        formula: 'exposure: PM2.5 × mode factor × inhalation × hours; CO₂ = (EF_current − EF_alt) g/km × round-trip km',
      });
    }
  }

  // 5. Work from home for a day (skips the commute)
  if (commuteKm > 0 && commuteHours > 0) {
    const ek = emissionKey(lifestyle);
    const before = pm2_5 * curFactor * (1 - curMaskEff) * rate * commuteHours;
    const homeHours = commuteHours;
    const after = pm2_5 * INFILTRATION_FACTORS[indoorKey(lifestyle)] * rate * homeHours;
    const co2 = ek ? EMISSION_FACTORS[ek].co2_g_per_km * commuteKm * 2 : 0;
    choices.push({
      id: 'wfh_day', before_ug: round(before, 2), after_ug: round(after, 2),
      doseAvoided_ug: round(Math.max(before - after, 0), 2),
      percent: before > 0 ? round(Math.max((before - after) / before, 0) * 100, 0) : 0,
      co2Avoided_g: round(co2, 0),
      inputs: { pm2_5, commuteMode: curKey, indoorNow: indoorKey(lifestyle), hours: round(homeHours, 2), km_roundTrip: commuteKm * 2 },
      formula: 'avoided = commute dose − same hours spent indoors; CO₂ = EF × round-trip km',
    });
  }

  return res.json({
    ageGroup, inhalation_m3h: round(rate, 2), choices,
    note: 'Estimates for one typical day using literature-based factors; real exposure varies.',
    methodology: {
      inhalationSource: 'WHO EHC 237 (2005); US EPA Exposure Factors Handbook (2011)',
      infiltrationSource: 'Chen & Zhao (2011) Indoor Air; WHO Housing and Health Guidelines (2018)',
      commuteSource: 'Rank et al. (2001); Zuurbier et al. (2010); HEI Report 155',
      maskSource: 'NIOSH 42 CFR Part 84; Cherrie et al. (2018)',
      emissionSource: 'IPCC AR6 WGIII Ch.10; CEA India grid 2022-23; CPCB inventory 2019',
      exerciseMultiplier: EXERCISE_MULTIPLIER,
    },
  });
});

// ============================================================
// ROOM SIZE → CADR / ACH.  CADR (m³/h) = ACH × volume.
// "Rule of thumb": CADR ≥ 2/3 of floor area in ft² (AHAM 2-thirds rule, 8 ft ceilings) — we use ACH form.
// ============================================================
router.get('/room', (req, res) => {
  const area = parseFloat(req.query.area as string);
  const height = parseFloat((req.query.height as string) || '2.7');
  const ach = parseFloat((req.query.ach as string) || '5');
  const cadrOwned = req.query.cadr ? parseFloat(req.query.cadr as string) : null;
  if (!(area > 0 && area <= 500) || !(height >= 2 && height <= 6) || !(ach > 0 && ach <= 12)) {
    return res.status(400).json({ error: 'area (1–500 m²), height (2–6 m), ach (1–12) required' });
  }
  const volume = area * height;
  const requiredCadr = Math.round(volume * ach);
  return res.json({
    areaM2: area, heightM: height, volumeM3: round(volume, 1), targetACH: ach, requiredCadr_m3h: requiredCadr,
    ownedCadr_m3h: cadrOwned, achWithOwned: cadrOwned ? round(cadrOwned / volume, 1) : null,
    formula: 'CADR (m³/h) = ACH × room volume (m³); 4–6 ACH is typical guidance for polluted air (AHAM/ASHRAE 241 principles)',
  });
});

export { router as impactRouter };
