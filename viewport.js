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
    // 矢印タイルドラッグ中はSVG側のマウスダウン処理をスキップ
    if (arrowTileDragging) return;

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

// ===== mousemove（パン / 矩形選択更新 / ベジェドラッグ / 矢印プレビュー）=====
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

    // フリーエッジ 端点ハンドルドラッグ
    if (freeEdgeDragging && freeEdgeDragEdge) {
        const lp      = screenToLogical(e.clientX, e.clientY);
        const snapped = snapFreePoint(lp.x, lp.y);

        // 水平・垂直スナップ：もう一方の端点との角度を見て軸にスナップ
        const otherEndpt = freeEdgeDragEndpt === "a" ? "b" : "a";
        const other = freeEdgeDragEdge[otherEndpt];
        const dx = snapped.x - other.x;
        const dy = snapped.y - other.y;
        if (dx !== 0 || dy !== 0) {
            const angleDeg = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
            const thresh   = AXIS_SNAP_DEG;
            // 水平（0°または180°に近い）
            if (angleDeg < thresh || angleDeg > 180 - thresh) {
                snapped.y = other.y;
            }
            // 垂直（90°に近い）
            else if (angleDeg > 90 - thresh && angleDeg < 90 + thresh) {
                snapped.x = other.x;
            }
        }

        freeEdgeDragEdge[freeEdgeDragEndpt].x = snapped.x;
        freeEdgeDragEdge[freeEdgeDragEndpt].y = snapped.y;
        updateEdgePath(freeEdgeDragEdge);
        updateFreeEdgeHandles(freeEdgeDragEdge);
        updateSnapHighlight(lp.x, lp.y);
    }

    // フリーエッジ 本体ドラッグ（全体移動）
    if (freeEdgeBodyDrag && freeEdgeBodyEdge) {
        const dx  = (e.clientX - freeEdgeBodyStartMX) / viewScale;
        const dy  = (e.clientY - freeEdgeBodyStartMY) / viewScale;
        let ax = freeEdgeBodyStartAX + dx;
        let ay = freeEdgeBodyStartAY + dy;
        let bx = freeEdgeBodyStartBX + dx;
        let by = freeEdgeBodyStartBY + dy;

        // 両端点でスナップ試行し、より近い方の補正量を全体に適用（軸独立）
        const sa = snapFreePoint(ax, ay);
        const sb = snapFreePoint(bx, by);
        const dxa = sa.x - ax, dya = sa.y - ay;
        const dxb = sb.x - bx, dyb = sb.y - by;

        // X軸：A・B のうち引力が強い方を採用
        const snapDX = Math.abs(dxa) <= Math.abs(dxb) ? dxa : dxb;
        const snapDY = Math.abs(dya) <= Math.abs(dyb) ? dya : dyb;

        freeEdgeBodyEdge.a.x = ax + snapDX;
        freeEdgeBodyEdge.a.y = ay + snapDY;
        freeEdgeBodyEdge.b.x = bx + snapDX;
        freeEdgeBodyEdge.b.y = by + snapDY;
        updateEdgePath(freeEdgeBodyEdge);
        updateFreeEdgeHandles(freeEdgeBodyEdge);
    }

    // 矢印タイルドラッグ中：プレビュー線を描画
    if (arrowTileDragging) {
        const lp = screenToLogical(e.clientX, e.clientY);
        if (!arrowPreviewEl) {
            arrowPreviewEl = document.createElementNS("http://www.w3.org/2000/svg", "line");
            arrowPreviewEl.setAttribute("stroke",           "#1976D2");
            arrowPreviewEl.setAttribute("stroke-width",     "2");
            arrowPreviewEl.setAttribute("stroke-dasharray", "6,4");
            arrowPreviewEl.setAttribute("pointer-events",   "none");
            edgeGroup.appendChild(arrowPreviewEl);
            arrowPreviewEl._startLP = lp;
        }
        const s = arrowPreviewEl._startLP;
        arrowPreviewEl.setAttribute("x1", s.x); arrowPreviewEl.setAttribute("y1", s.y);
        arrowPreviewEl.setAttribute("x2", lp.x); arrowPreviewEl.setAttribute("y2", lp.y);
    }

    // 矢印接続待ち中：マウス位置からプレビュー線を始点ノードから引く
    if (arrowConnectPending && !arrowTileDragging) {
        const lp  = screenToLogical(e.clientX, e.clientY);
        const src = arrowConnectPending.node;
        const cx  = src.x + src.w / 2, cy = src.y + src.h / 2;
        if (!arrowPreviewEl) {
            arrowPreviewEl = document.createElementNS("http://www.w3.org/2000/svg", "line");
            arrowPreviewEl.setAttribute("stroke",           "#1976D2");
            arrowPreviewEl.setAttribute("stroke-width",     "2");
            arrowPreviewEl.setAttribute("stroke-dasharray", "6,4");
            arrowPreviewEl.setAttribute("pointer-events",   "none");
            edgeGroup.appendChild(arrowPreviewEl);
        }
        arrowPreviewEl.setAttribute("x1", cx); arrowPreviewEl.setAttribute("y1", cy);
        arrowPreviewEl.setAttribute("x2", lp.x); arrowPreviewEl.setAttribute("y2", lp.y);
    }
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

    // フリーエッジ 端点ハンドルドラッグ終了
    if (freeEdgeDragging) {
        freeEdgeDragging  = false;
        freeEdgeDragEdge  = null;
        freeEdgeDragEndpt = null;
        clearSnapHighlight();
    }

    // フリーエッジ 本体ドラッグ終了
    if (freeEdgeBodyDrag) {
        freeEdgeBodyDrag = false;
        freeEdgeBodyEdge = null;
    }

    // 矢印タイルドラッグ：ノード以外でドロップ→キャンセル
    if (arrowTileDragging) {
        // enableConnect の mouseup でノード上ならすでに処理済み
        // ここに来たということはノード外でドロップ → キャンセル
        cancelArrowPreview();
        arrowTileDragging = false;
        svg.style.cursor = "";
    }
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
        // 矢印接続待ち中なら接続待ちをキャンセル、そうでなければ通常の選択クリア
        if (arrowConnectPending) {
            cancelArrowConnect();
        } else {
            clearSelection();
        }
    }
});