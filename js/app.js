/* ==========================================================================
   App Core (app.js) - نالش
   النسخة النهائية الشاملة: 
   - الترتيب الرسمي للفئات من API
   - إخفاء تلقائي للفئات الفارغة
   - ⭐ تم إلغاء الكاش المحلي للمنتجات لضمان مزامنة حقيقية 100%
   - السماح بفتح المتجر حتى لو كان فارغاً (بدون منتجات)
   ========================================================================== */

// ==========================================
// 1. الإعدادات العامة والمتغيرات
// ==========================================
const MAIN_API_URL = 'https://api.nalsh.dpdns.org/api.php'; 
const CF_WORKER_URL = 'https://nalsh.dpdns.org'; 

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

// ⭐ أمان: مسار نسبي (نفس دومين المتجر) يمرّ عبر بروكسي
// Cloudflare Pages Function (/functions/api/worker/[[path]].js)
// لتأمين الاتصال وإخفاء رابط وسر الـ Worker (X-Gateway-Secret) عن المتصفح.
const WORKER_API_URL = resolveWorkerApiUrl();

const WORKER_ACTIONS = new Set([
    'check_customer_session',
    'verify_cart_live',
    'create_order',
    'get_user_orders',
    'add_to_cart',
    'get_cart',
    'save_product',
    'list_products',
    'delete_product',
    'toggle_availability',
    'get_merchant_orders',
    'get_orders',
    'update_order_status',
    'cancel_order',
    'confirm_delivery_code',
    'get_stats',
    'get_merchant_settings',
    'save_merchant_settings',
    'save_fcm_token',
    'get_firebase_config',
    'get_categories_tree',
    'get_public_products',
    'get_ai_assistant_config',
    'save_ai_assistant_config',
    'get_whatsapp_config',
    'save_whatsapp_config',
    // 🤖 المساعد الذكي الخاص بكل تاجر
    'ai_chat',
]);

window.user = JSON.parse(localStorage.getItem('nalsh_user_session')) || { loggedIn: false };
window.allProducts = []; 

