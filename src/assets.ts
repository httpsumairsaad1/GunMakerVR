/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineAssets } from '@iwsdk/core';
import { createStudioFloor } from './scene-assets/studio.scene-asset.js';
import { createWorkbench } from './scene-assets/workbench.scene-asset.js';

export default defineAssets({
  'studio-floor': createStudioFloor(),
  workbench: createWorkbench(),
});
