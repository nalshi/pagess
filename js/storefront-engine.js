/**
 * ========================================================
 * 🎨 Nalsh Storefront Dynamic Rendering & Theme Engine v4.0
 * المحرك المركزي الشامل لربط وتطبيق كافة خصائص وإعدادات
 * استوديو مصمم المتجر (store-builder.html) وملف theme-config.json
 * ========================================================
 */

(function () {
  'use strict';

  let currentStorefrontConfig = null;

  function resolveWorkerApiUrl() {
    const configured = window.WORKER_API_URL || window.CF_WORKER_URL || window.CLOUDFLARE_WORKER_URL;
    if (configured) {
      const value = String(configured).trim();
      if (value === '/api/worker' || value === '/api/worker/') return '/api/worker/';
      if (value.includes('://')) {
        const normalized = value.replace(/\/$/, '');
        return normalized.endsWith('/api/worker') ? normalized + '/' : normalized + '/api/worker/';
      }
      return value.endsWith('/') ? value : value + '/';
    }
    return '/api/worker/';
  }

  // دالة تحويل HEX إلى RGBA لحساب التوهج والشفافية
  function hexToRgba(hex, alpha = 0.25) {
    if (!hex || typeof hex !== 'string') return `rgba(99, 102, 241, ${alpha})`;
    let cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const num = parseInt(cleanHex, 16);
    if (isNaN(num)) return `rgba(99, 102, 241, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // تحميل الخطوط تلقائياً من Google Fonts
  function loadGoogleFont(fontFamily) {
    if (!fontFamily || fontFamily === 'inherit' || fontFamily === 'system-ui') return;
    const fontId = `google-font-${fontFamily.toLowerCase().replace(/\s+/g, '-')}`;
    if (document.getElementById(fontId)) return;

    const fontMap = {
      'Tajawal': 'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap',
      'Cairo': 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap',
      'Almarai': 'https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&display=swap',
      'IBM Plex Sans Arabic': 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap',
      'Readex Pro': 'https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&display=swap',
      'Alexandria': 'https://fonts.googleapis.com/css2?family=Alexandria:wght@300;400;600;700;800;900&display=swap',
      'Noto Kufi Arabic': 'https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;600;700;800&display=swap',
      'Changa': 'https://fonts.googleapis.com/css2?family=Changa:wght@400;600;700;800&display=swap',
      'El Messiri': 'https://fonts.googleapis.com/css2?family=El+Messiri:wght@400;600;700;800&display=swap'
    };

    const fontUrl = fontMap[fontFamily] || `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;600;700;800&display=swap`;
    if (fontUrl) {
      const link = document.createElement('link');
      link.id = fontId;
      link.rel = 'stylesheet';
      link.href = fontUrl;
      document.head.appendChild(link);
    }
  }

  // فحص درجة سطوع اللون (Luminance check) لضمان عدم تسرب ألوان داكنة للوضع الفاتح أو العكس
  function isHexDark(hex) {
    if (!hex || typeof hex !== 'string') return false;
    let c = hex.replace('#', '').trim();
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length !== 6) return false;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq < 128;
  }

  function hexToRgbValues(hex) {
    if (!hex || typeof hex !== 'string') return '79, 70, 229';
    let clean = hex.replace('#', '').trim();
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    const num = parseInt(clean, 16);
    if (isNaN(num)) return '79, 70, 229';
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `${r}, ${g}, ${b}`;
  }

  function contrastText(hex) {
    return isHexDark(hex) ? '#FFFFFF' : '#0F172A';
  }

  /**
   * 1. تطبيق ألوان وهوية المتجر (Theme & Design Tokens)
   */
  function applyColorTokens(config = {}) {
    const root = document.documentElement;
    const isDark = root.classList.contains('dark-mode') || (document.body && document.body.classList.contains('dark-mode'));
    
    // استخراج حزمة الألوان النشطة مع الحفاظ على تناسق الوضعين
    const lightColors = config.light_theme?.colors || config.modes?.light?.colors || {};
    const darkColors = config.dark_theme?.colors || config.modes?.dark?.colors || {};
    const activeColors = isDark ? darkColors : lightColors;

    // 1. ألوان الهوية والعلامة (تتبع اللون المخصص من أي وضع)
    const basePrimary = lightColors.primary || '#4F46E5';
    const primary = (isDark ? (darkColors.primary || basePrimary) : basePrimary) || '#4F46E5';
    const primaryRgb = hexToRgbValues(primary);
    const primaryHover = activeColors.primary_hover || (isDark ? '#818CF8' : '#4338CA');
    const glow = hexToRgba(primary, isDark ? 0.35 : 0.22);
    const accent = (isDark ? (darkColors.accent || lightColors.accent) : (lightColors.accent || '#14B8A6')) || '#14B8A6';
    const gradStart = activeColors.primary_gradient_start || primary;
    const gradEnd = activeColors.primary_gradient_end || accent;
    const gradient = `linear-gradient(135deg, ${gradStart}, ${gradEnd})`;

    // 2. خلفيات المتجر والسطوح (استخدام ألوان الثيم المحددة مباشرة مع التوافق الذكي)
    const defaultDarkBg = '#0B1120';
    const defaultLightBg = '#F8FAFC';
    const bgBody = activeColors.bg_body || (isDark ? defaultDarkBg : defaultLightBg);
    const bgCard = activeColors.bg_card || activeColors.card_bg || (isDark ? '#151E2E' : '#FFFFFF');
    const bgSurface = activeColors.bg_surface || (isDark ? '#1E293B' : '#F1F5F9');
    const border = activeColors.border || activeColors.card_border || (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)');

    // 3. النصوص والعناوين
    const textMain = activeColors.text_main || activeColors.card_title || (isDark ? '#F8FAFC' : '#0F172A');
    const textMuted = activeColors.text_muted || (isDark ? '#94A3B8' : '#64748B');

    // 4. الأشرطة والتنقل
    const navBg = activeColors.navbar_bg || activeColors.header_bg || bgCard;
    const navText = activeColors.navbar_text || activeColors.header_text || textMain;
    const bottomBg = activeColors.bottom_bar_bg || activeColors.bottom_nav_bg || bgCard;
    const bottomActive = activeColors.bottom_bar_active || activeColors.bottom_nav_active || primary;
    const bottomInactive = activeColors.bottom_bar_inactive || activeColors.bottom_nav_inactive || (isDark ? '#64748B' : '#94A3B8');

    // 5. البحث وشريحة الفئات (Category Chips & Sub Navbar)
    const searchBg = activeColors.search_bg || bgSurface;
    const searchText = activeColors.search_text || textMain;
    const searchPlaceholder = activeColors.search_placeholder || (isDark ? '#64748B' : '#94A3B8');

    const chipBg = activeColors.category_chip_bg || bgSurface;
    const chipActive = activeColors.category_chip_active || activeColors.category_chip_active_bg || primary;
    const chipText = activeColors.category_chip_text || textMain;
    const chipActiveText = activeColors.category_chip_active_text || contrastText(chipActive);

    // 6. الأسعار، الشارات، والأزرار
    const priceColor = activeColors.price_color || primary;
    const oldPriceColor = activeColors.old_price_color || (isDark ? '#64748B' : '#94A3B8');
    const badgeBg = activeColors.badge_bg || activeColors.discount_badge_bg || '#EF4444';
    const badgeText = activeColors.badge_text || activeColors.discount_badge_text || '#FFFFFF';

    const btnPrimaryBg = activeColors.btn_primary_bg || activeColors.button_primary_bg || primary;
    const btnPrimaryText = activeColors.btn_primary_text || activeColors.button_primary_text || contrastText(btnPrimaryBg);
    const chatbotBtnBg = activeColors.chatbot_btn_bg || primary;

    // 7. النوافذ، السلة، والشيتات (Modals, Cart & Bottom Sheets)
    const modalBg = activeColors.modal_bg || bgCard;
    const modalOverlay = activeColors.modal_overlay || (isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(15, 23, 42, 0.6)');
    const modalHandle = activeColors.modal_handle || border;
    const cardShadow = activeColors.card_shadow || (isDark ? '0 4px 20px -2px rgba(0, 0, 0, 0.35)' : '0 4px 20px -2px rgba(0, 0, 0, 0.05)');

    // حزمة المتغيرات الشاملة (CSS Variables Map)
    const cssVars = {
      '--theme-primary': primary,
      '--primary': primary,
      '--theme-primary-rgb': primaryRgb,
      '--primary-rgb': primaryRgb,
      '--theme-primary-hover': primaryHover,
      '--primary-hover': primaryHover,
      '--theme-primary-glow': glow,
      '--primary-glow': glow,
      '--theme-accent': accent,
      '--accent': accent,
      '--theme-primary-gradient': gradient,
      '--primary-gradient': gradient,
      '--theme-background': bgBody,
      '--bg-body': bgBody,
      '--theme-card-bg': bgCard,
      '--bg-card': bgCard,
      '--theme-surface': bgSurface,
      '--bg-surface': bgSurface,
      '--theme-border': border,
      '--border': border,
      '--theme-text-primary': textMain,
      '--text-main': textMain,
      '--theme-text-secondary': textMuted,
      '--text-muted': textMuted,
      '--theme-navbar-bg': navBg,
      '--navbar-bg': navBg,
      '--theme-topbar-color': navBg,
      '--theme-navbar-text': navText,
      '--navbar-text': navText,
      '--theme-topbar-text': navText,
      '--theme-bottom-nav-bg': bottomBg,
      '--bottom-bar-bg': bottomBg,
      '--theme-bottom-nav-active': bottomActive,
      '--bottom-bar-active': bottomActive,
      '--theme-bottom-active-color': bottomActive,
      '--theme-bottom-active-bg': hexToRgba(bottomActive, isDark ? 0.2 : 0.12),
      '--theme-bottom-nav-inactive': bottomInactive,
      '--bottom-bar-inactive': bottomInactive,
      '--theme-search-bg': searchBg,
      '--search-bg': searchBg,
      '--theme-search-text': searchText,
      '--search-text': searchText,
      '--theme-search-placeholder': searchPlaceholder,
      '--search-placeholder': searchPlaceholder,
      '--theme-cat-chip-bg': chipBg,
      '--cat-chip-bg': chipBg,
      '--category-chip-bg': chipBg,
      '--theme-cat-chip-active-bg': chipActive,
      '--cat-chip-active': chipActive,
      '--category-chip-active': chipActive,
      '--theme-cat-chip-text': chipText,
      '--cat-chip-text': chipText,
      '--category-chip-text': chipText,
      '--theme-cat-chip-active-text': chipActiveText,
      '--theme-price-color': priceColor,
      '--price-color': priceColor,
      '--theme-old-price-color': oldPriceColor,
      '--old-price-color': oldPriceColor,
      '--theme-discount-badge-bg': badgeBg,
      '--badge-bg': badgeBg,
      '--theme-discount-badge-text': badgeText,
      '--badge-text': badgeText,
      '--theme-btn-primary-bg': btnPrimaryBg,
      '--btn-primary-bg': btnPrimaryBg,
      '--theme-btn-primary-text': btnPrimaryText,
      '--btn-primary-text': btnPrimaryText,
      '--theme-chatbot-btn-bg': chatbotBtnBg,
      '--chatbot-btn-bg': chatbotBtnBg,
      '--theme-modal-bg': modalBg,
      '--modal-bg': modalBg,
      '--bg-modal': modalBg,
      '--theme-modal-overlay': modalOverlay,
      '--modal-overlay': modalOverlay,
      '--theme-modal-handle': modalHandle,
      '--modal-handle': modalHandle,
      '--theme-card-shadow': cardShadow
    };

    // تطبيقها على :root
    for (const [prop, val] of Object.entries(cssVars)) {
      root.style.setProperty(prop, val);
    }

    // وتطبيقها أيضاً على document.body بأعلى أولوية
    if (document.body) {
      for (const [prop, val] of Object.entries(cssVars)) {
        document.body.style.setProperty(prop, val);
      }
      document.body.style.backgroundColor = bgBody;
      document.body.style.color = textMain;
    }

    // 8. الخطوط والأشكال المتجاوبة للجوال والكمبيوتر
    const typo = config.typography || config.design_tokens?.typography || {};
    if (typo.font_family) {
      root.style.setProperty('--theme-font-family', `'${typo.font_family}', sans-serif`);
      loadGoogleFont(typo.font_family);
    }
    
    // حجم الخط الأساسي
    const mobileBase = typo.base_size_mobile || typo.base_size || '15px';
    const desktopBase = typo.base_size_desktop || typo.base_size || '17px';
    root.style.setProperty('--theme-base-size-mobile', mobileBase);
    root.style.setProperty('--theme-base-size-desktop', desktopBase);
    root.style.setProperty('--theme-base-size', desktopBase);

    // حجم خط العناوين
    const mobileHeading = typo.heading_size_mobile || '1.15rem';
    const desktopHeading = typo.heading_size_desktop || '1.45rem';
    root.style.setProperty('--theme-heading-size-mobile', mobileHeading);
    root.style.setProperty('--theme-heading-size-desktop', desktopHeading);

    // حجم خط الأسعار
    const mobilePrice = typo.price_size_mobile || typo.headings?.price_size || '1.1rem';
    const desktopPrice = typo.price_size_desktop || typo.headings?.price_size || '1.25rem';
    root.style.setProperty('--theme-price-size-mobile', mobilePrice);
    root.style.setProperty('--theme-price-size-desktop', desktopPrice);
    root.style.setProperty('--theme-price-font-size', desktopPrice);

    if (typo.heading_weight) {
      root.style.setProperty('--theme-heading-weight', typo.heading_weight);
    }

    const shapes = config.shapes || config.design_tokens?.shapes || {};
    if (shapes.card_radius) {
      root.style.setProperty('--theme-card-radius', shapes.card_radius);
      root.style.setProperty('--radius-xl', shapes.card_radius);
    }
    if (shapes.button_radius) {
      root.style.setProperty('--theme-button-radius', shapes.button_radius);
      root.style.setProperty('--radius-lg', shapes.button_radius);
    }
    if (shapes.button_style === 'pill') {
      root.style.setProperty('--theme-button-radius', '9999px');
    } else if (shapes.button_style === 'flat') {
      root.style.setProperty('--theme-button-radius', '4px');
    }

    if (shapes.card_style) {
      document.body.dataset.cardStyle = shapes.card_style;
    }

    const anim = config.animations || {};
    if (anim.card_hover) {
      document.body.dataset.cardHover = anim.card_hover;
    }

    document.body.classList.add('theme-storefront');
  }

  /**
   * 2. تطبيق هوية المتجر وشريط الإعلانات (Store Identity & Announcement Bar)
   */
  function applyStoreIdentity(identity = {}) {
    if (!identity) return;

    // اسم المتجر
    if (identity.store_name) {
      document.title = identity.store_name;
      const logoSpan = document.getElementById('main-logo-text') || document.querySelector('.logo span') || document.querySelector('.navbar-brand span');
      if (logoSpan) logoSpan.textContent = identity.store_name;

      const profileName = document.querySelector('.dsc-name') || document.querySelector('.ultra-info h1') || document.getElementById('iso-store-title') || document.querySelector('.iso-text-box h1');
      if (profileName) profileName.textContent = identity.store_name;
    }

    // الوصف / الشعار
    if (identity.slogan !== undefined) {
      const bioEl = document.querySelector('.dsc-bio') || document.querySelector('.ultra-info p') || document.querySelector('.iso-text-box p');
      if (bioEl) bioEl.textContent = identity.slogan;
    }

    // رمز العملة
    if (identity.currency_symbol) {
      window.CURRENCY_SYMBOL = identity.currency_symbol;
      document.querySelectorAll('.p-currency').forEach(el => {
        el.textContent = identity.currency_symbol;
      });
    }

    // شريط الإعلانات الترويجي (Announcement Bar)
    const ann = identity.announcement_bar || {};
    let barEl = document.getElementById('storefront-announcement-bar');
    
    if (ann.enabled && ann.text) {
      if (!barEl) {
        barEl = document.createElement('div');
        barEl.id = 'storefront-announcement-bar';
        barEl.style.cssText = `
          width: 100%;
          padding: 8px 15px;
          text-align: center;
          font-size: 0.85rem;
          font-weight: 700;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 10001;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        `;
        document.body.insertBefore(barEl, document.body.firstChild);
      }
      barEl.style.background = ann.bg_color || 'var(--theme-primary)';
      barEl.style.color = ann.text_color || '#FFFFFF';
      barEl.innerHTML = `<span>${ann.text}</span>`;
      barEl.style.display = 'flex';

      // حساب الارتفاع الفعلي وتعيين المتغير — الهيدر يتحرك عبر CSS تلقائياً
      requestAnimationFrame(() => {
        const h = barEl ? (barEl.offsetHeight || 38) : 38;
        document.documentElement.style.setProperty('--announcement-bar-height', `${h}px`);
        document.body.classList.add('has-announcement-bar');
      });
    } else if (barEl) {
      barEl.style.display = 'none';
      document.documentElement.style.setProperty('--announcement-bar-height', '0px');
      document.body.classList.remove('has-announcement-bar');
    }
  }

  /**
   * 3. تطبيق إعدادات المنتجات وعرض الشبكة والأطوال والأعراض (Products Layout & Dimensions)
   */
  function applyProductsSettings(ps = {}) {
    if (!ps) return;

    const port = ps.portrait || {};
    const land = ps.landscape || {};
    const pCols = Number(port.grid_columns || port.items_per_row || 2);
    const lCols = Number(land.grid_columns || land.items_per_row || 4);

    let styleTag = document.getElementById('dynamic-products-layout-css');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'dynamic-products-layout-css';
      document.head.appendChild(styleTag);
    }

    styleTag.textContent = `
      /* 📱 وضع الجوال والشاشات الصغيرة المستقل */
      @media (max-width: 767px) {
        .product-grid, .ultra-product-grid, .store-premium-grid {
          grid-template-columns: repeat(${pCols}, minmax(0, 1fr)) !important;
          gap: 12px !important;
        }

        ${port.card_custom_width > 0 ? `
          .horizontal-scroller .product-card-compact,
          .horizontal-scroller .fast-card {
            flex: 0 0 ${port.card_custom_width}px !important;
            width: ${port.card_custom_width}px !important;
            min-width: ${port.card_custom_width}px !important;
            max-width: ${port.card_custom_width}px !important;
          }
        ` : ''}

        ${port.card_custom_height > 0 ? `
          .product-card-compact, .fast-card {
            height: ${port.card_custom_height}px !important;
            min-height: ${port.card_custom_height}px !important;
          }
        ` : ''}

        ${port.img_custom_height > 0 ? `
          .compact-img-wrapper, .sic-img-box, .ppc-img-box, .ct-min-img-box, .ct-bold-img-wrap, .ct-glass-img-wrap, .ct-mag-image-wrap {
            height: ${port.img_custom_height}px !important;
            aspect-ratio: auto !important;
            padding-top: 0 !important;
          }
        ` : ''}

        ${port.card_orientation === 'landscape' ? `
          .product-card-compact, .fast-card {
            flex-direction: row !important;
            align-items: center !important;
          }
          .compact-img-wrapper {
            width: 110px !important;
            height: 100% !important;
            flex-shrink: 0 !important;
          }
        ` : ''}

        ${port.show_badges === false ? '.discount-badge-mini, .product-badge, .discount-tag, .sale-badge { display: none !important; }' : ''}
        ${port.show_quick_add === false ? '.modern-add-cart-btn-mini, .add-to-cart-quick, .btn-quick-add, .ct-min-btn, .ct-bold-action-btn, .ct-mag-add, .ct-glass-btn { display: none !important; }' : ''}
        ${port.show_rating === false ? '.product-rating, .rating-stars { display: none !important; }' : ''}
        ${port.show_old_price === false ? '.modern-price-old-wrapper, .p-old-price { display: none !important; }' : ''}
      }

      /* 💻 وضع الكمبيوتر والشاشات الكبيرة المستقل */
      @media (min-width: 768px) {
        .product-grid, .ultra-product-grid, .store-premium-grid {
          grid-template-columns: repeat(${lCols}, minmax(0, 1fr)) !important;
          gap: 18px !important;
        }

        ${land.card_custom_width > 0 ? `
          .horizontal-scroller .product-card-compact,
          .horizontal-scroller .fast-card {
            flex: 0 0 ${land.card_custom_width}px !important;
            width: ${land.card_custom_width}px !important;
            min-width: ${land.card_custom_width}px !important;
            max-width: ${land.card_custom_width}px !important;
          }
        ` : ''}

        ${land.card_custom_height > 0 ? `
          .product-card-compact, .fast-card {
            height: ${land.card_custom_height}px !important;
            min-height: ${land.card_custom_height}px !important;
          }
        ` : ''}

        ${land.img_custom_height > 0 ? `
          .compact-img-wrapper, .sic-img-box, .ppc-img-box, .ct-min-img-box, .ct-bold-img-wrap, .ct-glass-img-wrap, .ct-mag-image-wrap {
            height: ${land.img_custom_height}px !important;
            aspect-ratio: auto !important;
            padding-top: 0 !important;
          }
        ` : ''}

        ${land.card_orientation === 'landscape' ? `
          .product-card-compact, .fast-card {
            flex-direction: row !important;
            align-items: center !important;
          }
          .compact-img-wrapper {
            width: 130px !important;
            height: 100% !important;
            flex-shrink: 0 !important;
          }
        ` : ''}

        ${land.show_badges === false ? '.discount-badge-mini, .product-badge, .discount-tag, .sale-badge { display: none !important; }' : ''}
        ${land.show_quick_add === false ? '.modern-add-cart-btn-mini, .add-to-cart-quick, .btn-quick-add { display: none !important; }' : ''}
        ${land.show_rating === false ? '.product-rating, .rating-stars { display: none !important; }' : ''}
        ${land.show_old_price === false ? '.modern-price-old-wrapper, .p-old-price { display: none !important; }' : ''}
      }
    `;
  }

  /**
   * 4. تطبيق الرسائل والنصوص المخصصة (Store Messages)
   */
  function applyStoreMessages(messages = {}) {
    if (!messages) return;

    if (messages.search_placeholder) {
      document.querySelectorAll('.modern-search-input, .search-input, #search-input').forEach(inp => {
        inp.placeholder = messages.search_placeholder;
      });
    }

    if (messages.empty_cart_title || messages.cart_empty_msg) {
      const emptyMsg = messages.empty_cart_title || messages.cart_empty_msg;
      document.querySelectorAll('.empty-cart-text, .cart-empty-message, .empty-cart-state p').forEach(el => {
        el.textContent = emptyMsg;
      });
    }

    if (messages.checkout_btn_label) {
      document.querySelectorAll('.btn-checkout span, #btn-checkout-label, .checkout-btn-text').forEach(el => {
        el.textContent = messages.checkout_btn_label;
      });
    }

    if (messages.chatbot_greeting) {
      const botGreet = document.querySelector('.bot-welcome-msg, .chatbot-initial-msg');
      if (botGreet) botGreet.textContent = messages.chatbot_greeting;
    }
  }

  /**
   * 5. تطبيق تخصيص النوافذ والشيتات (Modals Customization)
   */
  function applyModalsCustomization(mc = {}) {
    if (!mc) return;

    const pd = mc.product_details || {};
    if (pd.cta_button_text) {
      document.querySelectorAll('#add-to-cart-btn span, .btn-add-main span, .modal-add-btn span').forEach(el => {
        el.textContent = pd.cta_button_text;
      });
    }
    if (pd.border_radius) {
      document.documentElement.style.setProperty('--theme-modal-radius', pd.border_radius);
    }

    const cd = mc.cart_drawer || {};
    if (cd.header_title) {
      const cartTitle = document.querySelector('#cart-drawer-title, .cart-header h3, .cart-modal-title');
      if (cartTitle) cartTitle.textContent = cd.header_title;
    }
    if (cd.checkout_btn_text) {
      document.querySelectorAll('.btn-checkout span, #checkout-btn span').forEach(el => {
        el.textContent = cd.checkout_btn_text;
      });
    }
  }

  /**
   * 6. تطبيق أدوات التسويق والعناصر العائمة (Marketing & Floating Buttons)
   */
  function applyMarketingWidgets(m = {}) {
    if (!m) return;

    // زر الواتساب العائم
    const wa = m.whatsapp_floating || {};
    let waBtn = document.getElementById('storefront-floating-whatsapp');

    if (wa.enabled && wa.phone) {
      if (!waBtn) {
        waBtn = document.createElement('a');
        waBtn.id = 'storefront-floating-whatsapp';
        waBtn.target = '_blank';
        waBtn.rel = 'noopener noreferrer';
        waBtn.style.cssText = `
          position: fixed;
          bottom: 85px;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: #25D366;
          color: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.6rem;
          box-shadow: 0 4px 18px rgba(37, 211, 102, 0.4);
          z-index: 999;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          text-decoration: none;
        `;
        document.body.appendChild(waBtn);
      }
      const cleanPhone = wa.phone.replace(/[^0-9]/g, '');
      waBtn.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent('مرحباً، أود الاستفسار بخصوص المتجر')}`;
      if (wa.position === 'right') {
        waBtn.style.right = '20px';
        waBtn.style.left = 'auto';
      } else {
        waBtn.style.left = '20px';
        waBtn.style.right = 'auto';
      }
      waBtn.innerHTML = '<i class="fab fa-whatsapp"></i>';
      waBtn.style.display = 'flex';
    } else if (waBtn) {
      waBtn.style.display = 'none';
    }

    // شريط الشحن المجاني الترويجي
    const ship = m.free_shipping_bar || {};
    let shipBar = document.getElementById('storefront-shipping-bar');
    if (ship.enabled && ship.message) {
      if (!shipBar) {
        shipBar = document.createElement('div');
        shipBar.id = 'storefront-shipping-bar';
        shipBar.style.cssText = `
          width: 100%;
          padding: 6px 14px;
          text-align: center;
          font-size: 0.8rem;
          font-weight: 700;
          background: var(--theme-accent, #06B6D4);
          color: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          z-index: 10000;
        `;
        const annBar = document.getElementById('storefront-announcement-bar');
        if (annBar && annBar.nextSibling) {
          annBar.parentNode.insertBefore(shipBar, annBar.nextSibling);
        } else {
          document.body.insertBefore(shipBar, document.body.firstChild);
        }
      }
      shipBar.innerHTML = `<i class="fas fa-truck-fast"></i> <span>${ship.message}</span>`;
      shipBar.style.display = 'flex';
      requestAnimationFrame(() => {
        const annH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--announcement-bar-height') || '0');
        const sH = shipBar ? (shipBar.offsetHeight || 34) : 34;
        document.documentElement.style.setProperty('--shipping-bar-height', `${sH}px`);
        // إعادة ضبط موضع شريط الشحن تحت شريط الإعلان
        shipBar.style.top = `${annH}px`;
      });
    } else if (shipBar) {
      shipBar.style.display = 'none';
      document.documentElement.style.setProperty('--shipping-bar-height', '0px');
    }
  }

  /**
   * 7. المحرك الرئيسي لتشغيل الثيم وتطبيقه بالكامل
   */
  window.initStorefront = function (config, storeData = {}) {
    if (!config) return;

    // تعيين الـ config عالمياً فوراً حتى تقرأه js/home.js و js/storefront-engine.js معاً بدون تضارب
    window.currentStorefrontConfig = config;
    currentStorefrontConfig = config;

    // 0. تطبيق الوضع الافتراضي (فاتح / داكن / تلقائي) - لا نعيد تعيين الوضع إذا كنا داخل استوديو المعاينة
    const isStudioPreview = (window.parent && window.parent !== window) || window.location.search.includes('preview=studio');
    if (!isStudioPreview && config.default_theme_mode) {
      const mode = config.default_theme_mode;
      const root = document.documentElement;
      if (mode === 'dark') {
        root.classList.add('dark-mode');
        document.body?.classList.add('dark-mode');
      } else if (mode === 'light') {
        root.classList.remove('dark-mode');
        document.body?.classList.remove('dark-mode');
      } else if (mode === 'auto') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark-mode', prefersDark);
        document.body?.classList.toggle('dark-mode', prefersDark);
      }
    }

    // 1. تطبيق الألوان والخطوط والأشكال
    applyColorTokens(config);

    // 2. تطبيق هوية المتجر وشريط الإعلانات
    if (config.store_identity) {
      applyStoreIdentity(config.store_identity);
    }

    // 3. تطبيق إعدادات شبكة المنتجات (CSS فقط)
    if (config.products_settings) {
      applyProductsSettings(config.products_settings);
    }

    // 4. تطبيق الرسائل
    if (config.messages || config.store_messages) {
      applyStoreMessages(config.messages || config.store_messages);
    }

    // 5. تطبيق تخصيص النوافذ
    if (config.modals_customization) {
      applyModalsCustomization(config.modals_customization);
    }

    // 6. تطبيق أدوات التسويق والواتساب
    if (config.marketing) {
      applyMarketingWidgets(config.marketing);
    }

    // 7. تحديث نمط العرض الحي في واجهة المتجر (DOM rebuild فقط إذا كانت الواجهة جاهزة ومبنية مسبقاً)
    if (!window.HomeUI?._isRendering && window._homeLayoutRendered && window.HomeUI && typeof window.HomeUI.applyLiveConfig === 'function' && window.HomeUI.storeData) {
      window.HomeUI.applyLiveConfig(config, true);
    }

    // 8. تطبيق إعدادات التنقل (الشريط السفلي والعلوي)
    if (config.navigation_settings && typeof window.applyNavigationSettings === 'function') {
      window.applyNavigationSettings(config);
    }

    // 9. تطبيق إعدادات المساعد الذكي
    if (typeof window.applyNalshBotConfig === 'function') {
      window.applyNalshBotConfig();
    }
  };

  /**
   * 7. تحميل الإعدادات عند الإقلاع
   */
  async function loadInitialConfig() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('template_preview') || urlParams.get('local_preview') === '1') {
      const previewSaved = localStorage.getItem('nalsh_template_local_config');
      if (previewSaved) {
        try {
          const parsed = JSON.parse(previewSaved);
          if (parsed && typeof parsed === 'object') {
            window.initStorefront(parsed);
            return parsed;
          }
        } catch (e) {}
      }
      return null;
    }
    const storeParam = urlParams.get('store');
    const pathParts = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/');
    const storeFromPath = pathParts.length > 0 && !['', 'index.html', 'store-builder.html', 'login.html'].includes(pathParts[0].toLowerCase()) ? pathParts[0] : null;
    const targetStore = (storeParam || storeFromPath || '').toLowerCase();

    try {
      let config = null;

      if (targetStore) {
        const cdnUrl = window.CF_WORKER_URL || 'https://nalsh.dpdns.org';
        const configUrl = `${cdnUrl.replace(/\/$/, '')}/stores/${encodeURIComponent(targetStore)}/storefront_config.json`;
        try {
          const res = await fetch(`${configUrl}?v=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) config = await res.json();
        } catch (e) {}

        // Fallback 1: استعلام مباشر عبر API في حال لم يتزامن CDN بعد
        if (!config || typeof config !== 'object') {
          try {
            if (typeof window.apiRequest === 'function') {
              const apiRes = await window.apiRequest('get_storefront_config', { username: targetStore }, 'POST', true);
              if (apiRes && apiRes.data?.config) {
                config = apiRes.data.config;
              }
            }
          } catch (e) {}
        }

        // Fallback 2: كاش محلي للمتجر
        if (!config || typeof config !== 'object') {
          const cached = localStorage.getItem(`nalsh_storefront_config_${targetStore}`);
          if (cached) {
            try { config = JSON.parse(cached); } catch (e) {}
          }
        }
      }

      // Fallback 3: كاش محلي عام للإعدادات أو المسودات
      if (!config || typeof config !== 'object') {
        const fallbackKeys = [
          'nalsh_storefront_config',
          'nalsh_storefront_config_merchant',
          'nalsh_storefront_config_v2',
          'nalsh_theme_config'
        ];
        for (const key of fallbackKeys) {
          const cached = localStorage.getItem(key);
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (parsed && typeof parsed === 'object') {
                config = parsed;
                break;
              }
            } catch (e) {}
          }
        }
      }

      // Fallback 4: ملف theme-config.json من الخادم
      if (!config || typeof config !== 'object') {
        try {
          const res = await fetch('theme-config.json?v=' + Date.now(), { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            if (json && typeof json === 'object') config = json;
          }
        } catch (e) {}
      }

      if (config && typeof config === 'object') {
        if (targetStore) {
          try { localStorage.setItem(`nalsh_storefront_config_${targetStore}`, JSON.stringify(config)); } catch (e) {}
        }
        window.initStorefront(config);
        return config;
      }
      return null;
    } catch (err) {
      console.warn(`[StorefrontEngine] تعذر تحميل إعدادات المتجر:`, err);
      return null;
    }
  }

  /**
   * 8. مراقبة التبديل بين الوضعين الداكن والفاتح
   */
  function observeThemeMode() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          const cfg = currentStorefrontConfig || window.currentStorefrontConfig || window.App?.storeData?.storefront_config;
          if (cfg) {
            currentStorefrontConfig = cfg;
            applyColorTokens(cfg);
          }
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
  }

  /**
   * 9. الاستماع الفوري لرسائل لوحة التحكم واستوديو المصمم (Live Preview Listener)
   */
  window.addEventListener('message', function (event) {
    if (!event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'NALSH_CONFIG_UPDATE' || event.data.type === 'NALSH_THEME_UPDATE' || event.data.type === 'STORE_CONFIG_UPDATED') {
      const liveConfig = event.data.config || event.data.payload;
      if (typeof event.data._preview_dark === 'boolean') {
        const isDark = event.data._preview_dark;
        document.documentElement.classList.toggle('dark-mode', isDark);
        if (document.body) document.body.classList.toggle('dark-mode', isDark);
      }
      if (liveConfig) {
        window.initStorefront(liveConfig);
      }
    } else if (event.data.type === 'NALSH_TOGGLE_DARK_MODE') {
      const isDark = typeof event.data.darkMode === 'boolean'
        ? event.data.darkMode
        : !document.documentElement.classList.contains('dark-mode');
      document.documentElement.classList.toggle('dark-mode', isDark);
      if (document.body) document.body.classList.toggle('dark-mode', isDark);
      try { localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled'); } catch (e) {}
      const cfg = currentStorefrontConfig || window.currentStorefrontConfig || window.App?.storeData?.storefront_config;
      if (cfg) {
        currentStorefrontConfig = cfg;
        applyColorTokens(cfg);
      }
    }
  });

  // كائن عالمي للمحرك
  window.StorefrontEngine = {
    init: window.initStorefront,
    getConfig: () => currentStorefrontConfig || window.currentStorefrontConfig,
    reapplyActiveMode: () => {
      const cfg = currentStorefrontConfig || window.currentStorefrontConfig || window.App?.storeData?.storefront_config;
      if (cfg) {
        currentStorefrontConfig = cfg;
        applyColorTokens(cfg);
      }
    },
    load: () => typeof window.reloadStorefrontTheme === 'function'
      ? window.reloadStorefrontTheme()
      : loadInitialConfig()
  };

  // إعلام النافذة الأب في حال كان المتجر معروضاً داخل Iframe استوديو المصمم
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'NALSH_IFRAME_READY' }, '*');
  }

  // تشغيل عند تحميل الصفحة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observeThemeMode();
    });
  } else {
    observeThemeMode();
  }

})();
