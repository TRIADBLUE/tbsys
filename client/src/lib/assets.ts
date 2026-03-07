// ── Asset Registry ──────────────────────────────────────
// Single source of truth for all asset paths.
// All assets live in client/public/assets/ and are served statically.
// Only reference files that ACTUALLY EXIST on disk.

const BASE = "/assets";

// ── Brand Assets ───────────────────────────────────────
// Each brand has an icon.png and various favicon sizes.
// Do NOT add logo/wordmark/avatar entries until the files exist.

export const BRAND_ASSETS = {
  triadblue: {
    icon: `${BASE}/brands/triadblue/icon.png`,
  },
  consoleblue: {
    icon: `${BASE}/brands/consoleblue/icon.png`,
    logoLockup: `${BASE}/brands/consoleblue/logo-lockup.png`,
  },
  linkblue: {
    icon: `${BASE}/brands/linkblue/icon.png`,
  },
  hostsblue: {
    icon: `${BASE}/brands/hostsblue/icon.png`,
  },
  swipesblue: {
    icon: `${BASE}/brands/swipesblue/icon.png`,
  },
  businessblueprint: {
    icon: `${BASE}/brands/businessblueprint/icon.png`,
  },
  scansblue: {
    icon: `${BASE}/brands/scansblue/icon.png`,
  },
} as const;

// ── UI Assets ──────────────────────────────────────────

export const UI_ASSETS = {
  placeholder: `${BASE}/ui/placeholder.svg`,
  loadingSpinner: `${BASE}/ui/loading-spinner.svg`,
} as const;

// ── Helper: Get brand assets by slug ───────────────────

export function getBrandAssets(slug: string) {
  return (
    BRAND_ASSETS[slug as keyof typeof BRAND_ASSETS] ?? {
      icon: UI_ASSETS.placeholder,
    }
  );
}
