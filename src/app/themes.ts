/**
 * Colour themes. "Classic" is the palette in tokens.css; every other theme
 * overrides the surface, text and accent colours on top of it. Status
 * colours (done, warning, over) and shadows stay the same in every theme.
 */
export interface ThemeColors {
  canvas: string;
  panel: string;
  surface: string;
  hover: string;
  line: string;
  'line-strong': string;
  ink: string;
  'ink-2': string;
  'ink-3': string;
  accent: string;
  'accent-soft': string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
}

export const LIGHT_THEMES = [
  {
    id: 'classic',
    name: 'Classic',
    colors: {
      canvas: '#f7f7f8', panel: '#efeff1', surface: '#ffffff', hover: '#ebebee', line: '#e6e6ea', 'line-strong': '#d1d1d8',
      ink: '#1b1c22', 'ink-2': '#5c5e6b', 'ink-3': '#9a9ca9', accent: '#2f7de1', 'accent-soft': '#e7f0fc',
    },
  },
  {
    id: 'paper',
    name: 'Paper',
    colors: {
      canvas: '#f6f3ee', panel: '#ede8e0', surface: '#fffdf9', hover: '#e9e3d9', line: '#e4ddd2', 'line-strong': '#d2c8ba',
      ink: '#2a241d', 'ink-2': '#6b6155', 'ink-3': '#a39888', accent: '#c4662b', 'accent-soft': '#f7e6d8',
    },
  },
  {
    id: 'mint',
    name: 'Mint',
    colors: {
      canvas: '#f3f7f5', panel: '#e7efeb', surface: '#ffffff', hover: '#e2ebe6', line: '#dce7e1', 'line-strong': '#c4d5cc',
      ink: '#17231d', 'ink-2': '#53645b', 'ink-3': '#93a399', accent: '#1d9470', 'accent-soft': '#dcf2e9',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    colors: {
      canvas: '#faf5f6', panel: '#f2e8eb', surface: '#ffffff', hover: '#efe3e7', line: '#ebdee2', 'line-strong': '#dac8ce',
      ink: '#2a1c21', 'ink-2': '#6c5860', 'ink-3': '#a8959c', accent: '#c94a74', 'accent-soft': '#fbe5ec',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    colors: {
      canvas: '#f2f4f7', panel: '#e6e9ee', surface: '#ffffff', hover: '#e3e7ec', line: '#dde1e7', 'line-strong': '#c7cdd6',
      ink: '#161b24', 'ink-2': '#525b6b', 'ink-3': '#8f98a8', accent: '#3d63c9', 'accent-soft': '#e3e9f8',
    },
  },
] as const satisfies readonly Theme[];

export const DARK_THEMES = [
  {
    id: 'classic',
    name: 'Classic',
    colors: {
      canvas: '#18191e', panel: '#121317', surface: '#22232a', hover: '#272830', line: '#2b2c35', 'line-strong': '#3b3c47',
      ink: '#ececf2', 'ink-2': '#a5a7b5', 'ink-3': '#6c6e7c', accent: '#5e9ef0', 'accent-soft': '#1b2c44',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      canvas: '#0f1524', panel: '#0b101d', surface: '#182039', hover: '#1e2741', line: '#232c46', 'line-strong': '#333d5b',
      ink: '#e8ecf7', 'ink-2': '#a3abc4', 'ink-3': '#69728f', accent: '#6ea8ff', 'accent-soft': '#1a2a4a',
    },
  },
  {
    id: 'black',
    name: 'Black',
    colors: {
      canvas: '#000000', panel: '#000000', surface: '#131313', hover: '#1b1b1b', line: '#232323', 'line-strong': '#343434',
      ink: '#f2f2f2', 'ink-2': '#a8a8a8', 'ink-3': '#6b6b6b', accent: '#5e9ef0', 'accent-soft': '#14233a',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      canvas: '#141a17', panel: '#0f1411', surface: '#1d2520', hover: '#232c26', line: '#29332c', 'line-strong': '#38443c',
      ink: '#e7efe9', 'ink-2': '#a5b4aa', 'ink-3': '#6c7b71', accent: '#5cc49c', 'accent-soft': '#173a2d',
    },
  },
  {
    id: 'mocha',
    name: 'Mocha',
    colors: {
      canvas: '#1c1814', panel: '#16130f', surface: '#26211b', hover: '#2d2720', line: '#332c24', 'line-strong': '#463d32',
      ink: '#f0e8dd', 'ink-2': '#b6a999', 'ink-3': '#7d7163', accent: '#e08a4a', 'accent-soft': '#3d2918',
    },
  },
] as const satisfies readonly Theme[];

export type LightThemeId = (typeof LIGHT_THEMES)[number]['id'];
export type DarkThemeId = (typeof DARK_THEMES)[number]['id'];

export function lightTheme(id: string): Theme {
  return LIGHT_THEMES.find((t) => t.id === id) ?? LIGHT_THEMES[0];
}

export function darkTheme(id: string): Theme {
  return DARK_THEMES.find((t) => t.id === id) ?? DARK_THEMES[0];
}

/** CSS custom properties for a theme, as index.html applies them before the app loads. */
export function themeVars(theme: Theme): Record<string, string> {
  return Object.fromEntries(Object.entries(theme.colors).map(([key, value]) => [`--${key}`, value]));
}
