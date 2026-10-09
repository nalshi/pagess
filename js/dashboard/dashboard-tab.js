/**
 * dashboard-tab.js — تبويب الرئيسية (تصاميم بصرية فائقة السرعة بدون مكتبات خارجية)
 * يُحمَّل عند الحاجة (Lazy Loaded)
 */
(function () {
    'use strict';

    // ===== حقن واجهة تبويب الرئيسية ديناميكياً (تصميم نظيف، أنيق، وفائق السرعة) =====
    window.ensureDashboardHTML = function () {
        const dashboardSec = document.getElementById('dashboard');
        if (!dashboardSec) return;

        if (!dashboardSec.querySelector('.dashboard-home-content')) {
            const html = `
            <div class="dashboard-home-content">
                <div class="dashboard-overview dashboard-hero">
                    <div class="dashboard-hero-copy">
                        <span class="dashboard-eyebrow">مساحة التاجر</span>
                        <h2 id="dashboard-store-name">متجري</h2>
                        <p>بيانات متجرك وروابطه ومتابعة أحدث نشاطاته في مكان واحد.</p>
                    </div>
                    <div class="dashboard-store-meta">
                        <a class="dashboard-store-meta-item" id="dashboard-store-phone" href="#">
                            <i data-lucide="phone" class="dashboard-icon" aria-hidden="true"></i>
                            <span><small>رقم المتجر</small><b id="dashboard-store-phone-text">غير مضاف</b></span>
                        </a>
                        <a class="dashboard-store-meta-item" id="dashboard-store-link" href="#" target="_blank" rel="noopener noreferrer">
                            <i data-lucide="store" class="dashboard-icon" aria-hidden="true"></i>
                            <span><small>رابط المتجر</small><b id="dashboard-store-url" dir="ltr">جارٍ التجهيز...</b></span>
                        </a>
                    </div>
                </div>

                <div class="dashboard-recent-grid">
                    <section class="dashboard-recent-panel" aria-labelledby="dashboard-recent-products-title">
                        <div class="dashboard-section-heading dashboard-recent-heading">
                            <div>
                                <h3 id="dashboard-recent-products-title">أحدث المنتجات</h3>
                                <p>آخر المنتجات المضافة إلى متجرك</p>
                            </div>
                            <button type="button" class="dashboard-view-all" onclick="switchT('management')">عرض الكل <i data-lucide="arrow-left" class="dashboard-icon" aria-hidden="true"></i></button>
                        </div>
                        <div class="dashboard-recent-list dashboard-recent-products" id="dashboard-recent-products">
                            <div class="dashboard-recent-empty">ستظهر منتجاتك هنا عند توفرها.</div>
                        </div>
                    </section>

                    <section class="dashboard-recent-panel" aria-labelledby="dashboard-recent-orders-title">
                        <div class="dashboard-section-heading dashboard-recent-heading">
                            <div>
                                <h3 id="dashboard-recent-orders-title">آخر الطلبات</h3>
                                <p>أحدث خمسة طلبات وصلتك</p>
                            </div>
                            <button type="button" class="dashboard-view-all" onclick="switchT('orders')">عرض الكل <i data-lucide="arrow-left" class="dashboard-icon" aria-hidden="true"></i></button>
                        </div>
                        <div class="dashboard-recent-list dashboard-recent-orders" id="dashboard-recent-orders">
                            <div class="dashboard-recent-empty">ستظهر طلباتك هنا عند وصولها.</div>
                        </div>
                    </section>
                </div>

                <div class="dashboard-section-heading dashboard-actions-heading">
                    <div>
                        <h3>إجراءات سريعة</h3>
                        <p>أنجز أهم مهام المتجر مباشرة</p>
                    </div>
                </div>
                <div class="dash-actions-row">
                    <button type="button" class="dash-action-btn" onclick="switchT('management'); setTimeout(showProductForm, 250);">
                        <span class="dash-action-icon action-add">
                            <i data-lucide="plus" class="dashboard-icon"></i>
                        </span>
                        <span class="dash-action-info">
                            <span class="dash-action-title">إضافة منتج جديد</span>
                            <span class="dash-action-subtitle">أضف سلعة إلى متجرك</span>
                        </span>
                        <i data-lucide="arrow-left" class="dashboard-icon dash-action-arrow" aria-hidden="true"></i>
                    </button>

                    <button type="button" class="dash-action-btn" onclick="switchT('orders');">
                        <span class="dash-action-icon action-orders">
                            <i data-lucide="shopping-bag" class="dashboard-icon"></i>
                        </span>
                        <span class="dash-action-info">
                            <span class="dash-action-title">متابعة الطلبات</span>
                            <span class="dash-action-subtitle">راجع الواردة والجارية</span>
                        </span>
                        <i data-lucide="arrow-left" class="dashboard-icon dash-action-arrow" aria-hidden="true"></i>
                    </button>

                    <button type="button" class="dash-action-btn" onclick="switchT('templates');">
                        <span class="dash-action-icon action-templates">
                            <i data-lucide="palette" class="dashboard-icon"></i>
                        </span>
                        <span class="dash-action-info">
                            <span class="dash-action-title">قوالب المتجر</span>
                            <span class="dash-action-subtitle">اختر مظهر متجرك</span>
                        </span>
                        <i data-lucide="arrow-left" class="dashboard-icon dash-action-arrow" aria-hidden="true"></i>
                    </button>

                    <button type="button" class="dash-action-btn" onclick="if(typeof openDeliveryCodeModal === 'function') openDeliveryCodeModal();">
                        <span class="dash-action-icon action-delivery">
                            <i data-lucide="qr-code" class="dashboard-icon"></i>
                        </span>
                        <span class="dash-action-info">
                            <span class="dash-action-title">تسليم فوري</span>
                            <span class="dash-action-subtitle">تحقق من كود الاستلام</span>
                        </span>
                        <i data-lucide="arrow-left" class="dashboard-icon dash-action-arrow" aria-hidden="true"></i>
                    </button>
                </div>
            </div>`;
            dashboardSec.innerHTML = html;
        }

        window.renderDashboardHome();
    };

    const createDashboardText = (tag, className, text) => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        element.textContent = text;
        return element;
    };

    const getDashboardTimestamp = item => {
        const value = item && (item.created_at || item.createdAt || item.updated_at || item.updatedAt);
        const timestamp = value ? Date.parse(value) : 0;
        return Number.isFinite(timestamp) ? timestamp : 0;
    };

    const getDashboardStatus = status => ({
        pending_merchant_approval: 'بانتظار الموافقة',
        confirmed_by_store: 'قيد التجهيز',
        out_for_delivery: 'في الطريق',
        completed: 'مكتمل',
        cancelled: 'ملغي'
    }[status] || 'قيد المتابعة');

    window.renderDashboardHome = function () {
        const home = document.querySelector('.dashboard-home-content');
        if (!home) return;

        const merchant = window.currentMerchantData || {};
        let settings = merchant.settings || {};
        if (typeof settings === 'string') {
            try { settings = JSON.parse(settings); } catch (error) { settings = {}; }
        }
        if (!settings || typeof settings !== 'object') settings = {};
        const storeName = merchant.store_name || merchant.name || window.jwtPayload?.store_name || window.merchantUsername || 'متجري';
        const phone = merchant.phone || settings.phone || settings.whatsapp || settings.whatsappNumber || '';
        const username = window.merchantUsername || merchant.username || 'store';
        const storeUrl = `${window.location.origin}/${encodeURIComponent(String(username).replace(/^@/, ''))}`;
        const nameElement = document.getElementById('dashboard-store-name');
        const phoneText = document.getElementById('dashboard-store-phone-text');
        const phoneLink = document.getElementById('dashboard-store-phone');
        const storeUrlText = document.getElementById('dashboard-store-url');
        const storeLink = document.getElementById('dashboard-store-link');
        if (nameElement) nameElement.textContent = storeName;
        if (phoneText) phoneText.textContent = phone || 'غير مضاف';
        if (phoneLink) {
            const callablePhone = String(phone).replace(/[^\d+#*]/g, '');
            if (callablePhone) phoneLink.href = `tel:${callablePhone}`;
            else phoneLink.removeAttribute('href');
            phoneLink.setAttribute('aria-disabled', callablePhone ? 'false' : 'true');
        }
        if (storeUrlText) storeUrlText.textContent = storeUrl;
        if (storeLink) storeLink.href = storeUrl;

        const productsContainer = document.getElementById('dashboard-recent-products');
        const ordersContainer = document.getElementById('dashboard-recent-orders');
        if (!productsContainer || !ordersContainer) return;

        const products = window.AppStore ? window.AppStore.getProducts() : [];
        productsContainer.replaceChildren();
        if (!products.length) {
            productsContainer.appendChild(createDashboardText('div', 'dashboard-recent-empty', 'لا توجد منتجات لعرضها بعد.'));
        } else {
            const recentProducts = products
                .map((product, index) => ({ product, index, timestamp: getDashboardTimestamp(product) }))
                .sort((a, b) => (b.timestamp - a.timestamp) || (a.index - b.index))
                .slice(0, 4);
            recentProducts.forEach(({ product }) => {
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'dashboard-product-row';
                row.addEventListener('click', () => window.switchT('management'));

                const image = document.createElement('img');
                image.className = 'dashboard-product-thumb';
                image.alt = product.name || 'صورة المنتج';
                image.loading = 'lazy';
                image.src = typeof window.getValidImageUrl === 'function'
                    ? window.getValidImageUrl(product.image)
                    : (product.image || '');
                image.onerror = () => {
                    image.onerror = null;
                    if (window.PLACEHOLDER_IMG) image.src = window.PLACEHOLDER_IMG;
                };

                const details = document.createElement('span');
                details.className = 'dashboard-product-copy';
                details.appendChild(createDashboardText('b', 'dashboard-product-name', product.name || 'منتج بدون اسم'));
                details.appendChild(createDashboardText('small', 'dashboard-product-category', product.type || 'عام'));

                const price = Number.parseFloat(product.price) || 0;
                const priceElement = createDashboardText('bdi', 'dashboard-product-price', `${price.toLocaleString()} ${product.currency || 'YER'}`);
                priceElement.dir = 'ltr';
                row.append(image, details, priceElement);
                productsContainer.appendChild(row);
            });
        }

        const activeOrders = window.AppStore ? window.AppStore.getOrders('active') : [];
        const archivedOrders = window.AppStore ? window.AppStore.getOrders('archived') : [];
        const uniqueOrders = new Map();
        [...activeOrders, ...archivedOrders].forEach(order => {
            if (order && order.id !== undefined && order.id !== null) uniqueOrders.set(String(order.id), order);
        });
        const recentOrders = [...uniqueOrders.values()]
            .map((order, index) => ({ order, index, timestamp: getDashboardTimestamp(order) }))
            .sort((a, b) => (b.timestamp - a.timestamp) || (a.index - b.index))
            .slice(0, 5);

        ordersContainer.replaceChildren();
        if (!recentOrders.length) {
            ordersContainer.appendChild(createDashboardText('div', 'dashboard-recent-empty', 'لا توجد طلبات لعرضها بعد.'));
        } else {
            recentOrders.forEach(({ order }) => {
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'dashboard-order-row';
                row.addEventListener('click', async () => {
                    await window.switchT('orders');
                    if (document.getElementById('orders')?.classList.contains('active')
                        && typeof window.openOrderDetail === 'function') {
                        window.openOrderDetail(order.id);
                    }
                });

                const identity = document.createElement('span');
                identity.className = 'dashboard-order-identity';
                identity.appendChild(createDashboardText('bdi', 'dashboard-order-id', `#${String(order.id).slice(0, 8)}`));
                identity.appendChild(createDashboardText('small', 'dashboard-order-customer', order.customer_name || 'عميل'));

                const status = createDashboardText('span', `dashboard-order-status status-${String(order.status || '').replace(/[^a-z_]/g, '')}`, getDashboardStatus(order.status));
                const total = Number.parseFloat(order.total_amount) || 0;
                const amount = createDashboardText('bdi', 'dashboard-order-total', `${total.toLocaleString()} ${order.currency || 'YER'}`);
                amount.dir = 'ltr';
                row.append(identity, status, amount);
                ordersContainer.appendChild(row);
            });
        }

        if (typeof window.refreshDashboardIcons === 'function') window.refreshDashboardIcons(home);
    };

    // تهيئة فورية عند التحميل
    window.ensureDashboardHTML();

    if (window.AppStore && !window.dashboardHomeStoreSubscribed) {
        window.dashboardHomeStoreSubscribed = true;
        window.AppStore.subscribe('products_init', window.renderDashboardHome);
        window.AppStore.subscribe('product_added', window.renderDashboardHome);
        window.AppStore.subscribe('product_updated', window.renderDashboardHome);
        window.AppStore.subscribe('product_removed', window.renderDashboardHome);
        window.AppStore.subscribe('orders_updated', window.renderDashboardHome);
    }

    if (window.ModuleLoader) window.ModuleLoader.loaded.add('dashboard-tab');

})();
