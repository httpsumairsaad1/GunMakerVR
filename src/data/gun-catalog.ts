import gunPack from '../../VRGunMaker_Guns_LowPoly/manifest.json';

type GunStats = {
  damage: number;
  accuracy: number;
  fireRate: number;
  recoil: number;
  magazine: number;
};

const gunStats: Record<string, GunStats> = {
  bolt_sniper: { damage: 92, accuracy: 96, fireRate: 28, recoil: 78, magazine: 5 },
  drum_shotgun: { damage: 88, accuracy: 58, fireRate: 42, recoil: 82, magazine: 12 },
  assault_rifle: { damage: 68, accuracy: 76, fireRate: 74, recoil: 56, magazine: 30 },
  grenade_launcher: { damage: 100, accuracy: 62, fireRate: 22, recoil: 96, magazine: 6 },
  drum_pistol: { damage: 54, accuracy: 70, fireRate: 64, recoil: 44, magazine: 18 },
};

const gunPrices: Record<string, number> = {
  bolt_sniper: 140,
  drum_shotgun: 120,
  assault_rifle: 95,
  grenade_launcher: 160,
  drum_pistol: 50,
};

export const GUN_CATALOG = gunPack.guns.map((gun) => {
  if (
    !Object.prototype.hasOwnProperty.call(gunPrices, gun.id) ||
    !Object.prototype.hasOwnProperty.call(gunStats, gun.id)
  ) {
    throw new Error(`Gun pack entry "${gun.id}" is missing price or stats metadata.`);
  }
  const gunId = gun.id.replace(/_/g, '-');
  return {
    ...gun,
    itemId: `gun-${gunId}`,
    price: gunPrices[gun.id],
    stats: gunStats[gun.id],
    parts: gun.parts.map((part) => ({
      ...part,
      weaponId: gun.id,
      weaponName: gun.name,
      itemId: `part-${gunId}-${part.id.replace(/_/g, '-')}`,
      assetId: `part-${gunId}-${part.id.replace(/_/g, '-')}`,
    })),
  };
});

export type GunCatalogEntry = (typeof GUN_CATALOG)[number];
export type GunPart = GunCatalogEntry['parts'][number];

export const GUN_BY_ITEM_ID = new Map(
  GUN_CATALOG.map((gun) => [gun.itemId, gun]),
);

export const PART_BY_ITEM_ID = new Map(
  GUN_CATALOG.flatMap((gun) => gun.parts.map((part) => [part.itemId, part])),
);
