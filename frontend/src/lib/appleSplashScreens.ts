// Step 17 — iOS "Add to Home Screen" splash screens.
//
// iOS has no single universal splash size (unlike Android, which just
// paints manifest.json's background_color behind the icon). Safari instead
// picks one `<link rel="apple-touch-startup-image">` by matching the
// device's exact (device-width, device-height, -webkit-device-pixel-ratio,
// orientation) against each link's `media` query — get the numbers wrong
// and iOS silently falls back to a blank white screen, no error, no partial
// match.
//
// The PNGs themselves live in /public/brand/splash/ and are generated (not
// hand-drawn) from the real logo-mark-1024.png, composited onto #0A0C10 —
// the same color as manifest.json's background_color/theme_color and
// MobileFrame's actual inner background (i.e. what the screen looks like
// once the app has actually painted), not white and not a placeholder. See
// the generation script referenced in REVIEW.md for the exact devices/sizes
// list and how to regenerate if the logo mark or background color changes.
//
// Portrait only: home-screen launches are overwhelmingly portrait, and this
// set (12 sizes) already covers essentially every iPhone/iPad model Apple
// currently supports installing a home-screen web app on.

export interface AppleSplashScreen {
  url: string;
  media: string;
}

interface SplashDevice {
  file: string;
  cssWidth: number;
  cssHeight: number;
  dpr: number;
}

const DEVICES: SplashDevice[] = [
  { file: "iphone-se.png", cssWidth: 320, cssHeight: 568, dpr: 2 }, // SE 2nd/3rd gen, 6/6s/7/8
  { file: "iphone-xr-11.png", cssWidth: 414, cssHeight: 896, dpr: 2 }, // XR, 11
  { file: "iphone-x-11pro-mini.png", cssWidth: 375, cssHeight: 812, dpr: 3 }, // X/XS/11 Pro, 12 mini/13 mini
  { file: "iphone-xsmax-11promax.png", cssWidth: 414, cssHeight: 896, dpr: 3 }, // XS Max, 11 Pro Max
  { file: "iphone-12-13-14.png", cssWidth: 390, cssHeight: 844, dpr: 3 }, // 12/12 Pro/13/13 Pro/14
  { file: "iphone-promax-plus-1.png", cssWidth: 428, cssHeight: 926, dpr: 3 }, // 12 Pro Max/13 Pro Max/14 Plus
  { file: "iphone-14pro-15-16.png", cssWidth: 393, cssHeight: 852, dpr: 3 }, // 14 Pro/15/15 Pro/16
  { file: "iphone-promax-plus-2.png", cssWidth: 430, cssHeight: 932, dpr: 3 }, // 14 Pro Max/15 Pro Max/15 Plus/16 Plus
  { file: "ipad-10-2.png", cssWidth: 768, cssHeight: 1024, dpr: 2 }, // iPad 9.7"/10.2"
  { file: "ipad-air-10-9.png", cssWidth: 820, cssHeight: 1180, dpr: 2 }, // iPad Air 10.9"
  { file: "ipad-pro-11.png", cssWidth: 834, cssHeight: 1194, dpr: 2 }, // iPad Pro 11"
  { file: "ipad-pro-12-9.png", cssWidth: 1024, cssHeight: 1366, dpr: 2 }, // iPad Pro 12.9"
];

export const APPLE_SPLASH_SCREENS: AppleSplashScreen[] = DEVICES.map((d) => ({
  url: `/brand/splash/${d.file}`,
  media: `(device-width: ${d.cssWidth}px) and (device-height: ${d.cssHeight}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: portrait)`,
}));
