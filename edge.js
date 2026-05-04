// ===== エッジ管理 =====
// エッジの生成・パス計算・スタイル適用・ベジェ制御点ドラッグ・
// エッジ選択パネルの操作を担当します。

// ===== パス計算ユーティリティ =====
// ノードオブジェクト、または {x, y}（フリーエッジの端点座標）を受け付ける
function getNodeCenter(n) {
    if (n._isFreePoint) return { x: n.x, y: n.y };
    return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

function getEdgePoint(n, tx, ty) {
    // フリーエッジ端点はそのまま座標を返す
    if (n._isFreePoint) return { x: n.x, y: n.y };
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const dx = tx - cx, dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const hw = n.w / 2, hh = n.h / 2;
    const t  = Math.min(
        Math.abs(dx) > 0 ? hw / Math.abs(dx) : Infinity,
        Math.abs(dy) > 0 ? hh / Math.abs(dy) : Infinity
    );
    return { x: cx + dx * t, y: cy + dy * t };
}

function buildPath(edge) {
    const a     = edge.a, b = edge.b;
    const ac    = getNodeCenter(a), bc = getNodeCenter(b);
    const style = edge.style || "straight";
    const p1    = getEdgePoint(a, bc.x, bc.y);
    const p2    = getEdgePoint(b, ac.x, ac.y);

    if (style === "straight") {
        return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
    }
    if (style === "bezier") {
        const mx = (p1.x + p2.x) / 2 + (edge.cpOffX || 0);
        const my = (p1.y + p2.y) / 2 + (edge.cpOffY || 0);
        return `M${p1.x},${p1.y} Q${mx},${my} ${p2.x},${p2.y}`;
    }
    if (style === "orthogonal") {
        const midX = (p1.x + p2.x) / 2 + (edge.cpOffX || 0);
        return `M${p1.x},${p1.y} L${midX},${p1.y} L${midX},${p2.y} L${p2.x},${p2.y}`;
    }
    return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
}

function updateEdgePath(edge) {
    const d = buildPath(edge);
    edge.pathEl.setAttribute("d", d);
    edge.hitEl.setAttribute("d",  d);
    if (edge.cpDotEl) updateCPDot(edge);
}

function updateEdges() {
    edges.forEach(e => updateEdgePath(e));
}

// ===== エッジスタイル適用 =====
function applyEdgeStyle(edge) {
    const el   = edge.pathEl;
    const col  = edge.color || "#333333";
    const w    = edge.width || 2;
    const arr  = edge.arrow || "end";
    const dash = edge.dash  || "solid";
    const isSelected = (edge === selectedEdge);

    el.setAttribute("stroke",       isSelected ? "#1976D2" : col);
    el.setAttribute("stroke-width", isSelected ? Math.max(w, 2) + 2 : w);
    el.setAttribute("fill",         "none");
    if (isSelected) el.setAttribute("filter", "url(#sel-glow)");
    else            el.removeAttribute("filter");

    if      (dash === "dashed") el.setAttribute("stroke-dasharray", `${w * 4},${w * 3}`);
    else if (dash === "dotted") el.setAttribute("stroke-dasharray", `${w},${w * 2}`);
    else                        el.removeAttribute("stroke-dasharray");

    const meid = getOrCreateMarkerEnd(col);
    const msid = getOrCreateMarkerStart(col);
    if (arr === "end") {
        el.setAttribute("marker-end", `url(#${meid})`);
        el.removeAttribute("marker-start");
    } else if (arr === "both") {
        el.setAttribute("marker-end",   `url(#${meid})`);
        el.setAttribute("marker-start", `url(#${msid})`);
    } else {
        el.removeAttribute("marker-end");
        el.removeAttribute("marker-start");
    }
}

// ===== エッジ選択ハイライト =====
function highlightEdge(edge, on) {
    if (!edge) return;
    if (on) {
        edge.pathEl.setAttribute("stroke",       "#1976D2");
        edge.pathEl.setAttribute("stroke-width", Math.max(edge.width || 2, 2) + 2);
        edge.pathEl.setAttribute("filter",       "url(#sel-glow)");
    } else {
        edge.pathEl.setAttribute("stroke",       edge.color || "#333333");
        edge.pathEl.setAttribute("stroke-width", edge.width || 2);
        edge.pathEl.removeAttribute("filter");
    }
}

// ===== エッジ選択 =====
function selectEdge(edge) {
    if (selectedEdge && selectedEdge !== edge) {
        highlightEdge(selectedEdge, false);
        hideCPDot(selectedEdge);
        hideFreeEdgeHandles(selectedEdge);
    }
    // ノード選択をクリア
    if (selectedNode) { highlight(selectedNode, false); selectedNode = null; }
    selectedNodes.forEach(n => highlightMulti(n, false));
    selectedNodes.clear();
    hideResizeHandles();

    selectedEdge = edge;
    highlightEdge(edge, true);
    if (edge.style === "bezier" || edge.style === "orthogonal") showCPDot(edge);
    // フリーエッジなら端点ハンドルを表示
    if (edge.isFree) showFreeEdgeHandles(edge);
    const panel = document.getElementById("edge-panel");
    if (panel) {
        panel.classList.add("visible");
        document.getElementById("ep-color").value = edge.color || "#333333";
    }
}

// ===== ベジェ/折れ線 制御点ドラッグ =====
function showCPDot(edge) {
    hideCPDot(edge);
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("r",            6 / viewScale);
    dot.setAttribute("fill",         "#1976D2");
    dot.setAttribute("stroke",       "#fff");
    dot.setAttribute("stroke-width", 1.5 / viewScale);
    dot.style.cursor = "move";
    edge.cpDotEl = dot;
    nodeGroup.appendChild(dot);
    updateCPDot(edge);
    dot.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        bezierDragging = true;
        bezierEdge     = edge;
        bezierStartMX  = e.clientX;
        bezierStartMY  = e.clientY;
        bezierStartCPX = edge.cpOffX || 0;
        bezierStartCPY = edge.cpOffY || 0;
    });
}

