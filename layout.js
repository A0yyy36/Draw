// ===== 右パネル：自動レイアウト & 描画 =====
// 左画面のフローチャートを解析し、右画面に整理されたレイアウトで表示します。

// ===== 右パネルSVGの初期化 =====
const rightSvg = document.getElementById("right-canvas");

const rightGridGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
rightGridGroup.id = "right-grid-group";
rightSvg.appendChild(rightGridGroup);

const rightMainGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
rightMainGroup.id = "right-main-group";
rightSvg.appendChild(rightMainGroup);

const rightEdgeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
rightEdgeGroup.id = "right-edge-group";
rightMainGroup.appendChild(rightEdgeGroup);

const rightNodeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
rightNodeGroup.id = "right-node-group";
rightMainGroup.appendChild(rightNodeGroup);

// 右パネル defs（マーカー）
const rightDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
rightSvg.appendChild(rightDefs);

// 右パネル ビュー変換
let rightViewX = 0, rightViewY = 0, rightViewScale = 1;
let rightIsPanning = false, rightPanStart = null;

function applyRightTransform() {
    rightMainGroup.setAttribute("transform",
        `translate(${rightViewX},${rightViewY}) scale(${rightViewScale})`);
    drawRightGrid();
}

function drawRightGrid() {
    while (rightGridGroup.firstChild) rightGridGroup.removeChild(rightGridGroup.firstChild);
    const w    = rightSvg.clientWidth  || 600;
    const h    = rightSvg.clientHeight || 600;
    const step = 20 * rightViewScale;
    const ox   = rightViewX % step;
    const oy   = rightViewY % step;
    const cols = Math.ceil(w / step) + 2;
    const rows = Math.ceil(h / step) + 2;
    for (let i = -1; i < cols; i++) {
        const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const lx = ox + i * step;
        l.setAttribute("x1", lx); l.setAttribute("y1", 0);
        l.setAttribute("x2", lx); l.setAttribute("y2", h);
        l.setAttribute("stroke", "#e8eaf0"); l.setAttribute("stroke-width", "1");
        rightGridGroup.appendChild(l);
    }
    for (let j = -1; j < rows; j++) {
        const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const ly = oy + j * step;
        l.setAttribute("x1", 0);  l.setAttribute("y1", ly);
        l.setAttribute("x2", w);  l.setAttribute("y2", ly);
        l.setAttribute("stroke", "#e8eaf0"); l.setAttribute("stroke-width", "1");
        rightGridGroup.appendChild(l);
    }
}

// 右パネルのパン操作
rightSvg.addEventListener("mousedown", (e) => {
    if (e.button === 1 || e.button === 0) {
        rightIsPanning = true;
        rightPanStart  = { mx: e.clientX, my: e.clientY, vx: rightViewX, vy: rightViewY };
        rightSvg.style.cursor = "grabbing";
        e.preventDefault();
    }
});
window.addEventListener("mousemove", (e) => {
    if (!rightIsPanning) return;
    rightViewX = rightPanStart.vx + (e.clientX - rightPanStart.mx);
    rightViewY = rightPanStart.vy + (e.clientY - rightPanStart.my);
    applyRightTransform();
});
window.addEventListener("mouseup", () => {
    if (rightIsPanning) { rightIsPanning = false; rightSvg.style.cursor = ""; }
});
rightSvg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zf = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    const ns = Math.min(5, Math.max(0.1, rightViewScale * zf));
    const r  = rightSvg.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    rightViewX     = mx - (mx - rightViewX) * (ns / rightViewScale);
    rightViewY     = my - (my - rightViewY) * (ns / rightViewScale);
    rightViewScale = ns;
    applyRightTransform();
}, { passive: false });

