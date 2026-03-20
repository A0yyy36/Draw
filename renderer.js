const svg = document.getElementById("canvas");

let nodes = [];
let edges = [];
let nodeId = 0;

// ===== グローバルエッジ設定 =====
let globalEdgeStyle = "straight"; // straight | bezier | orthogonal
let globalArrow     = "end";      // end | both | none
let globalDash      = "solid";    // solid | dashed | dotted
let globalColor     = "#333333";
let globalWidth     = 2;

// ===== 選択管理（単一 or 複数）=====
let selectedNode  = null;
let selectedNodes = new Set();
let selectedEdge  = null;

let resizeHandleGroup = null;
let resizingNode = null;
let resizeDir    = null;
let resizeStart  = null;

// ===== 無限キャンバス =====
let viewX = 0, viewY = 0, viewScale = 1;

const gridGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
gridGroup.id = "grid-group";
svg.appendChild(gridGroup);

const mainGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
mainGroup.id = "main-group";
svg.appendChild(mainGroup);

// エッジ専用グループ（ノードより下の層）
const edgeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
edgeGroup.id = "edge-group";
mainGroup.appendChild(edgeGroup);

// ノード専用グループ（エッジより上の層）
const nodeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
nodeGroup.id = "node-group";
mainGroup.appendChild(nodeGroup);

// 矩形選択ボックス
const selBox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
selBox.setAttribute("fill",         "rgba(33,150,243,0.08)");
selBox.setAttribute("stroke",       "#2196F3");
selBox.setAttribute("stroke-width", "1.5");
selBox.setAttribute("display",      "none");
svg.appendChild(selBox);

function applyTransform() {
    mainGroup.setAttribute("transform", `translate(${viewX},${viewY}) scale(${viewScale})`);
    drawGrid();
}

function drawGrid() {
    while (gridGroup.firstChild) gridGroup.removeChild(gridGroup.firstChild);
    const svgW = svg.clientWidth  || 900;
    const svgH = svg.clientHeight || 600;
    const step    = 20 * viewScale;
    const offsetX = viewX % step;
    const offsetY = viewY % step;
    const cols = Math.ceil(svgW / step) + 2;
    const rows = Math.ceil(svgH / step) + 2;
    for (let i = -1; i < cols; i++) {
        const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const lx = offsetX + i * step;
        l.setAttribute("x1", lx); l.setAttribute("y1", 0);
        l.setAttribute("x2", lx); l.setAttribute("y2", svgH);
        l.setAttribute("stroke", "#e0e0e0"); l.setAttribute("stroke-width", "1");
        gridGroup.appendChild(l);
    }
    for (let j = -1; j < rows; j++) {
        const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const ly = offsetY + j * step;
        l.setAttribute("x1", 0);    l.setAttribute("y1", ly);
        l.setAttribute("x2", svgW); l.setAttribute("y2", ly);
        l.setAttribute("stroke", "#e0e0e0"); l.setAttribute("stroke-width", "1");
        gridGroup.appendChild(l);
    }
}

svg.setAttribute("width", "100%");
svg.setAttribute("height", "100%");
svg.style.display = "block";
applyTransform();

function screenToLogical(sx, sy) {
    const r = svg.getBoundingClientRect();
    return { x: (sx - r.left - viewX) / viewScale, y: (sy - r.top - viewY) / viewScale };
}

// ===== パン =====
let isPanning = false;
let panStart  = null;
let spaceDown = false;

window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !document.getElementById("node-input")) {
        spaceDown = true; svg.style.cursor = "grab"; e.preventDefault();
    }
});
window.addEventListener("keyup", (e) => {
    if (e.code === "Space") { spaceDown = false; svg.style.cursor = ""; }
});

// ===== 矩形選択 =====
let isSelecting           = false;
let selStart              = null;
let selPressTimer         = null;
let selPendingEvent       = null;
let _justFinishedSelecting = false;
const SEL_LONG_PRESS_MS   = 200;

