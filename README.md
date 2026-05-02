# VAIZO OPS Dashboard

VAIZO_OPS_Sheet（GOALS / TASKS / MASTERS / SALES / BUDGET）を可視化する閲覧専用ダッシュボード。
編集はスプレッドシート、閲覧はこのページ、という DB / View 分離構成。

公開 URL（GitHub Pages）：
`https://y-hashimoto-vaizo.github.io/vaizo-ops-dashboard/`

---

## アーキテクチャ

```
ブラウザ（誰でも、URLを叩く）
    │ fetch JSON
    ▼
GAS Web App  ──(オーナー権限)──>  VAIZO_OPS_Sheet（非公開のまま）
```

スプシは公開せず、GAS が橋本オーナー権限で読み取って JSON を返す。
フロントは静的 HTML/CSS/JS のみ（GitHub Pages にホスト）。

---

## セットアップ手順（初回 1 回だけ）

### 1. GAS Web App をデプロイ

1. ブラウザで [https://script.google.com/](https://script.google.com/) を開く（橋本 CEO アカウントで）
2. 「**新しいプロジェクト**」
3. デフォルトの `Code.gs` の中身を全削除し、このリポの `Code.gs` の内容を貼り付ける
4. 右上「**デプロイ**」→「**新しいデプロイ**」
5. 歯車アイコン → 種類 = **ウェブアプリ**
6. 設定：
   - 説明: `VAIZO OPS Dashboard API`
   - 実行するユーザー: **自分（橋本 CEO）**
   - アクセスできるユーザー: **全員**
7. 「**デプロイ**」 → 初回はアクセス権限の承認が出るので許可
8. 「**ウェブアプリ URL**」が表示される（`https://script.google.com/macros/s/AKfyc.../exec`）→ コピー

### 2. config.js に URL を貼り付け

`config.js` の `apiUrl` に上記 URL を貼り付け。

```js
window.VAIZO_OPS_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfyc.../exec',
  ...
};
```

### 3. push

```bash
git add config.js
git commit -m "Set GAS API URL"
git push
```

GitHub Pages が数分後に再デプロイ。完了。

---

## 運用

- **タスク追加・編集**: スプレッドシートで直接編集
- **ダッシュボード反映**: ブラウザでリロード（自動再取得は 5 分間隔）
- **個人ビュー**: `?owner=橋本友太郎` のようにクエリパラメータで担当絞り込み

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | DOM 骨格 |
| `styles.css` | 白黒エディトリアル（VAIZO Design Policy 準拠） |
| `app.js` | データ取得・パース・描画 |
| `config.js` | GAS Web App URL（要設定） |
| `Code.gs` | GAS バックエンド（Google Apps Script に貼り付け） |
| `.nojekyll` | GitHub Pages の Jekyll をスキップ |

---

## セキュリティ

- スプシは非公開のまま（GAS のオーナー権限で読み取り）
- GAS Web App はリードオンリー（書き込み API なし）
- ダッシュボード URL は推測困難な GitHub Pages のサブパス

機密度をさらに上げたい場合は GAS 側で Bearer トークン検証や IP 制限を追加可能。
