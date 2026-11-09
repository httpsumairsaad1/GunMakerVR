import { GUN_CATALOG } from './gun-catalog.js';
import { XP_PER_LEVEL } from './workshop-items.js';

/** Real bench geometry (metres), taken from workbench.scene-asset.ts with the bench at (0, 0, -0.65). */
export const BENCH = {
  woodTop: 0.75,
  matTop: 0.762,
  footprint: { minX: -0.56, maxX: 0.56, minZ: -0.94, maxZ: -0.36 },
  mat: { minX: -0.345, maxX: 0.345, minZ: -0.855, maxZ: -0.515 },
  matCenter: { x: 0, z: -0.685 },
  /** Staging strip between the mat and the bench edge (the vise blocks x < -0.28). */
  stripRows: [-0.47, -0.4],
  stripMinX: -0.26,
  stripMaxX: 0.52,
  stripGap: 0.03,
  partScale: 0.6,
  partYawDeg: -90,
};

export function surfaceY(x: number, z: number): number {
  const f = BENCH.footprint;
  if (x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) return 0;
  const m = BENCH.mat;
  return x >= m.minX && x <= m.maxX && z >= m.minZ && z <= m.maxZ ? BENCH.matTop : BENCH.woodTop;
}

export const levelFromXp = (xp: number): number => Math.floor(xp / XP_PER_LEVEL) + 1;
export const xpIntoLevel = (xp: number): number => xp % XP_PER_LEVEL;

/** Display order = keyboard keys 1 to 5. */
export const GUN_ORDER = ['assault_rifle', 'drum_pistol', 'drum_shotgun', 'bolt_sniper', 'grenade_launcher'] as const;
export const UNLOCK_LEVEL: Record<string, number> = {
  assault_rifle: 1,
  drum_pistol: 1,
  drum_shotgun: 2,
  bolt_sniper: 3,
  grenade_launcher: 4,
};
export const FREE_GUN = 'assault_rifle';
export const TUTORIAL_GUN = 'assault_rifle';
export const TUTORIAL_XP = 50;
export const STORE_XP = 20;

export const SLOT_COLORS: Record<string, string> = {
  receiver: '#4fc3ff',
  barrel: '#ff5a5a',
  magazine: '#3dff8f',
  stock: '#ffb04a',
  sight: '#b58cff',
  handguard: '#ffd84f',
  grip: '#34d6c8',
  bolt: '#ff8fd6',
  cylinder: '#3dff8f',
  slide: '#ff8fd6',
};

export type Rank = { rank: 'S' | 'A' | 'B' | 'C'; mult: number };
export function rankFor(mistakes: number, seconds: number): Rank {
  if (mistakes === 0 && seconds <= 120) return { rank: 'S', mult: 1.5 };
  if (mistakes <= 1) return { rank: 'A', mult: 1.2 };
  if (mistakes <= 3) return { rank: 'B', mult: 1 };
  return { rank: 'C', mult: 0.8 };
}

export const isBase = (partId: string): boolean => partId === 'receiver' || partId === 'frame';

export function gunById(id: string) {
  return GUN_CATALOG.find((g) => g.id === id);
}

/** Parts a player attaches, in manifest assembly order (the receiver/frame is the base). */
export function stepsFor(gunId: string) {
  const gun = gunById(gunId);
  if (!gun) return [];
  const order = (gun as unknown as { assembly_order?: string[] }).assembly_order ?? gun.parts.map((p) => p.id);
  return order
    .filter((id) => !isBase(id))
    .map((id) => gun.parts.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);
}