function startSelectionBox(e) {
    const r = svg.getBoundingClientRect();
    selStart = { x: e.clientX - r.left, y: e.clientY - r.top };
    isSelecting = true;
    selBox.setAttribute("x",      selStart.x);
    selBox.setAttribute("y",      selStart.y);
    selBox.setAttribute("width",  0);
    selBox.setAttribute("height", 0);
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
    isSelecting = false;
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

// ===== 選択クリア =====
function clearSelection() {
    if (selectedNode) { highlight(selectedNode, false); selectedNode = null; }
    selectedNodes.forEach(n => highlightMulti(n, false));
    selectedNodes.clear();
    hideResizeHandles();
    if (selectedEdge) {
        highlightEdge(selectedEdge, false);
        hideCPDot(selectedEdge);
        selectedEdge = null;
    }
    const panel = document.getElementById("edge-panel");
    if (panel) panel.classList.remove("visible");
}

// ===== svg mousedown =====
svg.addEventListener("mousedown", (e) => {
    const onBackground = e.target === svg || e.target === mainGroup ||
        e.target === gridGroup || e.target === edgeGroup || e.target === nodeGroup ||
        !!e.target.closest?.("#grid-group");

    if (e.button === 1 || (e.button === 0 && spaceDown)) {
        isPanning = true;
        panStart  = { mx: e.clientX, my: e.clientY, vx: viewX, vy: viewY };
        svg.style.cursor = "grabbing";
        e.preventDefault();
    } else if (e.button === 0 && onBackground) {
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

window.addEventListener("mousemove", (e) => {
    if (isPanning) {
        viewX = panStart.vx + (e.clientX - panStart.mx);
        viewY = panStart.vy + (e.clientY - panStart.my);
        applyTransform();
    }
    if (selPressTimer && selPendingEvent) {
        const dx = e.clientX - selPendingEvent.clientX;
        const dy = e.clientY - selPendingEvent.clientY;
        if (dx*dx + dy*dy > 16) {
            clearTimeout(selPressTimer);
            selPressTimer = null;
            clearSelection();
            startSelectionBox(selPendingEvent);
            svg.style.cursor = "crosshair";
            selPendingEvent = null;
        }
    }
    if (isSelecting) updateSelectionBox(e);
    if (bezierDragging) updateBezierHandle(e);
});

window.addEventListener("mouseup", (e) => {
    if (isPanning) {
        isPanning = false;
        svg.style.cursor = spaceDown ? "grab" : "";
    }
    if (selPressTimer) {
        clearTimeout(selPressTimer);
        selPressTimer = null;
        selPendingEvent = null;
        clearSelection();
    }
    if (isSelecting) {
        finishSelectionBox();
        svg.style.cursor = "";
    }
    if (bezierDragging) { bezierDragging = false; }
});

// ===== ホイール: ズーム・パン =====
const MIN_SCALE = 0.1, MAX_SCALE = 5;

svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.ctrlKey) {
        const zf = e.deltaY < 0 ? 1.08 : 1 / 1.08;
        const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, viewScale * zf));
        const r  = svg.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        viewX = mx - (mx - viewX) * (ns / viewScale);
        viewY = my - (my - viewY) * (ns / viewScale);
        viewScale = ns;
        applyTransform();
        if (resizeHandleGroup && selectedNode) showResizeHandles(selectedNode);
    } else {
        viewX -= e.deltaX;
        viewY -= e.deltaY;
        applyTransform();
    }
}, { passive: false });

// ===== ツールバー: エッジ設定 =====
function setGroupActive(attr, val) {
    document.querySelectorAll(`[data-${attr}]`).forEach(b => {
        b.classList.toggle("active", b.dataset[attr] === val);
    });
}

document.querySelectorAll("[data-estyle]").forEach(b => {
    b.addEventListener("click", () => {
        globalEdgeStyle = b.dataset.estyle;
        setGroupActive("estyle", globalEdgeStyle);
        if (selectedEdge) {
            hideCPDot(selectedEdge);
            selectedEdge.style = globalEdgeStyle;
            updateEdgePath(selectedEdge);
            if (globalEdgeStyle === "bezier" || globalEdgeStyle === "orthogonal") showCPDot(selectedEdge);
        }
    });
});
document.querySelectorAll("[data-arrow]").forEach(b => {
    b.addEventListener("click", () => {
        globalArrow = b.dataset.arrow;
        setGroupActive("arrow", globalArrow);
        if (selectedEdge) { selectedEdge.arrow = globalArrow; applyEdgeStyle(selectedEdge); }
    });
});
document.querySelectorAll("[data-dash]").forEach(b => {
    b.addEventListener("click", () => {
        globalDash = b.dataset.dash;
        setGroupActive("dash", globalDash);
        if (selectedEdge) { selectedEdge.dash = globalDash; applyEdgeStyle(selectedEdge); }
    });
});
document.getElementById("edge-color").addEventListener("input", (e) => {
    globalColor = e.target.value;
    if (selectedEdge) { selectedEdge.color = globalColor; applyEdgeStyle(selectedEdge); }
});
const edgeWidthSlider = document.getElementById("edge-width");
const edgeWidthValue  = document.getElementById("edge-width-value");
edgeWidthSlider.addEventListener("input", () => {
    globalWidth = parseFloat(edgeWidthSlider.value);
    edgeWidthValue.textContent = globalWidth;
    if (selectedEdge) { selectedEdge.width = globalWidth; applyEdgeStyle(selectedEdge); }
});

