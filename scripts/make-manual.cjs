// สร้างคู่มือ PDF จาก docs/*.html : คู่มือผู้ดูแล 4 หน้า + คู่มือนักเรียน/ครู 1 หน้า (PDF และ PNG สำหรับส่งในไลน์)
// รัน scripts/make-shots.cjs ก่อนถ้าต้องการภาพใหม่ แล้ว: node scripts/make-manual.cjs
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const docs = path.resolve(__dirname, '../docs');
const pub = path.resolve(__dirname, '../public');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
  const render = async (html, pdfOut, pngOut) => {
    await page.goto('file://' + path.join(docs, html));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await page.pdf({ path: pdfOut, format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
    if (pngOut) await page.screenshot({ path: pngOut, clip: { x: 0, y: 0, width: 794, height: 1123 } });
  };
  await render('manual.html', path.join(docs, 'timetable-user-manual.pdf'));
  await render('viewer-guide.html', path.join(docs, 'viewer-guide.pdf'), path.join(docs, 'viewer-guide.png'));
  fs.copyFileSync(path.join(docs, 'timetable-user-manual.pdf'), path.join(pub, 'timetable-user-manual.pdf'));
  fs.copyFileSync(path.join(docs, 'viewer-guide.pdf'), path.join(pub, 'viewer-guide.pdf'));
  await browser.close();
  console.log('manuals done');
})();
