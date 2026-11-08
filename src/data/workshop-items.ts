import { GUN_CATALOG } from './gun-catalog.js';

export type WorkshopItemDefinition = {
  label: string;
  category: 'gun' | 'part';
  price: number;
  cashReward: number;
  xpReward: number;
  stripTargets?: string[];
  stats?: {
    damage: number;
    accuracy: number;
    fireRate: number;
    recoil: number;
    magazine: number;
  };
};

const gunPartItems = GUN_CATALOG.reduce<Record<string, WorkshopItemDefinition>>(
  (items, gun) => {
    for (const part of gun.parts) {
      items[part.itemId] = {
        label: `${gun.name} - ${part.name}`,
        category: 'part',
        price: 0,
        cashReward: 0,
        xpReward: 0,
      };
    }
    return items;
  },
  {},
);

export const WORKSHOP_ITEMS: Record<string, WorkshopItemDefinition> = {
  'gun-bolt-sniper': {
    label: 'Bolt Sniper',
    category: 'gun',
    price: 140,
    cashReward: 92,
    xpReward: 45,
    stripTargets: ['receiver', 'stock', 'handguard', 'barrel', 'magazine', 'bolt', 'scope'],
    stats: { damage: 92, accuracy: 96, fireRate: 28, recoil: 78, magazine: 5 },
  },
  'gun-drum-shotgun': {
    label: 'Drum Pump Shotgun',
    category: 'gun',
    price: 120,
    cashReward: 68,
    xpReward: 34,
    stripTargets: ['receiver', 'barrel_shroud', 'pump_forend', 'drum_magazine', 'stock', 'front_sight'],
    stats: { damage: 88, accuracy: 58, fireRate: 42, recoil: 82, magazine: 12 },
  },
  'gun-assault-rifle': {
    label: 'Assault Rifle',
    category: 'gun',
    price: 95,
    cashReward: 72,
    xpReward: 36,
    stripTargets: ['receiver', 'barrel', 'handguard', 'magazine', 'stock', 'grip', 'rear_sight'],
    stats: { damage: 68, accuracy: 76, fireRate: 74, recoil: 56, magazine: 30 },
  },
  'gun-grenade-launcher': {
    label: 'Revolver Grenade Launcher',
    category: 'gun',
    price: 160,
    cashReward: 82,
    xpReward: 40,
    stripTargets: ['receiver', 'cylinder', 'barrel', 'forend', 'stock', 'sight'],
    stats: { damage: 100, accuracy: 62, fireRate: 22, recoil: 96, magazine: 6 },
  },
  'gun-drum-pistol': {
    label: 'Drum Pistol',
    category: 'gun',
    price: 50,
    cashReward: 40,
    xpReward: 22,
    stripTargets: ['frame', 'slide', 'barrel', 'forend', 'drum', 'grip', 'rear_sight'],
    stats: { damage: 54, accuracy: 70, fireRate: 64, recoil: 44, magazine: 18 },
  },
  ...gunPartItems,
};

export const STARTING_CREDITS = 250;
export const XP_PER_REMOVED_PART = 3;
export const XP_PER_ATTACHMENT = 8;
export const XP_PER_LEVEL = 100;
