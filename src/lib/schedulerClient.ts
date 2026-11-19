import type { Schedule } from '../types';
import { Progress, SchedulerEngine, SchedulerInput, SchedulerOptions } from './scheduler';

export interface RunHandle { promise: Promise<Schedule>; stop: () => void }

/** รันตัวจัดตารางใน Web Worker (ถ้าใช้ไม่ได้ จะรันบนหน้าเว็บแบบแบ่งช่วงแทน) */
export function runScheduler(input: SchedulerInput, options: SchedulerOptions, onProgress: (p: Progress) => void): RunHandle {
  let worker: Worker | null = null;
  let stopFn: () => void = () => {};

  const inline = (resolve: (s: Schedule) => void, reject: (e: Error) => void) => {
    try {
      const eng = new SchedulerEngine(input, options);
      stopFn = () => eng.stop();
      const tick = () => {
        if (eng.finished) return resolve(eng.result());
        eng.step(40);
        onProgress(eng.progress());
        setTimeout(tick, 0);
      };
      tick();
    } catch (e) { reject(e as Error); }
  };

  const promise = new Promise<Schedule>((resolve, reject) => {
    let started = false;
    try {
      worker = new Worker(new URL('./scheduler.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      return inline(resolve, reject);
    }
    stopFn = () => worker?.postMessage({ type: 'stop' });
    worker.onmessage = (e: MessageEvent) => {
      started = true;
      const m = e.data;
      if (m.type === 'progress') onProgress(m.progress);
      else if (m.type === 'done') { worker?.terminate(); resolve(m.schedule); }
      else if (m.type === 'error') { worker?.terminate(); reject(new Error(m.message)); }
    };
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      if (!started) inline(resolve, reject); // Worker เริ่มไม่ได้ -> ใช้แบบไม่มี Worker
      else reject(new Error('Worker ทำงานผิดพลาด'));
    };
    worker.postMessage({ type: 'start', input, options });
  });

  return { promise, stop: () => stopFn() };
}
