// ===== ツールバー操作 =====
// ツールバーのボタン・スライダー操作を担当します。
// グローバルエッジ設定の変更と、ノード追加ボタンのイベントを管理します。

// ===== ボタングループのアクティブ切替ヘルパー =====
function setGroupActive(attr, val) {
    document.querySelectorAll(`[data-${attr}]`).forEach(b => {
        b.classList.toggle("active", b.dataset[attr] === val);
    });
}

// ===== 矢印スタイル =====
document.querySelectorAll("[data-estyle]").forEach(b => {
    b.addEventListener("click", () => {
        globalEdgeStyle = b.dataset.estyle;
        setGroupActive("estyle", globalEdgeStyle);
        if (selectedEdge) {
            hideCPDot(selectedEdge);
            selectedEdge.style = globalEdgeStyle;
            updateEdgePath(selectedEdge);
            if (globalEdgeStyle === "bezier" || globalEdgeStyle === "orthogonal") {
                showCPDot(selectedEdge);
            }
        }
    });
});

// ===== 矢印種類 =====
document.querySelectorAll("[data-arrow]").forEach(b => {
    b.addEventListener("click", () => {
        globalArrow = b.dataset.arrow;
        setGroupActive("arrow", globalArrow);
        if (selectedEdge) { selectedEdge.arrow = globalArrow; applyEdgeStyle(selectedEdge); }
    });
});

// ===== 線種 =====
document.querySelectorAll("[data-dash]").forEach(b => {
    b.addEventListener("click", () => {
        globalDash = b.dataset.dash;
        setGroupActive("dash", globalDash);
        if (selectedEdge) { selectedEdge.dash = globalDash; applyEdgeStyle(selectedEdge); }
    });
});

// ===== 線色 =====
document.getElementById("edge-color").addEventListener("input", (e) => {
    globalColor = e.target.value;
    if (selectedEdge) { selectedEdge.color = globalColor; applyEdgeStyle(selectedEdge); }
});

// ===== 線の太さ =====
const edgeWidthSlider = document.getElementById("edge-width");
const edgeWidthValue  = document.getElementById("edge-width-value");
edgeWidthSlider.addEventListener("input", () => {
    globalWidth = parseFloat(edgeWidthSlider.value);
    edgeWidthValue.textContent = globalWidth;
    if (selectedEdge) { selectedEdge.width = globalWidth; applyEdgeStyle(selectedEdge); }
});

// ===== 矢印タイル：クリック→キャンバス中央に追加 ／ ドラッグ→ノード接続モード =====
document.querySelectorAll(".arrow-tile").forEach(tile => {
    let tileMouseDownPos = null;
    const DRAG_THRESHOLD = 6; // px

    tile.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        tileMouseDownPos = { x: e.clientX, y: e.clientY };
        e.preventDefault();
    });

    // mousemove で閾値を超えたらドラッグモード開始
    const onTileMouseMove = (e) => {
        if (!tileMouseDownPos) return;
        const dx = e.clientX - tileMouseDownPos.x;
        const dy = e.clientY - tileMouseDownPos.y;
        if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
            // ドラッグ開始
            const preset = tile.dataset.arrowPreset;
            if (preset) { globalArrow = preset; setGroupActive("arrow", globalArrow); }
            cancelArrowConnect();
            arrowTileDragging = true;
            svg.style.cursor = "crosshair";
            tileMouseDownPos = null;
            window.removeEventListener("mousemove", onTileMouseMove);
        }
    };
    window.addEventListener("mousemove", onTileMouseMove);

    tile.addEventListener("click", (e) => {
        e.stopPropagation();
        // ドラッグ中だった場合はクリック扱いしない
        if (arrowTileDragging) return;

        const preset = tile.dataset.arrowPreset;
        if (preset) { globalArrow = preset; setGroupActive("arrow", globalArrow); }

        const svgRect = svg.getBoundingClientRect();
        const cx = (svgRect.width  / 2 - viewX) / viewScale;
        const cy = (svgRect.height / 2 - viewY) / viewScale;
        const freeCount = edges.filter(ed => ed.isFree).length;
        const offsetX = 80;
        const offsetY = freeCount * 14; // 少しずつずらして重ならないように
        const a = makeFreePoint(cx - offsetX, cy + offsetY);
        const b = makeFreePoint(cx + offsetX, cy + offsetY);

        const edge = createEdge(a, b, {
            style:  globalEdgeStyle,
            arrow:  globalArrow,
            dash:   globalDash,
            color:  globalColor,
            width:  globalWidth,
        });
        selectEdge(edge);
    });

    tile.addEventListener("mouseup", () => { tileMouseDownPos = null; });
});
document.querySelectorAll("button[data-shape]").forEach(btn => {
    btn.addEventListener("click", () => {
        const shape = btn.dataset.shape;
        if (shape === "save") { saveFlowchart(); return; }
        if (shape === "load") { document.getElementById("load-input").click(); return; }

        const svgRect = svg.getBoundingClientRect();
        const centerX = (svgRect.width  / 2 - viewX) / viewScale;
        const centerY = (svgRect.height / 2 - viewY) / viewScale;

        const node = {
            id:      nodeId++,
            x:       centerX - 60 + (nodeId % 5) * 10,
            y:       centerY - 30 + (nodeId % 5) * 10,
            w:       shape === "diamond" ? 140 : 120,
            h:       60,
            label:   `Node ${nodeId}`,
            fontsize: 14,
            shape,
            el:      null,
            textEl:  null,
        };
        nodes.push(node);
        drawNode(node);
    });
});