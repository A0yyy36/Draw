const svg = document.getElementById("canvas");

let nodes = [];
let edges = [];
let nodeId = 0;
let selectedNode = null;

let resizeHandleGroup = null;
let resizingNode = null;
let resizeDir = null;
let resizeStart = null;

// ===== ノード追加 =====
document.querySelectorAll("button[data-shape]").forEach(btn => {
    btn.onclick = () => {
        const shape = btn.dataset.shape;
        const node = {
            id: nodeId++,
            x: 100 + nodeId * 20,
            y: 100 + nodeId * 20,
            w: shape === "diamond" ? 140 : 120, 
            h: 60,
            label: `Node ${nodeId}`,
            shape,
            el: null,
            textEl: null
        };
        nodes.push(node);
        drawNode(node);
    };
});

// ===== 矢印マーカー定義（初期化時に一度だけ実行）=====
function initArrowMarker() {
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    
    marker.setAttribute("id", "arrowhead");
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "7");
    marker.setAttribute("refX", "10");
    marker.setAttribute("refY", "3.5");
    marker.setAttribute("orient", "auto");
    
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", "0 0, 10 3.5, 0 7");
    polygon.setAttribute("fill", "#333");
    
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);
}

initArrowMarker(); // 呼び出し

// ===== ノード削除 =====
function deleteNode(node) {
    // 接続されているエッジを削除
    edges = edges.filter(e => {
        if (e.a === node || e.b === node) {
            e.line.remove();
            return false;
        }
        return true;
    });

    // SVG要素を削除
    node.el.remove();
    node.textEl.remove();

    // 配列から削除
    nodes = nodes.filter(n => n !== node);

    selectedNode = null;
}

// ===== Backspaceキーで選択中ノードを削除 =====
window.addEventListener("keydown", (e) => {
    // input編集中は無視
    if (document.getElementById("node-input")) return;

    if (e.key === "Backspace" && selectedNode) {
        deleteNode(selectedNode);
    }
});

// ===== ノード描画 =====
function drawNode(node){
    const shapeEl = createShapeEl(node);
    node.el = shapeEl;

    const text = document.createElementNS(
        "http://www.w3.org/2000/svg", 
        "text"
    );
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("fill", "white");
    text.setAttribute("font-size", "14");
    text.setAttribute("pointer-events", "none");
    text.textContent = node.label;
    node.textEl = text;

    updateNodePosition(node);
    enableDrag(shapeEl,node);
    enableConnect(shapeEl,node);
    enableEdit(shapeEl, node);
    
    svg.appendChild(shapeEl);
    svg.appendChild(text);
}

function createShapeEl(node) {
    const { shape, w, h } = node;

    if (shape === "rounded") {
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("width", w);
        rect.setAttribute("height", h);
        rect.setAttribute("rx", h / 2);
        rect.setAttribute("ry", h / 2);
        rect.setAttribute("fill", "#4CAF50");
        return rect;
    }

    if (shape === "diamond") {
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        poly.setAttribute("fill", "#FF9800");
        poly._isDiamond = true;
        return poly;
    }

    if (shape === "parallelogram") {
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        poly.setAttribute("fill", "#9C27B0");
        poly._isParallelogram = true;
        return poly;
    }

    if (shape === "cylinder") {
        const g   = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const rx  = w / 2;
        const ry  = 10;

        const body = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        body.setAttribute("x", 0);
        body.setAttribute("y", ry);          // 上楕円の分だけ下げる
        body.setAttribute("width", w);
        body.setAttribute("height", h - ry * 2);
        body.setAttribute("fill", "#F44336");

        // 下楕円（先に描いてbodyで隠す）
        const bottom = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        bottom.setAttribute("cx", rx);
        bottom.setAttribute("cy", h - ry);
        bottom.setAttribute("rx", rx);
        bottom.setAttribute("ry", ry);
        bottom.setAttribute("fill", "#E57373");

        // 上楕円（最前面）
        const top = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        top.setAttribute("cx", rx);
        top.setAttribute("cy", ry);
        top.setAttribute("rx", rx);
        top.setAttribute("ry", ry);
        top.setAttribute("fill", "#EF9A9A");

        g.appendChild(body);
        g.appendChild(bottom);
        g.appendChild(top);
        g._isCylinder = true;
        return g;
    }

    // デフォルト：rect（処理）
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", w);
    rect.setAttribute("height", h);
    rect.setAttribute("fill", "#2196F3");
    return rect;
}

