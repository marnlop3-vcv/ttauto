/// ประมวลผลตารางใน Web Worker เพื่อไม่ให้หน้าเว็บค้าง
import { SchedulerEngine } from './scheduler';

const ctx: any = self;
let stopFlag = false;

ctx.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  if (m.type === 'stop') { stopFlag = true; return; }
  if (m.type !== 'start') return;
  stopFlag = false;
  try {
    const eng = new SchedulerEngine(m.input, m.options);
    while (!eng.finished) {
      if (stopFlag) { eng.stop(); break; }
      eng.step(80);
      ctx.postMessage({ type: 'progress', progress: eng.progress() });
      await new Promise((r) => setTimeout(r, 0)); // ให้รับข้อความ stop ได้
    }
    ctx.postMessage({ type: 'done', schedule: eng.result() });
  } catch (err) {
    ctx.postMessage({ type: 'error', message: (err as Error).message });
  }
};
