export const THEME_STORAGE_KEY = "candyvault-theme";
export const DEFAULT_THEME = "candy";

export const themes = Object.freeze({
  candy: Object.freeze({
    id: "candy",
    name: "Crazy Carney Candy Shop",
    description: "Bright carnival candy colors, playful stripes, and sweet celebrations.",
    previewColors: Object.freeze(["#e91e63", "#67d8ff", "#ffe45c", "#fff3dc"]),
    decorationStyle: "candy",
    colorScheme: "light",
    decorations: Object.freeze({
      feedbackIcons: Object.freeze(["🍬", "🍭", "🧁", "🥤", "🍒", "✨"]),
      heroTreats: Object.freeze(["🍬", "🥤", "🧁"]),
      heroRunner: "🍭",
    }),
    language: Object.freeze({
      keeperGreeting: "candy keeper",
      emptyContainer: "Looks like this candy jar is empty.",
    }),
  }),
  forest: Object.freeze({
    id: "forest",
    name: "Forest Waterfall",
    description: "Calm forest greens, waterfall blues, warm wood, and gentle mist.",
    previewColors: Object.freeze(["#1f3d2b", "#7ca982", "#5dade2", "#f8f3e7"]),
    decorationStyle: "forest",
    colorScheme: "light",
    decorations: Object.freeze({
      feedbackIcons: Object.freeze(["🍃", "💧", "🌿", "🌲", "✨", "🪨"]),
      heroTreats: Object.freeze(["🍃", "💧", "🌲"]),
      heroRunner: "💧",
    }),
    language: Object.freeze({
      keeperGreeting: "forest keeper",
      emptyContainer: "This peaceful clearing is ready for something new.",
    }),
  }),
});

export function isSupportedTheme(themeName) {
  return Object.hasOwn(themes, themeName);
}

export function readStoredTheme() {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isSupportedTheme(storedTheme) ? storedTheme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(themeName) {
  const safeTheme = isSupportedTheme(themeName) ? themeName : DEFAULT_THEME;
  document.documentElement.dataset.theme = safeTheme;
  document.documentElement.style.colorScheme = themes[safeTheme].colorScheme;
  return safeTheme;
}

export function initializeTheme() {
  return applyTheme(readStoredTheme());
}