// ===== マーカー生成（右パネル用）=====
function getRightMarkerEnd(color) {
    const id = `rme-${color.replace("#", "")}`;
    if (!rightDefs.querySelector(`#${id}`)) {
        const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        m.setAttribute("id", id);
        m.setAttribute("markerWidth",  "10");
        m.setAttribute("markerHeight", "7");
        m.setAttribute("refX",  "9"); m.setAttribute("refY", "3.5");
        m.setAttribute("orient", "auto");
        const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        p.setAttribute("points", "0 0, 10 3.5, 0 7");
        p.setAttribute("fill", color);
        m.appendChild(p); rightDefs.appendChild(m);
    }
    return id;
}
function getRightMarkerStart(color) {
    const id = `rms-${color.replace("#", "")}`;
    if (!rightDefs.querySelector(`#${id}`)) {
        const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        m.setAttribute("id", id);
        m.setAttribute("markerWidth",  "10");
        m.setAttribute("markerHeight", "7");
        m.setAttribute("refX",  "1"); m.setAttribute("refY", "3.5");
        m.setAttribute("orient", "auto");
        const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        p.setAttribute("points", "10 0, 0 3.5, 10 7");
        p.setAttribute("fill", color);
        m.appendChild(p); rightDefs.appendChild(m);
    }
    return id;
}

// ===== Sugiyama 風 階層レイアウト =====

/**
 * ノードグラフを階層的に整列する
 * 手順:
 *   1. サイクル除去（逆向きエッジを反転）
 *   2. 層割り当て（最長パス法）
 *   3. 各層内の順序最適化（バリセンタ法 複数回）
 *   4. 座標割り当て
 */
