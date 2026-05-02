/**
 * VAIZO OPS Dashboard - Config
 *
 * GAS Web App をデプロイしたら、ここに URL を貼り付けて push してください。
 * URL 形式: https://script.google.com/macros/s/AKfyc.../exec
 */

window.VAIZO_OPS_CONFIG = {
  // GAS Web App URL（デプロイ後に貼り替え）
  apiUrl: '',

  // 自動更新間隔（ミリ秒）。デフォルト 5 分
  refreshIntervalMs: 5 * 60 * 1000,

  // ソーススプレッドシートのリンク（ヘッダーから「編集する」遷移用）
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1KgdXxw5Wci1Gu0GqBviT5E5uwl9taA7jDbv49C60ckw/edit'
};
