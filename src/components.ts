/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineComponents, createComponent, Types } from '@iwsdk/core';
import { STARTING_CREDITS } from './data/workshop-items.js';

export const WorkshopItem = createComponent('WorkshopItem', {
  itemId: { type: Types.String, default: '' },
  strippedCount: { type: Types.Int8, default: 0 },
});

export const Interactable = createComponent('Interactable', {});

export const WorkshopWallet = createComponent('WorkshopWallet', {
  credits: { type: Types.Int32, default: STARTING_CREDITS },
  xp: { type: Types.Int32, default: 0 },
  level: { type: Types.Int16, default: 1 },
  score: { type: Types.Int32, default: 0 },
});

export const InteractionHighlight = createComponent('InteractionHighlight', {
  state: { type: Types.Int8, default: 0 },
  pulse: { type: Types.Boolean, default: false },
});

export const AssemblyPart = createComponent('AssemblyPart', {
  weaponId: { type: Types.String, default: '' },
  slot: { type: Types.String, default: '' },
  attachX: { type: Types.Float32, default: 0 },
  attachY: { type: Types.Float32, default: 0 },
  attachZ: { type: Types.Float32, default: 0 },
  attached: { type: Types.Boolean, default: false },
});

export const TutorialProgress = createComponent('TutorialProgress', {
  step: { type: Types.Int8, default: 0 },
  active: { type: Types.Boolean, default: true },
  complete: { type: Types.Boolean, default: false },
});

export default defineComponents([
  Interactable,
  WorkshopItem,
  WorkshopWallet,
  InteractionHighlight,
  AssemblyPart,
  TutorialProgress,
]);
