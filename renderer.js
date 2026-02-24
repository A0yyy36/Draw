const svg = document.getElementById("canvas");

let nodes = [];
let edges = [];
let nodeId = 0;

let selectedNode = null;

// ===== ノード追加 =====
document.getElementById("addBtn").onclick = () => {
    const node = {
        id: nodeId++,
        x: 100 + nodeId * 20, 
        y: 100 + nodeId * 20, 
        w: 120, 
        h: 50, 
        el: null
    };

    nodes.push(node);
    drawNode(node);
};

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

// ===== ノード描画 =====
function drawNode(node){
    const rect = document.createElementNS(
        "http://www.w3.org/2000/svg", 
        "rect"
    );

    rect.setAttribute("width",node.w);
    rect.setAttribute("height",node.h);
    rect.setAttribute("fill","#2196F3");
    
    node.el = rect;
    updateNodePosition(node);

    enableDrag(rect,node);
    enableConnect(rect,node);
    
    svg.appendChild(rect);
}

// ===== ノード位置更新 =====
function updateNodePosition(node){
    node.el.setAttribute("x",node.x);
    node.el.setAttribute("y",node.y);

    updateEdges();
}

// ===== 接続処理 =====
function enableConnect(el,node){
    el.addEventListener("click",(e)=>{
        e.stopPropagation();

        if (!selectedNode) {
            selectedNode = node;
            highlight(node, true);
        } 
        else {
            if (selectedNode !== node) {
                toggleConnection(selectedNode, node);
            }
            highlight(selectedNode, false);
            selectedNode = null;
        }
    });
}

// ===== ハイライト(red) =====
function highlight(node, on) {
    node.el.setAttribute(
        "stroke",
        on ? "red" : "none"
    );
    node.el.setAttribute(
        "stroke-width",
        on ? "3" : "0"
    );
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