import { RoomRef, roomLabel } from '../types';

/** จัดกลุ่มห้องตามอาคาร (คงลำดับที่ปรากฏ) */
export function groupByBuilding(rooms: RoomRef[]): { buildingId: string; rooms: RoomRef[] }[] {
  const out: { buildingId: string; rooms: RoomRef[] }[] = [];
  for (const r of rooms) {
    const g = out.find((x) => x.buildingId === r.buildingId);
    if (g) g.rooms.push(r); else out.push({ buildingId: r.buildingId, rooms: [r] });
  }
  return out;
}

/** ข้อความสถานที่ เช่น "อาคาร 1 ห้อง 101" หรือหลายห้อง "อาคาร 1 ห้อง 101, 102 • อาคาร 2 ห้อง 203" */
export function placeText(rooms: RoomRef[], buildingName: (id: string) => string): string {
  return groupByBuilding(rooms).map((g) => `${buildingName(g.buildingId)} ห้อง ${g.rooms.map(roomLabel).join(', ')}`).join(' • ');
}
