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
});

export const AttachedAccessory = createComponent('AttachedAccessory', {
  target: { type: Types.Entity, default: null },
  offsetX: { type: Types.Float32, default: 0 },
  offsetY: { type: Types.Float32, default: 0.12 },
  offsetZ: { type: Types.Float32, default: 0 },
});

export default defineComponents([Interactable, WorkshopItem, WorkshopWallet, AttachedAccessory]);
