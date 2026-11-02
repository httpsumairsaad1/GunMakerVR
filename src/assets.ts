/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AssetType, defineAssets } from '@iwsdk/core';
import { createStudioFloor } from './scene-assets/studio.scene-asset.js';
import { createWorkbench } from './scene-assets/workbench.scene-asset.js';
import {
  accessories,
  createGunWall,
  guns,
  tools,
} from './scene-assets/arsenal.scene-asset.js';

export default defineAssets({
  'studio-floor': createStudioFloor(),
  workbench: createWorkbench(),
  'gun-wall': createGunWall(),
  'workshop-card': {
    url: `${import.meta.env.BASE_URL}ui/workshop-card.uikitml`,
    type: AssetType.UIKitML,
  },
  ...Object.fromEntries(
    Object.entries(guns).map(([id, create]) => [id, create()]),
  ),
  ...Object.fromEntries(
    Object.entries(accessories).map(([id, create]) => [id, create()]),
  ),
  ...Object.fromEntries(Object.entries(tools).map(([id, create]) => [id, create()])),
});