// ===== ノード位置更新 =====
function updateNodePosition(node) {
    const el = node.el;
    const { x, y, w, h } = node;

    if (el._isDiamond) {
        const cx = x + w / 2, cy = y + h / 2;
        el.setAttribute("points",
            `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`
        );
    } else if (el._isParallelogram) {
        const skew = 15;
        el.setAttribute("points",
            `${x + skew},${y} ${x + w},${y} ${x + w - skew},${y + h} ${x},${y + h}`
        );
    } else if (el._isCylinder) {
        el.setAttribute("transform", `translate(${x}, ${y})`);
        const rx = w / 2;
        el.querySelector("rect").setAttribute("width", w);
        el.querySelectorAll("ellipse").forEach(e => {
            e.setAttribute("cx", rx);
            e.setAttribute("rx", rx);
        });
    } else {
        // rect・角丸rect
        el.setAttribute("x", x);
        el.setAttribute("y", y);
        el.setAttribute("width", w);
        el.setAttribute("height", h);
        if (node.shape === "rounded") {
            el.setAttribute("rx", h / 2);
            el.setAttribute("ry", h / 2);
        }
    }

    if (node.textEl) {
        node.textEl.setAttribute("x", x + w / 2);
        node.textEl.setAttribute("y", y + h / 2);
    }

    updateEdges();
    if (resizeHandleGroup && resizingNode === node) {
        updateResizeHandles(node);
    }
}

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
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("width",  HANDLE_SIZE);
        rect.setAttribute("height", HANDLE_SIZE);
        rect.setAttribute("fill",   "#fff");
        rect.setAttribute("stroke", "#e91e63");
        rect.setAttribute("stroke-width", "1.5");
        rect.setAttribute("rx", "2");
        rect.style.cursor = getCursorForDir(dir);

        rect.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            startResize(node, dir, e);
        });

        g._handles = g._handles || {};
        g._handles[dir] = rect;
        g.appendChild(rect);
    });

    svg.appendChild(g);
    updateResizeHandles(node);
}

function updateResizeHandles(node) {
    if (!resizeHandleGroup) return;
    const pos = getHandlePositions(node);
    DIRS.forEach(dir => {
        const rect = resizeHandleGroup._handles[dir];
        const [hx, hy] = pos[dir];
        rect.setAttribute("x", hx - HANDLE_SIZE / 2);
        rect.setAttribute("y", hy - HANDLE_SIZE / 2);
    });
}

function hideResizeHandles() {
    if (resizeHandleGroup) {
        resizeHandleGroup.remove();
        resizeHandleGroup = null;
    }
}

function getCursorForDir(dir) {
    const map = {
        nw: "nw-resize", n: "n-resize",  ne: "ne-resize",
        e:  "e-resize",  se: "se-resize", s:  "s-resize",
        sw: "sw-resize", w:  "w-resize"
    };
    return map[dir];
}

const MIN_W = 40, MIN_H = 30;

function startResize(node, dir, e) {
    resizingNode = node;
    resizeDir = dir;
    resizeStart = {
        mx: e.clientX, my: e.clientY,
        x: node.x, y: node.y,
        w: node.w, h: node.h
    };
}

window.addEventListener("mousemove", (e) => {
    if (!resizingNode) return;

    const dx = e.clientX - resizeStart.mx;
    const dy = e.clientY - resizeStart.my;
    const s = resizeStart;
    const node = resizingNode;

    let nx = s.x, ny = s.y, nw = s.w, nh = s.h;

    if (resizeDir.includes("e")) nw = Math.max(MIN_W, s.w + dx);
    if (resizeDir.includes("w")) { nw = Math.max(MIN_W, s.w - dx); nx = s.x + s.w - nw; }
    if (resizeDir.includes("s")) nh = Math.max(MIN_H, s.h + dy);
    if (resizeDir.includes("n")) { nh = Math.max(MIN_H, s.h - dy); ny = s.y + s.h - nh; }

    node.x = nx; node.y = ny;
    node.w = nw; node.h = nh;

    updateNodePosition(node);
    updateResizeHandles(node);
});

