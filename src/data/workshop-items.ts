export type WorkshopItemDefinition = {
  label: string;
  category: 'gun' | 'accessory' | 'tool';
  price: number;
  cashReward: number;
  xpReward: number;
  stripTargets?: string[];
};

export const WORKSHOP_ITEMS: Record<string, WorkshopItemDefinition> = {
  'gun-revolver': {
    label: 'Trailblazer Revolver',
    category: 'gun',
    price: 0,
    cashReward: 45,
    xpReward: 24,
    stripTargets: ['Cylinder Assembly', 'Barrel Assembly', 'Grip Assembly', 'Receiver Assembly'],
  },
  'gun-pistol': {
    label: 'Sparrow Compact',
    category: 'gun',
    price: 0,
    cashReward: 40,
    xpReward: 22,
    stripTargets: ['Barrel Assembly', 'Grip Assembly', 'Receiver Assembly'],
  },
  'gun-smg': {
    label: 'Rook Burst SMG',
    category: 'gun',
    price: 0,
    cashReward: 65,
    xpReward: 32,
    stripTargets: ['Magazine Assembly', 'Stock Assembly', 'Barrel Assembly', 'Grip Assembly', 'Receiver Assembly'],
  },
  'gun-rifle': {
    label: 'Longshot Scout Rifle',
    category: 'gun',
    price: 0,
    cashReward: 72,
    xpReward: 36,
    stripTargets: ['Magazine Assembly', 'Stock Assembly', 'Barrel Assembly', 'Grip Assembly', 'Receiver Assembly'],
  },
  'gun-shotgun': {
    label: 'Boreal Pump Shotgun',
    category: 'gun',
    price: 0,
    cashReward: 68,
    xpReward: 34,
    stripTargets: ['Stock Assembly', 'Barrel Assembly', 'Grip Assembly', 'Receiver Assembly'],
  },
  'gun-sniper': {
    label: 'Aster Precision Rifle',
    category: 'gun',
    price: 0,
    cashReward: 92,
    xpReward: 45,
    stripTargets: ['Optic Assembly', 'Magazine Assembly', 'Stock Assembly', 'Barrel Assembly', 'Grip Assembly', 'Receiver Assembly'],
  },
  'accessory-optic': { label: 'Prism Optic', category: 'accessory', price: 24, cashReward: 0, xpReward: 0 },
  'accessory-suppressor': { label: 'Quietline Sleeve', category: 'accessory', price: 28, cashReward: 0, xpReward: 0 },
  'accessory-drum': { label: 'Drum Magazine', category: 'accessory', price: 30, cashReward: 0, xpReward: 0 },
  'accessory-foregrip': { label: 'Stability Foregrip', category: 'accessory', price: 18, cashReward: 0, xpReward: 0 },
  'accessory-laser': { label: 'Targeting Module', category: 'accessory', price: 22, cashReward: 0, xpReward: 0 },
  'accessory-brake': { label: 'Muzzle Brake', category: 'accessory', price: 16, cashReward: 0, xpReward: 0 },
  'tool-torch': { label: 'Weld Torch', category: 'tool', price: 0, cashReward: 0, xpReward: 0 },
  'tool-driver': { label: 'Precision Driver', category: 'tool', price: 0, cashReward: 0, xpReward: 0 },
  'tool-wrench': { label: 'Workshop Wrench', category: 'tool', price: 0, cashReward: 0, xpReward: 0 },
  'tool-hammer': { label: 'Soft-Face Hammer', category: 'tool', price: 0, cashReward: 0, xpReward: 0 },
  'tool-pliers': { label: 'Grip Pliers', category: 'tool', price: 0, cashReward: 0, xpReward: 0 },
  'tool-oil-can': { label: 'Care Oil', category: 'tool', price: 0, cashReward: 0, xpReward: 0 },
};

export const STARTING_CREDITS = 250;
export const XP_PER_REMOVED_PART = 3;
export const XP_PER_ATTACHMENT = 8;
export const XP_PER_LEVEL = 100;