// ==========================================
// 2. محرك الاتصال المركزي 
// ==========================================
window.apiRequest = async function(action, data = {}, method = 'POST', silent = false) {
    let payload = { action: action, ...data };
    
    let headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    const token = localStorage.getItem('customer_token');
    const useWorker = WORKER_ACTIONS.has(action);

    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
        if (!useWorker) {
            payload['auth_token'] = token;
        }
    }

    const targetUrl = useWorker ? WORKER_API_URL : MAIN_API_URL;

    try {
        const response = await fetch(targetUrl, {
            method: method,
            headers: headers,
            credentials: useWorker ? 'omit' : 'include', 
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (response.status === 401) {
            console.warn("⚠️ انتهت الجلسة أو الحساب غير مصرح.");
            localStorage.removeItem('customer_token');
            localStorage.removeItem('nalsh_user_session');
            window.user = { loggedIn: false };
            
            if (!silent && typeof showToast === 'function') {
                showToast("انتهت الجلسة، يرجى تسجيل الدخول مجدداً", "error");
            }
            if (typeof updateUIAfterLoginStateChange === 'function') {
                updateUIAfterLoginStateChange();
            }
        }
        
        return result;
    } catch (error) {
        console.error("❌ API Request Error:", error);
        throw error;
    }
};

// ==========================================
// 3. نظام إدارة الجلسة 
// ==========================================
window.checkSession = async function() {
    const token = localStorage.getItem('customer_token');
    if (!token) {
        window.user = { loggedIn: false };
        if (typeof updateUIAfterLoginStateChange === 'function') updateUIAfterLoginStateChange();
        return;
    }

    try {
        const response = await window.apiRequest('check_customer_session', {}, 'POST', true);
        
        if (response.status === 'success' && response.loggedIn) {
            window.user = response.customer;
            window.user.loggedIn = true;
            localStorage.setItem('nalsh_user_session', JSON.stringify(window.user));
            console.log("✅ تم التحقق من جلسة العميل بنجاح:", window.user.full_name);
        } else {
            localStorage.removeItem('customer_token');
            localStorage.removeItem('nalsh_user_session');
            window.user = { loggedIn: false };
        }
        
        if (typeof updateUIAfterLoginStateChange === 'function') updateUIAfterLoginStateChange();
        
    } catch (e) {
        console.error("فشل فحص الجلسة:", e);
    }
};

window.handleLogout = function() {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('nalsh_user_session');
    window.user = { loggedIn: false };
    
    if (typeof togglePage === 'function') togglePage('profile-page', false);
    if (typeof updateUIAfterLoginStateChange === 'function') updateUIAfterLoginStateChange();
    if (typeof showToast === 'function') showToast('تم تسجيل الخروج بنجاح', 'success');
};

// ==========================================
// 4. قلب التطبيق (تحميل المتجر وبناء الواجهة)
// ==========================================
window.App = {
    currentStoreId: null,
    storeData: null,
    currentVersion: 0,
    storeValidationStatus: 'unverified',
    syncInterval: null,
    syncInProgress: false,
    storeLoadPromise: null,
    chatbotLoadScheduled: false,

    // ==========================================
    // 💾 نظام الكاش المحلي (لعرض آخر نسخة عند انقطاع النت)
    // ==========================================
    getCacheKey: function(targetStore) {
        return `nalsh_store_cache_${targetStore}`;
    },

    saveStoreCache: function(targetStore) {
        try {
            const cachePayload = {
                version: this.currentVersion,
                storeData: this.storeData,
                allProducts: window.allProducts,
                savedAt: Date.now()
            };
            localStorage.setItem(this.getCacheKey(targetStore), JSON.stringify(cachePayload));
        } catch (e) {
            console.warn("⚠️ تعذر حفظ نسخة الكاش المحلية (قد تكون المساحة ممتلئة):", e);
        }
    },

    loadStoreCache: function(targetStore) {
        try {
            const raw = localStorage.getItem(this.getCacheKey(targetStore));
            if (!raw) return null;
            const cached = JSON.parse(raw);
            if (!cached || typeof cached !== 'object' ||
                !cached.storeData || !Array.isArray(cached.storeData.categories) ||
                !Array.isArray(cached.allProducts)) {
                console.warn(`⚠️ نسخة الكاش لمتجر "${targetStore}" غير صالحة، سيتم جلب البيانات من الخادم.`);
                return null;
            }

            const version = Number(cached.version);
            return { ...cached, version: Number.isFinite(version) ? version : 0 };
        } catch (e) {
            console.warn(`⚠️ تعذر قراءة نسخة الكاش لمتجر "${targetStore}":`, e);
            return null;
        }
    },

    applyStoreCache: function(cached, targetStore) {
        this.storeData = cached.storeData;
        window.allProducts = cached.allProducts || [];
        this.currentVersion = cached.version || 0;
        window.isIsolatedStore = true;
        console.log(`📦 [Offline] تم عرض آخر نسخة محفوظة لمتجر "${targetStore}" (إصدار ${this.currentVersion})`);
    },


    init: async function() {
        console.log("🚀 جاري تشغيل النظام (وضع المتجر الواحد)...");

        const rawPath = (window.location.pathname || '').replace(/\\/g, '/');
        const path = rawPath.replace(/^\/+|\/+$/g, '');
        const pathParts = path.split('/').filter(Boolean);
        const isFileUrl = window.location.protocol === 'file:';
        
        const ignoredPaths = ['', 'index.html', 'merchant-app.html', 'merchant-app', 'merchant-dashboard', 'auth-page.html', 'login', 'api.php'];
        
        let storeFromPath = null;
        let productFromPath = null;

        if (!isFileUrl && pathParts.length > 0) {
            const firstSegment = pathParts[0];
            const firstLower = firstSegment.toLowerCase();
            const isWindowsDrive = /^[a-z]:$/.test(firstSegment);

            if (firstLower === 'merchant-app' && pathParts.length > 1) {
                storeFromPath = pathParts[1];
                if (pathParts.length > 2 && pathParts[2].startsWith('p')) {
                    productFromPath = pathParts[2].substring(1);
                }
            } else if (!ignoredPaths.includes(firstLower) && !isWindowsDrive) {
                storeFromPath = firstSegment;
                if (pathParts.length > 1 && pathParts[1].startsWith('p')) {
                    productFromPath = pathParts[1].substring(1);
                }
            }
        }

        const urlParams = new URLSearchParams(window.location.search);
        this.currentStoreId = storeFromPath || urlParams.get('store') || 'nalshi'; 

        document.body.classList.add('isolated-mode');

        if (typeof updateUIAfterLoginStateChange === 'function') {
            updateUIAfterLoginStateChange();
        }

        const openLinkedProduct = () => {
            if (!productFromPath) return;

            const productToOpen = window.allProducts.find(p =>
                String(p.id) === String(productFromPath) ||
                String(p.global_product_id) === String(productFromPath)
            );

            if (productToOpen) {
                console.log("🎯 جاري فتح المنتج المشترك...");
                const checkInterval = setInterval(() => {
                    if (typeof window.toggleProductModal === 'function') {
                        clearInterval(checkInterval);
                        this.hideSplashScreen();
                        window.toggleProductModal(true, productToOpen);
                    }
                }, 100);

                setTimeout(() => {
                    clearInterval(checkInterval);
                    this.hideSplashScreen();
                }, 5000);
            } else {
                console.warn("⚠️ المنتج غير موجود، سيتم عرض المتجر...");
                this.hideSplashScreen();
                this.showToast("عذراً، المنتج غير متوفر حالياً، تم توجيهك للمتجر.", "error");
            }
        };

        const cached = this.loadStoreCache(this.currentStoreId.toLowerCase());
        if (cached) this.applyStoreCache(cached, this.currentStoreId.toLowerCase());

        await this.loadStoreData(Boolean(cached));
        await (window.nalshThemeReady || Promise.resolve());

        if (this.storeValidationStatus === 'failed' || !this.storeData) {
            this.showStoreUnavailable();
            if (new URLSearchParams(window.location.search).get('preview') === 'studio') {
                this.scheduleDeferredChatbot();
            }
        } else if (this.storeData && typeof window.HomeUI !== 'undefined') {
            if (this.storeValidationStatus === 'offline') {
                this.showToast("أنت غير متصل؛ هذه آخر نسخة محفوظة وقد لا تتضمن أحدث التغييرات.", "error");
            }
            const activeTheme = window.currentStorefrontConfigStoreId === this.currentStoreId.toLowerCase()
                ? window.currentStorefrontConfig
                : null;
            if (activeTheme) {
                this.storeData.storefront_config = activeTheme;
                this.saveStoreCache(this.currentStoreId.toLowerCase());
            }
            window.HomeUI.render(this.storeData);
            if (productFromPath) openLinkedProduct();
            else this.hideSplashScreen();
            this.scheduleDeferredChatbot();
        }

        this.initGlobalSystems();
        
        if (typeof renderSubNavbar === 'function') {
            renderSubNavbar();
        }

        this.startLiveSync();
    },

    startLiveSync: function() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        
        this.syncInterval = setInterval(async () => {
            if (this.syncInProgress) return;

            // 🚫 إذا الجهاز غير متصل بالإنترنت، لا داعي لمحاولة الطلب أصلاً
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                return;
            }

            this.syncInProgress = true;
            try {
                const targetStore = this.currentStoreId.toLowerCase();
                const manifestUrl = `${CF_WORKER_URL}/stores/${targetStore}/manifest.json`;
                
                const manifestRes = await fetch(manifestUrl, { cache: 'no-store' });
                
                if (manifestRes.ok) {
                    const manifestData = await manifestRes.json();
                    const serverVersion = Number(manifestData.version);
                    if (!Number.isFinite(serverVersion) || serverVersion <= 0) return;
                    
                    if (serverVersion !== this.currentVersion || this.storeValidationStatus === 'failed') {
                        console.log(`⚡ [Live Sync] تم رصد تحديث جديد! جاري التحديث بصمت إلى الإصدار ${serverVersion}...`);

                        if (
                            this.storeValidationStatus === 'failed' &&
                            serverVersion === this.currentVersion &&
                            !this.storeData
                        ) {
                            const cached = this.loadStoreCache(this.currentStoreId.toLowerCase());
                            if (cached && cached.version === serverVersion) {
                                this.applyStoreCache(cached, this.currentStoreId.toLowerCase());
                                this.storeValidationStatus = 'current';
                                await (window.reloadStorefrontTheme?.() || Promise.resolve());
                                if (window.currentStorefrontConfigStoreId === this.currentStoreId.toLowerCase()) {
                                    this.storeData.storefront_config = window.currentStorefrontConfig;
                                }
                                this.saveStoreCache(this.currentStoreId.toLowerCase());
                                window.HomeUI?.render(this.storeData);
                                this.hideSplashScreen();
                                return;
                            }
                        }
                        
                        const didRefresh = await this.loadStoreData(true, manifestData);
                        
                        if (didRefresh && this.storeData && typeof window.HomeUI !== 'undefined') {
                            if (typeof window.reloadStorefrontTheme === 'function') {
                                await window.reloadStorefrontTheme();
                            }
                            const activeTheme = window.currentStorefrontConfigStoreId === this.currentStoreId.toLowerCase()
                                ? window.currentStorefrontConfig
                                : null;
                            if (activeTheme) this.storeData.storefront_config = activeTheme;
                            this.saveStoreCache(this.currentStoreId.toLowerCase());
                            window.HomeUI.render(this.storeData);
                            this.showToast("تم تحديث المنتجات والأسعار للتو 🔄", "success");
                        }
                    }
                }
            } catch (error) {
                // التجاهل الصامت
            } finally {
                this.syncInProgress = false;
            }
        }, 15000); 
    },

    scheduleDeferredChatbot: function() {
        if (this.chatbotLoadScheduled || window.NalshBotUI) return;
        this.chatbotLoadScheduled = true;

        const loadChatbot = () => {
            if (window.NalshBotUI) return;

            const script = document.createElement('script');
            script.src = 'js/chatbot.js';
            script.async = true;
            script.onload = () => {
                this.chatbotLoadScheduled = false;
            };
            script.onerror = () => {
                this.chatbotLoadScheduled = false;
                console.error("❌ تعذر تحميل المساعد الذكي.");
            };
            document.body.appendChild(script);
        };

        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(loadChatbot, { timeout: 2000 });
        } else {
            window.setTimeout(loadChatbot, 500);
        }
    },

    loadStoreData: function(isSilent = false, preFetchedManifest = null) {
        if (this.storeLoadPromise) return this.storeLoadPromise;

        const loadPromise = this.fetchStoreData(isSilent, preFetchedManifest);
        this.storeLoadPromise = loadPromise;
        return loadPromise.finally(() => {
            if (this.storeLoadPromise === loadPromise) this.storeLoadPromise = null;
        });
    },

    fetchStoreData: async function(isSilent = false, preFetchedManifest = null) {
        const targetStore = this.currentStoreId.toLowerCase();

        // 🚫 لا يوجد اتصال بالإنترنت إطلاقاً: اعرض آخر نسخة محفوظة فوراً بدل التوقف بالتحميل
        if (typeof navigator !== 'undefined' && navigator.onLine === false && !preFetchedManifest) {
            const cached = this.loadStoreCache(targetStore);
            if (cached) {
                this.applyStoreCache(cached, targetStore);
                this.storeValidationStatus = 'offline';
                if (!isSilent) this.showToast("أنت غير متصل بالإنترنت، يتم عرض آخر نسخة محفوظة 📦", "error");
                return false;
            }
        }

        try {
            if (!isSilent) console.log(`⏳ جاري جلب البيانات السحابية لمتجر: ${targetStore}...`);

            let storeProducts = [];
            let storeInfo = {};
            let categoriesArray = [];
            let storeName = targetStore;
            let storeBio = 'أهلاً بك في متجرنا. نسعد بتوفير أفضل المنتجات لك!';
            let serverVersion = 0;
            let manifestData = preFetchedManifest;

            if (!manifestData) {
                try {
                    const manifestRes = await fetch(`${CF_WORKER_URL}/stores/${targetStore}/manifest.json`, { cache: 'no-store' });
                    if (manifestRes.ok) manifestData = await manifestRes.json();
                } catch (e) {
                    if (!isSilent) console.warn("⚠️ تعذر قراءة المانيفست، سيتم المتابعة لتجنب التوقف.");
                }
            }

            // 🚫 فشل جلب المانيفست تماماً (على الأغلب لا يوجد اتصال بالإنترنت):
            // نعرض آخر نسخة محفوظة محلياً بدل بناء متجر فارغ أو محاولة تحميل صفحات المنتجات
            if (!manifestData) {
                throw new Error("تعذر التحقق من إصدار المتجر؛ لن يتم عرض نسخة منتجات قديمة.");
            }

            const manifestVersion = Number(manifestData && manifestData.version);
            serverVersion = Number.isFinite(manifestVersion) ? manifestVersion : 0;
            if (!Number.isFinite(manifestVersion) || manifestVersion <= 0) {
                throw new Error("بيانات إصدار المتجر غير صالحة؛ لن يتم عرض نسخة منتجات قديمة.");
            }
            if (this.storeData && serverVersion === this.currentVersion) {
                this.storeValidationStatus = 'current';
                return false;
            }

            const CDN_BASE_URL = `${CF_WORKER_URL}/stores/${targetStore}`;
            const manifestFiles = manifestData.files && typeof manifestData.files === 'object'
                ? manifestData.files
                : {};
            const changedFiles = Object.keys(manifestFiles);
            const themeOnlyFiles = new Set(['storefront_config', 'storefront_selection', 'theme_config']);
            const isThemeOnlyUpdate = changedFiles.length > 0 &&
                changedFiles.every(file => themeOnlyFiles.has(file.replace(/\.json$/i, '')));

            if (this.storeData && isThemeOnlyUpdate) {
                this.currentVersion = serverVersion;
                this.storeValidationStatus = 'current';
                this.saveStoreCache(targetStore);
                return true;
            }

            const pageEntries = manifestFiles.pages && typeof manifestFiles.pages === 'object'
                ? Object.keys(manifestFiles.pages)
                : [];
            const pageNumbers = pageEntries.map(key => Number(key.match(/\d+/)?.[0])).filter(Number.isInteger);
            const pageCountFromFiles = pageNumbers.length ? Math.max(...pageNumbers) : NaN;
            let totalPages = Number(manifestData.total_pages ?? pageCountFromFiles);
            let firstPageData = null;
            if (!Number.isInteger(totalPages) || totalPages < 0) {
                const firstPageResponse = await fetch(`${CDN_BASE_URL}/products_page_1.json`, { cache: 'no-store' });
                if (!firstPageResponse.ok) {
                    throw new Error("تعذر تحديد صفحات المنتجات الحديثة؛ لن يتم عرض نسخة قديمة.");
                }
                firstPageData = await firstPageResponse.json();
                totalPages = Number(firstPageData?.total_pages);
                if (!Number.isInteger(totalPages) || totalPages < 1 ||
                    !firstPageData.data || typeof firstPageData.data !== 'object' ||
                    Array.isArray(firstPageData.data)) {
                    throw new Error("تعذر قراءة صفحات المنتجات الحديثة؛ لن يتم عرض نسخة قديمة.");
                }
            }
            if (totalPages === 0 && Number(manifestData.total_products) !== 0) {
                throw new Error("بيانات صفحات المنتجات غير متوافقة؛ لن يتم عرض نسخة قديمة.");
            }
            const fetchPromises = [];

            fetchPromises.push(
                fetch(`${CDN_BASE_URL}/info.json`, { cache: 'no-store' })
                .then(res => res.ok ? res.json() : null).catch(() => null)
            );
            fetchPromises.push(
                fetch(`${CDN_BASE_URL}/categories.json`, { cache: 'no-store' })
                .then(res => res.ok ? res.json() : null).catch(() => null)
            );
            fetchPromises.push(
                fetch(`${CDN_BASE_URL}/storefront_config.json`, { cache: 'no-store' })
                .then(res => res.ok ? res.json() : null).catch(() => null)
            );

            for (let i = 1; i <= totalPages; i++) {
                fetchPromises.push(i === 1 && firstPageData
                    ? Promise.resolve(firstPageData)
                    : fetch(`${CDN_BASE_URL}/products_page_${i}.json`, { cache: 'no-store' })
                        .then(res => res.ok ? res.json() : null).catch(() => null));
            }

            const results = await Promise.all(fetchPromises);
            const productPages = results.slice(3);
            if (productPages.some(pageData =>
                !pageData || typeof pageData !== 'object' ||
                !pageData.data || typeof pageData.data !== 'object' ||
                Array.isArray(pageData.data)
            )) {
                throw new Error("تعذر تحميل كل صفحات المنتجات؛ تم الاحتفاظ بالبيانات الحالية.");
            }

            if (results[0]) storeInfo = results[0];
            const rawCategories = results[1];
            const storefrontConfig = results[2];
            
            let productsDict = {}; 
            
            for (let i = 3; i < results.length; i++) {
                const pageData = results[i];
                if (pageData && pageData.data) {
                    Object.values(pageData.data).forEach(prod => {
                        productsDict[prod.id] = prod;
                    });
                }
            }

            // 💡 السماح بفتح المتجر حتى لو كان فارغاً من المنتجات
            if (Object.keys(productsDict).length === 0 && !isSilent) {
                console.warn("⚠️ المتجر لا يحتوي على منتجات نشطة حالياً، سيتم عرض واجهة المتجر فارغة.");
            }

            if (rawCategories && rawCategories.data) {
                function buildCategoryTree(node) {
                    const nodeProducts = (node.products || []).map(pref => {
                        const p = productsDict[pref.id];
                        if (p) p.leaf_category = node.name;
                        return p;
                    }).filter(Boolean);
                    
                    const subcats = (node.children || []).map(child => buildCategoryTree(child));
                    
                    return {
                        name: node.name,
                        products: nodeProducts,
                        subcategories: subcats
                    };
                }
                
                categoriesArray = rawCategories.data.map(buildCategoryTree);
                
                function removeEmptyCategories(cats) {
                    return cats.map(cat => {
                        if (cat.subcategories && cat.subcategories.length > 0) {
                            cat.subcategories = removeEmptyCategories(cat.subcategories);
                        }
                        return cat;
                    }).filter(cat => (cat.products && cat.products.length > 0) || (cat.subcategories && cat.subcategories.length > 0));
                }
                categoriesArray = removeEmptyCategories(categoriesArray);

                function extractFlatProducts(cats) {
                    cats.forEach(c => {
                        if (c.products) storeProducts.push(...c.products);
                        if (c.subcategories) extractFlatProducts(c.subcategories);
                    });
                }
                extractFlatProducts(categoriesArray);
                
                storeProducts = [...new Set(storeProducts)];
                
                const categorizedIds = new Set(storeProducts.map(p => p.id));
                const orphans = Object.values(productsDict).filter(p => !categorizedIds.has(p.id));
                if (orphans.length > 0) {
                    orphans.forEach(p => p.leaf_category = 'أقسام متنوعة');
                    categoriesArray.push({
                        name: 'أقسام متنوعة',
                        products: orphans,
                        subcategories: []
                    });
                    storeProducts.push(...orphans);
                }
            } else {
                storeProducts = Object.values(productsDict);
                const categoriesMap = {};
                storeProducts.forEach(p => {
                    const rawCat = (p.category || p.department || p.type || 'أقسام متنوعة');
                    const parts = String(rawCat).split('>').map(s => s.trim()).filter(Boolean);
                    const parentName = parts[0] || 'أقسام متنوعة';
                    const leafName = parts[parts.length - 1] || parentName;
                    p.leaf_category = leafName;
                    if (!categoriesMap[parentName]) categoriesMap[parentName] = { name: parentName, products: [], subMap: {} };
                    categoriesMap[parentName].products.push(p);
                    if (parts.length > 1) {
                        const subName = parts[1];
                        if (!categoriesMap[parentName].subMap[subName]) categoriesMap[parentName].subMap[subName] = [];
                        categoriesMap[parentName].subMap[subName].push(p);
                    }
                });
                categoriesArray = Object.keys(categoriesMap).map(catName => {
                    const cat = categoriesMap[catName];
                    return {
                        name: cat.name,
                        products: cat.products,
                        subcategories: Object.keys(cat.subMap).map(subName => ({ name: subName, products: cat.subMap[subName] }))
                    };
                });
                categoriesArray = categoriesArray.filter(cat => cat.products.length > 0 || cat.subcategories.length > 0);
            }

            // 🔧 info.json الفعلي مغلّف بمفتاح "data" (راجع storeInfoSyncService.js على الباك إند):
            // { _version, data: { store_name, phone, settings, ... } }
            // ندعم كمان الشكل القديم المسطّح احتياطاً لو كان في ملفات قديمة على GitHub لسا ما تزامنت.
            const infoPayload = (storeInfo && storeInfo.data) ? storeInfo.data : storeInfo;

            let storeSettings = {};
            let storePhone = '';
            if (infoPayload && Object.keys(infoPayload).length > 0 && infoPayload.store_name) {
                storeName = infoPayload.store_name || infoPayload.name || infoPayload.full_name || storeName;
                let settings = infoPayload.settings || {};
                if (typeof settings === 'string') {
                    try { settings = JSON.parse(settings); } catch(e){}
                }
                storeBio = settings.welcome_message || settings.bio || settings.description || infoPayload.bio || storeBio;
                storeSettings = settings;
                storePhone = infoPayload.phone || settings.phone || settings.whatsapp || settings.whatsappNumber || '';
            } 
            
            if (storeName.toLowerCase() === targetStore.toLowerCase() && storeProducts.length > 0) {
                const firstProduct = storeProducts[0];
                storeName = firstProduct.merchant_name || firstProduct.store_name || storeName;
            }
            
            window.allProducts = storeProducts;

            let resolvedMerchantId = null;
            if (infoPayload && (infoPayload.id !== undefined && infoPayload.id !== null)) {
                resolvedMerchantId = String(infoPayload.id);
            } else if (infoPayload && (infoPayload.merchant_id !== undefined && infoPayload.merchant_id !== null)) {
                resolvedMerchantId = String(infoPayload.merchant_id);
            } else {
                const productWithMerchant = storeProducts.find(p => p && p.merchant_id !== undefined && p.merchant_id !== null && p.merchant_id !== '');
                if (productWithMerchant) resolvedMerchantId = String(productWithMerchant.merchant_id);
            }

            window.isIsolatedStore = true;
            window.currentMerchantId = resolvedMerchantId;
            console.log(`🏪 [Store Context] currentMerchantId = ${resolvedMerchantId}`);

            let localStorefrontConfig = null;
            try {
                const rawCached = localStorage.getItem(`nalsh_storefront_config_${targetStore}`);
                if (rawCached) localStorefrontConfig = JSON.parse(rawCached);
            } catch (e) {}

            const activeTheme = window.currentStorefrontConfigStoreId === targetStore
                ? window.currentStorefrontConfig
                : null;
            const resolvedStorefrontConfig = activeTheme || storefrontConfig || storeSettings.storefront_config || localStorefrontConfig || null;

            this.currentVersion = serverVersion;
            this.storeValidationStatus = 'current';
            this.storeData = {
                id: targetStore,
                name: storeName,
                username: `@${targetStore}`,
                bio: storeBio,
                phone: storePhone,
                settings: storeSettings,
                storefront_config: resolvedStorefrontConfig,
                stats: { 
                    products: storeProducts.length, 
                    rating: '4.9', 
                    delivery: 'سريع' 
                },
                categories: categoriesArray
            };

            try {
                localStorage.setItem(`customer_info_${targetStore}`, JSON.stringify({
                    store_name: storeName,
                    name: storeName,
                    welcome_message: storeBio,
                    settings: storeSettings
                }));
            } catch (e) {}

            if (!isSilent) console.log("✅ تم تجهيز واستعادة بيانات المتجر بنجاح بالترتيب الصحيح.");

            // 💾 احفظ هذه النسخة الناجحة محلياً لاستخدامها لاحقاً عند انقطاع النت
            this.saveStoreCache(targetStore);
            return true;

        } catch (error) {
            console.error("❌ خطأ أثناء تحميل المتجر:", error);

            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const cached = this.loadStoreCache(targetStore);
                if (cached) {
                    this.applyStoreCache(cached, targetStore);
                    this.storeValidationStatus = 'offline';
                    if (!isSilent) this.showToast("أنت غير متصل، يتم عرض آخر نسخة محفوظة 📦", "error");
                    return false;
                }
            }

            this.storeValidationStatus = 'failed';
            if (!isSilent) this.showToast("تعذر التحقق من تحديثات المتجر؛ لم نعرض بيانات قديمة.", "error");
            return false;
        }
    },

    showStoreUnavailable: function() {
        window.allProducts = [];
        this.storeData = null;
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `
                <section class="empty-store-state" role="status">
                    <i class="fas fa-cloud-arrow-down"></i>
                    <h3>تعذر تحديث المتجر</h3>
                    <p>لم نتمكن من التحقق من أحدث المنتجات، لذلك لم نعرض نسخة قديمة.</p>
                    <button class="btn-action primary" type="button" onclick="window.location.reload()">إعادة المحاولة</button>
                </section>
            `;
        }
        this.hideSplashScreen();
        this.showToast("تعذر التحقق من أحدث بيانات المتجر.", "error");
    },

    loadFallbackDemoStore: function(targetStore, randomize = false) {
        const demoProducts = [
            {
                id: '1',
                name: 'سماعات رأس لاسلكية فائقة النقاء Pro',
                category: 'إلكترونيات',
                price: 18500,
                original_price: 24000,
                discount: 23,
                description: 'سماعات رأس احترافية مع ميزة إلغاء الضوضاء الفعالة وبطارية تدوم حتى 40 ساعة متواصلة.',
                rating: 4.9,
                image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
                badge: 'الأكثر مبيعاً 🔥'
            },
            {
                id: '2',
                name: 'ساعة ذكية رياضية مقاومة للماء Ultra',
                category: 'إلكترونيات',
                price: 14000,
                original_price: 19000,
                discount: 26,
                description: 'ساعة ذكية بشاشة AMOLED ومستشعرات دقيقة لمعدل ضربات القلب والأكسجين وتتبع التمارين.',
                rating: 4.8,
                image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
                badge: 'خصم خاص ⚡'
            },
            {
                id: '3',
                name: 'طقم عطر شرقي فاخر مسك وعنبر',
                category: 'عطور وتجميل',
                price: 22000,
                original_price: 22000,
                discount: 0,
                description: 'مزيج فاخر من العود والمسك الأصيل بثبات يدوم لأيام مع لمسات عصرية مبهجة.',
                rating: 5.0,
                image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&auto=format&fit=crop&q=80'
            },
            {
                id: '4',
                name: 'حقيبة ظهر ذكية مضادة للسرقة مع منفذ USB',
                category: 'حقائب وإكسسوارات',
                price: 9500,
                original_price: 13000,
                discount: 27,
                description: 'حقيبة أنيقة للعمل والسفر مصممة بأقمشة مقاومة للماء وقفل أمان مدمج.',
                rating: 4.7,
                image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80'
            },
            {
                id: '5',
                name: 'مكبر صوت بلوتوث محمول مقاوم للصدمات',
                category: 'إلكترونيات',
                price: 11000,
                original_price: 11000,
                discount: 0,
                description: 'صوت محيطي قوي 360 درجة مع إضاءة RGB تفاعلية وبطارية تدوم طوال اليوم.',
                rating: 4.6,
                image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80'
            },
            {
                id: '6',
                name: 'ماكينة قهوة إسبريسو منزلية مدمجة',
                category: 'أجهزة منزلية',
                price: 34000,
                original_price: 42000,
                discount: 19,
                description: 'استمتع بألذ كوب قهوة وكابتشينو بضغط 15 بار مع أنبوب تبخير الحليب المطور.',
                rating: 4.9,
                image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
                badge: 'مميز ⭐'
            }
        ];

        if (randomize) {
            for (let i = demoProducts.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [demoProducts[i], demoProducts[j]] = [demoProducts[j], demoProducts[i]];
            }
        }

        window.allProducts = demoProducts;

        this.storeData = {
            id: targetStore || 'nalsh_store',
            name: 'متجر نالش العصري',
            username: '@nalsh_store',
            bio: 'أهلاً بكم في متجرنا! نسعد بتقديم أرقى وأحدث المنتجات بأفضل الأسعار.',
            phone: '770000000',
            settings: {
                address: 'صنعاء، شارع حدة',
                location: 'https://maps.google.com'
            },
            stats: {
                products: demoProducts.length,
                rating: '4.9',
                delivery: 'سريع'
            },
            categories: [...new Set(demoProducts.map(product => product.category))].map(name => ({
                name,
                products: demoProducts.filter(product => product.category === name),
                subcategories: []
            }))
        };

        if (typeof window.HomeUI !== 'undefined') {
            window.HomeUI.render(this.storeData);
        }
        this.hideSplashScreen();
    },

    hideSplashScreen: function() {
        const splash = document.getElementById('smart-splash-screen');
        if (splash) {
            setTimeout(() => {
                splash.style.opacity = '0';
                document.body.classList.remove('intro-locked');
                document.body.classList.add('store-ready');
                setTimeout(() => splash.remove(), 800);
            }, 500); 
        } else {
            document.body.classList.remove('intro-locked');
            document.body.classList.add('store-ready');
        }
    },

    initGlobalSystems: function() {
        const customName = window.currentStorefrontConfig?.store_identity?.store_name;
        const displayName = customName || (this.storeData && this.storeData.name) || 'متجر نالش';

        document.title = `${displayName} | نالش`;
        const introName = document.getElementById('nalsh-intro-text');
        const introWelcome = document.getElementById('nalsh-welcome-text');
        if (introName) {
            const isArabic = /[\u0600-\u06FF]/.test(displayName);
            introName.textContent = displayName;
            introName.style.fontFamily = isArabic ? "'Tajawal', sans-serif" : "system-ui, sans-serif";
            introName.style.fontSize = isArabic ? '2.8rem' : '2.5rem';
            introName.style.letterSpacing = isArabic ? '0' : '3px';
        }
        if (introWelcome && this.storeData && this.storeData.bio) {
            introWelcome.textContent = this.storeData.bio;
        }
        
        if (typeof window.updateMainHeaderLogo === 'function') {
            window.updateMainHeaderLogo(true, displayName);
        } else {
            const logoText = document.getElementById('main-logo-text');
            if (logoText) {
                logoText.innerText = displayName;
            }
        }
    },

    showToast: function(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
        toast.style.background = type === 'success' ? 'var(--success)' : 'var(--danger)';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
};