window.addEventListener("mouseup", () => {
    if (resizingNode) {
        resizingNode = null;
        resizeDir = null;
        resizeStart = null;
    }
});

// ===== 接続処理 =====
function enableConnect(el,node){
    el.addEventListener("click",(e)=>{
        e.stopPropagation();

        if (!selectedNode) {
            selectedNode = node;
            highlight(node, true);
            showResizeHandles(node);
        } 
        else {
            if (selectedNode !== node) {
                toggleConnection(selectedNode, node);
            }
            highlight(selectedNode, false);
            hideResizeHandles();
            selectedNode = null;
        }
    });
}

svg.addEventListener("click", (e) => {
    if (e.target === svg) {
        if (selectedNode) {
            highlight(selectedNode, false);
            selectedNode = null;
        }
        hideResizeHandles();
    }
});

// ===== ハイライト(red) =====
function highlight(node, on) {
    const el = node.el;

    if (el._isCylinder) {
        // g内のrect・ellipse全部にstrokeを適用
        el.querySelectorAll("rect, ellipse").forEach(child => {
            child.setAttribute("stroke", on ? "red" : "none");
            child.setAttribute("stroke-width", on ? "3" : "0");
        });
    } else {
        el.setAttribute("stroke", on ? "red" : "none");
        el.setAttribute("stroke-width", on ? "3" : "0");
    }
}

function toggleConnection(a, b) {

    // 既存エッジ検索（順不同対応）
    const existingIndex = edges.findIndex(e =>
        (e.a === a && e.b === b) ||
        (e.a === b && e.b === a)
    );

    // 既に存在 → 削除
    if (existingIndex !== -1) {
        const edge = edges[existingIndex];
        edge.line.remove(); // SVGから削除
        edges.splice(existingIndex, 1); // 配列から削除
        return;
    }

    // 存在しない → 追加
    const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
    );

    line.setAttribute("stroke", "#333");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("marker-end", "url(#arrowhead)");

    svg.prepend(line);

    edges.push({ a, b, line });
    updateEdges();
}

// ===== 線位置更新 =====
function updateEdges() {
    edges.forEach(e => {
        const ax = e.a.x + e.a.w / 2;
        const ay = e.a.y + e.a.h / 2;
        const bx = e.b.x + e.b.w / 2;
        const by = e.b.y + e.b.h / 2;

        // 中心間のベクトル
        const dx = bx - ax;
        const dy = by - ay;

        // ノードbの縁までの距離を計算（矩形との交差）
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const hw = e.b.w / 2; // 半幅
        const hh = e.b.h / 2; // 半高さ

        // 矩形の縁に当たるtを求める（直線をt=0:a中心, t=1:b中心 とパラメータ化）
        let t = 1;
        if (absDx > 0 || absDy > 0) {
            const tx = absDx > 0 ? hw / absDx : Infinity;
            const ty = absDy > 0 ? hh / absDy : Infinity;
            t = Math.min(tx, ty); // 先に縁に当たる方向を採用
        }

        // 矢印の先端（ノードbの縁）
        const endX = bx - dx * t;
        const endY = by - dy * t;

        e.line.setAttribute("x1", ax);
        e.line.setAttribute("y1", ay);
        e.line.setAttribute("x2", endX);
        e.line.setAttribute("y2", endY);
    });
}

// ===== ドラッグ =====
const SNAP_THRESHOLD = 5; // スナップ距離の閾値