function computeHierarchicalLayout(srcNodes, srcEdges) {
    if (srcNodes.length === 0) return { layoutNodes: [], layoutEdges: [] };

    // ノード・エッジをコピー（元データを変更しない）
    const nodeMap = new Map();
    srcNodes.forEach(n => {
        nodeMap.set(n.id, {
            id:    n.id,
            label: n.label,
            shape: n.shape,
            w:     n.w,
            h:     n.h,
            fontsize: n.fontsize ?? 14,
            layer: -1,
            order: 0,
            x: 0, y: 0,
        });
    });

    // フリーエッジ・接続エッジを両方扱う
    const edgeList = [];
    srcEdges.forEach(e => {
        const aNode = e.isFree ? (e.a._attachNode || null) : e.a;
        const bNode = e.isFree ? (e.b._attachNode || null) : e.b;
        if (!aNode || !bNode) return;
        if (!nodeMap.has(aNode.id) || !nodeMap.has(bNode.id)) return;
        if (aNode.id === bNode.id) return;
        edgeList.push({ from: aNode.id, to: bNode.id, orig: e });
    });

    // 重複エッジを除去
    const edgeSet  = new Set();
    const uniqueEdges = [];
    edgeList.forEach(e => {
        const key = `${e.from}->${e.to}`;
        if (!edgeSet.has(key)) { edgeSet.add(key); uniqueEdges.push(e); }
    });

    // ----- 1. サイクル除去（DFS で後向き辺を反転）-----
    const visited  = new Set();
    const inStack  = new Set();
    const reversed = new Set();

    function dfsRemoveCycles(nodeId, adjMap) {
        visited.add(nodeId);
        inStack.add(nodeId);
        const nexts = adjMap.get(nodeId) || [];
        nexts.forEach(e => {
            if (!visited.has(e.to)) {
                dfsRemoveCycles(e.to, adjMap);
            } else if (inStack.has(e.to)) {
                reversed.add(e);
                [e.from, e.to] = [e.to, e.from];
            }
        });
        inStack.delete(nodeId);
    }

    const adjMap = new Map();
    nodeMap.forEach((_, id) => adjMap.set(id, []));
    uniqueEdges.forEach(e => adjMap.get(e.from).push(e));
    nodeMap.forEach((_, id) => { if (!visited.has(id)) dfsRemoveCycles(id, adjMap); });

    // ----- 2. 層割り当て（最長パス法）-----
    // 入次数0のノードから BFS
    const inDeg = new Map();
    nodeMap.forEach((_, id) => inDeg.set(id, 0));
    uniqueEdges.forEach(e => inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1));

    const layer = new Map();
    const queue = [];
    nodeMap.forEach((_, id) => { if (inDeg.get(id) === 0) { queue.push(id); layer.set(id, 0); } });

    // 孤立ノード（エッジなし）は層0
    nodeMap.forEach((_, id) => {
        if (!layer.has(id)) { layer.set(id, 0); }
    });

    let qi = 0;
    while (qi < queue.length) {
        const cur = queue[qi++];
        const nexts = adjMap.get(cur) || [];
        nexts.forEach(e => {
            const nl = (layer.get(cur) || 0) + 1;
            if (!layer.has(e.to) || layer.get(e.to) < nl) {
                layer.set(e.to, nl);
            }
            inDeg.set(e.to, inDeg.get(e.to) - 1);
            if (inDeg.get(e.to) === 0) queue.push(e.to);
        });
    }

    // キューに追加されなかったノード（サイクル残り）を末尾層に
    nodeMap.forEach((_, id) => {
        if (!layer.has(id)) layer.set(id, queue.length > 0 ? Math.max(...layer.values()) + 1 : 0);
    });

    nodeMap.forEach((n, id) => { n.layer = layer.get(id) || 0; });

    // 層ごとのノードリスト
    const layers = new Map();
    nodeMap.forEach((n, id) => {
        if (!layers.has(n.layer)) layers.set(n.layer, []);
        layers.get(n.layer).push(id);
    });

    // ----- 3. 各層内ノード順序（バリセンタ法）-----
    const maxLayer = Math.max(...layer.values());
    // 初期順序を入次数の少ない順で設定
    for (let l = 0; l <= maxLayer; l++) {
        const ids = layers.get(l) || [];
        ids.forEach((id, i) => { nodeMap.get(id).order = i; });
    }

    // バリセンタ法を数回繰り返す
    for (let iter = 0; iter < 4; iter++) {
        // 上→下パス
        for (let l = 1; l <= maxLayer; l++) {
            const ids = layers.get(l) || [];
            ids.forEach(id => {
                // 前層での親ノードの平均order
                const preds = uniqueEdges
                    .filter(e => e.to === id && nodeMap.get(e.from).layer === l - 1)
                    .map(e => nodeMap.get(e.from).order);
                if (preds.length > 0) {
                    nodeMap.get(id).order = preds.reduce((s, v) => s + v, 0) / preds.length;
                }
            });
            ids.sort((a, b) => nodeMap.get(a).order - nodeMap.get(b).order);
            ids.forEach((id, i) => { nodeMap.get(id).order = i; });
        }
        // 下→上パス
        for (let l = maxLayer - 1; l >= 0; l--) {
            const ids = layers.get(l) || [];
            ids.forEach(id => {
                const succs = uniqueEdges
                    .filter(e => e.from === id && nodeMap.get(e.to).layer === l + 1)
                    .map(e => nodeMap.get(e.to).order);
                if (succs.length > 0) {
                    nodeMap.get(id).order = succs.reduce((s, v) => s + v, 0) / succs.length;
                }
            });
            ids.sort((a, b) => nodeMap.get(a).order - nodeMap.get(b).order);
            ids.forEach((id, i) => { nodeMap.get(id).order = i; });
        }
    }

    // ----- 4. 座標割り当て-----
    const H_GAP   = 80;  // 層間の垂直ギャップ
    const V_GAP   = 30;  // 同層内の水平ギャップ

    // 各層の最大ノード高さ
    const layerMaxH = new Map();
    nodeMap.forEach(n => {
        const cur = layerMaxH.get(n.layer) || 0;
        layerMaxH.set(n.layer, Math.max(cur, n.h));
    });

    // 層ごとのY座標累積
    const layerY = new Map();
    let curY = 40;
    for (let l = 0; l <= maxLayer; l++) {
        layerY.set(l, curY);
        curY += (layerMaxH.get(l) || 60) + H_GAP;
    }

    // 各層内のノードをX方向に並べる
    for (let l = 0; l <= maxLayer; l++) {
        const ids = (layers.get(l) || []).slice()
            .sort((a, b) => nodeMap.get(a).order - nodeMap.get(b).order);
        let curX = 40;
        ids.forEach(id => {
            const n = nodeMap.get(id);
            n.x = curX;
            n.y = layerY.get(l);
            curX += n.w + V_GAP;
        });
    }

    // 各層を水平中央揃え（最大幅の層に合わせる）
    let maxWidth = 0;
    for (let l = 0; l <= maxLayer; l++) {
        const ids = layers.get(l) || [];
        if (ids.length === 0) continue;
        const lastId = ids[ids.length - 1];
        const last = nodeMap.get(lastId);
        maxWidth = Math.max(maxWidth, last.x + last.w);
    }
    for (let l = 0; l <= maxLayer; l++) {
        const ids = (layers.get(l) || []).slice()
            .sort((a, b) => nodeMap.get(a).order - nodeMap.get(b).order);
        if (ids.length === 0) continue;
        const lastId = ids[ids.length - 1];
        const last = nodeMap.get(lastId);
        const layerWidth = last.x + last.w - 40;
        const offset = (maxWidth - layerWidth) / 2;
        ids.forEach(id => { nodeMap.get(id).x += offset; });
    }

    return {
        layoutNodes: Array.from(nodeMap.values()),
        layoutEdges: uniqueEdges,
        nodeMap,
    };
}