// ===== SVG defs (マーカー・グロー) =====
const svgDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
svg.appendChild(svgDefs);

// グロー用フィルター（filterRegionを広げて直線でも切れないようにする）
const glowFilter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
glowFilter.setAttribute("id", "sel-glow");
glowFilter.setAttribute("filterUnits", "userSpaceOnUse");
glowFilter.setAttribute("x", "-50%");
glowFilter.setAttribute("y", "-50%");
glowFilter.setAttribute("width", "200%");
glowFilter.setAttribute("height", "200%");
const feDs = document.createElementNS("http://www.w3.org/2000/svg", "feDropShadow");
feDs.setAttribute("dx", "0"); feDs.setAttribute("dy", "0");
feDs.setAttribute("stdDeviation", "4");
feDs.setAttribute("flood-color", "#1976D2");
feDs.setAttribute("flood-opacity", "1");
glowFilter.appendChild(feDs);
svgDefs.appendChild(glowFilter);

function getOrCreateMarkerEnd(color) {
    const cid = color.replace("#", "");
    const id  = `me-${cid}`;
    if (!svgDefs.querySelector(`#${id}`)) {
        const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        m.setAttribute("id", id);
        m.setAttribute("markerWidth", "10"); m.setAttribute("markerHeight", "7");
        m.setAttribute("refX", "9");         m.setAttribute("refY", "3.5");
        m.setAttribute("orient", "auto");
        const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        p.setAttribute("points", "0 0, 10 3.5, 0 7");
        p.setAttribute("fill", color);
        m.appendChild(p); svgDefs.appendChild(m);
    }
    return id;
}

function getOrCreateMarkerStart(color) {
    const cid = color.replace("#", "");
    const id  = `ms-${cid}`;
    if (!svgDefs.querySelector(`#${id}`)) {
        const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        m.setAttribute("id", id);
        m.setAttribute("markerWidth", "10"); m.setAttribute("markerHeight", "7");
        m.setAttribute("refX", "1");         m.setAttribute("refY", "3.5");
        m.setAttribute("orient", "auto");
        const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        p.setAttribute("points", "10 0, 0 3.5, 10 7");
        p.setAttribute("fill", color);
        m.appendChild(p); svgDefs.appendChild(m);
    }
    return id;
}

// ===== エッジスタイル適用 =====
function applyEdgeStyle(edge) {
    const el   = edge.pathEl;
    const col  = edge.color || "#333333";
    const w    = edge.width || 2;
    const arr  = edge.arrow || "end";
    const dash = edge.dash  || "solid";

    // 選択中のエッジはハイライト色・太さを維持する
    const isSelected = (edge === selectedEdge);
    el.setAttribute("stroke",       isSelected ? "#1976D2" : col);
    el.setAttribute("stroke-width", isSelected ? Math.max(w, 2) + 2 : w);
    el.setAttribute("fill",         "none");
    if (isSelected) el.setAttribute("filter", "url(#sel-glow)");
    else            el.removeAttribute("filter");

    if      (dash === "dashed") el.setAttribute("stroke-dasharray", `${w*4},${w*3}`);
    else if (dash === "dotted") el.setAttribute("stroke-dasharray", `${w},${w*2}`);
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

// ===== パス計算 =====
function getNodeCenter(n) { return { x: n.x + n.w / 2, y: n.y + n.h / 2 }; }

function getEdgePoint(n, tx, ty) {
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
    const a = edge.a, b = edge.b;
    const ac = getNodeCenter(a), bc = getNodeCenter(b);
    const style = edge.style || "straight";

    const p1 = getEdgePoint(a, bc.x, bc.y);
    const p2 = getEdgePoint(b, ac.x, ac.y);

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

// ===== ベジェ/折れ線 制御点ドラッグ =====
let bezierDragging = false;
let bezierEdge     = null;
let bezierStartMX, bezierStartMY, bezierStartCPX, bezierStartCPY;

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
        bezierDragging  = true;
        bezierEdge      = edge;
        bezierStartMX   = e.clientX;
        bezierStartMY   = e.clientY;
        bezierStartCPX  = edge.cpOffX || 0;
        bezierStartCPY  = edge.cpOffY || 0;
    });
}

function updateCPDot(edge) {
    if (!edge.cpDotEl) return;
    const ac = getNodeCenter(edge.a), bc = getNodeCenter(edge.b);
    const p1 = getEdgePoint(edge.a, bc.x, bc.y);
    const p2 = getEdgePoint(edge.b, ac.x, ac.y);
    const mx = (p1.x + p2.x) / 2 + (edge.cpOffX || 0);
    const my = (p1.y + p2.y) / 2 + (edge.cpOffY || 0);
    edge.cpDotEl.setAttribute("cx", mx);
    edge.cpDotEl.setAttribute("cy", my);
    edge.cpDotEl.setAttribute("r",            6 / viewScale);
    edge.cpDotEl.setAttribute("stroke-width", 1.5 / viewScale);
}

