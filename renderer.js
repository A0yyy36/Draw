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
                connect(selectedNode, node);
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

// ===== 接続線作成 =====
function connect(a, b) {
    const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
    );

    line.setAttribute("stroke", "#333");
    line.setAttribute("stroke-width", "2");

    svg.prepend(line);

    edges.push({ a, b, line });
    updateEdges();
}

// ===== 線位置更新 =====
function updateEdges(){
    edges.forEach(e=>{
        const ax = e.a.x + e.a.w/2;
        const ay = e.a.y + e.a.h/2;
        const bx = e.b.x + e.b.w/2;
        const by = e.b.y + e.b.h/2;

        e.line.setAttribute("x1",ax);
        e.line.setAttribute("y1",ay);
        e.line.setAttribute("x2",bx);
        e.line.setAttribute("y2",by);
    });
}

// ===== ドラッグ =====
function enableDrag(el,node){
    let dragging=false;
    let ox,oy;

    el.addEventListener("mousedown",(e)=>{
        dragging=true;
        ox=e.offsetX-node.x;
        oy=e.offsetY-node.y;
    });

    svg.addEventListener("mousemove",(e)=>{
        if(!dragging) return;

        node.x=e.offsetX-ox;
        node.y=e.offsetY-oy;

        updateNodePosition(node);
    });

    window.addEventListener("mouseup",()=>dragging=false);
}