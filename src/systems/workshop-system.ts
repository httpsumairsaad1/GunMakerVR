import {
  BackSide,
  createSystem,
  Entity,
  Grabbed,
  Hovered,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Pressed,
  Quaternion,
  Transform,
  UIKit,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { PART_BY_ITEM_ID, type GunPart } from '../data/gun-catalog.js';
import {
  XP_PER_ATTACHMENT,
  XP_PER_LEVEL,
  XP_PER_REMOVED_PART,
  WORKSHOP_ITEMS,
} from '../data/workshop-items.js';
import {
  AssemblyPart,
  Interactable,
  InteractionHighlight,
  TutorialProgress,
  WorkshopItem,
  WorkshopWallet,
} from '../components.js';

type SavedWallet = { credits: number; xp: number; score: number };
type HighlightEntry = {
  standards: Array<{
    material: MeshStandardMaterial;
    emissive: string;
    intensity: number;
  }>;
  outlines: Array<{ mesh: Mesh; material: MeshBasicMaterial }>;
};

export class WorkshopSystem extends createSystem({
  items: { required: [Interactable, WorkshopItem] },
  hovered: { required: [Interactable, WorkshopItem, Hovered] },
  pressed: { required: [Interactable, WorkshopItem, Pressed] },
  wallets: { required: [WorkshopWallet] },
  highlights: { required: [InteractionHighlight] },
  tutorials: { required: [TutorialProgress] },
  assemblyParts: { required: [AssemblyPart, WorkshopItem] },
  heldParts: { required: [AssemblyPart, WorkshopItem, Grabbed] },
  releasedParts: {
    required: [AssemblyPart, WorkshopItem],
    excluded: [Grabbed],
  },
}) {
  private selectedItem: Entity | null = null;
  private walletLabel!: UIKit.Text;
  private selectionLabel!: UIKit.Text;
  private hintLabel!: UIKit.Text;
  private rewardLabel!: UIKit.Text;
  private setActionLabel!: (text: string) => void;
  private readonly highlightEntries = new Map<Entity, HighlightEntry>();
  private readonly redFlashUntil = new Map<Entity, number>();
  private readonly receivers = new Map<string, Entity>();
  private readonly assemblyTarget = new Vector3();
  private readonly assemblyPosition = new Vector3();
  private readonly localPosition = new Vector3();
  private readonly assemblyScale = new Vector3();
  private readonly localScale = new Vector3();
  private readonly parentScale = new Vector3();
  private readonly assemblyRotation = new Quaternion();
  private readonly localRotation = new Quaternion();
  private readonly parentRotation = new Quaternion();
  private currentTime = 0;
  private audioContext: AudioContext | null = null;

  init(): void {
    const panel = this.world.requireSceneObject<UIKitMLAsset>('workshop-panel');
    this.walletLabel = panel.requireElementById<UIKit.Text>('wallet');
    this.selectionLabel = panel.requireElementById<UIKit.Text>('selection');
    this.hintLabel = panel.requireElementById<UIKit.Text>('hint');
    this.rewardLabel = panel.requireElementById<UIKit.Text>('reward');
    const actionButton = panel.requireElementById('strip-part');
    this.setActionLabel = (text) => actionButton.setProperties({ text });
    actionButton.addEventListener('click', this.removeNextPart);
    this.cleanupFuncs.push(() =>
      actionButton.removeEventListener('click', this.removeNextPart),
    );

    for (const entity of this.queries.assemblyParts.entities) {
      const itemId = entity.getValue(WorkshopItem, 'itemId');
      const part = itemId ? PART_BY_ITEM_ID.get(itemId) : undefined;
      if (!part) {
        console.error(`Assembly part "${itemId}" is missing from the local gun catalog.`);
        continue;
      }

      entity.setValue(AssemblyPart, 'weaponId', part.weaponId);
      entity.setValue(AssemblyPart, 'slot', part.slot);
      entity.setValue(AssemblyPart, 'attachX', part.attach_position[0]);
      entity.setValue(AssemblyPart, 'attachY', part.attach_position[1]);
      entity.setValue(AssemblyPart, 'attachZ', part.attach_position[2]);
      if (part.id === 'receiver' || part.id === 'frame') {
        this.receivers.set(part.weaponId, entity);
      }
    }

    const stopHover = this.queries.hovered.subscribe('qualify', (entity) => {
      this.setHighlight(entity, 1);
    });
    const stopGlow = this.queries.hovered.subscribe('disqualify', (entity) =>
      this.setHighlight(entity, entity === this.selectedItem ? 2 : 0),
    );
    const stopSelect = this.queries.pressed.subscribe('qualify', (entity) => {
      if (this.selectedItem && this.selectedItem !== entity) {
        this.setHighlight(this.selectedItem, 0);
      }
      this.setHighlight(entity, 2);
      this.selectItem(entity);
      this.playFeedback(780, 0.06);
    });
    const stopGrab = this.queries.heldParts.subscribe('qualify', (entity) => {
      if (!entity.getValue(AssemblyPart, 'attached')) return;
      entity.setValue(AssemblyPart, 'attached', false);
      this.setHighlight(entity, 5);
      this.rewardLabel.setProperties({ text: 'Part released from its slot' });
    });
    const stopRelease = this.queries.heldParts.subscribe('disqualify', (entity) => {
      this.tryAttachPart(entity);
    });
    const tutorial = this.queries.tutorials.entities.values().next().value;
    if (tutorial) this.loadTutorial(tutorial);
    this.cleanupFuncs.push(stopHover, stopGlow, stopSelect, stopGrab, stopRelease, () => {
      if (this.audioContext) void this.audioContext.close();
      for (const entry of this.highlightEntries.values()) {
        for (const outline of entry.outlines) {
          outline.mesh.parent?.remove(outline.mesh);
          outline.material.dispose();
        }
      }
      this.highlightEntries.clear();
    });
    const wallet = this.queries.wallets.entities.values().next().value;
    if (wallet) {
      this.loadWallet(wallet);
      this.updateWallet(wallet);
    }
  }

  private selectItem(entity: Entity): void {
    const itemId = entity.getValue(WorkshopItem, 'itemId');
    if (!itemId) return;
    const item = WORKSHOP_ITEMS[itemId];
    if (!item) {
      console.error(`Unknown workshop item "${itemId}".`);
      return;
    }

    this.selectedItem = entity;
    this.selectionLabel.setProperties({ text: item.label });
    if (item.category === 'gun') {
      const current = entity.getValue(WorkshopItem, 'strippedCount') ?? 0;
      const total = item.stripTargets?.length ?? 0;
      const nextPart = item.stripTargets?.[current] ?? 'Complete';
      const stats = item.stats;
      const statText = stats
        ? `DMG ${stats.damage}  ACC ${stats.accuracy}  RATE ${stats.fireRate}  RECOIL ${stats.recoil}  MAG ${stats.magazine}`
        : '';
      this.hintLabel.setProperties({
        text: `Part ${Math.min(current + 1, total)} of ${total}: ${nextPart}  ${statText}`,
      });
      this.setActionLabel('REMOVE NEXT PART');
    } else {
      const part = PART_BY_ITEM_ID.get(itemId);
      if (!part) {
        console.error(`Workshop part "${itemId}" is missing from the local gun catalog.`);
        return;
      }
      this.hintLabel.setProperties({
        text: `Place ${part.name} near its ${part.slot} slot, then release to snap.`,
      });
      this.setActionLabel('SNAP PART');
    }
    this.rewardLabel.setProperties({ text: 'Selection ready' });
  }

  private readonly removeNextPart = (): void => {
    const entity = this.selectedItem;
    if (!entity) {
      this.rewardLabel.setProperties({ text: 'Select a gun from the wall first' });
      return;
    }

    const itemId = entity.getValue(WorkshopItem, 'itemId');
    if (!itemId) {
      this.rewardLabel.setProperties({ text: 'Select a gun from the wall first' });
      return;
    }
    const item = WORKSHOP_ITEMS[itemId];
    if (!item) {
      this.rewardLabel.setProperties({ text: 'Select a gun from the wall first' });
      return;
    }
    if (item.category === 'part') {
      this.tryAttachPart(entity);
      return;
    }
    if (item.category !== 'gun' || !item.stripTargets) {
      this.rewardLabel.setProperties({ text: 'Select a gun first' });
      return;
    }

    const strippedCount = entity.getValue(WorkshopItem, 'strippedCount') ?? 0;
    const partName = item.stripTargets[strippedCount];
    if (!partName) {
      this.rewardLabel.setProperties({ text: 'This gun is already disassembled' });
      return;
    }

    const part = entity.object3D?.getObjectByName(partName);
    if (!part) {
      console.error(`Gun "${itemId}" is missing disassembly part "${partName}".`);
      this.rewardLabel.setProperties({ text: 'Part unavailable - select another gun' });
      return;
    }

    part.visible = false;
    this.setHighlight(entity, 5);
    this.playFeedback(420, 0.12);
    const nextCount = strippedCount + 1;
    entity.setValue(WorkshopItem, 'strippedCount', nextCount);
    const wallet = this.queries.wallets.entities.values().next().value;
    if (!wallet) {
      console.error('Workshop wallet entity is missing.');
      return;
    }

    let xp = (wallet.getValue(WorkshopWallet, 'xp') ?? 0) + XP_PER_REMOVED_PART;
    let credits = wallet.getValue(WorkshopWallet, 'credits') ?? 0;
    let score = wallet.getValue(WorkshopWallet, 'score') ?? 0;
    const complete = nextCount >= item.stripTargets.length;
    if (complete) {
      credits += item.cashReward;
      xp += item.xpReward;
    }
    score += XP_PER_REMOVED_PART + (complete ? item.xpReward : 0);
    wallet.setValue(WorkshopWallet, 'credits', credits);
    wallet.setValue(WorkshopWallet, 'xp', xp);
    wallet.setValue(WorkshopWallet, 'level', Math.floor(xp / XP_PER_LEVEL) + 1);
    wallet.setValue(WorkshopWallet, 'score', score);
    this.persistWallet(credits, xp, score);
    this.updateWallet(wallet);

    const nextPart = item.stripTargets[nextCount];
    this.hintLabel.setProperties({
      text: complete ? 'All modules removed. Choose another wall gun.' : `Next: ${nextPart}`,
    });
    this.rewardLabel.setProperties({
      text: complete
        ? `+${item.cashReward} credits  +${item.xpReward + XP_PER_REMOVED_PART} XP`
        : `+${XP_PER_REMOVED_PART} XP`,
    });
  };

  update(_delta: number, time: number): void {
    this.currentTime = time;
    for (const entity of this.queries.highlights.entities) {
      const state = entity.getValue(InteractionHighlight, 'state') ?? 0;
      if (state === 3) {
        this.applyHighlight(entity, '#39D98A', 0.3 + Math.sin(time * 8) * 0.12);
      } else if (state === 4 && time >= (this.redFlashUntil.get(entity) ?? time)) {
        this.setHighlight(entity, entity === this.selectedItem ? 2 : 0);
      }
    }

    for (const entity of this.queries.releasedParts.entities) {
      if (!entity.getValue(AssemblyPart, 'attached')) continue;
      const itemId = entity.getValue(WorkshopItem, 'itemId');
      const part = itemId ? PART_BY_ITEM_ID.get(itemId) : undefined;
      if (!part || part.id === 'receiver' || part.id === 'frame') continue;
      this.applyAssemblyTransform(entity, part);
    }
  }

  private tryAttachPart(entity: Entity): void {
    const itemId = entity.getValue(WorkshopItem, 'itemId');
    const part = itemId ? PART_BY_ITEM_ID.get(itemId) : undefined;
    if (!part) {
      console.error(`Cannot snap assembly part "${itemId}": no local gun catalog entry exists.`);
      return;
    }
    if (part.id === 'receiver' || part.id === 'frame') {
      this.rewardLabel.setProperties({ text: 'Choose a part to attach to the receiver' });
      return;
    }
    const receiver = this.receivers.get(part.weaponId);
    if (!receiver?.object3D || !entity.object3D) {
      this.rewardLabel.setProperties({ text: 'Place the receiver on the bench first' });
      this.setHighlight(entity, 4);
      return;
    }

    this.setAssemblyTarget(part, receiver);
    entity.object3D.getWorldPosition(this.assemblyPosition);
    if (this.assemblyPosition.distanceToSquared(this.assemblyTarget) > 0.12 * 0.12) {
      this.setHighlight(entity, 4);
      this.rewardLabel.setProperties({ text: `Wrong slot - move to ${part.slot}` });
      this.playFeedback(260, 0.08);
      return;
    }

    this.applyAssemblyTransform(entity, part);
    entity.setValue(AssemblyPart, 'attached', true);
    this.setHighlight(entity, 3);
    this.selectionLabel.setProperties({ text: `${part.name} snapped` });
    this.hintLabel.setProperties({ text: `${part.slot.toUpperCase()} SLOT LOCKED` });
    this.rewardLabel.setProperties({ text: `+${XP_PER_ATTACHMENT} XP  |  +${XP_PER_ATTACHMENT} SCORE` });

    const wallet = this.queries.wallets.entities.values().next().value;
    if (!wallet) {
      console.error('Workshop wallet entity is missing.');
      return;
    }
    const credits = wallet.getValue(WorkshopWallet, 'credits') ?? 0;
    const xp = (wallet.getValue(WorkshopWallet, 'xp') ?? 0) + XP_PER_ATTACHMENT;
    const score = (wallet.getValue(WorkshopWallet, 'score') ?? 0) + XP_PER_ATTACHMENT;
    wallet.setValue(WorkshopWallet, 'xp', xp);
    wallet.setValue(WorkshopWallet, 'level', Math.floor(xp / XP_PER_LEVEL) + 1);
    wallet.setValue(WorkshopWallet, 'score', score);
    this.persistWallet(credits, xp, score);
    this.updateWallet(wallet);
    this.playFeedback(920, 0.1);
  }

  private setAssemblyTarget(part: GunPart, receiver: Entity): void {
    const targetObject = receiver.object3D;
    if (!targetObject) return;
    targetObject.updateWorldMatrix(true, false);
    this.assemblyTarget.set(
      part.attach_position[0],
      part.attach_position[1],
      part.attach_position[2],
    );
    targetObject.localToWorld(this.assemblyTarget);
  }

  private applyAssemblyTransform(entity: Entity, part: GunPart): void {
    const receiver = this.receivers.get(part.weaponId);
    const receiverObject = receiver?.object3D;
    const object = entity.object3D;
    if (!receiverObject || !object) return;

    this.setAssemblyTarget(part, receiver);
    receiverObject.getWorldQuaternion(this.assemblyRotation);
    receiverObject.getWorldScale(this.assemblyScale);
    this.localPosition.copy(this.assemblyTarget);
    this.localRotation.copy(this.assemblyRotation);
    this.localScale.copy(this.assemblyScale);
    if (object.parent) {
      object.parent.worldToLocal(this.localPosition);
      object.parent.getWorldQuaternion(this.parentRotation);
      this.localRotation.premultiply(this.parentRotation.invert());
      object.parent.getWorldScale(this.parentScale);
      this.localScale.divide(this.parentScale);
    }

    object.position.copy(this.localPosition);
    object.quaternion.copy(this.localRotation);
    object.scale.copy(this.localScale);
    const position = entity.getVectorView(Transform, 'position');
    position[0] = this.localPosition.x;
    position[1] = this.localPosition.y;
    position[2] = this.localPosition.z;
    const orientation = entity.getVectorView(Transform, 'orientation');
    orientation[0] = this.localRotation.x;
    orientation[1] = this.localRotation.y;
    orientation[2] = this.localRotation.z;
    orientation[3] = this.localRotation.w;
    const scale = entity.getVectorView(Transform, 'scale');
    scale[0] = this.localScale.x;
    scale[1] = this.localScale.y;
    scale[2] = this.localScale.z;
  }

  private setHighlight(entity: Entity, state: number): void {
    if (!entity.hasComponent(InteractionHighlight)) return;
    entity.setValue(InteractionHighlight, 'state', state);
    if (state === 4) {
      this.redFlashUntil.set(entity, this.currentTime + 0.4);
    } else {
      this.redFlashUntil.delete(entity);
    }
    this.applyHighlight(
      entity,
      state === 1 ? '#FFFFFF' :
        state === 2 ? '#38BDF8' :
          state === 3 ? '#39D98A' :
            state === 4 || state === 5 ? '#F04452' :
              '#000000',
      state === 1 ? 0.12 : state === 2 ? 0.4 : state >= 3 ? 0.42 : 0,
    );
  }

  private applyHighlight(entity: Entity, color: string, intensity: number): void {
    const entry = this.getHighlightEntry(entity);
    const state = entity.getValue(InteractionHighlight, 'state') ?? 0;
    for (const standard of entry.standards) {
      if (state === 0) {
        standard.material.emissive.set(standard.emissive);
        standard.material.emissiveIntensity = standard.intensity;
      } else {
        standard.material.emissive.set(color);
        standard.material.emissiveIntensity = intensity;
      }
    }
    const opacity =
      state === 1 ? 0.28 :
        state === 2 ? 0.7 :
          state === 3 ? 0.55 + intensity * 0.35 :
            state >= 4 ? 0.72 : 0;
    const scale = state === 1 ? 1.025 : state === 2 ? 1.045 : state === 3 ? 1.04 + intensity * 0.02 : 1.05;
    for (const outline of entry.outlines) {
      outline.material.color.set(color);
      outline.material.opacity = opacity;
      outline.mesh.scale.setScalar(scale);
      outline.mesh.visible = state !== 0;
    }
  }

  private getHighlightEntry(entity: Entity): HighlightEntry {
    const existing = this.highlightEntries.get(entity);
    if (existing) return existing;

    const entry: HighlightEntry = { standards: [], outlines: [] };
    const meshes: Mesh[] = [];
    entity.object3D?.traverse((object) => {
      if (object instanceof Mesh) meshes.push(object);
    });
    for (const mesh of meshes) {
      const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const clones = source.map((material) => material.clone());
      mesh.material = Array.isArray(mesh.material) ? clones : clones[0];
      for (const material of clones) {
        if (material instanceof MeshStandardMaterial) {
          entry.standards.push({
            material,
            emissive: material.emissive.getHexString(),
            intensity: material.emissiveIntensity,
          });
        }
      }

      const outlineMaterial = new MeshBasicMaterial({
        color: '#38BDF8',
        side: BackSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      });
      const outline = new Mesh(mesh.geometry, outlineMaterial);
      outline.name = 'Interaction Outline';
      outline.scale.setScalar(1.045);
      outline.visible = false;
      outline.raycast = () => {};
      mesh.add(outline);
      entry.outlines.push({ mesh: outline, material: outlineMaterial });
    }

    this.highlightEntries.set(entity, entry);
    return entry;
  }

  private loadTutorial(progress: Entity): void {
    try {
      const complete = window.localStorage.getItem('gunmaker-tutorial-v1') === 'complete';
      progress.setValue(TutorialProgress, 'complete', complete);
      progress.setValue(TutorialProgress, 'active', !complete);
      progress.setValue(TutorialProgress, 'step', complete ? 5 : 0);
    } catch (error) {
      console.warn('Using first-run tutorial defaults because saved progress could not be loaded.', error);
    }
  }

  private loadWallet(wallet: Entity): void {
    try {
      const raw = window.localStorage.getItem('gunmaker-wallet-v1');
      if (raw === null) return;
      const saved: unknown = JSON.parse(raw);
      if (
        typeof saved !== 'object' ||
        saved === null ||
        !('credits' in saved) ||
        !('xp' in saved) ||
        typeof saved.credits !== 'number' ||
        typeof saved.xp !== 'number' ||
        !Number.isSafeInteger(saved.credits) ||
        !Number.isSafeInteger(saved.xp) ||
        saved.credits < 0 ||
        saved.xp < 0
      ) {
        throw new Error('Saved wallet has an invalid shape.');
      }
      const score =
        'score' in saved &&
        typeof saved.score === 'number' &&
        Number.isSafeInteger(saved.score) &&
        saved.score >= 0
          ? saved.score
          : 0;
      wallet.setValue(WorkshopWallet, 'credits', saved.credits);
      wallet.setValue(WorkshopWallet, 'xp', saved.xp);
      wallet.setValue(WorkshopWallet, 'level', Math.floor(saved.xp / XP_PER_LEVEL) + 1);
      wallet.setValue(WorkshopWallet, 'score', score);
    } catch (error) {
      console.warn('Using the authored starter wallet because saved data could not be loaded.', error);
    }
  }

  private persistWallet(credits: number, xp: number, score: number): void {
    try {
      const saved: SavedWallet = { credits, xp, score };
      window.localStorage.setItem('gunmaker-wallet-v1', JSON.stringify(saved));
    } catch (error) {
      console.error('Could not save workshop wallet progress.', error);
    }
  }

  private updateWallet(wallet: Entity): void {
    const credits = wallet.getValue(WorkshopWallet, 'credits') ?? 0;
    const xp = wallet.getValue(WorkshopWallet, 'xp') ?? 0;
    const level = wallet.getValue(WorkshopWallet, 'level') ?? 1;
    const score = wallet.getValue(WorkshopWallet, 'score') ?? 0;
    this.walletLabel.setProperties({ text: `${credits} CREDITS  |  LV ${level}  |  ${xp} XP  |  ${score} SCORE` });
  }

  private playFeedback(frequency: number, duration: number): void {
    const context = this.audioContext ??= new AudioContext();
    void context.resume();
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    const start = context.currentTime;
    oscillator.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(0.025, start + 0.008);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }
}
