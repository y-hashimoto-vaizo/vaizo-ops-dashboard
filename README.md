# VAIZO OPS Dashboard

VAIZO_OPS_Sheet（GOALS / TASKS / MASTERS / SALES / BUDGET）を可視化する閲覧専用ダッシュボード。
編集はスプレッドシート、閲覧はこのページ、という DB / View 分離構成。

公開 URL（GitHub Pages）：
**https://y-hashimoto-vaizo.github.io/vaizo-ops-dashboard/**

---

## アーキテクチャ（GASなし・完全静的）

```
スプレッドシート（みんなが編集）
        │
        │  Claude が読み取って data.json に変換
        ▼
data.json（リポジトリにコミット）
        │
        ▼
ブラウザ（誰でもURL叩く）
        │
        └─→ 同階層の data.json を fetch して描画
```

サーバー無し、GAS 無し、認証無し、ビルドツール無し。
スプシは非公開のまま、必要なデータだけ静的 JSON にダンプして公開する。

---

## 運用フロー

### 通常の閲覧
- ブラウザで公開 URL を開くだけ
- ページは 5 分ごとに自動再fetch（手動更新ボタンも有り）

### スプシを更新したあと
1. 橋本さんがスプシで編集（みんなも編集していい）
2. Claude に「ダッシュボード更新」と一言頼む
3. Claude が MCP でスプシ全シート読取 → data.json 生成 → commit → push
4. 1〜2分後、GitHub Pages が再デプロイされて公開 URL に反映
5. みんなはリロードするだけ

### 個人ビュー
- `?owner=橋本友太郎` のようにクエリパラメータで担当絞り込み
- 例: https://y-hashimoto-vaizo.github.io/vaizo-ops-dashboard/?owner=櫻井理也

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | DOM 骨格 |
| `styles.css` | 白黒エディトリアル（VAIZO Design Policy 準拠） |
| `app.js` | データ取得・パース・描画 |
| `config.js` | 自動更新間隔・スプシリンク |
| `data.json` | スプシのスナップショット（Claude が更新） |
| `.nojekyll` | GitHub Pages の Jekyll をスキップ |

---

## ダッシュボードの機能

- **KPI**: TOTAL / IN PROGRESS / NOT STARTED / ON HOLD / DONE
- **締切アラート**: 超過 / 本日 / 7日以内
- **GOALS進捗**: ANNUAL / Q / MONTH ツリー＋プログレスバー
- **担当者×状態マトリクス**: VAIZER 別の積み上がり
- **事業部別進捗バー**: V/AIBOU / V/ENTER / TWIST / 全社 等
- **TASKS全件テーブル**: 検索 / 事業部・担当・状態・優先度フィルタ / 締切・優先度・ID・状態ソート
- **個人ビュー**: クエリパラメータで担当絞り込み
- **5分自動更新** + **手動更新ボタン**

---

## デザイン

VAIZO Design Policy v1（白黒エディトリアル × ミッション主義）準拠。
- 黒地ヒーロー＋ミッション全文
- Inter（英数字）+ Noto Sans JP（日本語）
- 罫線ベース UI、装飾最小、影ゼロ
- 階層用語禁止・採用語完全排除

---

## セキュリティ

- スプシは非公開のまま
- data.json には TASKS / GOALS / MASTERS / SALES / BUDGET の生データが含まれる
- リポジトリ public のため、URL を知る誰でも data.json を取得可能
- 機密度が上がったらリポを private 化＋GitHub Pages も private 化（要 Enterprise）or 認証付きホストへ移行
