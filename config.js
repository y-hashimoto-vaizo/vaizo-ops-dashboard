/**
 * VAIZO OPS Dashboard - Config
 *
 * データソース: 同階層の data.json（GitHub Actions が 30 分ごとに自動生成）
 *
 * パスワード:
 *   下の passHash は SHA-256 ハッシュ。
 *   現在のパスワード = "vaizo2026"
 *   変更したい場合は新しいパスワードの SHA-256 を計算して差し替え:
 *     node -e "console.log(require('crypto').createHash('sha256').update('NEWPASS').digest('hex'))"
 */

window.VAIZO_OPS_CONFIG = {
  refreshIntervalMs: 5 * 60 * 1000,
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1KgdXxw5Wci1Gu0GqBviT5E5uwl9taA7jDbv49C60ckw/edit',
  passHash: '77448e264faa188c6af800adf270fe1ad032c0f5c2daa7ebcdef0b8164aa5fa1'
};
