import {
  createSystem,
  Entity,
  Grabbed,
  Hovered,
  Mesh,
  MeshStandardMaterial,
  Pressed,
  Quaternion,
  UIKit,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import {
  XP_PER_ATTACHMENT,
  XP_PER_LEVEL,
  XP_PER_REMOVED_PART,
  WORKSHOP_ITEMS,
} from '../data/workshop-items.js';
import {
  AttachedAccessory,
  Interactable,
  WorkshopItem,
  WorkshopWallet,
} from '../components.js';

type SavedWallet = { credits: number; xp: number };

export class WorkshopSystem extends createSystem({
  items: { required: [Interactable, WorkshopItem] },
  hovered: { required: [Interactable, WorkshopItem, Hovered] },
  pressed: { required: [Interactable, WorkshopItem, Pressed] },
  wallets: { required: [WorkshopWallet] },
  attached: {
    required: [AttachedAccessory],
    excluded: [Grabbed],
  },
}) {
  private selectedItem: Entity | null = null;
  private selectedGun: Entity | null = null;
  private walletLabel!: UIKit.Text;
  private selectionLabel!: UIKit.Text;
  private hintLabel!: UIKit.Text;
  private rewardLabel!: UIKit.Text;
  private setActionLabel!: (text: string) => void;
  private readonly originalMaterials = new WeakMap<Entity, Array<[Mesh, MeshStandardMaterial[]]>>();
  private readonly attachmentPoint = new Vector3();
  private readonly attachmentRotation = new Quaternion();
  private readonly attachmentScale = new Vector3();
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

    const stopHover = this.queries.hovered.subscribe('qualify', (entity) => {
      this.setGlow(entity, true);
    });
    const stopGlow = this.queries.hovered.subscribe('disqualify', (entity) =>
      this.setGlow(entity, false),
    );
    const stopSelect = this.queries.pressed.subscribe('qualify', (entity) => {
      this.selectItem(entity);
      this.playFeedback(780, 0.06);
    });
    this.cleanupFuncs.push(stopHover, stopGlow, stopSelect, () => {
      if (this.audioContext) void this.audioContext.close();
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
      this.selectedGun = entity;
      const current = entity.getValue(WorkshopItem, 'strippedCount') ?? 0;
      const total = item.stripTargets?.length ?? 0;
      const nextPart = item.stripTargets?.[current] ?? 'Complete';
      this.hintLabel.setProperties({ text: `Part ${Math.min(current + 1, total)} of ${total}: ${nextPart}` });
      this.setActionLabel('REMOVE NEXT PART');
    } else {
      const category = item.category === 'tool' ? 'maker tool' : 'gun accessory';
      this.hintLabel.setProperties({ text: `Selected ${category}. Pinch to grab, turn to inspect.` });
      const attached = entity.getValue(AttachedAccessory, 'target');
      this.setActionLabel(
        item.category === 'accessory'
          ? attached ? 'DETACH ACCESSORY' : 'ATTACH TO SELECTED GUN'
          : 'SELECT A GUN OR ACCESSORY',
      );
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
    if (item.category === 'accessory') {
      this.toggleAccessory(entity, itemId, item.price);
      return;
    }
    if (item.category !== 'gun' || !item.stripTargets) {
      this.rewardLabel.setProperties({ text: 'Select a gun or accessory first' });
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
    const complete = nextCount >= item.stripTargets.length;
    if (complete) {
      credits += item.cashReward;
      xp += item.xpReward;
    }
    wallet.setValue(WorkshopWallet, 'credits', credits);
    wallet.setValue(WorkshopWallet, 'xp', xp);
    wallet.setValue(WorkshopWallet, 'level', Math.floor(xp / XP_PER_LEVEL) + 1);
    this.persistWallet(credits, xp);
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

  update(): void {
    for (const entity of this.queries.attached.entities) {
      const target = entity.getValue(AttachedAccessory, 'target');
      const object = entity.object3D;
      const targetObject = target?.object3D;
      if (!object || !targetObject) continue;

      targetObject.updateWorldMatrix(true, false);
      targetObject.getWorldQuaternion(this.attachmentRotation);
      targetObject.getWorldScale(this.attachmentScale);
      this.attachmentPoint.set(
        entity.getValue(AttachedAccessory, 'offsetX') ?? 0,
        entity.getValue(AttachedAccessory, 'offsetY') ?? 0,
        entity.getValue(AttachedAccessory, 'offsetZ') ?? 0,
      );
      targetObject.localToWorld(this.attachmentPoint);
      object.position.copy(this.attachmentPoint);
      object.quaternion.copy(this.attachmentRotation);
      object.scale.copy(this.attachmentScale);
    }
  }

  private toggleAccessory(entity: Entity, itemId: string, price: number): void {
    const currentTarget = entity.getValue(AttachedAccessory, 'target');
    if (currentTarget) {
      entity.setValue(AttachedAccessory, 'target', null);
      this.setActionLabel('ATTACH TO SELECTED GUN');
      this.rewardLabel.setProperties({ text: 'Accessory detached' });
      this.playFeedback(420, 0.1);
      return;
    }
    if (!this.selectedGun) {
      this.rewardLabel.setProperties({ text: 'Select a wall gun before attaching an accessory' });
      return;
    }

    const wallet = this.queries.wallets.entities.values().next().value;
    if (!wallet) {
      console.error('Workshop wallet entity is missing.');
      return;
    }
    const credits = wallet.getValue(WorkshopWallet, 'credits') ?? 0;
    if (credits < price) {
      this.rewardLabel.setProperties({ text: `Need ${price - credits} more credits` });
      return;
    }

    const offset = this.accessoryOffset(itemId);
    wallet.setValue(WorkshopWallet, 'credits', credits - price);
    const xp = (wallet.getValue(WorkshopWallet, 'xp') ?? 0) + XP_PER_ATTACHMENT;
    wallet.setValue(WorkshopWallet, 'xp', xp);
    wallet.setValue(WorkshopWallet, 'level', Math.floor(xp / XP_PER_LEVEL) + 1);
    entity.setValue(AttachedAccessory, 'target', this.selectedGun);
    entity.setValue(AttachedAccessory, 'offsetX', offset[0]);
    entity.setValue(AttachedAccessory, 'offsetY', offset[1]);
    entity.setValue(AttachedAccessory, 'offsetZ', offset[2]);
    this.persistWallet(credits - price, xp);
    this.updateWallet(wallet);
    this.setActionLabel('DETACH ACCESSORY');
    this.rewardLabel.setProperties({ text: `-${price} credits  +${XP_PER_ATTACHMENT} XP` });
    this.playFeedback(920, 0.1);
  }

  private accessoryOffset(itemId: string): [number, number, number] {
    if (itemId === 'accessory-optic') return [-0.08, 0.16, 0];
    if (itemId === 'accessory-suppressor' || itemId === 'accessory-brake') return [0.62, 0.02, 0];
    if (itemId === 'accessory-drum') return [0, -0.17, 0];
    if (itemId === 'accessory-foregrip') return [0.25, -0.11, 0];
    return [0, -0.1, 0.08];
  }

  private setGlow(entity: Entity, active: boolean): void {
    let entries = this.originalMaterials.get(entity);
    if (!entries) {
      entries = [];
      entity.object3D?.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const source = Array.isArray(object.material) ? object.material : [object.material];
        const clones = source.map((material) => material.clone());
        object.material = Array.isArray(object.material) ? clones : clones[0];
        const standards = clones.filter(
          (material): material is MeshStandardMaterial => material instanceof MeshStandardMaterial,
        );
        if (standards.length > 0) entries?.push([object, standards]);
      });
      this.originalMaterials.set(entity, entries);
    }

    for (const [, materials] of entries) {
      for (const material of materials) {
        material.emissive.set(active ? '#35c9a0' : '#000000');
        material.emissiveIntensity = active ? 0.42 : 0;
      }
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
      wallet.setValue(WorkshopWallet, 'credits', saved.credits);
      wallet.setValue(WorkshopWallet, 'xp', saved.xp);
      wallet.setValue(WorkshopWallet, 'level', Math.floor(saved.xp / XP_PER_LEVEL) + 1);
    } catch (error) {
      console.warn('Using the authored starter wallet because saved data could not be loaded.', error);
    }
  }

  private persistWallet(credits: number, xp: number): void {
    try {
      const saved: SavedWallet = { credits, xp };
      window.localStorage.setItem('gunmaker-wallet-v1', JSON.stringify(saved));
    } catch (error) {
      console.error('Could not save workshop wallet progress.', error);
    }
  }

  private updateWallet(wallet: Entity): void {
    const credits = wallet.getValue(WorkshopWallet, 'credits') ?? 0;
    const xp = wallet.getValue(WorkshopWallet, 'xp') ?? 0;
    const level = wallet.getValue(WorkshopWallet, 'level') ?? 1;
    this.walletLabel.setProperties({ text: `${credits} CREDITS  |  LV ${level}  |  ${xp} XP` });
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
