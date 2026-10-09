/**
 * ========================================================
 * ⚡ StoreEngine.ts - المحرك الرئيسي فائق السرعة للمتجر (OOP Singleton)
 * ========================================================
 * المعمارية:
 * 1. نمط التصميم كائني التوجه (OOP Architecture)
 * 2. فتح لحظي في أجزاء من الثانية (< 1s) عبر الاسترجاع الفوري من الكاش (Cache-First / Stale-While-Revalidate)
 * 3. إزالة كافة الشاشات المصطنعة وحالات القفل (No artificial splash delays)
 * 4. ربط وتنسيق كافة الأنظمة: الثيم، السلة، المنتجات، التتبع، البحث، والملاحة
 * ========================================================
 */

import { StoreState } from './StoreState';
import { ThemeEngine } from './ThemeEngine';
import { events } from './EventBus';
import { ProductCard } from '../components/ProductCard';
import { ProductGrid } from '../components/ProductGrid';
import { Navigation } from '../components/Navigation';
import { CartDrawer } from '../components/CartDrawer';
import { CheckoutModal } from '../components/CheckoutModal';
import { AuthModal } from '../components/AuthModal';
import { ProductDetailsModal } from '../components/ProductDetailsModal';
import { FavoritesModal } from '../components/FavoritesModal';
import { OrdersTracker } from '../components/OrdersTracker';
import { SearchOverlay } from '../components/SearchOverlay';
import { ShareModal } from '../components/ShareModal';
import { Toast } from '../components/Toast';
import { LazyLoader } from './LazyLoader';
import { Product, Category, StorefrontConfig } from '../types';

export class StoreEngine {
  private static instance: StoreEngine;

  public state: StoreState;
  public themeEngine: ThemeEngine;
  public storeId: string = 'nalshi';
  private syncInterval: any = null;
  private isBooted: boolean = false;

  private constructor() {
    this.state = StoreState.getInstance();
    this.themeEngine = ThemeEngine.getInstance();
  }

  public static getInstance(): StoreEngine {
    if (!StoreEngine.instance) {
      StoreEngine.instance = new StoreEngine();
    }
    return StoreEngine.instance;
  }

  /**
   * إقلاع المتجر فائق السرعة
   */
  public async boot(): Promise<void> {
    if (this.isBooted) return;
    this.isBooted = true;

    console.log('🚀 [StoreEngine] Initializing ultra-fast OOP Storefront...');

    // 1. استخراج معرّف المتجر من المسار أو المعاملات فوراً
    this.storeId = this.resolveTargetStoreId();
    this.state.storeId = this.storeId;
    (window as any).isIsolatedStore = true;

    // 2. إزالة أي قفل أو شاشة انتظار مصطنعة فوراً
    this.unlockBodyImmediately();

    // 3. كشف واجهة NalshStorefront العالمية للتفاعل من عناصر DOM
    this.exposeGlobalApi();

    // 4. تهيئة الأنظمة الأساسية (التنبيهات، شريط التنقل، سلة المشتريات، البحث)
    Toast.init();
    SearchOverlay.init();
    CartDrawer.init();

    // 5. تطبيق الهوية والألوان المحفوظة فوراً (0ms flash)
    this.themeEngine.loadInitial();

    // 6. استراتيجية السرعة الفائقة: عرض النسخة المحفوظة محلياً فوراً (< 50ms)
    const hasCachedData = this.renderFromCacheFirst(this.storeId);

    // 7. تهيئة شبكة المنتجات وأشرطة التنقل
    Navigation.init();
    ProductGrid.init();

    // 8. فحص وتحديث البيانات من السحابة في الخلفية بدون حجب الواجهة (Stale-While-Revalidate)
    this.revalidateStoreData(this.storeId, hasCachedData);

    // 9. الاستماع للأحداث الحية والتنقل بين الصفحات
    this.bindWindowEvents();

    console.log(`✅ [StoreEngine] Storefront ready in sub-second (<1s) for store: "${this.storeId}"`);
  }

  /**
   * استخراج معرف المتجر من الرابط
   */
  public resolveTargetStoreId(): string {
    const rawPath = (window.location.pathname || '').replace(/\\/g, '/');
    const path = rawPath.replace(/^\/+|\/+$/g, '');
    const pathParts = path.split('/').filter(Boolean);
    const isFileUrl = window.location.protocol === 'file:';

    const ignored = ['', 'index.html', 'merchant-app.html', 'merchant-dashboard', 'store-builder.html', 'login.html', 'api.php'];

    let storeFromPath: string | null = null;

    if (!isFileUrl && pathParts.length > 0) {
      const first = pathParts[0].toLowerCase();
      const isWinDrive = /^[a-z]:$/.test(pathParts[0]);

      if (first === 'merchant-app' && pathParts.length > 1) {
        storeFromPath = pathParts[1];
      } else if (!ignored.includes(first) && !isWinDrive) {
        storeFromPath = pathParts[0];
      }
    }

    const urlParams = new URLSearchParams(window.location.search);
    return (storeFromPath || urlParams.get('store') || 'nalshi').trim().toLowerCase();
  }