function updateCPDot(edge) {
    if (!edge.cpDotEl) return;
    const ac = getNodeCenter(edge.a), bc = getNodeCenter(edge.b);
    const p1 = getEdgePoint(edge.a, bc.x, bc.y);
    const p2 = getEdgePoint(edge.b, ac.x, ac.y);
    const mx = (p1.x + p2.x) / 2 + (edge.cpOffX || 0);
    const my = (p1.y + p2.y) / 2 + (edge.cpOffY || 0);
    edge.cpDotEl.setAttribute("cx",           mx);
    edge.cpDotEl.setAttribute("cy",           my);
    edge.cpDotEl.setAttribute("r",            6   / viewScale);
    edge.cpDotEl.setAttribute("stroke-width", 1.5 / viewScale);
}

function hideCPDot(edge) {
    if (edge && edge.cpDotEl) { edge.cpDotEl.remove(); edge.cpDotEl = null; }
}

// ===== フリーエッジ ユーティリティ =====
function makeFreePoint(x, y) {
    return { x, y, _isFreePoint: true };
}

// ===== フリーエッジ端点スナップ =====
// 優先度1: ノードの接続点（上下左右の辺中央）へ2D距離でスナップ
// 優先度2: ノードの格子候補（辺・中心）へX軸・Y軸独立スナップ
const FREE_SNAP      = SNAP_THRESHOLD * 2;   // 軸独立スナップ閾値
const CONNPT_SNAP    = SNAP_THRESHOLD * 4;   // 接続点スナップ閾値（広め）

// 各ノードの接続点（上下左右の辺中央）を返す
function getNodeConnectPoints(n) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    return [
        { x: cx,        y: n.y      },   // 上
        { x: cx,        y: n.y + n.h },  // 下
        { x: n.x,       y: cy       },   // 左
        { x: n.x + n.w, y: cy       },   // 右
    ];
}

function snapFreePoint(px, py) {
    // 接続点（ノードの上下左右の辺中央）への2Dスナップのみ
    let bestDist = CONNPT_SNAP + 1;
    let snapX = null, snapY = null;

    nodes.forEach(n => {
        getNodeConnectPoints(n).forEach(pt => {
            const dx = px - pt.x, dy = py - pt.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) {
                bestDist = dist;
                snapX = pt.x;
                snapY = pt.y;
            }
        });
    });

    if (bestDist <= CONNPT_SNAP) {
        return { x: snapX, y: snapY };
    }

    return { x: px, y: py };
}

