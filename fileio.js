// ===== ファイル入出力 =====
// フローチャートのJSONへの保存と、JSONファイルからの読み込みを担当します。

// ===== 保存 =====
function saveFlowchart() {
    const data = {
        nodeId,
        nodes: nodes.map(n => ({
            id:      n.id,
            x:       n.x,
            y:       n.y,
            w:       n.w,
            h:       n.h,
            label:   n.label,
            fontsize: n.fontsize ?? 14,
            shape:   n.shape,
        })),
        edges: edges.map(e => ({
            aId:    e.a.id,
            bId:    e.b.id,
            style:  e.style,
            arrow:  e.arrow,
            dash:   e.dash,
            color:  e.color,
            width:  e.width,
            cpOffX: e.cpOffX || 0,
            cpOffY: e.cpOffY || 0,
        })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "flowchart.json";
    a.click();
    URL.revokeObjectURL(url);
}

// ===== 読み込み =====
function loadFlowchart(jsonData) {
    // 既存データを全削除
    nodes.forEach(n => { n.el.remove(); n.textEl.remove(); });
    edges.forEach(e => { e.pathEl.remove(); e.hitEl.remove(); hideCPDot(e); });
    nodes = []; edges = [];
    clearSelection();
    nodeId = jsonData.nodeId ?? 0;

    // ノード復元
    jsonData.nodes.forEach(nd => {
        const node = {
            id:      nd.id,
            x:       nd.x,
            y:       nd.y,
            w:       nd.w,
            h:       nd.h,
            label:   nd.label,
            fontsize: nd.fontsize ?? 14,
            shape:   nd.shape,
            el:      null,
            textEl:  null,
        };
        nodes.push(node);
        drawNode(node);
    });

    // エッジ復元
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
            cpOffY: ed.cpOffY || 0,
        });
    });
}

// ===== ファイル選択input =====
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