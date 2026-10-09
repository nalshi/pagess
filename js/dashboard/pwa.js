/**
 * pwa.js — ميزات PWA، تثبيت التطبيق، Service Worker، والاتصال
 * يُحمَّل بعد تحميل الصفحة (Lazy Loaded)
 */
(function () {
    'use strict';

    // ===== تسجيل Service Worker =====
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(() => { }).catch(() => { });
    }

    // ===== حقن بانر تثبيت PWA =====
    function injectPwaBanner() {
        if (!document.getElementById('pwa-install-banner')) {
            const html = `
            <div id="pwa-install-banner">
                <div class="pwa-text">ثبّت التطبيق لتجربة أسرع 🚀</div>
                <button id="pwa-install-btn">تثبيت</button>
                <button id="pwa-close-btn"><i class="fas fa-times"></i></button>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        }
    }

    injectPwaBanner();

    // ===== معالجة بانر التثبيت =====
    let deferredPrompt = null;
    let bannerShownTimer = null;

    function getPwaBanner() { return document.getElementById('pwa-install-banner'); }

    window.addEventListener('beforeinstallprompt', (e) => {
        // نمنع البانر الافتراضي للمتصفح ونعرض بانرنا المخصص بدلاً منه
        e.preventDefault();
        deferredPrompt = e;

        // تأجيل ظهور البانر 3 ثوان لعدم مقاطعة المستخدم
        if (bannerShownTimer) clearTimeout(bannerShownTimer);
        bannerShownTimer = setTimeout(() => {
            const banner = getPwaBanner();
            if (banner) banner.classList.add('show');
        }, 3000);
    });

    // ربط الأزرار عبر تفويض الأحداث (delegation) — يعمل حتى بعد الحقن الديناميكي
    document.addEventListener('click', function (e) {
        const installBtn = e.target.closest('#pwa-install-btn');
        const closeBtn = e.target.closest('#pwa-close-btn');

        if (installBtn) {
            if (!deferredPrompt) return;
            const banner = getPwaBanner();
            if (banner) banner.classList.remove('show');
            if (bannerShownTimer) { clearTimeout(bannerShownTimer); bannerShownTimer = null; }
            // prompt() هو الطريقة الوحيدة الصحيحة لعرض حوار التثبيت بعد preventDefault()
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(() => {
                deferredPrompt = null;
            }).catch(() => {
                deferredPrompt = null;
            });
        } else if (closeBtn) {
            const banner = getPwaBanner();
            if (banner) banner.classList.remove('show');
            if (bannerShownTimer) { clearTimeout(bannerShownTimer); bannerShownTimer = null; }
            // لا نصفر deferredPrompt — المستخدم قد يريد التثبيت لاحقاً
        }
    });

    window.addEventListener('appinstalled', () => {
        const banner = getPwaBanner();
        if (banner) banner.classList.remove('show');
        deferredPrompt = null;
        if (bannerShownTimer) { clearTimeout(bannerShownTimer); bannerShownTimer = null; }
    });

    // ===== معالجات حالة الاتصال =====
    window.addEventListener('offline', () => {
        if (typeof window.showT === 'function') window.showT('انقطع الاتصال بالإنترنت!', 'error');
    });

    window.addEventListener('online', () => {
        if (typeof window.showT === 'function') window.showT('عاد الاتصال بالإنترنت!', 'success');
        if (typeof window.startOrderPolling === 'function') window.startOrderPolling();
        if (typeof window.startProductAutoRefresh === 'function') window.startProductAutoRefresh();
    });

    window.startOrderPolling = function () {};
    window.startProductAutoRefresh = function () {};

    // ===== معالجة الروابط الخارجية الآمنة =====
    document.addEventListener('click', function (e) {
        const link = e.target.closest('a');
        if (!link || !link.href) return;
        if (link.href.startsWith('tel:') || link.href.startsWith('mailto:')) return;

        let url;
        try { url = new URL(link.href, window.location.origin); } catch (_) { return; }

        const currentOrigin = window.location.origin;
        const currentPath = window.location.pathname.toLowerCase();
        let shouldOpenExternally = false;

        if (url.origin !== currentOrigin) {
            shouldOpenExternally = true;
        } else {
            const targetPath = url.pathname.toLowerCase();
            const isCurrentlyInMerchantApp = currentPath.includes('merchant-dashboard') || currentPath.includes('login');
            if (isCurrentlyInMerchantApp) {
                if (!targetPath.includes('merchant-dashboard') && !targetPath.includes('login')) shouldOpenExternally = true;
            } else {
                if (targetPath.includes('merchant-dashboard') || targetPath.includes('login')) shouldOpenExternally = true;
            }
        }

        if (link.getAttribute('target') === '_blank') shouldOpenExternally = true;

        if (shouldOpenExternally) {
            e.preventDefault();
            e.stopPropagation();
            const a = document.createElement('a');
            a.href = link.href;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    }, true);

    const originalWindowOpen = window.open;
    window.open = function (url, target, features) {
        if (!url) return null;
        return originalWindowOpen.call(window, url, '_blank', 'noopener,noreferrer');
    };

    // إعادة رسم الصفحة عند العودة إليها عبر bfcache (يحل مشكلة iOS Safari)
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) {
            document.body.style.transform = 'none';
            void document.body.offsetHeight;
            window.dispatchEvent(new Event('resize'));
        }
    });

    if (window.ModuleLoader) window.ModuleLoader.loaded.add('pwa');

})();
