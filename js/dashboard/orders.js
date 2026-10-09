/**
 * orders.js — إدارة الطلبات، كروت خفيفة سريعة، وكرت تفاصيل موحد (Single Reusable Detail Card)
 * يُحمَّل عند الحاجة (Lazy Loaded)
 */
(function () {
    'use strict';

    let currentOrdersLimit = 25;
    let renderedOrdersState = null;
    let ordersSearchTerm = '';
    window.currentViewingOrderId = null;

    // ===== حقن واجهة قسم الطلبات والنافذة الموحدة ديناميكياً =====
    window.ensureOrdersHTML = function () {
        const ordersSec = document.getElementById('orders');
        if (!ordersSec) return;

        if (!document.getElementById('orders-container')) {
            const html = `
            <div class="orders-page-shell">
                <header class="orders-page-hero">
                    <div class="orders-page-hero-copy">
                        <span class="orders-page-kicker"><i class="fas fa-store"></i> مساحة التاجر</span>
                        <h2>إدارة الطلبات</h2>
                        <p>راجع الطلبات، تابع حالتها، وتواصل مع عملائك من مكان واحد.</p>
                    </div>
                    <div class="orders-page-hero-art" aria-hidden="true">
                        <i class="fas fa-receipt"></i>
                        <span><i class="fas fa-check"></i></span>
                    </div>
                </header>
                <section class="orders-content-panel" aria-labelledby="orders-list-title">
                    <div class="orders-content-heading">
                        <div>
                            <h3 id="orders-list-title"><i class="fas fa-shopping-bag"></i> قائمة الطلبات</h3>
                            <p>ابحث عن طلب محدد أو بدّل بين الطلبات النشطة والسابقة.</p>
                        </div>
                        <span class="orders-list-hint"><i class="fas fa-layer-group"></i> متابعة سهلة ومنظمة</span>
                    </div>
                <div class="orders-toolbar">
                    <div class="orders-search">
                        <i class="fas fa-search"></i>
                        <input id="orders-search-input" type="search" placeholder="ابحث برقم الطلب أو اسم العميل أو الهاتف..." autocomplete="off" aria-label="البحث في الطلبات">
                    </div>
                    <div class="segment-group orders-filter" role="group" aria-label="تصفية الطلبات">
                    <button class="segment-btn active" onclick="loadOrders('active', this)"><i class="fas fa-bolt"></i> النشطة</button>
                    <button class="segment-btn" onclick="loadOrders('archived', this)"><i class="fas fa-clock-rotate-left"></i> السابقة</button>
                    <button class="segment-btn" onclick="loadOrders(window._lastOrdersFilter || 'active', null, false)" title="تحديث فوري"><i class="fas fa-rotate"></i></button>
                    </div>
                </div>
                <div id="orders-container" class="orders-list-compact">
                    <div class="section-skeleton" style="padding: 10px 0;">
                        <div class="sk-card"><div style="display:flex;justify-content:space-between;margin-bottom:12px;"><div class="sk-shimmer sk-bar" style="width:130px;"></div><div class="sk-shimmer" style="width:70px;height:24px;border-radius:12px;"></div></div><div class="sk-shimmer sk-bar" style="width:55%;margin-bottom:10px;"></div><div class="sk-shimmer sk-bar-sm"></div></div>
                        <div class="sk-card"><div style="display:flex;justify-content:space-between;margin-bottom:12px;"><div class="sk-shimmer sk-bar" style="width:150px;"></div><div class="sk-shimmer" style="width:70px;height:24px;border-radius:12px;"></div></div><div class="sk-shimmer sk-bar" style="width:65%;margin-bottom:10px;"></div><div class="sk-shimmer sk-bar-sm"></div></div>
                    </div>
                </div>
                </section>
            </div>`;
            ordersSec.innerHTML = html;
            const searchInput = document.getElementById('orders-search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (event) => {
                    ordersSearchTerm = event.target.value.trim().toLowerCase();
                    currentOrdersLimit = 25;
                    renderedOrdersState = null;
                    const activeFilter = window._lastOrdersFilter || 'active';
                    window.renderOrdersUI(window.AppStore.getOrders(activeFilter), activeFilter);
                });
            }
        }

        // حقن نافذة كرت تفاصيل الطلب الموحدة مرة واحدة فقط في الـ DOM
        if (!document.getElementById('single-order-detail-modal')) {
            const modalHtml = `
            <div class="modal" id="single-order-detail-modal" role="dialog" aria-modal="true" aria-labelledby="m-detail-order-title">
                <div class="modal-content order-detail-modal-content">
                    <div class="modal-title-bar" style="margin-bottom: 14px;">
                        <h3 id="m-detail-order-title"><i class="fas fa-receipt text-primary"></i> تفاصيل الطلب</h3>
                        <button class="close-btn" onclick="closeM('single-order-detail-modal')"><i class="fas fa-times"></i></button>
                    </div>
                    <div id="single-order-detail-body">
                        <!-- يُحقن محتوى كرت الطلب المحدد عند النقر في 0ms -->
                    </div>
                    <div id="single-order-detail-actions" class="order-detail-actions-footer"></div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
    };

    // ===== جلب الطلبات من الخادم مع الحفظ بالذاكرة =====
    window.loadOrders = async function (filterType, btnElement, silent = false) {
        window.dashboardReadState = window.dashboardReadState || {};
        window.dashboardReadPromises = window.dashboardReadPromises || {};
        window.ensureOrdersHTML();
        if (btnElement) {
            document.querySelectorAll('#orders .segment-btn').forEach(b => b.classList.remove('active'));
            btnElement.classList.add('active');
        }

        // إعادة ضبط حد العرض عند تبديل الفلتر
        if (window._lastOrdersFilter !== filterType) {
            currentOrdersLimit = 25;
            window._lastOrdersFilter = filterType;
        }

        const container = document.getElementById('orders-container');
        const ordersSection = document.getElementById('orders');
        const isOrdersTabActive = ordersSection && ordersSection.classList.contains('active');
        const hasRealtimeData = Boolean(window.dashboardSnapshotLoaded || window.dashboardReadState[filterType + 'Orders']);

        // عرض كاش الذاكرة فوراً (إن وجد) لمنع الوميض
        const cached = window.AppStore ? window.AppStore.getOrders(filterType) : [];
        if (cached && cached.length > 0 && isOrdersTabActive && container) {
            window.renderOrdersUI(cached, filterType);
        } else if (!hasRealtimeData && isOrdersTabActive && container) {
            container.innerHTML = `
                <div class="section-skeleton" style="padding: 10px 0;">
                    <div class="sk-card"><div style="display:flex;justify-content:space-between;margin-bottom:12px;"><div class="sk-shimmer sk-bar" style="width:130px;"></div><div class="sk-shimmer" style="width:70px;height:24px;border-radius:12px;"></div></div><div class="sk-shimmer sk-bar" style="width:55%;margin-bottom:10px;"></div><div class="sk-shimmer sk-bar-sm"></div></div>
                    <div class="sk-card"><div style="display:flex;justify-content:space-between;margin-bottom:12px;"><div class="sk-shimmer sk-bar" style="width:150px;"></div><div class="sk-shimmer" style="width:70px;height:24px;border-radius:12px;"></div></div><div class="sk-shimmer sk-bar" style="width:65%;margin-bottom:10px;"></div><div class="sk-shimmer sk-bar-sm"></div></div>
                </div>
            `;
        } else if (hasRealtimeData && isOrdersTabActive && container) {
            window.renderOrdersUI(cached, filterType);
        }

        try {
            const readKey = filterType + 'Orders';
            const storeOrders = window.AppStore ? window.AppStore.getOrders(filterType) : [];
            const hasOrders = storeOrders && storeOrders.length > 0;

            // إذا كان الكاش مليئاً وكانت القناة اللحظية متصلة وتم الطلب بهدوء (silent)، نكتفي بعرض الكاش
            if (silent && window.dashboardSocketReady && hasOrders && window.dashboardReadState[readKey]) {
                if (isOrdersTabActive && container) {
                    window.renderOrdersUI(storeOrders, filterType);
                }
                return;
            }

            if (window.dashboardReadPromises[readKey]) return window.dashboardReadPromises[readKey];
            window.dashboardReadPromises[readKey] = window.apiReq('get_orders', { filter: filterType }, 'POST', false, true);
            const res = await window.dashboardReadPromises[readKey];
            delete window.dashboardReadPromises[readKey];
            let newOrders = [];

            if (res && res.status === 'success' && Array.isArray(res.data)) {
                newOrders = res.data;
                localStorage.setItem(`merchant_${filterType}_orders_cache`, JSON.stringify(newOrders));
            }
            window.dashboardReadState[readKey] = true;

            const prevOrders = window.AppStore.getOrders(filterType);

            // للأرشيف: نرتّب بـ setTimeout لعدم تجميد الـ UI Thread
            const doRender = (sorted) => {
                window.AppStore.setOrders(filterType, sorted);
                if (isOrdersTabActive && container) {
                    window.renderOrdersUI(sorted, filterType);
                }
            };

            if (filterType === 'archived') {
                // تأجيل الترتيب ليكون خارج الـ critical path
                setTimeout(() => {
                    newOrders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                    doRender(newOrders);
                }, 0);
            } else {
                newOrders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

                const prevIds = prevOrders.map(o => String(o.id));
                const hasNewOrder = newOrders.some(o => !prevIds.includes(String(o.id)));

                if (hasNewOrder && window.initialOrdersLoaded) {
                    const isNotifEnabled = window.currentMerchantData?.settings?.push_notifications;
                    if (isNotifEnabled !== false && isNotifEnabled !== 'false' && window.orderAudio) {
                        window.orderAudio.loop = true;
                        window.orderAudio.currentTime = 0;
                        window.orderAudio.play().catch(() => { });
                    }
                    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                        new Notification('طلب جديد واصل الآن! 🛍️', { body: 'لديك طلب جديد بانتظار التجهيز.', icon: '/favicon.svg' });
                    }
                    window.setOrderAlertVisible?.('persistent-order-alert', true);
                    window.setOrderAlertVisible?.('new-order-alert', true);
                }

                doRender(newOrders);
            }

            window.initialOrdersLoaded = true;

        } catch (error) {
            console.error('خطأ جلب الطلبات:', error);
            if (isOrdersTabActive && container && (!cached || cached.length === 0)) {
                container.innerHTML = `<div style="text-align:center; padding:35px; color:var(--danger);"><i class="fas fa-exclamation-circle" style="font-size:2rem; margin-bottom:10px; display:block;"></i>تعذر جلب الطلبات. تحقق من الاتصال.</div>`;
            }
        }
    };

    // استخراج تفاصيل حالة الطلب
    function getStatusMeta(status) {
        switch (status) {
            case 'pending_merchant_approval':
                return { text: 'بانتظار موافقتك', badgeStyle: 'background:rgba(245, 158, 11, 0.12); color:var(--warning);', icon: 'fa-clock' };
            case 'confirmed_by_store':
                return { text: 'قيد التجهيز', badgeStyle: 'background:rgba(16, 185, 129, 0.12); color:var(--success);', icon: 'fa-box-open' };
            case 'out_for_delivery':
                return { text: 'في الطريق', badgeStyle: 'background:rgba(59, 130, 246, 0.12); color:var(--info);', icon: 'fa-motorcycle' };
            case 'completed':
                return { text: 'مكتمل بنجاح', badgeStyle: 'background:rgba(16, 185, 129, 0.12); color:var(--success);', icon: 'fa-circle-check' };
            case 'cancelled':
                return { text: 'طلب ملغي', badgeStyle: 'background:rgba(239, 68, 68, 0.12); color:var(--danger);', icon: 'fa-circle-xmark' };
            default:
                return { text: status, badgeStyle: 'background:var(--bg-body); color:var(--text-muted);', icon: 'fa-receipt' };
        }
    }

    // ===== رسم قائمة الطلبات المصغرة — تدريجي بـ chunks لمنع التجميد =====
    window.renderOrdersUI = function (data, filterType) {
        window.ensureOrdersHTML();
        const container = document.getElementById('orders-container');
        if (!container) return;

        if (!Array.isArray(data) || data.length === 0) {
            renderedOrdersState = null;
            container.innerHTML = `
            <div class="orders-empty-state orders-empty-default">
                <span class="orders-empty-icon"><i class="fas fa-inbox"></i></span>
                <h3>لا توجد طلبات في هذا القسم</h3>
                <p>ستظهر طلبات متجرك هنا عند وصولها.</p>
            </div>`;
            return;
        }

        const filteredData = ordersSearchTerm
            ? data.filter(order => {
                const haystack = [
                    order.id,
                    order.customer_name,
                    order.customer_phone,
                    order.delivery_address_text
                ].map(value => String(value || '').toLowerCase()).join(' ');
                return haystack.includes(ordersSearchTerm);
            })
            : data;
        const dataToShow = filteredData.slice(0, currentOrdersLimit);
        if (filteredData.length === 0) {
            renderedOrdersState = null;
            container.innerHTML = `
                <div class="orders-empty-state">
                    <i class="fas fa-search"></i>
                    <h3>لا توجد نتائج مطابقة</h3>
                    <p>جرّب رقم طلب أو اسم عميل مختلف.</p>
                </div>`;
            return;
        }

        const ids = dataToShow.map(order => `${String(order.id)}:${String(order.status || '')}:${String(order.updated_at || '')}`);
        const stateKey = `${filterType}:${ordersSearchTerm}:${ids.join(',')}`;
        const previous = renderedOrdersState;
        if (previous && previous.filterType === filterType
            && previous.dataIds.length < ids.length
            && ids.slice(0, previous.dataIds.length).every((id, index) => id === previous.dataIds[index])) {
            const footer = document.getElementById('orders-load-more-wrap');
            if (footer) footer.remove();
            const fragment = document.createDocumentFragment();
            dataToShow.slice(previous.dataIds.length).forEach(order => {
                const template = document.createElement('template');
                template.innerHTML = buildCompactRow(order).trim();
                if (template.content.firstElementChild) fragment.appendChild(template.content.firstElementChild);
            });
            container.appendChild(fragment);
            renderedOrdersState = { filterType, dataIds: ids, stateKey };
            appendOrdersFooter(container, filteredData.length, filterType);
            return;
        }

        if (previous && previous.stateKey === stateKey) return;

        // بناء HTML بشكل متزامن (سريع لأن الكروت خفيفة)
        const rowsHtml = dataToShow.map(o => buildCompactRow(o)).join('');

        // كتابة HTML دفعة واحدة → يحسم الجمود
        container.innerHTML = rowsHtml;
        renderedOrdersState = { filterType, dataIds: ids, stateKey };
        appendOrdersFooter(container, filteredData.length, filterType);
    };

    function appendOrdersFooter(container, total, filterType) {
        if (total <= currentOrdersLimit) return;
        const footer = document.createElement('div');
        footer.id = 'orders-load-more-wrap';
        footer.style.cssText = 'text-align:center;margin-top:14px;';
        footer.innerHTML = `<button onclick="loadMoreOrders('${filterType}')" class="btn-main" style="width:auto;margin:0 auto;background:var(--bg-solid);color:var(--primary);border:2px solid var(--primary);box-shadow:none;padding:8px 18px;font-size:0.88rem;">عرض المزيد (${total - currentOrdersLimit}) <i class="fas fa-chevron-down"></i></button>`;
        container.appendChild(footer);
    }

    // بناء HTML لكرت طلب واحد (دالة مساعدة خفيفة)
    function buildCompactRow(o) {
        const statusMeta = getStatusMeta(o.status);
        const totalAmount = (parseFloat(o.total_amount) || 0).toLocaleString();
        const itemsCount = (o.items || []).reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
        const dateStr = o.created_at
            ? new Date(o.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '';
        const custName = window.escapeHTML(o.customer_name || 'عميل');
        const oid = String(o.id);
        const shortId = oid.substring(0, 8);
        const cur = window.escapeHTML(o.currency || 'YER');
        const itemWord = itemsCount === 1 ? 'منتج' : 'منتجات';

        return `<article class="order-card-compact" id="m-order-row-${oid}" tabindex="0" aria-label="تفاصيل الطلب رقم ${shortId} للعميل ${custName}" onclick="openOrderDetail('${oid}')" onkeydown="if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openOrderDetail('${oid}')}"><div class="order-compact-main"><div class="order-compact-icon"><i class="fas ${statusMeta.icon}"></i></div><div class="order-compact-info"><div class="order-compact-header-row"><span class="order-compact-id"><bdi dir="ltr">#${shortId}</bdi></span><span class="order-compact-badge" style="${statusMeta.badgeStyle}">${statusMeta.text}</span></div><div class="order-compact-meta"><span><i class="fas fa-user text-primary" style="font-size:0.75rem;"></i> ${custName}</span><span>•</span><span>${itemsCount} ${itemWord}</span></div></div></div><div class="order-compact-right"><div class="order-compact-price-wrap"><span class="order-compact-price" dir="ltr">${totalAmount} <small style="font-size:0.75rem;">${cur}</small></span><span class="order-compact-date">${dateStr}</span></div><button class="order-compact-btn-details" onclick="event.stopPropagation();openOrderDetail('${oid}')"><span>عرض التفاصيل</span><i class="fas fa-arrow-left" style="font-size:0.7rem;"></i></button></div></article>`;
    }

    window.loadMoreOrders = function (filterType) {
        currentOrdersLimit += 25;
        const data = window.AppStore.getOrders(filterType);
        window.renderOrdersUI(data, filterType);
        // تمرير ناعم لأسفل
        const wrap = document.getElementById('orders-load-more-wrap');
        if (wrap) wrap.scrollIntoView({
            behavior: window.dashboardPerformanceMode === 'light' ? 'auto' : 'smooth',
            block: 'center'
        });
    };



    // ===== فتح كرت التفاصيل الموحد الذكي (Single Reused Modal Card) =====
    window.openOrderDetail = function (orderId) {
        window.ensureOrdersHTML();
        window.currentViewingOrderId = String(orderId);

        // البحث عن الطلب في الذاكرة
        const allOrders = [...(window.AppStore.getOrders('active') || []), ...(window.AppStore.getOrders('archived') || [])];
        const o = allOrders.find(item => String(item.id) === String(orderId));

        if (!o) {
            window.showT('لم يتم العثور على بيانات الطلب', 'error');
            return;
        }

        const titleEl = document.getElementById('m-detail-order-title');
        if (titleEl) {
            titleEl.innerHTML = `<i class="fas fa-receipt text-primary"></i> طلب <bdi dir="ltr">#${String(o.id).substring(0, 8)}</bdi>`;
        }

        const bodyEl = document.getElementById('single-order-detail-body');
        const actionsEl = document.getElementById('single-order-detail-actions');
        if (!bodyEl || !actionsEl) return;

        const statusMeta = getStatusMeta(o.status);

        // أزرار الإجراءات
        let actionButtons = '';
        switch (o.status) {
            case 'pending_merchant_approval':
                actionButtons = `
                <div class="order-detail-actions">
                    <button class="btn-main order-action-approve" onclick="approveOrder('${o.id}'); closeM('single-order-detail-modal');">
                        <i class="fas fa-check"></i> موافقة وتجهيز
                    </button>
                    <button class="btn-main order-action-cancel" onclick="merchantCancelOrder('${o.id}'); closeM('single-order-detail-modal');">
                        <i class="fas fa-times"></i> إلغاء
                    </button>
                </div>`;
                break;
            case 'confirmed_by_store':
                actionButtons = `
                <div class="order-detail-actions">
                    ${o.delivery_gps_link ? `<button class="btn-main order-action-map" onclick="window.open('${o.delivery_gps_link}', '_blank');"><i class="fas fa-map-marker-alt"></i> الخريطة</button>` : ''}
                    <button class="btn-main order-action-approve" onclick="markOrderOutForDelivery('${o.id}'); closeM('single-order-detail-modal');">
                        <i class="fas fa-motorcycle"></i> خرج للتوصيل
                    </button>
                </div>`;
                break;
            case 'out_for_delivery':
                actionButtons = `
                <div class="order-detail-actions">
                    ${o.delivery_gps_link ? `<button class="btn-main order-action-map" onclick="window.open('${o.delivery_gps_link}', '_blank');"><i class="fas fa-map-marker-alt"></i> الخريطة</button>` : ''}
                    <button class="btn-main order-action-confirm-delivery" onclick="closeM('single-order-detail-modal'); openDeliveryCodeModal('${o.id}');">
                        <i class="fas fa-key"></i> تأكيد كود الاستلام
                    </button>
                </div>`;
                break;
            default:
                actionButtons = '';
        }

        let totalCost = 0, productsTotalRevenue = 0;
        const itemsHtml = (o.items || []).map(i => {
            const itemSellingPrice = parseFloat(i.price) || 0;
            const itemCost = parseFloat(i.cost_price) || 0;
            const itemQty = parseInt(i.quantity) || 1;
            productsTotalRevenue += (itemSellingPrice * itemQty);
            totalCost += (itemCost * itemQty);
            // استخدم الصورة الأصلية داخل التفاصيل؛ محول الصور الخارجي يضيف
            // طلب شبكة وتأخيرًا لكل منتج عند فتح الطلب.
            const imgUrl = i.image || window.PLACEHOLDER_IMG;

            return `
            <div class="order-item-row">
                <img class="order-item-image" width="48" height="48" loading="lazy" decoding="async" src="${window.escapeHTML(imgUrl)}" alt="${window.escapeHTML(i.product_name || i.name || 'منتج')}">
                <div class="order-item-info">
                    <div class="order-item-name">${window.escapeHTML(i.product_name || i.name || 'منتج')}</div>
                    <div class="order-item-meta">
                        <span style="color:var(--text-muted);">الكمية: <b>${itemQty}</b></span>
                        <span style="color:var(--primary); font-weight:900;"><bdi dir="ltr">${(itemSellingPrice * itemQty).toLocaleString()} ${window.escapeHTML(o.currency || 'YER')}</bdi></span>
                    </div>
                </div>
            </div>`;
        }).join('');

        const netProfit = productsTotalRevenue - totalCost;
        const profitBadge = (netProfit > 0 && o.status !== 'cancelled') ? `<span class="order-profit-badge"><i class="fas fa-arrow-trend-up"></i> ربحك الصافي: <bdi dir="ltr">${netProfit.toLocaleString()} ${window.escapeHTML(o.currency || 'YER')}</bdi></span>` : '';
        const deliveryFee = parseFloat(o.delivery_fee) || 0;
        const finalGrandTotal = productsTotalRevenue + deliveryFee;

        bodyEl.innerHTML = `
            <div class="order-detail-summary">
                <div class="order-detail-date">
                    <span>تاريخ الطلب</span>
                    <strong>${new Date(o.created_at).toLocaleString('ar-EG')}</strong>
                </div>
                <div class="order-detail-status-wrap">
                    <span class="order-detail-status" style="${statusMeta.badgeStyle}">${statusMeta.text}</span>
                </div>
            </div>

            <section class="order-detail-section order-customer-section">
                <h4><i class="fas fa-user-circle"></i> بيانات العميل والتوصيل</h4>
                <div class="order-customer-main">
                    <strong>${window.escapeHTML(o.customer_name || 'عميل المتجر')}</strong>
                    ${o.customer_phone ? `
                        <a href="tel:${o.customer_phone}" class="order-customer-phone">
                            <i class="fas fa-phone-alt"></i> ${window.escapeHTML(o.customer_phone)}
                        </a>
                    ` : '<span class="order-customer-no-phone">بدون رقم</span>'}
                </div>
                ${o.delivery_address_text ? `
                    <div class="order-customer-address">
                        <i class="fas fa-map-marker-alt"></i> ${window.escapeHTML(o.delivery_address_text)}
                    </div>
                ` : ''}
            </section>

            <section class="order-detail-section order-detail-items">
                <h4><i class="fas fa-box-open"></i> قائمة المنتجات المطلوبة</h4>
                <div class="order-items-list">${itemsHtml}</div>
            </section>

            <section class="order-detail-section order-financial-summary">
                <div class="order-financial-row">
                    <span>إجمالي المنتجات</span>
                    <strong><bdi dir="ltr">${productsTotalRevenue.toLocaleString()} ${window.escapeHTML(o.currency || 'YER')}</bdi></strong>
                </div>
                <div class="order-financial-row order-delivery-fee">
                    <span>رسوم التوصيل</span>
                    <strong>${deliveryFee === 0 ? 'مجاني' : `<bdi dir="ltr">${deliveryFee.toLocaleString()} ${window.escapeHTML(o.currency || 'YER')}</bdi>`}</strong>
                </div>
                <div class="order-financial-total">
                    <div class="order-total-copy">
                        <span>المبلغ الإجمالي المستحق</span>
                        <strong><bdi dir="ltr">${finalGrandTotal.toLocaleString()} <small>${window.escapeHTML(o.currency || 'YER')}</small></bdi></strong>
                    </div>
                    ${profitBadge}
                </div>
            </section>
        `;

        actionsEl.innerHTML = actionButtons;
        bodyEl.scrollTop = 0;
        window.openM('single-order-detail-modal');
    };

    if (window.ModuleLoader) window.ModuleLoader.loaded.add('orders');

})();
