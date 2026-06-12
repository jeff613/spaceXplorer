// Site configuration.

// Free API key from finnhub.io — powers the live SPCX quote after the IPO.
// Public by design: this is a client-side static site and the free tier is
// read-only and rate-limited. The placeholder disables polling gracefully
// (the banner shows the T+ elapsed clock instead).
export const FINNHUB_KEY = 'YOUR_FINNHUB_KEY';
