// ===== エクスポート機能 =====
// キャンバス（編集SVG）を SVG / PNG / JPEG / PDF として書き出します。
// 対象は #canvas のみ（グリッド線は除外、背景白）。

// ===== SVGコンテンツ取得（グリッド除外・インラインスタイル付き）=====
function getExportSVGString({ bgColor = "#ffffff" } = {}) {
    const origSVG = document.getElementById("canvas");
    // SVGのクローンを作成
    const clone = origSVG.cloneNode(true);

    // グリッドグループを削除
    const gridClone = clone.querySelector("#grid-group");
    if (gridClone) gridClone.remove();

    // 選択ボックス（矩形選択UI）を非表示化
    clone.querySelectorAll("rect[display='none']").forEach(el => el.remove());

    // snap-guide-group を削除
    const snapGuide = clone.querySelector("#snap-guide-group");
    if (snapGuide) snapGuide.remove();

    // フリーエッジのハンドル（選択UIの円）を削除
    // handle クラスの要素を削除
    clone.querySelectorAll(".free-handle, .free-edge-handle").forEach(el => el.remove());

    // 実サイズをviewBoxで確定させる
    const rect = origSVG.getBoundingClientRect();
    clone.setAttribute("width",  rect.width);
    clone.setAttribute("height", rect.height);
    clone.removeAttribute("style");

    // 背景矩形を先頭に追加
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x",      0);
    bg.setAttribute("y",      0);
    bg.setAttribute("width",  rect.width);
    bg.setAttribute("height", rect.height);
    bg.setAttribute("fill",   bgColor);
    clone.insertBefore(bg, clone.firstChild);

    // svgDefs の中身（マーカー等）が含まれているか確認、なければ元から取り込む
    const origDefs = origSVG.querySelector("defs");
    const cloneDefs = clone.querySelector("defs");
    if (origDefs && !cloneDefs) {
        clone.insertBefore(origDefs.cloneNode(true), clone.firstChild);
    }

    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(clone);

    // xmlns が付いていない場合に補完
    if (!svgStr.includes("xmlns=")) {
        svgStr = svgStr.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return svgStr;
}

// ===== SVGをCanvasに描画してBlobを返す =====
function svgToCanvas(svgStr, width, height) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        const dpr    = window.devicePixelRatio || 1;
        canvas.width  = width  * dpr;
        canvas.height = height * dpr;
        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);

        const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
        const url  = URL.createObjectURL(blob);
        const img  = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve(canvas);
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };
        img.src = url;
    });
}

// ===== ダウンロードヘルパー =====
function triggerDownload(url, filename) {
    const a = document.createElement("a");
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ===== SVGエクスポート =====
function exportAsSVG() {
    const svgStr = getExportSVGString();
    const blob   = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url    = URL.createObjectURL(blob);
    triggerDownload(url, "flowchart.svg");
    setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// ===== PNG エクスポート =====
async function exportAsPNG() {
    const origSVG = document.getElementById("canvas");
    const rect    = origSVG.getBoundingClientRect();
    const svgStr  = getExportSVGString({ bgColor: "#ffffff" });
    try {
        const canvas = await svgToCanvas(svgStr, rect.width, rect.height);
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            triggerDownload(url, "flowchart.png");
            setTimeout(() => URL.revokeObjectURL(url), 3000);
        }, "image/png");
    } catch (e) {
        console.error("PNG export failed:", e);
        alert("PNG の書き出しに失敗しました。");
    }
}

// ===== JPEG エクスポート =====
async function exportAsJPEG() {
    const origSVG = document.getElementById("canvas");
    const rect    = origSVG.getBoundingClientRect();
    const svgStr  = getExportSVGString({ bgColor: "#ffffff" });
    try {
        const canvas = await svgToCanvas(svgStr, rect.width, rect.height);
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            triggerDownload(url, "flowchart.jpg");
            setTimeout(() => URL.revokeObjectURL(url), 3000);
        }, "image/jpeg", 0.92);
    } catch (e) {
        console.error("JPEG export failed:", e);
        alert("JPEG の書き出しに失敗しました。");
    }
}

// ===== PDF エクスポート =====
async function exportAsPDF() {
    // jsPDF がロードされているか確認
    if (typeof window.jspdf === "undefined" && typeof window.jsPDF === "undefined") {
        alert("PDFライブラリ（jsPDF）の読み込みに失敗しました。");
        return;
    }
    const { jsPDF } = window.jspdf || window;

    const origSVG = document.getElementById("canvas");
    const rect    = origSVG.getBoundingClientRect();
    const svgStr  = getExportSVGString({ bgColor: "#ffffff" });

    try {
        const canvas  = await svgToCanvas(svgStr, rect.width, rect.height);
        const imgData = canvas.toDataURL("image/png");

        // pt単位: 1px = 0.75pt
        const pxToPt  = 0.75;
        const wPt     = rect.width  * pxToPt;
        const hPt     = rect.height * pxToPt;

        const pdf = new jsPDF({
            orientation: wPt > hPt ? "landscape" : "portrait",
            unit:        "pt",
            format:      [wPt, hPt],
        });
        pdf.addImage(imgData, "PNG", 0, 0, wPt, hPt);
        pdf.save("flowchart.pdf");
    } catch (e) {
        console.error("PDF export failed:", e);
        alert("PDF の書き出しに失敗しました。");
    }
}