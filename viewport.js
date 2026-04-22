// ===== ビューポート操作 =====
// パン（スクロール）・ズーム・矩形選択・スペースキー操作を担当します。

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

// ===== スペースキー（パンモード切替）=====
window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !document.getElementById("node-input")) {
        spaceDown = true;
        svg.style.cursor = "grab";
        e.preventDefault();
    }
});
window.addEventListener("keyup", (e) => {
    if (e.code === "Space") { spaceDown = false; svg.style.cursor = ""; }
});

// ===== SVG mousedown（パン開始 / 矩形選択開始）=====
svg.addEventListener("mousedown", (e) => {
    const onBackground =
        e.target === svg       || e.target === mainGroup ||
        e.target === gridGroup || e.target === edgeGroup ||
        e.target === nodeGroup || !!e.target.closest?.("#grid-group");

    if (e.button === 1 || (e.button === 0 && spaceDown)) {
        // パン開始
        isPanning = true;
        panStart  = { mx: e.clientX, my: e.clientY, vx: viewX, vy: viewY };
        svg.style.cursor = "grabbing";
        e.preventDefault();
    } else if (e.button === 0 && onBackground) {
        // 長押しで矩形選択開始
        selPendingEvent = e;
        selPressTimer = setTimeout(() => {
            selPressTimer = null;
            clearSelection();
            startSelectionBox(selPendingEvent);
            svg.style.cursor = "crosshair";
        }, SEL_LONG_PRESS_MS);
        e.preventDefault();
    }
});

// ===== mousemove（パン / 矩形選択更新 / ベジェドラッグ）=====
window.addEventListener("mousemove", (e) => {
    if (isPanning) {
        viewX = panStart.vx + (e.clientX - panStart.mx);
        viewY = panStart.vy + (e.clientY - panStart.my);
        applyTransform();
    }
    if (selPressTimer && selPendingEvent) {
        const dx = e.clientX - selPendingEvent.clientX;
        const dy = e.clientY - selPendingEvent.clientY;
        if (dx * dx + dy * dy > 16) {
            clearTimeout(selPressTimer);
            selPressTimer = null;
            clearSelection();
            startSelectionBox(selPendingEvent);
            svg.style.cursor = "crosshair";
            selPendingEvent = null;
        }
    }
    if (isSelecting)    updateSelectionBox(e);
    if (bezierDragging) updateBezierHandle(e);
});

// ===== mouseup（パン終了 / 矩形選択終了）=====
window.addEventListener("mouseup", (e) => {
    if (isPanning) {
        isPanning = false;
        svg.style.cursor = spaceDown ? "grab" : "";
    }
    if (selPressTimer) {
        clearTimeout(selPressTimer);
        selPressTimer   = null;
        selPendingEvent = null;
        clearSelection();
    }
    if (isSelecting) {
        finishSelectionBox();
        svg.style.cursor = "";
    }
    if (bezierDragging) { bezierDragging = false; }
});

// ===== ホイール（ズーム / パン）=====
svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.ctrlKey) {
        const zf = e.deltaY < 0 ? 1.08 : 1 / 1.08;
        const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, viewScale * zf));
        const r  = svg.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        viewX     = mx - (mx - viewX) * (ns / viewScale);
        viewY     = my - (my - viewY) * (ns / viewScale);
        viewScale = ns;
        applyTransform();
        if (resizeHandleGroup && selectedNode) showResizeHandles(selectedNode);
    } else {
        viewX -= e.deltaX;
        viewY -= e.deltaY;
        applyTransform();
    }
}, { passive: false });

// ===== 矩形選択ボックス操作 =====
function startSelectionBox(e) {
    const r = svg.getBoundingClientRect();
    selStart    = { x: e.clientX - r.left, y: e.clientY - r.top };
    isSelecting = true;
    selBox.setAttribute("x",       selStart.x);
    selBox.setAttribute("y",       selStart.y);
    selBox.setAttribute("width",   0);
    selBox.setAttribute("height",  0);
    selBox.setAttribute("display", "");
}

function updateSelectionBox(e) {
    const r  = svg.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    selBox.setAttribute("x",      Math.min(selStart.x, cx));
    selBox.setAttribute("y",      Math.min(selStart.y, cy));
    selBox.setAttribute("width",  Math.abs(cx - selStart.x));
    selBox.setAttribute("height", Math.abs(cy - selStart.y));
}

function finishSelectionBox() {
    selBox.setAttribute("display", "none");
    isSelecting            = false;
    _justFinishedSelecting = true;
    setTimeout(() => { _justFinishedSelecting = false; }, 0);

    const sx = parseFloat(selBox.getAttribute("x"));
    const sy = parseFloat(selBox.getAttribute("y"));
    const sw = parseFloat(selBox.getAttribute("width"));
    const sh = parseFloat(selBox.getAttribute("height"));
    if (sw < 4 && sh < 4) return;

    const lx1 = (sx      - viewX) / viewScale;
    const ly1 = (sy      - viewY) / viewScale;
    const lx2 = (sx + sw - viewX) / viewScale;
    const ly2 = (sy + sh - viewY) / viewScale;

    clearSelection();
    nodes.forEach(n => {
        if (n.x < lx2 && n.x + n.w > lx1 && n.y < ly2 && n.y + n.h > ly1) {
            selectedNodes.add(n);
            highlightMulti(n, true);
        }
    });
}

// ===== SVGクリック（背景クリックで選択クリア）=====
svg.addEventListener("click", (e) => {
    if (isPanning || isSelecting || _justFinishedSelecting) return;
    const t = e.target;
    if (t === svg || t === mainGroup || t === edgeGroup ||
        t === nodeGroup || t === gridGroup || t.closest?.("#grid-group")) {
        clearSelection();
    }
});