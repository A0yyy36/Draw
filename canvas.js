// ===== キャンバス初期化・グリッド描画・座標変換 =====
// SVGの各グループ生成、グリッド描画、スクリーン↔論理座標変換を担当します。

const svg = document.getElementById("canvas");

// --- レイヤー構成 ---
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

// SVG defs（マーカー・グロー）
const svgDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
svg.appendChild(svgDefs);

// グロー用フィルター
const glowFilter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
glowFilter.setAttribute("id",          "sel-glow");
glowFilter.setAttribute("filterUnits", "userSpaceOnUse");
glowFilter.setAttribute("x",           "-50%");
glowFilter.setAttribute("y",           "-50%");
glowFilter.setAttribute("width",       "200%");
glowFilter.setAttribute("height",      "200%");
const feDs = document.createElementNS("http://www.w3.org/2000/svg", "feDropShadow");
feDs.setAttribute("dx",            "0");
feDs.setAttribute("dy",            "0");
feDs.setAttribute("stdDeviation",  "4");
feDs.setAttribute("flood-color",   "#1976D2");
feDs.setAttribute("flood-opacity", "1");
glowFilter.appendChild(feDs);
svgDefs.appendChild(glowFilter);

svg.setAttribute("width",  "100%");
svg.setAttribute("height", "100%");
svg.style.display = "block";

// --- ビュー変換適用 ---
function applyTransform() {
    mainGroup.setAttribute("transform", `translate(${viewX},${viewY}) scale(${viewScale})`);
    drawGrid();
}

// --- グリッド描画 ---
function drawGrid() {
    while (gridGroup.firstChild) gridGroup.removeChild(gridGroup.firstChild);
    const svgW   = svg.clientWidth  || 900;
    const svgH   = svg.clientHeight || 600;
    const step   = 20 * viewScale;
    const offsetX = viewX % step;
    const offsetY = viewY % step;
    const cols   = Math.ceil(svgW / step) + 2;
    const rows   = Math.ceil(svgH / step) + 2;
    for (let i = -1; i < cols; i++) {
        const l  = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const lx = offsetX + i * step;
        l.setAttribute("x1", lx); l.setAttribute("y1", 0);
        l.setAttribute("x2", lx); l.setAttribute("y2", svgH);
        l.setAttribute("stroke", "#e0e0e0"); l.setAttribute("stroke-width", "1");
        gridGroup.appendChild(l);
    }
    for (let j = -1; j < rows; j++) {
        const l  = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const ly = offsetY + j * step;
        l.setAttribute("x1", 0);    l.setAttribute("y1", ly);
        l.setAttribute("x2", svgW); l.setAttribute("y2", ly);
        l.setAttribute("stroke", "#e0e0e0"); l.setAttribute("stroke-width", "1");
        gridGroup.appendChild(l);
    }
}

// --- スクリーン座標 → 論理座標変換 ---
function screenToLogical(sx, sy) {
    const r = svg.getBoundingClientRect();
    return {
        x: (sx - r.left - viewX) / viewScale,
        y: (sy - r.top  - viewY) / viewScale,
    };
}

// --- マーカー（矢印）生成 ---
function getOrCreateMarkerEnd(color) {
    const cid = color.replace("#", "");
    const id  = `me-${cid}`;
    if (!svgDefs.querySelector(`#${id}`)) {
        const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        m.setAttribute("id",           id);
        m.setAttribute("markerWidth",  "10");
        m.setAttribute("markerHeight", "7");
        m.setAttribute("refX",         "9");
        m.setAttribute("refY",         "3.5");
        m.setAttribute("orient",       "auto");
        const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        p.setAttribute("points", "0 0, 10 3.5, 0 7");
        p.setAttribute("fill",   color);
        m.appendChild(p); svgDefs.appendChild(m);
    }
    return id;
}

function getOrCreateMarkerStart(color) {
    const cid = color.replace("#", "");
    const id  = `ms-${cid}`;
    if (!svgDefs.querySelector(`#${id}`)) {
        const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        m.setAttribute("id",           id);
        m.setAttribute("markerWidth",  "10");
        m.setAttribute("markerHeight", "7");
        m.setAttribute("refX",         "1");
        m.setAttribute("refY",         "3.5");
        m.setAttribute("orient",       "auto");
        const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        p.setAttribute("points", "10 0, 0 3.5, 10 7");
        p.setAttribute("fill",   color);
        m.appendChild(p); svgDefs.appendChild(m);
    }
    return id;
}

// ===== スナップガイドライン =====
// ノードドラッグ時に軸が揃ったときに表示する赤いガイドライン
const snapGuideGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
snapGuideGroup.id = "snap-guide-group";
snapGuideGroup.setAttribute("pointer-events", "none");
svg.appendChild(snapGuideGroup);

/**
 * スナップガイドラインを更新する
 * @param {Array<{type:'x'|'y', value:number}>} guides - 論理座標でのガイドライン
 */
function updateSnapGuides(guides) {
    while (snapGuideGroup.firstChild) snapGuideGroup.removeChild(snapGuideGroup.firstChild);
    if (!guides || guides.length === 0) return;

    const svgW = svg.clientWidth  || 900;
    const svgH = svg.clientHeight || 600;

    guides.forEach(({ type, value }) => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("stroke",           "#E53935");
        line.setAttribute("stroke-width",     "1");
        line.setAttribute("stroke-dasharray", "5,3");
        line.setAttribute("opacity",          "0.85");

        if (type === "x") {
            // 垂直ライン（x座標が揃った）
            const sx = value * viewScale + viewX;
            line.setAttribute("x1", sx); line.setAttribute("y1", 0);
            line.setAttribute("x2", sx); line.setAttribute("y2", svgH);
        } else {
            // 水平ライン（y座標が揃った）
            const sy = value * viewScale + viewY;
            line.setAttribute("x1", 0);    line.setAttribute("y1", sy);
            line.setAttribute("x2", svgW); line.setAttribute("y2", sy);
        }
        snapGuideGroup.appendChild(line);
    });
}

function clearSnapGuides() {
    while (snapGuideGroup.firstChild) snapGuideGroup.removeChild(snapGuideGroup.firstChild);
}

applyTransform();