import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const en = {
  "app": { "name": "AirAlly", "tagline": "Urban Air Quality Assistant" },
  "nav": { "dashboard": "Dashboard", "plan": "Daily Plan", "indoor": "Indoor Hacks", "alternatives": "Alternatives", "impact": "Impact", "chat": "AI Chat" },
  "dashboard": {
    "liveAqi": "Live AQI", "usAqi": "US AQI", "naqi": "India NAQI",
    "dominant": "Dominant Pollutant", "lastUpdated": "Last updated",
    "whoLimit": "WHO 24h limit", "times": "× WHO limit",
    "forecast": "5-Day Forecast", "history": "24h History",
    "goodWindow": "Good air window", "weatherContext": "Weather Context",
    "nearbyPlaces": "Nearby Places", "groundStation": "Ground Station (WAQI)",
    "modelData": "Model Data (Open-Meteo)", "retry": "Retry",
    "loading": "Fetching live air quality data...",
    "smogReason": "Why is air quality poor today?"
  },
  "pollutants": { "pm2_5": "PM2.5", "pm10": "PM10", "no2": "NO₂", "o3": "O₃", "so2": "SO₂", "co": "CO" },
  "plan": {
    "title": "AI Daily Plan", "generating": "Generating personalized plan...",
    "today": "Today", "tomorrow": "Tomorrow",
    "bestWindows": "Best Outdoor Windows", "ventilation": "Ventilation Windows",
    "memberAdvice": "Family Member Guidance", "maskRequired": "Mask Required", "maskType": "Mask Type"
  },
  "indoor": {
    "title": "Indoor Air Quality Hacks", "purifier": "Purifier Recommendation",
    "cadr": "Recommended CADR", "cooking": "Cooking Tips",
    "plants": "Plant Facts vs Myths", "diy": "DIY Box Fan Filter"
  },
  "alternatives": {
    "title": "Sustainable Alternatives", "current": "Your current",
    "switch": "Switch to", "co2Saved": "CO₂ saved/day", "community": "Community Actions"
  },
  "impact": {
    "title": "Impact Explainer", "exposure": "Your Exposure Dose",
    "before": "Before change", "after": "After change",
    "methodology": "How we calculated this",
    "saved": "Exposure Saved", "co2Avoided": "CO₂ Avoided"
  },
  "chat": {
    "title": "Ask AirAlly",
    "placeholder": "Ask about air quality, health tips, or your routine...",
    "send": "Send", "listening": "Listening...", "suggestions": "Suggested questions"
  },
  "onboarding": {
    "step1": "Your Location", "step2": "Your Household", "step3": "Your Lifestyle",
    "detect": "Detect my location", "search": "Search a city",
    "addLocation": "Add location", "members": "Household members",
    "sensitivities": "Health sensitivities", "commute": "How do you commute?",
    "cooking": "Cooking fuel", "continue": "Continue", "finish": "Get Started"
  },
  "errors": {
    "fetchFailed": "Failed to fetch data. Please retry.",
    "noLocation": "No location set. Please set your location.",
    "aiError": "AI response failed. Please retry.",
    "offline": "You are offline. Showing last known data."
  },
  "disclaimer": "AirAlly provides air quality information based on published guidelines. This is NOT medical advice. For health symptoms, consult a doctor immediately.",
  "attribution": "Data: Open-Meteo (CC BY 4.0) · OpenStreetMap contributors (ODbL) · AI: Google Gemini · WAQI"
};