function hideCPDot(edge) {
    if (edge && edge.cpDotEl) { edge.cpDotEl.remove(); edge.cpDotEl = null; }
}

function updateBezierHandle(e) {
    if (!bezierDragging || !bezierEdge) return;
    bezierEdge.cpOffX = bezierStartCPX + (e.clientX - bezierStartMX) / viewScale;
    bezierEdge.cpOffY = bezierStartCPY + (e.clientY - bezierStartMY) / viewScale;
    updateEdgePath(bezierEdge);
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

function selectEdge(edge) {
    // 前のエッジ選択を解除
    if (selectedEdge && selectedEdge !== edge) {
        highlightEdge(selectedEdge, false);
        hideCPDot(selectedEdge);
    }
    // ノード選択をクリア（エッジ選択は上書きするのでclearSelectionは使わない）
    if (selectedNode) { highlight(selectedNode, false); selectedNode = null; }
    selectedNodes.forEach(n => highlightMulti(n, false));
    selectedNodes.clear();
    hideResizeHandles();

    selectedEdge = edge;
    highlightEdge(edge, true);
    if (edge.style === "bezier" || edge.style === "orthogonal") showCPDot(edge);
    const panel = document.getElementById("edge-panel");
    if (panel) {
        panel.classList.add("visible");
        document.getElementById("ep-color").value = edge.color || "#333333";
    }
}

// ===== エッジパネル操作 =====
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
        edges.splice(idx, 1);
        selectedEdge = null;
        document.getElementById("edge-panel").classList.remove("visible");
    }
});

// ===== ノード追加ボタン =====
document.querySelectorAll("button[data-shape]").forEach(btn => {
    btn.addEventListener("click", () => {
        const shape = btn.dataset.shape;
        if (shape === "save") { saveFlowchart(); return; }
        if (shape === "load") { document.getElementById("load-input").click(); return; }

        const svgRect = svg.getBoundingClientRect();
        const centerX = (svgRect.width  / 2 - viewX) / viewScale;
        const centerY = (svgRect.height / 2 - viewY) / viewScale;

        const node = {
            id: nodeId++,
            x: centerX - 60 + (nodeId % 5) * 10,
            y: centerY - 30 + (nodeId % 5) * 10,
            w: shape === "diamond" ? 140 : 120,
            h: 60,
            label: `Node ${nodeId}`,
            fontsize: 14,
            shape,
            el: null,
            textEl: null
        };
        nodes.push(node);
        drawNode(node);
    });
});

// ===== ファイル読み込み =====
document.getElementById("load-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try { loadFlowchart(JSON.parse(ev.target.result)); }
        catch { alert("JSONの読み込みに失敗しました。"); }
    };
    reader.readAsText(file);
    e.target.value = "";
});

// ===== 保存 =====
function saveFlowchart() {
    const data = {
        nodeId,
        nodes: nodes.map(n => ({
            id: n.id, x: n.x, y: n.y, w: n.w, h: n.h,
            label: n.label, fontsize: n.fontsize ?? 14, shape: n.shape
        })),
        edges: edges.map(e => ({
            aId: e.a.id, bId: e.b.id,
            style:  e.style,
            arrow:  e.arrow,
            dash:   e.dash,
            color:  e.color,
            width:  e.width,
            cpOffX: e.cpOffX || 0,
            cpOffY: e.cpOffY || 0
        })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "flowchart.json"; a.click();
    URL.revokeObjectURL(url);
}

// ===== 読み込み =====
function loadFlowchart(jsonData) {
    nodes.forEach(n => { n.el.remove(); n.textEl.remove(); });
    edges.forEach(e => { e.pathEl.remove(); e.hitEl.remove(); hideCPDot(e); });
    nodes = []; edges = [];
    clearSelection();
    nodeId = jsonData.nodeId ?? 0;

    jsonData.nodes.forEach(nd => {
        const node = {
            id: nd.id, x: nd.x, y: nd.y, w: nd.w, h: nd.h,
            label: nd.label, fontsize: nd.fontsize ?? 14, shape: nd.shape,
            el: null, textEl: null
        };
        nodes.push(node);
        drawNode(node);
    });

    jsonData.edges.forEach(ed => {
        const a = nodes.find(n => n.id === ed.aId);
        const b = nodes.find(n => n.id === ed.bId);
        if (!a || !b) return;
        createEdge(a, b, {
            style:  ed.style  || "straight",
            arrow:  ed.arrow  || "end",
            dash:   ed.dash   || "solid",
            color:  ed.color  || "#333333",
            width:  ed.width  || 2,
            cpOffX: ed.cpOffX || 0,
            cpOffY: ed.cpOffY || 0
        });
    });
}

// ===== エッジ生成 =====
function createEdge(a, b, opts = {}) {
    // 描画パス
    const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    // ヒット領域（太い透明パス）
    const hitEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hitEl.setAttribute("stroke",         "rgba(0,0,0,0)");
    hitEl.setAttribute("stroke-width",   "12");
    hitEl.setAttribute("fill",           "none");
    hitEl.setAttribute("pointer-events", "stroke");
    hitEl.style.cursor = "pointer";

    edgeGroup.appendChild(pathEl);
    edgeGroup.appendChild(hitEl);

    const edge = {
        a, b, pathEl, hitEl,
        style:   opts.style  ?? globalEdgeStyle,
        arrow:   opts.arrow  ?? globalArrow,
        dash:    opts.dash   ?? globalDash,
        color:   opts.color  ?? globalColor,
        width:   opts.width  ?? globalWidth,
        cpOffX:  opts.cpOffX ?? 0,
        cpOffY:  opts.cpOffY ?? 0,
        cpDotEl: null,
    };
    edges.push(edge);
    applyEdgeStyle(edge);
    updateEdgePath(edge);

    hitEl.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isPanning || isSelecting) return;
        if (selectedEdge === edge) return; // 同じエッジを再クリックしても何もしない
        selectEdge(edge);
    });

    return edge;
}

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

