// ===== ノード管理 =====
// ノードの描画・形状生成・位置更新・ドラッグ・ダブルクリック編集・
// リサイズハンドル・ハイライト・削除を担当します。

// ===== ノード描画エントリポイント =====
function drawNode(node) {
    const shapeEl = createShapeEl(node);
    node.el = shapeEl;

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("text-anchor",       "middle");
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

// ===== 形状SVG要素の生成 =====
function createShapeEl(node) {
    const { shape, w, h } = node;

    if (shape === "rounded") {
        const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        r.setAttribute("width", w); r.setAttribute("height", h);
        r.setAttribute("rx", h / 2); r.setAttribute("ry", h / 2);
        r.setAttribute("fill", "#4CAF50");
        return r;
    }
    if (shape === "diamond") {
        const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        p.setAttribute("fill", "#FF9800");
        p._isDiamond = true;
        return p;
    }
    if (shape === "parallelogram") {
        const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        p.setAttribute("fill", "#9C27B0");
        p._isParallelogram = true;
        return p;
    }
    if (shape === "cylinder") {
        const g  = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const rx = w / 2, ry = 10;
        const body = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        body.setAttribute("x", 0); body.setAttribute("y", ry);
        body.setAttribute("width", w); body.setAttribute("height", h - ry * 2);
        body.setAttribute("fill", "#F44336");
        const btm = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        btm.setAttribute("cx", rx); btm.setAttribute("cy", h - ry);
        btm.setAttribute("rx", rx); btm.setAttribute("ry", ry);
        btm.setAttribute("fill", "#E57373");
        const top = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        top.setAttribute("cx", rx); top.setAttribute("cy", ry);
        top.setAttribute("rx", rx); top.setAttribute("ry", ry);
        top.setAttribute("fill", "#EF9A9A");
        g.appendChild(body); g.appendChild(btm); g.appendChild(top);
        g._isCylinder = true;
        return g;
    }
    // デフォルト：処理（矩形）
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("width", w); r.setAttribute("height", h);
    r.setAttribute("fill", "#2196F3");
    return r;
}

// ===== ノード位置・サイズの更新 =====
function updateNodePosition(node) {
    const el = node.el;
    const { x, y, w, h } = node;

    if (el._isDiamond) {
        const cx = x + w / 2, cy = y + h / 2;
        el.setAttribute("points", `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`);
    } else if (el._isParallelogram) {
        const sk = 15;
        el.setAttribute("points", `${x + sk},${y} ${x + w},${y} ${x + w - sk},${y + h} ${x},${y + h}`);
    } else if (el._isCylinder) {
        el.setAttribute("transform", `translate(${x},${y})`);
        const rx   = w / 2, ry = 10;
        const body = el.querySelector("rect");
        const [btm, top] = el.querySelectorAll("ellipse");
        body.setAttribute("x", 0); body.setAttribute("y", ry);
        body.setAttribute("width", w); body.setAttribute("height", Math.max(0, h - ry * 2));
        btm.setAttribute("cx", rx); btm.setAttribute("cy", h - ry);
        btm.setAttribute("rx", rx); btm.setAttribute("ry", ry);
        top.setAttribute("cx", rx); top.setAttribute("cy", ry);
        top.setAttribute("rx", rx); top.setAttribute("ry", ry);
    } else {
        el.setAttribute("x", x); el.setAttribute("y", y);
        el.setAttribute("width", w); el.setAttribute("height", h);
        if (node.shape === "rounded") {
            el.setAttribute("rx", h / 2); el.setAttribute("ry", h / 2);
        }
    }

    if (node.textEl) {
        node.textEl.setAttribute("x", x + w / 2);
        node.textEl.setAttribute("y", y + h / 2);
    }
    updateEdges();
    if (resizeHandleGroup && resizingNode === node) updateResizeHandles(node);
}

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

// ===== ドラッグ（複数選択対応）=====
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
    const r  = svg.getBoundingClientRect();
    const rx = clientX - r.left, ry = clientY - r.top;
    const W  = r.width, H = r.height;
    edgeScrollDX = 0; edgeScrollDY = 0;
    if (rx < EDGE_MARGIN)          edgeScrollDX =  EDGE_SPEED * (1 - rx / EDGE_MARGIN);
    else if (rx > W - EDGE_MARGIN) edgeScrollDX = -EDGE_SPEED * (1 - (W - rx) / EDGE_MARGIN);
    if (ry < EDGE_MARGIN)          edgeScrollDY =  EDGE_SPEED * (1 - ry / EDGE_MARGIN);
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
        const lp    = screenToLogical(e.clientX, e.clientY);
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
                n.x = newX + dx; n.y = newY + dy;
                updateNodePosition(n);
            });
        } else {
            node.x = newX; node.y = newY;
            // スナップ
            nodes.forEach(other => {
                if (other === node) return;
                const ncx = node.x + node.w / 2, ocx = other.x + other.w / 2;
                if (Math.abs(ncx - ocx) < SNAP_THRESHOLD) node.x = ocx - node.w / 2;
                const ncy = node.y + node.h / 2, ocy = other.y + other.h / 2;
                if (Math.abs(ncy - ocy) < SNAP_THRESHOLD) node.y = ocy - node.h / 2;
                if (Math.abs(node.x - other.x)                        < SNAP_THRESHOLD) node.x = other.x;
                if (Math.abs((node.x + node.w) - (other.x + other.w)) < SNAP_THRESHOLD) node.x = other.x + other.w - node.w;
                if (Math.abs(node.y - other.y)                        < SNAP_THRESHOLD) node.y = other.y;
                if (Math.abs((node.y + node.h) - (other.y + other.h)) < SNAP_THRESHOLD) node.y = other.y + other.h - node.h;
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

        const input    = document.createElement("input");
        input.id       = "node-input";
        input.type     = "text";
        input.value    = node.label;

        // 形状ごとのスタイル
        const shapeStyles = {
            rect:          { background: "#1976D2", borderRadius: "0",               clipPath: "" },
            rounded:       { background: "#388E3C", borderRadius: (screenH / 2) + "px", clipPath: "" },
            diamond:       { background: "#F57C00", borderRadius: "0",               clipPath: "polygon(50% 0%,100% 50%,50% 100%,0% 50%)" },
            parallelogram: { background: "#7B1FA2", borderRadius: "0",               clipPath: "polygon(15px 0%,100% 0%,calc(100% - 15px) 100%,0% 100%)" },
            cylinder:      { background: "#C62828", borderRadius: "50%/10px",        clipPath: "" },
        };
        const ss = shapeStyles[node.shape] || shapeStyles.rect;
        Object.assign(input.style, {
            position: "absolute", left: screenX + "px", top: screenY + "px",
            width:  screenW + "px", height: screenH + "px",
            fontSize:     (node.fontsize * viewScale) + "px",
            textAlign:    "center", border: "2px solid red",
            borderRadius: ss.borderRadius, background: ss.background, clipPath: ss.clipPath,
            color:        "white", outline: "none", boxSizing: "border-box",
            lineHeight:   screenH + "px", padding: "0", zIndex: "1000",
        });

        document.body.appendChild(input);
        input.focus(); input.select();

        function commit() {
            const v   = input.value.trim();
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

// ===== ノード削除 =====
function deleteNode(node) {
    edges = edges.filter(e => {
        if (e.a === node || e.b === node) {
            e.pathEl.remove(); e.hitEl.remove(); hideCPDot(e);
            return false;
        }
        return true;
    });
    node.el.remove(); node.textEl.remove();
    nodes = nodes.filter(n => n !== node);
}

// ===== キーボード削除 =====
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

// ===== リサイズハンドル =====
const HANDLE_SIZE = 8;
const DIRS        = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function getHandlePositions(node) {
    const { x, y, w, h } = node;
    return {
        nw: [x,       y      ], n:  [x + w / 2, y      ], ne: [x + w,   y      ],
        e:  [x + w,   y + h / 2],                           se: [x + w,   y + h  ],
        s:  [x + w / 2, y + h], sw: [x,         y + h  ], w:  [x,       y + h / 2],
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
        const r        = resizeHandleGroup._handles[dir];
        const [hx, hy] = pos[dir];
        r.setAttribute("x",            hx - hs / 2);
        r.setAttribute("y",            hy - hs / 2);
        r.setAttribute("width",        hs);
        r.setAttribute("height",       hs);
        r.setAttribute("stroke-width", `${1.5 / viewScale}`);
    });
}

function hideResizeHandles() {
    if (resizeHandleGroup) { resizeHandleGroup.remove(); resizeHandleGroup = null; }
}

function getCursorForDir(dir) {
    return {
        nw: "nw-resize", n: "n-resize",  ne: "ne-resize", e: "e-resize",
        se: "se-resize",  s: "s-resize",  sw: "sw-resize", w: "w-resize",
    }[dir];
}

function startResize(node, dir, e) {
    resizingNode = node; resizeDir = dir;
    resizeStart  = { mx: e.clientX, my: e.clientY, x: node.x, y: node.y, w: node.w, h: node.h };
}

window.addEventListener("mousemove", (e) => {
    if (!resizingNode) return;
    const dx = (e.clientX - resizeStart.mx) / viewScale;
    const dy = (e.clientY - resizeStart.my) / viewScale;
    const s  = resizeStart, node = resizingNode;
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

// ===== 接続（クリックで2ノード選択→エッジ生成）=====
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
            else                         { selectedNodes.add(node);     highlightMulti(node, true); }
            return;
        }

        // 単一選択（1つ目は選択、2つ目で接続）
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