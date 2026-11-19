const ExcelJS = require('exceljs');
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[2] || '/tmp/e2e-out/out.xlsx');
  const ws = wb.worksheets[0];
  const merges = Object.keys(ws._merges || {}).length;
  let summary = false;
  ws.eachRow((r) => r.eachCell((c) => { if (String(c.value).includes('สรุปต่อสัปดาห์')) summary = String(c.value); }));
  console.log('sheet:', ws.name, '| merged ranges:', merges, '| summary:', summary);
  process.exit(merges > 1 && summary ? 0 : 1);
})();
