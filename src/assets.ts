/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AssetType, defineAssets } from '@iwsdk/core';
import gunPack from '../VRGunMaker_Guns_LowPoly/manifest.json';
import { createStudioFloor } from './scene-assets/studio.scene-asset.js';
import { createWorkbench } from './scene-assets/workbench.scene-asset.js';
import {
  accessories,
  createGunWall,
  tools,
} from './scene-assets/arsenal.scene-asset.js';

const gunModelUrls = import.meta.glob(
  '../VRGunMaker_Guns_LowPoly/**/*.glb',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;

function gltfAsset(path: string) {
  const url = gunModelUrls[`../VRGunMaker_Guns_LowPoly/${path}`];
  if (!url) {
    throw new Error(`Gun model is missing from the local pack: ${path}`);
  }
  return { url, type: AssetType.GLTF };
}

const gunAssets = Object.fromEntries(
  gunPack.guns.flatMap((gun) => {
    const gunId = gun.id.replace(/_/g, '-');
    return [
      [`gun-${gunId}`, gltfAsset(gun.assembled)],
      ...gun.parts.map((part) => [
        `part-${gunId}-${part.id.replace(/_/g, '-')}`,
        gltfAsset(part.file),
      ]),
    ];
  }),
);

export default defineAssets({
  'studio-floor': createStudioFloor(),
  workbench: createWorkbench(),
  'gun-wall': createGunWall(),
  ...gunAssets,
  'workshop-card': {
    url: `${import.meta.env.BASE_URL}ui/workshop-card.uikitml`,
    type: AssetType.UIKitML,
  },
  ...Object.fromEntries(
    Object.entries(accessories).map(([id, create]) => [id, create()]),
  ),
  ...Object.fromEntries(Object.entries(tools).map(([id, create]) => [id, create()])),
});
