/** Palette metadata shared by the picker, settings, menus and export dialog. */
export const THEMES = {
  light: { name: 'Light', description: 'The original canvas', mode: 'light', canvas: '#f6f5f2', panel: '#ffffff', accent: '#e5672d' },
  dark: { name: 'Dark', description: 'Quiet and familiar', mode: 'dark', canvas: '#15171b', panel: '#1d2026', accent: '#f07b45' },
  midnight: { name: 'Midnight', description: 'A little after-hours violet', mode: 'dark', canvas: '#171426', panel: '#201c33', accent: '#b6a0ff' },
  ocean: { name: 'Ocean', description: 'Deep blue, bright cyan', mode: 'dark', canvas: '#0c1b2a', panel: '#12283a', accent: '#66d9e8' },
  forest: { name: 'Forest', description: 'Fresh greens, warm ivory', mode: 'light', canvas: '#f2f5ed', panel: '#fcfdf8', accent: '#38704b' },
  rose: { name: 'Rose', description: 'Soft pink with a little warmth', mode: 'light', canvas: '#fbf2f4', panel: '#fffafb', accent: '#a93f67' },
} as const;

export type ThemeId = keyof typeof THEMES;
export type ThemeChoice = 'system' | ThemeId;
export type ColorMode = 'light' | 'dark';

export const THEME_CHOICES: readonly ThemeChoice[] = ['system', ...Object.keys(THEMES) as ThemeId[]];

export function normalizeTheme(value: unknown): ThemeChoice {
  return typeof value === 'string' && THEME_CHOICES.includes(value as ThemeChoice) ? value as ThemeChoice : 'system';
}

export function resolveTheme(theme: ThemeChoice, systemDark: boolean): ThemeId {
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

export function nextTheme(theme: ThemeChoice): ThemeChoice {
  return THEME_CHOICES[(THEME_CHOICES.indexOf(theme) + 1) % THEME_CHOICES.length];
}

export function themeName(theme: ThemeChoice): string {
  return theme === 'system' ? 'System' : THEMES[theme].name;
}