const hi = {
  "app": { "name": "एयरअली", "tagline": "शहरी वायु गुणवत्ता सहायक" },
  "nav": { "dashboard": "डैशबोर्ड", "plan": "दैनिक योजना", "indoor": "इनडोर टिप्स", "alternatives": "विकल्प", "impact": "प्रभाव", "chat": "AI चैट" },
  "dashboard": {
    "liveAqi": "लाइव AQI", "usAqi": "US AQI", "naqi": "भारत NAQI",
    "dominant": "प्रमुख प्रदूषक", "lastUpdated": "अंतिम अपडेट",
    "whoLimit": "WHO 24h सीमा", "times": "× WHO सीमा",
    "forecast": "5-दिन पूर्वानुमान", "history": "24h इतिहास",
    "goodWindow": "अच्छी हवा का समय", "weatherContext": "मौसम की जानकारी",
    "nearbyPlaces": "नज़दीकी स्थान", "groundStation": "ग्राउंड स्टेशन (WAQI)",
    "modelData": "मॉडल डेटा", "retry": "पुनः प्रयास",
    "loading": "लाइव डेटा लोड हो रहा है...",
    "smogReason": "आज वायु गुणवत्ता खराब क्यों है?"
  },
  "pollutants": { "pm2_5": "PM2.5", "pm10": "PM10", "no2": "NO₂", "o3": "O₃", "so2": "SO₂", "co": "CO" },
  "plan": {
    "title": "AI दैनिक योजना", "generating": "व्यक्तिगत योजना बना रहे हैं...",
    "today": "आज", "tomorrow": "कल",
    "bestWindows": "बाहर जाने का सबसे अच्छा समय", "ventilation": "घर को हवादार करने का समय",
    "memberAdvice": "परिवार के सदस्यों के लिए सुझाव", "maskRequired": "मास्क ज़रूरी", "maskType": "मास्क प्रकार"
  },
  "indoor": {
    "title": "इनडोर वायु गुणवत्ता सुझाव", "purifier": "एयर प्यूरीफायर की सिफारिश",
    "cadr": "अनुशंसित CADR", "cooking": "खाना पकाने के सुझाव",
    "plants": "पौधे: तथ्य vs मिथक", "diy": "DIY बॉक्स फैन फिल्टर"
  },
  "alternatives": {
    "title": "टिकाऊ विकल्प", "current": "आपका वर्तमान",
    "switch": "बदलें", "co2Saved": "CO₂ बचाया/दिन", "community": "सामुदायिक कार्य"
  },
  "impact": {
    "title": "प्रभाव समझाइए", "exposure": "आपकी एक्सपोज़र मात्रा",
    "before": "बदलाव से पहले", "after": "बदलाव के बाद",
    "methodology": "हमने यह कैसे गणना की",
    "saved": "एक्सपोज़र बचाया", "co2Avoided": "CO₂ से बचा"
  },
  "chat": {
    "title": "एयरअली से पूछें",
    "placeholder": "वायु गुणवत्ता, स्वास्थ्य या दिनचर्या के बारे में पूछें...",
    "send": "भेजें", "listening": "सुन रहे हैं...", "suggestions": "सुझाए गए प्रश्न"
  },
  "onboarding": {
    "step1": "आपका स्थान", "step2": "आपका परिवार", "step3": "आपकी जीवनशैली",
    "detect": "मेरा स्थान पहचानें", "search": "शहर खोजें",
    "addLocation": "स्थान जोड़ें", "members": "घर के सदस्य",
    "sensitivities": "स्वास्थ्य संवेदनशीलता", "commute": "आप कैसे यात्रा करते हैं?",
    "cooking": "खाना पकाने का ईंधन", "continue": "जारी रखें", "finish": "शुरू करें"
  },
  "errors": {
    "fetchFailed": "डेटा लाने में विफल। कृपया पुनः प्रयास करें।",
    "noLocation": "कोई स्थान नहीं। कृपया स्थान सेट करें।",
    "aiError": "AI उत्तर विफल। कृपया पुनः प्रयास करें।",
    "offline": "आप ऑफलाइन हैं।"
  },
  "disclaimer": "एयरअली प्रकाशित दिशानिर्देशों के आधार पर वायु गुणवत्ता की जानकारी प्रदान करता है। यह चिकित्सा सलाह नहीं है।",
  "attribution": "डेटा: Open-Meteo · OpenStreetMap · AI: Google Gemini · WAQI"
};

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