window.bootJAMstack = function() {
    App.init();
};

window.updateUIAfterLoginStateChange = function() {
    const userBtn = document.getElementById('user-nav-btn');
    if (!userBtn) return;
    
    if (window.user && window.user.loggedIn) {
        userBtn.innerHTML = `<div class="user-initial-small">${(window.user.full_name || 'ع').charAt(0)}</div>`;
        userBtn.classList.add('logged-in');
        
        if (typeof OrdersApp !== 'undefined' && typeof OrdersApp.renderPage === 'function') {
            const profilePage = document.getElementById('profile-page');
            if (profilePage && profilePage.classList.contains('open')) {
                OrdersApp.renderPage();
            }
        }
    } else {
        userBtn.innerHTML = `<i class="far fa-user"></i>`;
        userBtn.classList.remove('logged-in');
    }
};

window.lazyLoadMap = function() {
    if (window.L) return Promise.resolve(); 
    
    return new Promise((resolve, reject) => {
        ['css/leaflet.css', 'css/Control.Geocoder.css', 'css/leaflet-routing-machine.css'].forEach(href => {
            if (!document.querySelector(`link[href="${href}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                document.head.appendChild(link);
            }
        });

        const leafletScript = document.createElement('script');
        leafletScript.src = 'js/leaflet.js';
        leafletScript.onload = () => {
            let loadedCount = 0;
            const checkDone = () => {
                loadedCount++;
                if (loadedCount === 2) resolve();
            };

            const geocoderScript = document.createElement('script');
            geocoderScript.src = 'js/Control.Geocoder.js';
            geocoderScript.onload = checkDone;
            document.body.appendChild(geocoderScript);

            const routingScript = document.createElement('script');
            routingScript.src = 'js/leaflet-routing-machine.js';
            routingScript.onload = checkDone;
            document.body.appendChild(routingScript);
        };
        leafletScript.onerror = reject;
        document.body.appendChild(leafletScript);
    });
};

window.lazyLoadQR = function() {
    if (window.QRious) return Promise.resolve(); 
    
    return new Promise((resolve, reject) => {
        const qrScript = document.createElement('script');
        qrScript.src = 'js/qrious.min.js';
        qrScript.onload = resolve;
        qrScript.onerror = reject;
        document.body.appendChild(qrScript);
    });
};

window.lockBodyScroll = function(lock) {
    const body = document.body;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    const fixedElements = document.querySelectorAll('.header-container, #mobile-bar, #isolated-bottom-bar, .page-header');

    if (lock) {
        if (body.style.overflow !== 'hidden') {
            body.dataset.scrollY = window.scrollY;
            body.style.overflow = 'hidden';
            body.style.paddingRight = `${scrollBarWidth}px`; 
            
            fixedElements.forEach(el => {
                el.style.paddingRight = `${scrollBarWidth}px`;
            });
        }
    } else {
        body.style.overflow = '';
        body.style.paddingRight = '';
        
        fixedElements.forEach(el => {
            el.style.paddingRight = '';
        });
    }
};

window.disableContentCopy = function() {
    document.addEventListener('contextmenu', event => {
        const target = event.target;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
            event.preventDefault();
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const overlayObserver = new MutationObserver(() => {
        const hasOpenOverlays = document.querySelectorAll('.page-overlay.open, .sheet-modal.open, .modern-cart-overlay.active').length > 0;
        
        if (!hasOpenOverlays && document.body.style.overflow === 'hidden') {
            console.log("🛡️ فك تعليق الشاشة التلقائي: تم الرجوع للرئيسية.");
            if (typeof window.lockBodyScroll === 'function') {
                window.lockBodyScroll(false); 
            } else {
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            }
        }
    });

    overlayObserver.observe(document.body, { 
        childList: true, 
        subtree: true, 
        attributes: true, 
        attributeFilter: ['class'] 
    });
});