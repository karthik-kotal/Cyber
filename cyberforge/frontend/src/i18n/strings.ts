/**
 * Tiny i18n support: English + simple Hindi.
 * Keys are flat; UI components pick the language via useLang().
 * Keep wording simple for everyone to understand.
 */

export type Lang = 'en' | 'hi';

export const STRINGS = {
  app: { en: 'Community Scam Map', hi: 'Community Scam Map' },
  appTagline: {
    en: 'Report and verify scams in seconds, anonymously.',
    hi: 'सेकंडों में ठगी की शिकायत करें, गुप्त रूप से।',
  },

  // Navigation
  navReport: { en: 'Report', hi: 'शिकायत' },
  navLookup: { en: 'Check', hi: 'जांच' },
  navMap: { en: 'Map', hi: 'नक्शा' },
  navAlerts: { en: 'Alerts', hi: 'चेतावनी' },
  navDispute: { en: 'Dispute', hi: 'विवाद' },
  navLicense: { en: 'License', hi: 'लाइसेंस' },

  // Status banner
  backendOk: { en: 'Connected to the server', hi: 'सर्वर से जुड़ा हुआ है' },
  backendDown: { en: 'Cannot reach the server', hi: 'सर्वर से जुड़ा नहीं है' },
  backendChecking: { en: 'Checking server…', hi: 'सर्वर की जांच हो रही है…' },

  // States
  loading: { en: 'Loading…', hi: 'लोड हो रहा है…' },
  empty: { en: 'Nothing here yet', hi: 'अभी कुछ नहीं है' },
  tryAgain: { en: 'Try again', hi: 'फिर से कोशिश करें' },
  licenseExpired: {
    en: 'Your license has expired. Renew to keep the app running.',
    hi: 'आपका लाइसेंस समाप्त हो गया है। कृपया नवीनीकरण करें।',
  },
  enterKey: { en: 'Enter license key', hi: 'लाइसेंस कुंजी दर्ज करें' },
  renew: { en: 'Renew', hi: 'नवीनीकरण' },
  renewOk: { en: 'License renewed. Thank you!', hi: 'लाइसेंस का नवीनीकरण हो गया है।' },

  // Report page
  reportTitle: { en: 'Report a scam', hi: 'ठगी की शिकायत करें' },
  reportSubtitle: {
    en: 'No name, no phone, no address. Your report is anonymous.',
    hi: 'नाम नहीं, फोन नहीं, पता नहीं। आपकी शिकायत गुप्त रहेगी।',
  },
  chooseChannel: { en: 'Where did the scam happen?', hi: 'ठगी कहाँ हुई?' },
  identifierLabel: { en: 'Phone, UPI ID or link', hi: 'फोन, UPI आईडी या लिंक' },
  submitReport: { en: 'Submit report', hi: 'शिकायत भेजें' },
  reportOk: {
    en: 'Report received. Thank you for helping others!',
    hi: 'शिकायत मिल गई। दूसरों की मदद के लिए धन्यवाद!',
  },
  pincodeLabel: { en: 'Area pincode (optional)', hi: 'इलाके का पिनकोड (वैकल्पिक)' },
  reportInvalid: { en: 'Enter a valid identifier.', hi: 'एक वैध पहचानकर्ता दर्ज करें।' },
  submitting: { en: 'Submitting…', hi: 'भेजा जा रहा है…' },
  challengeInvalid: { en: 'Enter the report ID and your reason.', hi: 'रिपोर्ट आईडी और अपना कारण दर्ज करें।' },
  mapEmptyHint: { en: 'No scam reports on the map yet.', hi: 'नक्शे पर अभी कोई शिकायत नहीं है।' },
  alertsEmptyHint: { en: 'No active scam alerts right now.', hi: 'अभी कोई सक्रिय ठगी चेतावनी नहीं है।' },
  licenseValid: { en: 'Your license is valid.', hi: 'आपका लाइसेंस वैध है।' },

  // Lookup page
  lookupTitle: { en: 'Check before you pay', hi: 'भुगतान से पहले जांचें' },
  lookupLabel: { en: 'Enter phone, UPI ID or link', hi: 'फोन, UPI आईडी या लिंक लिखें' },
  lookupButton: { en: 'Check', hi: 'जांचें' },
  verdictKnownScam: { en: 'Known scam', hi: 'ज्ञात ठगी' },
  verdictSuspicious: { en: 'Suspicious', hi: 'संदिग्ध' },
  verdictNoReports: { en: 'No scam reports', hi: 'कोई शिकायत नहीं' },
  verdictVerifiedBusiness: { en: 'Verified business', hi: 'प्रमाणित व्यापार' },
  reports: { en: 'reports', hi: 'शिकायतें' },
  reporters: { en: 'people', hi: 'लोग' },
  challenged: {
    en: 'Under dispute — some people disputed this',
    hi: 'विवाद है — कुछ लोगों ने विरोध किया है',
  },
  firstSeen: { en: 'First reported', hi: 'पहली शिकायत' },
  lastSeen: { en: 'Latest report', hi: 'नवीनतम शिकायत' },
  evidence: { en: 'What was reported', hi: 'क्या बताया गया' },

  // Challenge
  challengeTitle: { en: 'Dispute a report', hi: 'शिकायत पर विवाद' },
  challengeSubtitle: {
    en: 'Was this tag wrong? Tell us and we will recheck.',
    hi: 'क्या यह शिकायत गलत है? हमें बताएं, हम फिर से जांचेंगे।',
  },
  reasonLabel: { en: 'Why is this wrong?', hi: 'यह गलत क्यों है?' },
  challengeOk: { en: 'Dispute received. We will recheck.', hi: 'विवाद मिल गया। हम जांच करेंगे।' },

  // Alerts
  alertsTitle: { en: 'Recent scam alerts', hi: 'हाल की चेतावनियां' },
  alertSpike: { en: 'Spiking', hi: 'बढ़ रही है' },
  alertNewType: { en: 'New pattern', hi: 'नया तरीका' },

  // Map
  mapTitle: { en: 'Community Scam Map', hi: 'Community Scam Map' },
  mapSubtitle: {
    en: 'Reports counted by area. Exact locations are never shown.',
    hi: 'इलाके के हिसाब से शिकायतें। सही जगह कभी नहीं दिखाई जाती।',
  },
  legend: { en: 'Reports', hi: 'शिकायतें' },

  // Verified business
  verifiedTitle: { en: 'Verified businesses', hi: 'प्रमाणित व्यापार' },
} as const;

export type StringKey = keyof typeof STRINGS;

export function get(lang: Lang, key: StringKey): string {
  return STRINGS[key][lang];
}
