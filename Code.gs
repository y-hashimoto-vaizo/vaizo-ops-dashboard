/**
 * VAIZO OPS Dashboard - Backend (Google Apps Script Web App)
 *
 * 役割: VAIZO_OPS_Sheet を読み取り、JSON で返すだけの薄い API。
 * デプロイ: 「新しいデプロイ」→種類「ウェブアプリ」
 *           実行ユーザー: 自分（橋本CEO）
 *           アクセスできるユーザー: 全員
 *
 * 公開される情報: TASKS / GOALS / MASTERS / SALES / BUDGET の生データ。
 * 編集権限は付与されない（読み取りのみ）。
 */

const SHEET_ID = '1KgdXxw5Wci1Gu0GqBviT5E5uwl9taA7jDbv49C60ckw';
const SHEETS = ['TASKS', 'GOALS', 'MASTERS', 'SALES', 'BUDGET'];

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const payload = { updatedAt: new Date().toISOString() };

    SHEETS.forEach(name => {
      const sh = ss.getSheetByName(name);
      payload[name.toLowerCase()] = sh ? sh.getDataRange().getValues() : [];
    });

    return ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
