import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** จับภาพตารางจาก DOM แล้วใส่ใน PDF A4 แนวนอน (ใช้ภาพเพื่อให้ฟอนต์ไทยแสดงถูกต้องทุกเครื่อง) */
export async function exportElementToPdf(el: HTMLElement, filename: string) {
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const maxW = pw - margin * 2;
  const maxH = ph - margin * 2;
  let w = maxW;
  let h = (canvas.height * w) / canvas.width;
  if (h > maxH) { h = maxH; w = (canvas.width * h) / canvas.height; }
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pw - w) / 2, margin, w, h);
  pdf.save(filename);
}
