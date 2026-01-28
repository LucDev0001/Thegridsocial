export const fakeMsgs = [
  {
    t: "Hello from New York! The city never sleeps.",
    l: "en-US",
    lat: 40.71,
    lng: -74.0,
    likes: 85,
  },
  {
    t: "Saludos desde Madrid, disfrutando el sol.",
    l: "es-ES",
    lat: 40.41,
    lng: -3.7,
    likes: 42,
  },
  {
    t: "Tokyo is amazing at night, neon lights everywhere.",
    l: "ja-JP",
    lat: 35.67,
    lng: 139.65,
    likes: 150,
  },
  {
    t: "O Rio de Janeiro continua lindo e quente!",
    l: "pt-BR",
    lat: -22.9,
    lng: -43.17,
    likes: 95,
  },
  { t: "Berlin calling", l: "de-DE", lat: 52.52, lng: 13.4, likes: 30 },
  { t: "Love from Paris", l: "fr-FR", lat: 48.85, lng: 2.35, likes: 60 },
  {
    t: "Sydney opera house view",
    l: "en-AU",
    lat: -33.86,
    lng: 151.2,
    likes: 25,
  },
  { t: "Moscow winter is cold", l: "ru-RU", lat: 55.75, lng: 37.61, likes: 15 },
  { t: "Cairo pyramids", l: "ar-EG", lat: 30.04, lng: 31.23, likes: 70 },
  { t: "Mumbai traffic!", l: "hi-IN", lat: 19.07, lng: 72.87, likes: 55 },
  { t: "Cape Town vibes", l: "en-ZA", lat: -33.92, lng: 18.42, likes: 20 },
  { t: "Buenos Aires tango", l: "es-AR", lat: -34.6, lng: -58.38, likes: 35 },
  { t: "Shanghai skyline", l: "zh-CN", lat: 31.23, lng: 121.47, likes: 80 },
  { t: "Istanbul bridge", l: "tr-TR", lat: 41.0, lng: 28.97, likes: 45 },
  {
    t: "Seoul food is the best",
    l: "ko-KR",
    lat: 37.56,
    lng: 126.97,
    likes: 90,
  },
  {
    t: "Greetings from Toronto!",
    l: "en-CA",
    lat: 43.65,
    lng: -79.38,
    likes: 28,
  },
  {
    t: "Mexico City is vibrant.",
    l: "es-MX",
    lat: 19.43,
    lng: -99.13,
    likes: 65,
  },
  {
    t: "Lagos energy is unmatched.",
    l: "en-NG",
    lat: 6.52,
    lng: 3.37,
    likes: 12,
  },
  {
    t: "Jakarta traffic but good food.",
    l: "id-ID",
    lat: -6.2,
    lng: 106.81,
    likes: 18,
  },
  {
    t: "Bangkok street food heaven.",
    l: "th-TH",
    lat: 13.75,
    lng: 100.5,
    likes: 75,
  },
  {
    t: "Dubai futuristic vibes.",
    l: "ar-AE",
    lat: 25.2,
    lng: 55.27,
    likes: 110,
  },
  { t: "Rome, eternal city.", l: "it-IT", lat: 41.9, lng: 12.49, likes: 58 },
  {
    t: "Amsterdam canals are beautiful.",
    l: "nl-NL",
    lat: 52.36,
    lng: 4.9,
    likes: 33,
  },
  {
    t: "Stockholm archipelago.",
    l: "sv-SE",
    lat: 59.32,
    lng: 18.06,
    likes: 22,
  },
  { t: "Auckland harbour.", l: "en-NZ", lat: -36.84, lng: 174.76, likes: 19 },
];

export const baseStats = {
  us: 1240,
  br: 985,
  jp: 850,
  de: 720,
  ru: 610,
  cn: 590,
  gb: 540,
  fr: 490,
  in: 430,
  es: 380,
};

export const langToFlag = {
  pt: "🇧🇷",
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  ja: "🇯🇵",
  zh: "🇨🇳",
  ru: "🇷🇺",
  hi: "🇮🇳",
  ar: "🇸🇦",
  it: "🇮🇹",
  ko: "🇰🇷",
  tr: "🇹🇷",
};

export const bannedWords = [
  "badword",
  "spam",
  "offensive",
  "idiot",
  "stupid",
  "hate",
  "kill",
  "death",
  "xxx",
  "porn",
];

export function containsProfanity(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return bannedWords.some((word) => lowerText.includes(word));
}