// ===== ノード削除 =====
function deleteNode(node) {
    edges = edges.filter(e => {
        if (e.a === node || e.b === node) {
            e.pathEl.remove(); e.hitEl.remove(); hideCPDot(e); return false;
        }
        return true;
    });
    node.el.remove(); node.textEl.remove();
    nodes = nodes.filter(n => n !== node);
}

window.addEventListener("keydown", (e) => {
    if (document.getElementById("node-input")) return;
    if (e.key === "Backspace") {
        if (selectedEdge) {
            document.getElementById("ep-delete").click();
            return;
        }
        if (selectedNodes.size > 0) {
            selectedNodes.forEach(n => deleteNode(n));
            selectedNodes.clear(); selectedNode = null; hideResizeHandles();
        } else if (selectedNode) {
            deleteNode(selectedNode); selectedNode = null; hideResizeHandles();
        }
    }
});

// ===== ノード描画 =====
function drawNode(node) {
    const shapeEl = createShapeEl(node);
    node.el = shapeEl;
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("text-anchor",      "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("fill",             "white");
    text.setAttribute("font-size",        node.fontsize ?? 14);
    text.setAttribute("pointer-events",   "none");
    text.textContent = node.label;
    node.textEl = text;

    updateNodePosition(node);
    enableDrag(shapeEl, node);
    enableConnect(shapeEl, node);
    enableEdit(shapeEl, node);
    nodeGroup.appendChild(shapeEl);
    nodeGroup.appendChild(text);
}

function createShapeEl(node) {
    const { shape, w, h } = node;
    if (shape === "rounded") {
        const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        r.setAttribute("width", w); r.setAttribute("height", h);
        r.setAttribute("rx", h/2); r.setAttribute("ry", h/2);
        r.setAttribute("fill", "#4CAF50"); return r;
    }
    if (shape === "diamond") {
        const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        p.setAttribute("fill", "#FF9800"); p._isDiamond = true; return p;
    }
    if (shape === "parallelogram") {
        const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        p.setAttribute("fill", "#9C27B0"); p._isParallelogram = true; return p;
    }
    if (shape === "cylinder") {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const rx = w/2, ry = 10;
        const body = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        body.setAttribute("x", 0); body.setAttribute("y", ry);
        body.setAttribute("width", w); body.setAttribute("height", h - ry*2);
        body.setAttribute("fill", "#F44336");
        const btm = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        btm.setAttribute("cx", rx); btm.setAttribute("cy", h-ry);
        btm.setAttribute("rx", rx); btm.setAttribute("ry", ry);
        btm.setAttribute("fill", "#E57373");
        const top = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        top.setAttribute("cx", rx); top.setAttribute("cy", ry);
        top.setAttribute("rx", rx); top.setAttribute("ry", ry);
        top.setAttribute("fill", "#EF9A9A");
        g.appendChild(body); g.appendChild(btm); g.appendChild(top);
        g._isCylinder = true; return g;
    }
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("width", w); r.setAttribute("height", h);
    r.setAttribute("fill", "#2196F3"); return r;
}

function updateNodePosition(node) {
    const el = node.el;
    const { x, y, w, h } = node;

    if (el._isDiamond) {
        const cx = x + w/2, cy = y + h/2;
        el.setAttribute("points", `${cx},${y} ${x+w},${cy} ${cx},${y+h} ${x},${cy}`);
    } else if (el._isParallelogram) {
        const sk = 15;
        el.setAttribute("points", `${x+sk},${y} ${x+w},${y} ${x+w-sk},${y+h} ${x},${y+h}`);
    } else if (el._isCylinder) {
        el.setAttribute("transform", `translate(${x},${y})`);
        const rx = w/2, ry = 10;
        const body = el.querySelector("rect");
        const [btm, top] = el.querySelectorAll("ellipse");
        body.setAttribute("x", 0); body.setAttribute("y", ry);
        body.setAttribute("width", w); body.setAttribute("height", Math.max(0, h - ry*2));
        btm.setAttribute("cx", rx); btm.setAttribute("cy", h-ry);
        btm.setAttribute("rx", rx); btm.setAttribute("ry", ry);
        top.setAttribute("cx", rx); top.setAttribute("cy", ry);
        top.setAttribute("rx", rx); top.setAttribute("ry", ry);
    } else {
        el.setAttribute("x", x); el.setAttribute("y", y);
        el.setAttribute("width", w); el.setAttribute("height", h);
        if (node.shape === "rounded") { el.setAttribute("rx", h/2); el.setAttribute("ry", h/2); }
    }

    if (node.textEl) {
        node.textEl.setAttribute("x", x + w/2);
        node.textEl.setAttribute("y", y + h/2);
    }
    updateEdges();
    if (resizeHandleGroup && resizingNode === node) updateResizeHandles(node);
}

// ===== リサイズハンドル =====
const HANDLE_SIZE = 8;
const DIRS = ["nw","n","ne","e","se","s","sw","w"];

function getHandlePositions(node) {
    const { x, y, w, h } = node;
    return {
        nw: [x,     y    ], n:  [x+w/2, y    ], ne: [x+w,   y    ],
        e:  [x+w,   y+h/2],                      se: [x+w,   y+h  ],
        s:  [x+w/2, y+h  ], sw: [x,     y+h  ], w:  [x,     y+h/2],
    };
}

function showResizeHandles(node) {
    hideResizeHandles();
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    resizeHandleGroup = g;
    DIRS.forEach(dir => {
        const hs = HANDLE_SIZE / viewScale;
        const r  = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        r.setAttribute("width",        hs);
        r.setAttribute("height",       hs);
        r.setAttribute("fill",         "#fff");
        r.setAttribute("stroke",       "#e91e63");
        r.setAttribute("stroke-width", `${1.5 / viewScale}`);
        r.setAttribute("rx",           `${2   / viewScale}`);
        r.style.cursor = getCursorForDir(dir);
        r.addEventListener("mousedown", (e) => { e.stopPropagation(); startResize(node, dir, e); });
        g._handles = g._handles || {};
        g._handles[dir] = r;
        g.appendChild(r);
    });
    nodeGroup.appendChild(g);
    updateResizeHandles(node);
}

function updateResizeHandles(node) {
    if (!resizeHandleGroup) return;
    const pos = getHandlePositions(node);
    const hs  = HANDLE_SIZE / viewScale;
    DIRS.forEach(dir => {
        const r = resizeHandleGroup._handles[dir];
        const [hx, hy] = pos[dir];
        r.setAttribute("x",            hx - hs/2);
        r.setAttribute("y",            hy - hs/2);
        r.setAttribute("width",        hs);
        r.setAttribute("height",       hs);
        r.setAttribute("stroke-width", `${1.5 / viewScale}`);
    });
}

function hideResizeHandles() {
    if (resizeHandleGroup) { resizeHandleGroup.remove(); resizeHandleGroup = null; }
}

function getCursorForDir(dir) {
    return { nw:"nw-resize",n:"n-resize",ne:"ne-resize",e:"e-resize",
             se:"se-resize",s:"s-resize",sw:"sw-resize",w:"w-resize" }[dir];
}

const MIN_W = 40, MIN_H = 30;

function startResize(node, dir, e) {
    resizingNode = node; resizeDir = dir;
    resizeStart  = { mx: e.clientX, my: e.clientY, x: node.x, y: node.y, w: node.w, h: node.h };
}

window.addEventListener("mousemove", (e) => {
    if (!resizingNode) return;
    const dx = (e.clientX - resizeStart.mx) / viewScale;
    const dy = (e.clientY - resizeStart.my) / viewScale;
    const s = resizeStart, node = resizingNode;
    let nx = s.x, ny = s.y, nw = s.w, nh = s.h;
    if (resizeDir.includes("e")) nw = Math.max(MIN_W, s.w + dx);
    if (resizeDir.includes("w")) { nw = Math.max(MIN_W, s.w - dx); nx = s.x + s.w - nw; }
    if (resizeDir.includes("s")) nh = Math.max(MIN_H, s.h + dy);
    if (resizeDir.includes("n")) { nh = Math.max(MIN_H, s.h - dy); ny = s.y + s.h - nh; }
    node.x = nx; node.y = ny; node.w = nw; node.h = nh;
    updateNodePosition(node);
    updateResizeHandles(node);
});

window.addEventListener("mouseup", () => {
    if (resizingNode) { resizingNode = null; resizeDir = null; resizeStart = null; }
});

// ===== 接続処理 =====
function enableConnect(el, node) {
    el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isPanning || isSelecting) return;

        // エッジ選択を解除
        if (selectedEdge) {
            highlightEdge(selectedEdge, false);
            hideCPDot(selectedEdge);
            selectedEdge = null;
            document.getElementById("edge-panel").classList.remove("visible");
        }

        // 複数選択中はトグル
        if (selectedNodes.size > 0) {
            if (selectedNodes.has(node)) { highlightMulti(node, false); selectedNodes.delete(node); }
            else                         { selectedNodes.add(node);     highlightMulti(node, true);  }
            return;
        }

        // 単一選択（接続）
        if (!selectedNode) {
            selectedNode = node;
            highlight(node, true);
            showResizeHandles(node);
            const size = node.fontsize ?? 14;
            fontSizeSlider.value      = size;
            fontSizeValue.textContent = size;
        } else {
            if (selectedNode !== node) toggleConnection(selectedNode, node);
            highlight(selectedNode, false);
            hideResizeHandles();
            selectedNode = null;
        }
    });
}

