// สร้างคู่มือ PDF จาก docs/manual.html (รัน scripts/make-shots.cjs ก่อนถ้าต้องการภาพใหม่)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(__dirname, '../docs/manual.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.pdf({ path: path.resolve(__dirname, '../docs/timetable-user-manual.pdf'), format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
  await browser.close();
  console.log('manual pdf done');
})();