// ===== 右パネル描画 =====
function renderRightPanel() {
    // クリア
    while (rightEdgeGroup.firstChild) rightEdgeGroup.removeChild(rightEdgeGroup.firstChild);
    while (rightNodeGroup.firstChild)  rightNodeGroup.removeChild(rightNodeGroup.firstChild);

    if (nodes.length === 0) {
        drawRightEmptyState();
        return;
    }

    const { layoutNodes, layoutEdges, nodeMap } = computeHierarchicalLayout(nodes, edges);

    // ノードを描画
    layoutNodes.forEach(n => drawRightNode(n));

    // エッジを描画
    layoutEdges.forEach(e => {
        const from = nodeMap.get(e.from);
        const to   = nodeMap.get(e.to);
        if (!from || !to) return;
        drawRightEdge(from, to, e.orig);
    });

    // ビューを全体にフィット
    fitRightView(layoutNodes);
}

function drawRightEmptyState() {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const w = rightSvg.clientWidth || 600;
    const h = rightSvg.clientHeight || 600;
    text.setAttribute("x", w / 2);
    text.setAttribute("y", h / 2);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", "#bbb");
    text.setAttribute("font-size", "16");
    text.setAttribute("font-family", "sans-serif");
    text.textContent = "左パネルにノードを追加すると整理されたレイアウトが表示されます";
    rightSvg.appendChild(text);
}