function enableDrag(el,node){
    let dragging=false;
    let ox,oy;

    el.addEventListener("mousedown",(e)=>{
        if (resizingNode) return;
        dragging=true;
        ox=e.offsetX-node.x;
        oy=e.offsetY-node.y;
    });

    svg.addEventListener("mousemove", (e) => {
        if (!dragging) return;

        node.x = e.offsetX - ox;
        node.y = e.offsetY - oy;

        // ===== スナップ処理 =====
        nodes.forEach(other => {
            if (other === node) return;

            // 中心X同士を比較
            const nodeCx  = node.x  + node.w  / 2;
            const otherCx = other.x + other.w / 2;
            if (Math.abs(nodeCx - otherCx) < SNAP_THRESHOLD) {
                node.x = otherCx - node.w / 2;
            }

            // 中心Y同士を比較
            const nodeCy  = node.y  + node.h  / 2;
            const otherCy = other.y + other.h / 2;
            if (Math.abs(nodeCy - otherCy) < SNAP_THRESHOLD) {
                node.y = otherCy - node.h / 2;
            }

            // 左端同士
            if (Math.abs(node.x - other.x) < SNAP_THRESHOLD) {
                node.x = other.x;
            }

            // 右端同士
            if (Math.abs((node.x + node.w) - (other.x + other.w)) < SNAP_THRESHOLD) {
                node.x = other.x + other.w - node.w;
            }

            // 上端同士
            if (Math.abs(node.y - other.y) < SNAP_THRESHOLD) {
                node.y = other.y;
            }

            // 下端同士
            if (Math.abs((node.y + node.h) - (other.y + other.h)) < SNAP_THRESHOLD) {
                node.y = other.y + other.h - node.h;
            }
        });
        // ====================

        updateNodePosition(node);
    });

    window.addEventListener("mouseup", () => dragging = false);
}

function enableEdit(el, node) {
    el.addEventListener("dblclick", (e) => {
        e.stopPropagation();

        // 既存のinputがあれば無視
        if (document.getElementById("node-input")) return;

        // SVGのスクリーン座標を取得
        const svgRect = svg.getBoundingClientRect();

        // input要素をSVG上に重ねて配置
        const input = document.createElement("input");
        input.id = "node-input";
        input.type = "text";
        input.value = node.label;

        const shapeStyles = {
            rect: {
                background:   "#1976D2",
                borderRadius: "0",
                clipPath:     "",
                transform:    "",
            },
            rounded: {
                background:   "#388E3C",
                borderRadius: (node.h / 2) + "px",
                clipPath:     "",
                transform:    "",
            },
            diamond: {
                background:   "#F57C00",
                borderRadius: "0",
                clipPath:     "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                transform:    "",
            },
            parallelogram: {
                background:   "#7B1FA2",
                borderRadius: "0",
                clipPath:     "polygon(15px 0%, 100% 0%, calc(100% - 15px) 100%, 0% 100%)",
                transform:    "",
            },
            cylinder: {
                background:   "#C62828",
                borderRadius: "50% / 10px",
                clipPath:     "",
                transform:    "",
            },
        };

        const cx = svgRect.left + node.x + node.w / 2;
        const cy = svgRect.top  + node.y + node.h / 2;

        const ss = shapeStyles[node.shape] || shapeStyles.rect;

        // 矩形の位置・サイズに合わせてinputを配置
        Object.assign(input.style, {
            position:        "absolute",
            left:            (svgRect.left + node.x) + "px", 
            top:             (svgRect.top  + node.y) + "px", 
            width:           node.w + "px", 
            height:          node.h + "px", 
            fontSize:        "14px", 
            textAlign:       "center", 
            border:          "2px solid red",
            borderRadius:    ss.borderRadius,
            background:      ss.background,
            clipPath:        ss.clipPath,
            transform:       ss.transform,
            transformOrigin: "center center",
            color:           "white",
            outline:         "none",
            boxSizing:       "border-box",
            lineHeight:      node.h + "px",
            padding:         "0",
            zIndex:          "1000",
        });

        document.body.appendChild(input);
        input.focus();
        input.select();

        // 確定：Enterキー or フォーカスが外れたとき
        function commit() {
            const newLabel = input.value.trim();
            node.label = newLabel || node.label; // 空なら元のラベルを維持
            node.textEl.textContent = node.label;
            input.remove();
        }

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") input.remove(); // キャンセル
        });

        input.addEventListener("blur", commit);
    });
}