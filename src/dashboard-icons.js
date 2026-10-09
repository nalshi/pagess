import {
    Activity,
    ArrowLeft,
    Bell,
    ChartNoAxesCombined,
    Crown,
    LayoutDashboard,
    LogOut,
    Moon,
    Package,
    Palette,
    PanelsTopLeft,
    Phone,
    Plus,
    QrCode,
    Settings2,
    ShoppingBag,
    Sparkles,
    Sun,
    Store,
    Truck,
    MessageSquareText,
    MessagesSquare,
    Zap
} from 'lucide';
import { createIcons } from 'lucide';

const icons = {
    Activity,
    ArrowLeft,
    Bell,
    ChartNoAxesCombined,
    Crown,
    LayoutDashboard,
    LogOut,
    Moon,
    Package,
    Palette,
    PanelsTopLeft,
    Phone,
    Plus,
    QrCode,
    Settings2,
    ShoppingBag,
    Sparkles,
    Sun,
    Store,
    Truck,
    MessageSquareText,
    MessagesSquare,
    Zap
};

function renderIcons(root) {
    if (!root) return;
    const target = root.matches?.('[data-lucide]') ? root.parentElement : root;
    if (target) createIcons({ icons, root: target });
}

function startIconObserver() {
    renderIcons(document);
    const observer = new MutationObserver(records => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE && node.localName !== 'svg') {
                    renderIcons(node);
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

window.refreshDashboardIcons = renderIcons;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startIconObserver, { once: true });
} else {
    startIconObserver();
}
