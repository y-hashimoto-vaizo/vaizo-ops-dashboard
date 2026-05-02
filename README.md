# VAIZO OPS Dashboard

VAIZO_OPS_Sheet（GOALS / TASKS / MASTERS / SALES / BUDGET）を可視化する閲覧専用ダッシュボード。
編集はスプレッドシート、閲覧はこのページ、という DB / View 分離構成。

公開 URL（GitHub Pages）：
**https://y-hashimoto-vaizo.github.io/vaizo-ops-dashboard/**

---

## アーキテクチャ（GASなし・完全静的・自動同期）

```
スプレッドシート（みんなが編集）
        │
        │  GitHub Actions が 30 分ごとに読み取り
        │  （誰でも「スプシ読み取り」ボタンで即時起動も可）
        ▼
data.json（リポジトリに自動 commit）
        │
        ▼
GitHub Pages（自動再ビルド）
        │
        ▼
ブラウザ（誰でも URL 叩く）
        │
        └─→ 同階層の data.json を fetch して描画
```

サーバー無し、GAS 無し、認証無し、ビルドツール無し、追加コスト無し。
GitHub Actions は Public リポなら無料無制限。

---

## 運用フロー

### 通常の閲覧
- ブラウザで公開 URL を開くだけ
- ページは 5 分ごとに自動再 fetch

### スプシを更新したとき
- **何もしなくてOK**。30 分以内に GitHub Actions が自動で同期する
- 急ぎなら、ヒーローの「**スプシ読み取り**」ボタンを押す → GitHub の Actions ページが開く → 「Run workflow」を押せば 1〜2 分で反映

### 個人ビュー
- `?owner=橋本友太郎` のようにクエリパラメータで担当絞り込み
- 例: https://y-hashimoto-vaizo.github.io/vaizo-ops-dashboard/?owner=櫻井理也

---

## 初回セットアップ（橋本のみ・10分・1 回だけ）

### Step 1. Google サービスアカウント発行（5分）

1. https://console.cloud.google.com/ を開く（**y-hashimoto@vaizo.jp** でログイン）
2. 上部のプロジェクト選択 → 「新しいプロジェクト」 → 名前 `vaizo-ops-dashboard` で作成
3. 左メニュー「APIs & Services」→「Library」→「**Google Sheets API**」検索 → **Enable**
4. 左メニュー「APIs & Services」→「Credentials」→「Create Credentials」→「**Service Account**」
5. 名前: `vaizo-ops-dashboard-reader`、Role なしで Done
6. 作成されたサービスアカウントをクリック → 「**KEYS**」タブ →「Add Key → JSON」
7. JSON ファイルがダウンロードされる（中身を全文コピーしておく）
8. サービスアカウントのメールアドレス（`...@vaizo-ops-dashboard.iam.gserviceaccount.com`）をコピーしておく

### Step 2. スプシに閲覧権限付与（1分）

1. VAIZO_OPS_Sheet を開く
2. 右上「共有」 → サービスアカウントのメールを **閲覧者** で追加
3. 「通知メールを送る」のチェックを外して「共有」

### Step 3. GitHub Secrets 登録（2分）

1. https://github.com/y-hashimoto-vaizo/vaizo-ops-dashboard/settings/secrets/actions を開く
2. 「New repository secret」
3. Name: `GOOGLE_SA_KEY`
4. Secret: Step 1-7 でコピーした JSON 全文を貼り付け
5. 「Add secret」

### Step 4. 動作確認（1分）

1. https://github.com/y-hashimoto-vaizo/vaizo-ops-dashboard/actions/workflows/update-data.yml を開く
2. 右側「Run workflow」→「Run workflow」（緑ボタン）
3. 1〜2 分待つ → ✅ になれば成功
4. ダッシュボードをリロード → 最新スプシが反映されている

これ以降は 30 分ごとに自動で `data.json` が更新される。

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | DOM 骨格 |
| `styles.css` | 白黒エディトリアル（VAIZO Design Policy 準拠） |
| `app.js` | データ取得・パース・描画 |
| `config.js` | 自動更新間隔・スプシリンク |
| `data.json` | スプシのスナップショット（GitHub Actions が自動更新） |
| `.github/workflows/update-data.yml` | 30 分ごと自動更新ジョブ |
| `scripts/build_data.py` | スプシ読取→data.json 出力スクリプト |
| `requirements.txt` | Python 依存（google-api-python-client） |
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
- **5分自動更新** + **手動更新ボタン** + **「スプシ読み取り」ボタン**（Actions 起動）

---

## デザイン

VAIZO Design Policy v1（白黒エディトリアル × ミッション主義）準拠。
- 黒地ヒーロー＋ミッション全文
- Inter（英数字）+ Noto Sans JP（日本語）
- 罫線ベース UI、装飾最小、影ゼロ
- 階層用語禁止・採用語完全排除

---

## セキュリティ

- スプシは非公開のまま（VAIZO Drive 限定共有 + 読取専用サービスアカウント 1 つ）
- data.json には TASKS / GOALS / MASTERS / SALES / BUDGET の生データが含まれる
- リポジトリ public のため、URL を知る誰でも data.json を取得可能
- 機密度が上がったらリポを private 化＋GitHub Pages も private 化（要 Enterprise）or 認証付きホストへ移行