function drawRightNode(n) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    // 形状
    let shapeEl;
    if (n.shape === "rounded") {
        shapeEl = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        shapeEl.setAttribute("x", n.x); shapeEl.setAttribute("y", n.y);
        shapeEl.setAttribute("width", n.w); shapeEl.setAttribute("height", n.h);
        shapeEl.setAttribute("rx", n.h / 2); shapeEl.setAttribute("ry", n.h / 2);
        shapeEl.setAttribute("fill", "#4CAF50");
        shapeEl.setAttribute("stroke", "#2e7d32"); shapeEl.setAttribute("stroke-width", "1.5");
    } else if (n.shape === "diamond") {
        shapeEl = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        shapeEl.setAttribute("points", `${cx},${n.y} ${n.x+n.w},${cy} ${cx},${n.y+n.h} ${n.x},${cy}`);
        shapeEl.setAttribute("fill", "#FF9800");
        shapeEl.setAttribute("stroke", "#e65100"); shapeEl.setAttribute("stroke-width", "1.5");
    } else if (n.shape === "parallelogram") {
        shapeEl = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        const sk = 15;
        shapeEl.setAttribute("points",
            `${n.x+sk},${n.y} ${n.x+n.w},${n.y} ${n.x+n.w-sk},${n.y+n.h} ${n.x},${n.y+n.h}`);
        shapeEl.setAttribute("fill", "#9C27B0");
        shapeEl.setAttribute("stroke", "#4a148c"); shapeEl.setAttribute("stroke-width", "1.5");
    } else if (n.shape === "cylinder") {
        const rx = n.w / 2, ry = 10;
        const body = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        body.setAttribute("x", n.x); body.setAttribute("y", n.y + ry);
        body.setAttribute("width", n.w); body.setAttribute("height", Math.max(0, n.h - ry * 2));
        body.setAttribute("fill", "#F44336");
        const btm = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        btm.setAttribute("cx", n.x + rx); btm.setAttribute("cy", n.y + n.h - ry);
        btm.setAttribute("rx", rx); btm.setAttribute("ry", ry); btm.setAttribute("fill", "#E57373");
        const top = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        top.setAttribute("cx", n.x + rx); top.setAttribute("cy", n.y + ry);
        top.setAttribute("rx", rx); top.setAttribute("ry", ry); top.setAttribute("fill", "#EF9A9A");
        g.appendChild(body); g.appendChild(btm); g.appendChild(top);
        rightNodeGroup.appendChild(g);
        // テキストを追加
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", n.x + n.w / 2); text.setAttribute("y", n.y + n.h / 2);
        text.setAttribute("text-anchor", "middle"); text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("fill", "white"); text.setAttribute("font-size", n.fontsize ?? 14);
        text.setAttribute("pointer-events", "none"); text.textContent = n.label;
        rightNodeGroup.appendChild(text);
        return;
    } else {
        // デフォルト: rect
        shapeEl = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        shapeEl.setAttribute("x", n.x); shapeEl.setAttribute("y", n.y);
        shapeEl.setAttribute("width", n.w); shapeEl.setAttribute("height", n.h);
        shapeEl.setAttribute("fill", "#2196F3");
        shapeEl.setAttribute("stroke", "#1565C0"); shapeEl.setAttribute("stroke-width", "1.5");
    }

    // ドロップシャドウ
    shapeEl.setAttribute("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.18))");
    g.appendChild(shapeEl);
    rightNodeGroup.appendChild(g);

    // テキスト
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", n.x + n.w / 2); text.setAttribute("y", n.y + n.h / 2);
    text.setAttribute("text-anchor", "middle"); text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("fill", "white"); text.setAttribute("font-size", n.fontsize ?? 14);
    text.setAttribute("pointer-events", "none"); text.textContent = n.label;
    rightNodeGroup.appendChild(text);
}

function drawRightEdge(from, to, origEdge) {
    const col   = (origEdge && origEdge.color) || "#555";
    const w     = (origEdge && origEdge.width) || 2;
    const arrow = (origEdge && origEdge.arrow) || "end";
    const dash  = (origEdge && origEdge.dash)  || "solid";

    // 始点・終点をノード辺から計算
    const p1 = getRightEdgePoint(from, to.x + to.w / 2, to.y + to.h / 2);
    const p2 = getRightEdgePoint(to, from.x + from.w / 2, from.y + from.h / 2);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    // 垂直が基本：中間点で折り返す
    const midY = (p1.y + p2.y) / 2;
    const d = `M${p1.x},${p1.y} L${p1.x},${midY} L${p2.x},${midY} L${p2.x},${p2.y}`;
    path.setAttribute("d", d);
    path.setAttribute("stroke", col);
    path.setAttribute("stroke-width", w);
    path.setAttribute("fill", "none");

    if (dash === "dashed") path.setAttribute("stroke-dasharray", `${w*4},${w*3}`);
    else if (dash === "dotted") path.setAttribute("stroke-dasharray", `${w},${w*2}`);

    if (arrow === "end" || arrow === "both") {
        path.setAttribute("marker-end", `url(#${getRightMarkerEnd(col)})`);
    }
    if (arrow === "both") {
        path.setAttribute("marker-start", `url(#${getRightMarkerStart(col)})`);
    }

    rightEdgeGroup.appendChild(path);
}

