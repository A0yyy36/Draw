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

// ===== 図形追加・保存ボタン =====
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