// ===== フリーエッジ 端点ハンドル =====
function showFreeEdgeHandles(edge) {
    hideFreeEdgeHandles(edge);
    edge._epHandles = {};
    ["a", "b"].forEach(which => {
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("r",            7 / viewScale);
        dot.setAttribute("fill",         which === "a" ? "#43a047" : "#e53935");
        dot.setAttribute("stroke",       "#fff");
        dot.setAttribute("stroke-width", 1.5 / viewScale);
        dot.style.cursor = "move";
        const pt = edge[which];
        dot.setAttribute("cx", pt.x);
        dot.setAttribute("cy", pt.y);
        nodeGroup.appendChild(dot);
        edge._epHandles[which] = dot;

        dot.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            freeEdgeDragging  = true;
            freeEdgeDragEdge  = edge;
            freeEdgeDragEndpt = which;
        });
    });
}

function updateFreeEdgeHandles(edge) {
    if (!edge._epHandles) return;
    ["a", "b"].forEach(which => {
        const dot = edge._epHandles[which];
        if (!dot) return;
        const pt = edge[which];
        dot.setAttribute("cx",           pt.x);
        dot.setAttribute("cy",           pt.y);
        dot.setAttribute("r",            7   / viewScale);
        dot.setAttribute("stroke-width", 1.5 / viewScale);
    });
}

// スナップ先ノードのハイライト管理
let _snapHighlightedNode = null;

function updateSnapHighlight(px, py) {
    // 接続点スナップが効いているノードを探す
    let snappedNode = null;
    let bestDist = CONNPT_SNAP + 1;
    nodes.forEach(n => {
        getNodeConnectPoints(n).forEach(pt => {
            const dx = px - pt.x, dy = py - pt.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) { bestDist = dist; snappedNode = n; }
        });
    });

    if (snappedNode !== _snapHighlightedNode) {
        if (_snapHighlightedNode) setSnapHighlight(_snapHighlightedNode, false);
        _snapHighlightedNode = snappedNode;
        if (_snapHighlightedNode) setSnapHighlight(_snapHighlightedNode, true);
    }
}

function clearSnapHighlight() {
    if (_snapHighlightedNode) { setSnapHighlight(_snapHighlightedNode, false); _snapHighlightedNode = null; }
}

function setSnapHighlight(node, on) {
    const el = node.el;
    if (!el) return;
    const applyTo = el._isCylinder ? Array.from(el.querySelectorAll("rect,ellipse")) : [el];
    applyTo.forEach(e => {
        if (on) {
            e.setAttribute("stroke",       "#1976D2");
            e.setAttribute("stroke-width", "2.5");
            e.setAttribute("stroke-dasharray", "5,3");
        } else {
            // 通常選択状態に戻す（selectedNode なら赤、そうでなければ none）
            const isSelected = (node === selectedNode) || selectedNodes.has(node);
            e.setAttribute("stroke",       isSelected ? "red" : "none");
            e.setAttribute("stroke-width", isSelected ? "3"   : "0");
            e.removeAttribute("stroke-dasharray");
        }
    });
}

function hideFreeEdgeHandles(edge) {
    if (!edge || !edge._epHandles) return;
    Object.values(edge._epHandles).forEach(d => d && d.remove());
    edge._epHandles = null;
}

// ===== フリーエッジ 本体ドラッグ有効化 =====
function enableFreeEdgeBodyDrag(edge) {
    edge.hitEl.addEventListener("mousedown", (e) => {
        if (!edge.isFree) return;
        if (e.button !== 0) return;
        e.stopPropagation();
        freeEdgeBodyDrag    = true;
        freeEdgeBodyEdge    = edge;
        freeEdgeBodyStartMX = e.clientX;
        freeEdgeBodyStartMY = e.clientY;
        freeEdgeBodyStartAX = edge.a.x; freeEdgeBodyStartAY = edge.a.y;
        freeEdgeBodyStartBX = edge.b.x; freeEdgeBodyStartBY = edge.b.y;
        selectEdge(edge);
    });
}

function updateBezierHandle(e) {
    if (!bezierDragging || !bezierEdge) return;
    bezierEdge.cpOffX = bezierStartCPX + (e.clientX - bezierStartMX) / viewScale;
    bezierEdge.cpOffY = bezierStartCPY + (e.clientY - bezierStartMY) / viewScale;
    updateEdgePath(bezierEdge);
}

