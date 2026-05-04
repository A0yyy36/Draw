// ===== グローバル状態管理 =====
// このファイルはアプリ全体で共有される状態変数を定義します。

// ノード・エッジのデータ
let nodes = [];
let edges = [];
let nodeId = 0;

// ===== グローバルエッジ設定 =====
let globalEdgeStyle = "straight"; // straight | bezier | orthogonal
let globalArrow     = "end";      // end | both | none
let globalDash      = "solid";    // solid | dashed | dotted
let globalColor     = "#333333";
let globalWidth     = 2;

// ===== 選択管理（単一 or 複数）=====
let selectedNode  = null;
let selectedNodes = new Set();
let selectedEdge  = null;

// ===== リサイズ状態 =====
let resizeHandleGroup = null;
let resizingNode = null;
let resizeDir    = null;
let resizeStart  = null;

// ===== 無限キャンバス（ビュー変換）=====
let viewX = 0, viewY = 0, viewScale = 1;

// ===== パン操作 =====
let isPanning = false;
let panStart  = null;
let spaceDown = false;

// ===== 矩形選択 =====
let isSelecting            = false;
let selStart               = null;
let selPressTimer          = null;
let selPendingEvent        = null;
let _justFinishedSelecting = false;
const SEL_LONG_PRESS_MS    = 200;

// ===== エッジ端スクロール =====
const SNAP_THRESHOLD = 5;
const EDGE_MARGIN    = 60;
const EDGE_SPEED     = 8;
let edgeScrollRAF = null;
let edgeScrollDX  = 0;
let edgeScrollDY  = 0;
let anyDragging   = false;

// ===== ベジェ制御点ドラッグ =====
let bezierDragging = false;
let bezierEdge     = null;
let bezierStartMX, bezierStartMY, bezierStartCPX, bezierStartCPY;

// ===== リサイズ最小サイズ =====
const MIN_W = 40;
const MIN_H = 30;

// ===== 矢印の水平・垂直スナップ =====
// この角度（度）以内なら水平または垂直にスナップする
const AXIS_SNAP_DEG = 5;

// ===== フリーエッジ（独立矢印）端点ドラッグ =====
let freeEdgeDragging    = false; // 端点ハンドルをドラッグ中
let freeEdgeDragEdge    = null;  // 対象エッジ
let freeEdgeDragEndpt   = null;  // "a" | "b"
let freeEdgeBodyDrag    = false; // 本体ドラッグ中
let freeEdgeBodyEdge    = null;
let freeEdgeBodyStartMX = 0, freeEdgeBodyStartMY = 0;
let freeEdgeBodyStartAX = 0, freeEdgeBodyStartAY = 0;
let freeEdgeBodyStartBX = 0, freeEdgeBodyStartBY = 0;

// ===== 矢印タイル接続待ち状態 =====
// arrowConnectPending: { arrow, style, dash } | null
let arrowConnectPending = null;
// 接続待ちのプレビュー線（SVGパス）
let arrowPreviewEl = null;
// ドラッグ中かどうか（サイドパネル→キャンバス）
let arrowTileDragging = false;