svg.addEventListener("click", (e) => {
    if (isPanning || isSelecting || _justFinishedSelecting) return;
    const t = e.target;
    if (t === svg || t === mainGroup || t === edgeGroup || t === nodeGroup ||
        t === gridGroup || t.closest?.("#grid-group")) {
        clearSelection();
    }
});

// ===== ハイライト =====
function highlight(node, on) {
    const el = node.el;
    if (el._isCylinder) {
        el.querySelectorAll("rect,ellipse").forEach(c => {
            c.setAttribute("stroke",       on ? "red" : "none");
            c.setAttribute("stroke-width", on ? "3"   : "0");
        });
    } else {
        el.setAttribute("stroke",       on ? "red" : "none");
        el.setAttribute("stroke-width", on ? "3"   : "0");
    }
}

function highlightMulti(node, on) { highlight(node, on); }

// ===== ドラッグ（複数選択対応）=====
const SNAP_THRESHOLD = 10;
const EDGE_MARGIN = 60, EDGE_SPEED = 8;
let edgeScrollRAF = null, edgeScrollDX = 0, edgeScrollDY = 0, anyDragging = false;

function startEdgeScroll() {
    if (edgeScrollRAF) return;
    function tick() {
        if (!anyDragging || (edgeScrollDX === 0 && edgeScrollDY === 0)) {
            edgeScrollRAF = null; return;
        }
        viewX += edgeScrollDX; viewY += edgeScrollDY;
        applyTransform();
        edgeScrollRAF = requestAnimationFrame(tick);
    }
    edgeScrollRAF = requestAnimationFrame(tick);
}