// ===== エッジ生成 =====
function createEdge(a, b, opts = {}) {
    const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const hitEl  = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hitEl.setAttribute("stroke",         "rgba(0,0,0,0)");
    hitEl.setAttribute("stroke-width",   "12");
    hitEl.setAttribute("fill",           "none");
    hitEl.setAttribute("pointer-events", "stroke");
    hitEl.style.cursor = "pointer";

    edgeGroup.appendChild(pathEl);
    edgeGroup.appendChild(hitEl);

    const isFree = !!(a._isFreePoint || b._isFreePoint);

    const edge = {
        a, b, pathEl, hitEl,
        isFree,
        style:  opts.style  ?? globalEdgeStyle,
        arrow:  opts.arrow  ?? globalArrow,
        dash:   opts.dash   ?? globalDash,
        color:  opts.color  ?? globalColor,
        width:  opts.width  ?? globalWidth,
        cpOffX: opts.cpOffX ?? 0,
        cpOffY: opts.cpOffY ?? 0,
        cpDotEl: null,
        _epHandles: null,
    };
    edges.push(edge);
    applyEdgeStyle(edge);
    updateEdgePath(edge);

    if (isFree) {
        hitEl.style.cursor = "move";
        enableFreeEdgeBodyDrag(edge);
    }

    hitEl.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isPanning || isSelecting) return;
        if (freeEdgeBodyDrag) return; // ドラッグ後のクリックを無視
        if (selectedEdge === edge) return;
        selectEdge(edge);
    });

    return edge;
}

// ===== エッジ接続トグル（同じ組み合わせなら削除）=====
function toggleConnection(a, b) {
    const idx = edges.findIndex(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
    if (idx !== -1) {
        edges[idx].pathEl.remove();
        edges[idx].hitEl.remove();
        hideCPDot(edges[idx]);
        edges.splice(idx, 1);
        return;
    }
    createEdge(a, b);
}

// ===== エッジパネル（選択中エッジ操作）=====
document.getElementById("ep-straight").addEventListener("click", () => {
    if (!selectedEdge) return;
    hideCPDot(selectedEdge);
    selectedEdge.style = "straight";
    updateEdgePath(selectedEdge);
});
document.getElementById("ep-bezier").addEventListener("click", () => {
    if (!selectedEdge) return;
    selectedEdge.style = "bezier";
    updateEdgePath(selectedEdge);
    showCPDot(selectedEdge);
});
document.getElementById("ep-orthogonal").addEventListener("click", () => {
    if (!selectedEdge) return;
    selectedEdge.style = "orthogonal";
    updateEdgePath(selectedEdge);
    showCPDot(selectedEdge);
});
document.getElementById("ep-end").addEventListener("click",  () => { if (selectedEdge) { selectedEdge.arrow = "end";  applyEdgeStyle(selectedEdge); } });
document.getElementById("ep-both").addEventListener("click", () => { if (selectedEdge) { selectedEdge.arrow = "both"; applyEdgeStyle(selectedEdge); } });
document.getElementById("ep-none").addEventListener("click", () => { if (selectedEdge) { selectedEdge.arrow = "none"; applyEdgeStyle(selectedEdge); } });
document.getElementById("ep-solid").addEventListener("click",  () => { if (selectedEdge) { selectedEdge.dash = "solid";  applyEdgeStyle(selectedEdge); } });
document.getElementById("ep-dashed").addEventListener("click", () => { if (selectedEdge) { selectedEdge.dash = "dashed"; applyEdgeStyle(selectedEdge); } });
document.getElementById("ep-dotted").addEventListener("click", () => { if (selectedEdge) { selectedEdge.dash = "dotted"; applyEdgeStyle(selectedEdge); } });
document.getElementById("ep-color").addEventListener("input", (e) => {
    if (selectedEdge) { selectedEdge.color = e.target.value; applyEdgeStyle(selectedEdge); }
});
document.getElementById("ep-delete").addEventListener("click", () => {
    if (!selectedEdge) return;
    const idx = edges.indexOf(selectedEdge);
    if (idx !== -1) {
        selectedEdge.pathEl.remove();
        selectedEdge.hitEl.remove();
        hideCPDot(selectedEdge);
        hideFreeEdgeHandles(selectedEdge);
        edges.splice(idx, 1);
        selectedEdge = null;
        document.getElementById("edge-panel").classList.remove("visible");
    }
});