  /**
   * إزالة فورية لأي شاشة تحميل مصطنعة أو حظر للتمرير
   */
  private unlockBodyImmediately(): void {
    document.body.classList.remove('intro-locked');
    document.body.classList.add('store-ready');

    const splash = document.getElementById('smart-splash-screen');
    if (splash) {
      splash.style.opacity = '0';
      splash.style.pointerEvents = 'none';
      setTimeout(() => splash.remove(), 200);
    }
  }

  /**
   * استرجاع فوري من الكاش المحلي وعرض المنتجات مباشرة
   */
  private renderFromCacheFirst(storeId: string): boolean {
    try {
      const cacheKey = `nalsh_store_cache_${storeId}`;
      const cachedRaw = localStorage.getItem(cacheKey);

      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && Array.isArray(cached.products) && cached.products.length > 0) {
          this.state.setProducts(cached.products);
          if (Array.isArray(cached.categories)) {
            this.state.setCategories(cached.categories);
          }
          if (cached.config) {
            this.state.setConfig(cached.config);
          }

          // مزامنة المتغيرات العامة للتوافقية
          (window as any).allProducts = cached.products;

          // رندر فوري
          ProductGrid.render();
          Navigation.render();
          return true;
        }
      }
    } catch (e) {
      console.warn('[StoreEngine] Error reading fast cache:', e);
    }
    return false;
  }

  /**
   * جلب البيانات الحديثة في الخلفية (Background Revalidation)
   */
  public async revalidateStoreData(storeId: string, hadCache: boolean): Promise<void> {
    const CF_WORKER_URL = 'https://nalsh.dpdns.org';
    const CDN_BASE_URL = `${CF_WORKER_URL}/stores/${storeId}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      // طلب متوازي لملفات المانيفست والمعلومات والفئات
      const [manifestRes, infoRes, catRes, configRes] = await Promise.all([
        fetch(`${CDN_BASE_URL}/manifest.json`, { cache: 'no-store', signal: controller.signal }).catch(() => null),
        fetch(`${CDN_BASE_URL}/info.json`, { cache: 'no-store', signal: controller.signal }).catch(() => null),
        fetch(`${CDN_BASE_URL}/categories.json`, { cache: 'no-store', signal: controller.signal }).catch(() => null),
        fetch(`${CDN_BASE_URL}/storefront_config.json`, { cache: 'no-store', signal: controller.signal }).catch(() => null),
      ]);

      clearTimeout(timeoutId);

      const manifestData = manifestRes && manifestRes.ok ? await manifestRes.json().catch(() => null) : null;
      const storeInfo = infoRes && infoRes.ok ? await infoRes.json().catch(() => null) : null;
      const rawCategories = catRes && catRes.ok ? await catRes.json().catch(() => null) : null;
      const storefrontConfig = configRes && configRes.ok ? await configRes.json().catch(() => null) : null;

      let totalPages = manifestData?.total_pages || 1;
      const pagePromises: Promise<any>[] = [];

      for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        pagePromises.push(
          fetch(`${CDN_BASE_URL}/products_page_${i}.json`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        );
      }

      const pagesResults = await Promise.all(pagePromises);
      const productsMap: Record<string, Product> = {};

      pagesResults.forEach((page) => {
        if (page?.data) {
          Object.values(page.data).forEach((p: any) => {
            if (p && p.id) productsMap[String(p.id)] = p;
          });
        }
      });

      const freshProducts: Product[] = Object.values(productsMap);

      if (freshProducts.length > 0) {
        this.state.setProducts(freshProducts);
        (window as any).allProducts = freshProducts;

        // تجهيز شجرة الفئات
        let categoriesArray: Category[] = [];
        if (rawCategories?.data) {
          const buildCategoryTree = (node: any): Category => {
            const nodeProds = (node.products || [])
              .map((pref: any) => {
                const p = productsMap[String(pref.id)];
                if (p) (p as any).leaf_category = node.name;
                return p;
              })
              .filter(Boolean);

            const subcats = (node.children || []).map(buildCategoryTree);
            return {
              id: node.id || node.name,
              name: node.name,
              products: nodeProds,
              subcategories: subcats,
            };
          };

          categoriesArray = rawCategories.data.map(buildCategoryTree);
          this.state.setCategories(categoriesArray);
        }

        // تطبيق إعدادات المتجر المستلمة
        if (storefrontConfig) {
          this.state.setConfig(storefrontConfig);
          this.themeEngine.applyConfig(storefrontConfig);
        }

        // حفظ النسخة المحدثة في الكاش للزيارة القادمة
        try {
          localStorage.setItem(
            `nalsh_store_cache_${storeId}`,
            JSON.stringify({
              products: freshProducts,
              categories: categoriesArray,
              config: storefrontConfig || this.state.config,
              timestamp: Date.now(),
            })
          );
        } catch (e) {}

        // تحديث الواجهة بسلاسة
        ProductGrid.render();
        Navigation.render();
      } else if (!hadCache) {
        // في حال عدم وجود منتجات في الخادم ولا في الكاش، تحميل بيانات تجريبية فوراً
        this.loadDemoFallback(storeId);
      }
    } catch (err) {
      console.warn('[StoreEngine] Background sync notice:', err);
      if (!hadCache) {
        this.loadDemoFallback(storeId);
      }
    }
  }

  /**
   * بيانات تجريبية غنية لضمان فتح المتجر فوراً حتى دون إنترنت
   */
  private loadDemoFallback(storeId: string): void {
    const demoProducts: Product[] = [
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
        badge: 'الأكثر مبيعاً 🔥',
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
        badge: 'خصم خاص ⚡',
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
        image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&auto=format&fit=crop&q=80',
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
        image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',
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
        image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80',
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
        badge: 'مميز ⭐',
      },
    ];

    const cats: Category[] = [
      { id: '1', name: 'إلكترونيات', products: demoProducts.filter((p) => p.category === 'إلكترونيات'), subcategories: [] },
      { id: '2', name: 'عطور وتجميل', products: demoProducts.filter((p) => p.category === 'عطور وتجميل'), subcategories: [] },
      { id: '3', name: 'حقائب وإكسسوارات', products: demoProducts.filter((p) => p.category === 'حقائب وإكسسوارات'), subcategories: [] },
      { id: '4', name: 'أجهزة منزلية', products: demoProducts.filter((p) => p.category === 'أجهزة منزلية'), subcategories: [] },
    ];

    this.state.setProducts(demoProducts);
    this.state.setCategories(cats);
    (window as any).allProducts = demoProducts;

    ProductGrid.render();
    Navigation.render();
  }

  /**
   * ربط وتوفير كائن NalshStorefront الموحد لكافة عناصر HTML
   */
  private exposeGlobalApi(): void {
    const self = this;

    const api = {
      // السلة
      openCart: () => CartDrawer.open(),
      closeCart: () => CartDrawer.close(),
      updateCartQty: (idx: number, delta: number) => CartDrawer.updateCartQty(idx, delta),
      removeCartItem: (idx: number) => CartDrawer.removeCartItem(idx),
      quickAddToCart: (productId: string | number) => self.quickAddToCart(productId),

      // تفاصيل المنتج
      openProductDetails: (productId: string | number) => ProductDetailsModal.open(productId),
      closeProductDetails: () => ProductDetailsModal.close(),
      selectProductVariation: (index: number) => ProductDetailsModal.selectVariation(index),
      changeModalQty: (delta: number) => ProductDetailsModal.changeQuantity(delta),
      addModalProductToCart: () => ProductDetailsModal.addToCart(),

      // المفضلة
      toggleFavorite: (productId: string | number, btnEl?: HTMLElement) => self.toggleFavorite(productId, btnEl),
      openFavorites: () => FavoritesModal.open(),
      closeFavorites: () => FavoritesModal.close(),

      // الحساب وتسجيل الدخول
      openProfile: () => AuthModal.open(),
      closeAuth: () => AuthModal.close(),
      requestOtp: () => AuthModal.requestOtp(),
      verifyOtp: () => AuthModal.verifyOtp(),
      resetAuthStep: () => AuthModal.resetStep(),
      logout: () => {
        self.state.logout();
        AuthModal.close();
        Toast.show('تم تسجيل الخروج بنجاح', 'info');
      },

      // إتمام الطلب والطلبات
      openCheckout: () => {
        CartDrawer.close();
        CheckoutModal.open();
      },
      closeCheckout: () => CheckoutModal.close(),
      toggleDeliveryMap: () => CheckoutModal.toggleMap(),
      submitOrder: () => CheckoutModal.submitOrder(),
      closeSuccessModal: () => CheckoutModal.closeSuccessModal(),
      openOrders: () => OrdersTracker.open(),
      closeOrders: () => OrdersTracker.close(),
      showOrderQR: (orderNum: string, code: string) => OrdersTracker.showQRModal(orderNum, code),

      // البحث والمشاركة
      toggleSearch: (open: boolean) => (open ? SearchOverlay.open() : SearchOverlay.close()),
      startVoiceSearch: () => SearchOverlay.startVoice(),
      clearRecentSearches: () => SearchOverlay.clearRecentSearches(),
      setSearchQuery: (q: string) => SearchOverlay.setSearchQuery(q),
      openShareModal: (productId?: string | number) => ShareModal.open(productId),
      closeShareModal: () => ShareModal.close(),
      copyShareLink: (url: string) => {
        navigator.clipboard.writeText(url).then(() => {
          Toast.show('تم نسخ الرابط بنجاح 📋', 'success');
        });
      },

      // التنقل والتفاعل
      selectCategory: (catId: string | number) => {
        events.emit('category:selected', catId);
      },
      toggleDarkMode: () => self.toggleDarkMode(),
      scrollToTop: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      navigateTo: (tab: string) => {
        if (tab === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
      },

      // التوافقية القديمة
      toggleProductModal: (show: boolean, prod?: any) => {
        if (show && prod) ProductDetailsModal.open(prod.id);
        else ProductDetailsModal.close();
      },
    };

    (window as any).NalshStorefront = api;

    // دوال مساعدة للتوافقية
    (window as any).showToast = (msg: string, type: any) => Toast.show(msg, type);
    (window as any).toggleProductModal = api.toggleProductModal;
    (window as any).bootJAMstack = () => self.boot();
  }

  /**
   * إضافة سريعة إلى السلة بنقرة واحدة
   */
  public quickAddToCart(productId: string | number): void {
    const product = this.state.products.find((p) => String(p.id) === String(productId));
    if (!product) return;

    if (product.stock !== undefined && product.stock <= 0) {
      Toast.show('عذراً، هذا المنتج غير متوفر حالياً', 'warning');
      return;
    }

    this.state.addToCart({
      id: String(product.id),
      product_id: product.id,
      name: product.name,
      price: product.price,
      old_price: product.old_price,
      quantity: 1,
      image: product.image,
    });

    Toast.show(`تمت إضافة "${product.name}" إلى السلة 🛍️`, 'success');
  }

  /**
   * تبديل حالة المفضلة لمنتج
   */
  public toggleFavorite(productId: string | number, btnEl?: HTMLElement): void {
    const isFav = this.state.toggleFavorite(productId);

    if (btnEl) {
      btnEl.classList.toggle('active', isFav);
      const icon = btnEl.querySelector('i');
      if (icon) {
        icon.className = isFav ? 'fas fa-heart' : 'far fa-heart';
      }
    }

    Toast.show(isFav ? 'تمت الإضافة إلى المفضلة ❤️' : 'تمت الإزالة من المفضلة', 'info', 1800);
  }

  /**
   * تبديل الوضع الداكن والفاتح لحظياً
   */
  public toggleDarkMode(): void {
    const isDark = document.documentElement.classList.toggle('dark-mode');
    if (document.body) document.body.classList.toggle('dark-mode', isDark);

    try {
      localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    } catch (e) {}

    // تحديث أيقونة الوضع في شريط التنقل
    const moonIcons = document.querySelectorAll('.nav-icon-btn[aria-label="الوضع الداكن"] i');
    moonIcons.forEach((i) => {
      i.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    });

    Toast.show(isDark ? 'تم تفعيل الوضع الداكن 🌙' : 'تم تفعيل الوضع الفاتح ☀️', 'info', 1500);
  }

  /**
   * ربط الأحداث العامة للنافذة
   */
  private bindWindowEvents(): void {
    // فتح المنتج مباشرة إن كان الرابط يحتوي على ?p=...
    const urlParams = new URLSearchParams(window.location.search);
    const prodParam = urlParams.get('p') || urlParams.get('product');
    if (prodParam) {
      setTimeout(() => {
        ProductDetailsModal.open(prodParam);
      }, 100);
    }

    // مزامنة عند عودة العميل إلى التبويب
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.revalidateStoreData(this.storeId, true);
      }
    });

    // دعم زر الرجوع في المتصفح
    window.addEventListener('popstate', () => {
      ProductDetailsModal.close();
      CartDrawer.close();
      CheckoutModal.close();
      FavoritesModal.close();
      OrdersTracker.close();
      SearchOverlay.close();
    });
  }
}
