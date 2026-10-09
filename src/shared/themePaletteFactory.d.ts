export interface ThemePaletteColors {
    primary: string;
    primaryHover: string;
    gradientEnd: string;
    accent: string;
    body: string;
    surface: string;
    textMain: string;
    textMuted: string;
    border: string;
}

export interface ThemePaletteDefinition {
    id: string;
    name: string;
    category: string;
    description: string;
    light: ThemePaletteColors;
    dark: ThemePaletteColors & { card: string };
}

export function createThemeColors(
    baseColors: Record<string, string | undefined>,
    palette: ThemePaletteDefinition,
    mode: 'light' | 'dark'
): Record<string, string>;