function updateEdgeScroll(clientX, clientY) {
    const r = svg.getBoundingClientRect();
    const rx = clientX - r.left, ry = clientY - r.top;
    const W = r.width, H = r.height;
    edgeScrollDX = 0; edgeScrollDY = 0;
    if (rx < EDGE_MARGIN)        edgeScrollDX =  EDGE_SPEED * (1 - rx / EDGE_MARGIN);
    else if (rx > W - EDGE_MARGIN) edgeScrollDX = -EDGE_SPEED * (1 - (W - rx) / EDGE_MARGIN);
    if (ry < EDGE_MARGIN)        edgeScrollDY =  EDGE_SPEED * (1 - ry / EDGE_MARGIN);
    else if (ry > H - EDGE_MARGIN) edgeScrollDY = -EDGE_SPEED * (1 - (H - ry) / EDGE_MARGIN);
    if (edgeScrollDX !== 0 || edgeScrollDY !== 0) startEdgeScroll();
}

function stopEdgeScroll() {
    edgeScrollDX = 0; edgeScrollDY = 0;
    if (edgeScrollRAF) { cancelAnimationFrame(edgeScrollRAF); edgeScrollRAF = null; }
}

function enableDrag(el, node) {
    let dragging = false, ox, oy, groupOffsets = [];

    el.addEventListener("mousedown", (e) => {
        if (resizingNode || isPanning || spaceDown || e.button !== 0) return;
        dragging    = true;
        anyDragging = true;
        const lp = screenToLogical(e.clientX, e.clientY);
        ox = lp.x - node.x;
        oy = lp.y - node.y;
        if (selectedNodes.size > 0 && selectedNodes.has(node)) {
            groupOffsets = Array.from(selectedNodes).map(n => ({
                node: n, dx: n.x - node.x, dy: n.y - node.y,
            }));
        } else {
            groupOffsets = [];
        }
        e.stopPropagation();
    });

    window.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        updateEdgeScroll(e.clientX, e.clientY);
        const lp   = screenToLogical(e.clientX, e.clientY);
        const newX = lp.x - ox, newY = lp.y - oy;
        if (groupOffsets.length > 0) {
            groupOffsets.forEach(({ node: n, dx, dy }) => {
                n.x = newX + dx; n.y = newY + dy; updateNodePosition(n);
            });
        } else {
            node.x = newX; node.y = newY;
            nodes.forEach(other => {
                if (other === node) return;
                const ncx = node.x + node.w/2, ocx = other.x + other.w/2;
                if (Math.abs(ncx - ocx) < SNAP_THRESHOLD) node.x = ocx - node.w/2;
                const ncy = node.y + node.h/2, ocy = other.y + other.h/2;
                if (Math.abs(ncy - ocy) < SNAP_THRESHOLD) node.y = ocy - node.h/2;
                if (Math.abs(node.x - other.x)                          < SNAP_THRESHOLD) node.x = other.x;
                if (Math.abs((node.x + node.w) - (other.x + other.w))   < SNAP_THRESHOLD) node.x = other.x + other.w - node.w;
                if (Math.abs(node.y - other.y)                          < SNAP_THRESHOLD) node.y = other.y;
                if (Math.abs((node.y + node.h) - (other.y + other.h))   < SNAP_THRESHOLD) node.y = other.y + other.h - node.h;
            });
            updateNodePosition(node);
        }
    });

    window.addEventListener("mouseup", () => {
        if (dragging) { anyDragging = false; stopEdgeScroll(); }
        dragging = false; groupOffsets = [];
    });
}

