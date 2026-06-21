# CandyVault Theme Architecture

CandyVault uses a lightweight React provider and CSS custom properties. The current selector supports `candy` and `forest`, with immediate browser-local persistence.

## Runtime flow

1. `initializeTheme()` reads `candyvault-theme` from `localStorage` before React mounts.
2. Unsupported or missing values fall back to `candy`.
3. The theme name is applied to `document.documentElement.dataset.theme`.
4. `ThemeProvider` exposes `theme`, `themeDefinition`, `availableThemes`, and `setTheme()`.
5. CSS resolves the visual design through `[data-theme="candy"]` semantic tokens.

Use the theme in React components through:

```jsx
import { useTheme } from "../theme/useTheme.js";

const { theme, themeDefinition, setTheme } = useTheme();
```

Only theme-aware components should consume the hook. Ordinary components should use semantic CSS variables and remain unaware of the active theme.

## Token strategy

Token groups are defined in `frontend/src/index.css`:

- Page and surfaces: `--page-background`, `--page-surface`, `--surface-*`
- Text: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-on-primary`
- Borders: `--border-primary`, `--border-secondary`
- Brand and state colors: `--color-primary`, `--color-secondary`, `--color-accent`, `--color-success`, `--color-warning`, `--color-danger`
- Interaction: `--focus-ring`, `--radius-*`, `--shadow-*`
- Data visualization: `--chart-color-1` through `--chart-color-5`
- Decoration: `--pattern-background`, `--pattern-accent`, and component background tokens

Legacy aliases such as `--cherry`, `--grape`, and `--lemon` temporarily map to semantic roles. They keep the Candy theme visually stable while remaining component rules are migrated incrementally. New styles must use semantic tokens.

## Theme-aware decorations

Non-CSS assets live in `frontend/src/theme/themes.js`. The Candy definition currently supplies:

- Dashboard hero treats and runner icon
- Interaction feedback and close-confetti icons

Future themes can supply leaves, water droplets, geometric particles, or minimal accents without changing feature components. Decorative DOM should be isolated behind small adapter components such as `ThemeDecorations.jsx`.

## Charts

Chart palettes come from `--chart-color-*`. Components read their computed values only when a JavaScript-generated gradient requires actual color strings. Do not add hardcoded chart palettes to JavaScript.

## Adding a future theme

1. Add metadata and decoration assets to `themes.js`.
2. Add a `[data-theme="new-theme"]` token block in `index.css` or a dedicated imported theme stylesheet.
3. Define every semantic token used by shared components.
4. Add the theme to the future Settings selector only after visual and accessibility QA.
5. Test all routes, responsive breakpoints, loading/error/empty states, focus states, charts, and reduced-motion behavior.
6. Verify startup persistence and absence of a theme flash.

Do not duplicate complete component styles for a theme. Override tokens first and add narrowly scoped theme rules only for genuinely different decorations or layout-independent artwork.

## Current limitations

- Settings exposes only themes that have completed visual and accessibility QA.
- Some Candy-specific product language remains in feature pages and should move behind the language helper incrementally.
- Dark Professional and Clean Light are not defined yet.
