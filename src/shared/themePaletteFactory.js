export function createThemeColors(baseColors, palette, mode) {
    const isDark = mode === 'dark';
    const colors = isDark ? palette.dark : palette.light;
    const background = isDark ? colors.card : '#FFFFFF';
    const overlay = isDark ? 'rgba(0, 0, 0, 0.85)' : `rgba(${hexToRgb(colors.textMain)}, 0.6)`;

    return {
        ...baseColors,
        primary: colors.primary,
        primary_hover: colors.primaryHover,
        primary_gradient_start: colors.primary,
        primary_gradient_end: colors.gradientEnd,
        accent: colors.accent,
        bg_body: colors.body,
        bg_card: background,
        bg_surface: colors.surface,
        text_main: colors.textMain,
        text_muted: colors.textMuted,
        border: colors.border,
        navbar_bg: background,
        navbar_text: colors.textMain,
        bottom_bar_bg: background,
        bottom_bar_active: colors.primary,
        bottom_bar_inactive: colors.textMuted,
        card_bg: background,
        card_border: colors.border,
        card_title: colors.textMain,
        price_color: colors.primary,
        old_price_color: colors.textMuted,
        section_title: colors.textMain,
        category_chip_bg: colors.surface,
        category_chip_active: colors.primary,
        category_chip_text: colors.textMain,
        modal_bg: background,
        modal_overlay: overlay,
        modal_handle: colors.border,
        btn_primary_bg: colors.primary,
        btn_primary_text: isDark ? colors.body : '#FFFFFF',
        chatbot_btn_bg: colors.primary
    };
}

function hexToRgb(hex) {
    const normalized = hex.replace(/^#/, '');
    const value = Number.parseInt(normalized, 16);
    return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}
