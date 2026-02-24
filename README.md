# Flowchart App (Electron + SVG)
ElectronとSVGを使用したフローチャートエディタ

現在は以下の機能を実装済み: 
- ノード追加
- ドラッグ移動
- ノード間接続 (矢印)
- 矢印削除
- スナップ整列
- ノード名編集

## 使用技術
- Electron
- Node.js
- SVG (DOM API)
- Vanilla JavaScript

## セットアップ
1. 依存インストール
   ```bash
   npm install
   ```
   
2. 起動
   ```bash
   npm start
   ``` 

## 今後の実装機能
- 保存 / 読み込み
- Undo / Redo
- ズーム / パン
- 右クリックメニュー
- ノード削除
- グループ化
- 曲線エッジ
- 自動レイアウト