function getRightEdgePoint(n, tx, ty) {
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

function fitRightView(layoutNodes) {
    if (!layoutNodes || layoutNodes.length === 0) return;
    const minX = Math.min(...layoutNodes.map(n => n.x));
    const minY = Math.min(...layoutNodes.map(n => n.y));
    const maxX = Math.max(...layoutNodes.map(n => n.x + n.w));
    const maxY = Math.max(...layoutNodes.map(n => n.y + n.h));

    const pad = 40;
    const cw  = rightSvg.clientWidth  || 600;
    const ch  = rightSvg.clientHeight || 600;
    const gw  = maxX - minX + pad * 2;
    const gh  = maxY - minY + pad * 2;
    rightViewScale = Math.min(cw / gw, ch / gh, 1.5);
    rightViewX = (cw - gw * rightViewScale) / 2 - (minX - pad) * rightViewScale;
    rightViewY = (ch - gh * rightViewScale) / 2 - (minY - pad) * rightViewScale;
    applyRightTransform();
}

// ===== 更新ボタン・自動更新 =====
document.getElementById("refresh-right-btn").addEventListener("click", () => {
    renderRightPanel();
});

// ===== 自動更新フック =====
let _autoRefreshTimer = null;
function scheduleRightPanelRefresh() {
    const autoCheck = document.getElementById("auto-refresh-check");
    if (autoCheck && !autoCheck.checked) return;
    clearTimeout(_autoRefreshTimer);
    _autoRefreshTimer = setTimeout(() => renderRightPanel(), 400);
}

// drawNode をラップ
const _origDrawNode = window.drawNode || drawNode;
const _patchedDrawNode = function(node) {
    _origDrawNode(node);
    scheduleRightPanelRefresh();
};

// deleteNode をラップ
const _origDeleteNode = window.deleteNode || deleteNode;
const _patchedDeleteNode = function(node) {
    _origDeleteNode(node);
    scheduleRightPanelRefresh();
};

// createEdge をラップ
const _origCreateEdge = window.createEdge || createEdge;
const _patchedCreateEdge = function(a, b, opts) {
    const e = _origCreateEdge(a, b, opts);
    scheduleRightPanelRefresh();
    return e;
};

// グローバル関数を上書き（layout.js は最後に読み込まれる）
window.drawNode   = _patchedDrawNode;
window.deleteNode = _patchedDeleteNode;
window.createEdge = _patchedCreateEdge;

// loadFlowchart をラップ
if (typeof loadFlowchart === 'function') {
    const _origLoad = loadFlowchart;
    window.loadFlowchart = function(data) {
        _origLoad(data);
        setTimeout(() => renderRightPanel(), 100);
    };
}

// ===== MutationObserver で左パネルの変化を検知 =====
// window.drawNode ラップが効かないケースの補完として
// nodeGroup / edgeGroup の DOM 変化を監視して自動更新する
(function() {
    function setupObserver() {
        const ng = document.getElementById("node-group");
        const eg = document.getElementById("edge-group");
        if (!ng || !eg) {
            setTimeout(setupObserver, 200);
            return;
        }
        const obs = new MutationObserver(() => scheduleRightPanelRefresh());
        obs.observe(ng, { childList: true, subtree: false });
        obs.observe(eg, { childList: true, subtree: false });
    }
    setupObserver();
})();