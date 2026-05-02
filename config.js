/**
 * VAIZO OPS Dashboard - Config
 *
 * データソース: 同階層の data.json
 *   → スプシに変更があった時、Claude に「ダッシュボード更新」と依頼すれば
 *     最新の data.json が生成され push される。
 */

window.VAIZO_OPS_CONFIG = {
  refreshIntervalMs: 5 * 60 * 1000,
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1KgdXxw5Wci1Gu0GqBviT5E5uwl9taA7jDbv49C60ckw/edit'
};