// ===== ダブルクリック編集 =====
function enableEdit(el, node) {
    el.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        if (document.getElementById("node-input")) return;

        const svgRect = svg.getBoundingClientRect();
        const screenX = node.x * viewScale + viewX + svgRect.left;
        const screenY = node.y * viewScale + viewY + svgRect.top;
        const screenW = node.w * viewScale;
        const screenH = node.h * viewScale;

        const input = document.createElement("input");
        input.id = "node-input"; input.type = "text"; input.value = node.label;

        const shapeStyles = {
            rect:          { background: "#1976D2", borderRadius: "0",              clipPath: "" },
            rounded:       { background: "#388E3C", borderRadius: (screenH/2)+"px", clipPath: "" },
            diamond:       { background: "#F57C00", borderRadius: "0",              clipPath: "polygon(50% 0%,100% 50%,50% 100%,0% 50%)" },
            parallelogram: { background: "#7B1FA2", borderRadius: "0",              clipPath: "polygon(15px 0%,100% 0%,calc(100% - 15px) 100%,0% 100%)" },
            cylinder:      { background: "#C62828", borderRadius: "50%/10px",       clipPath: "" },
        };
        const ss = shapeStyles[node.shape] || shapeStyles.rect;
        Object.assign(input.style, {
            position: "absolute", left: screenX+"px", top: screenY+"px",
            width: screenW+"px",  height: screenH+"px",
            fontSize: (node.fontsize * viewScale)+"px",
            textAlign: "center", border: "2px solid red",
            borderRadius: ss.borderRadius, background: ss.background, clipPath: ss.clipPath,
            color: "white", outline: "none", boxSizing: "border-box",
            lineHeight: screenH+"px", padding: "0", zIndex: "1000",
        });

        document.body.appendChild(input);
        input.focus(); input.select();

        function commit() {
            const v = input.value.trim();
            node.label = v || node.label;
            node.textEl.textContent = node.label;
            input.remove();
        }
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter")  commit();
            if (e.key === "Escape") input.remove();
        });
        input.addEventListener("blur", commit);
    });
}

// ===== 文字サイズ変更 =====
const fontSizeSlider = document.getElementById("font-size-slider");
const fontSizeValue  = document.getElementById("font-size-value");

fontSizeSlider.addEventListener("input", () => {
    const size = fontSizeSlider.value;
    fontSizeValue.textContent = size;
    if (selectedNode) {
        selectedNode.fontsize = parseInt(size);
        selectedNode.textEl.setAttribute("font-size", size);
    }
});