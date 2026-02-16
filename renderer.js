const svg = document.getElementById("canvas");

let nodes = [];
let nodeId = 0;

// ===== ノード追加 =====
document.getElementById("addBtn").onclick = () => {
    const node = {
        id: nodeId++,
        x: 100,
        y: 100,
        w: 120,
        h: 50
    };

    nodes.push(node);
    drawNode(node);
};

// ===== 描画 =====
function drawNode(node){
    const rect = document.createElementNS(
        "http://www.w3.org/2000/svg","rect"
    );

    rect.setAttribute("x",node.x);
    rect.setAttribute("y",node.y);
    rect.setAttribute("width",node.w);
    rect.setAttribute("height",node.h);
    rect.setAttribute("fill","#2196F3");

    enableDrag(rect,node);

    svg.appendChild(rect);
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

    el.setAttribute("x",node.x);
    el.setAttribute("y",node.y);
    });

    window.addEventListener("mouseup",()=>dragging=false);
}
