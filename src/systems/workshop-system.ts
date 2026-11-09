import {
  AssetManager, BackSide, Box3, createSystem, DistanceGrabbable, DoubleSide, Entity, Euler, Grabbed, Group,
  Hovered, InputComponent, Interactable, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D,
  OneHandGrabbable, PlaneGeometry, Pressed, Quaternion, RayInteractable, Raycaster, RingGeometry,
  Transform, UIKitMLAsset, Vector3,
} from '@iwsdk/core';
import { PART_BY_ITEM_ID, type GunPart } from '../data/gun-catalog.js';
import {
  BENCH, FREE_GUN, GUN_ORDER, SLOT_COLORS, STORE_XP, TUTORIAL_GUN, TUTORIAL_XP, UNLOCK_LEVEL,
  gunById, isBase, levelFromXp, rankFor, stepsFor, surfaceY, xpIntoLevel,
} from '../data/game-data.js';
import { XP_PER_ATTACHMENT, XP_PER_LEVEL, XP_PER_REMOVED_PART, WORKSHOP_ITEMS } from '../data/workshop-items.js';
import { AssemblyPart, InteractionHighlight, TutorialProgress, WorkshopItem, WorkshopWallet } from '../components.js';
import { PanelRef } from '../ui/panel-ref.js';
import { makeLabel, RadialMenu, type WheelItem } from '../ui/radial-menu.js';

type Phase = 'idle' | 'preview' | 'building' | 'complete';
type Kit = { gunId: string; receiver: Entity; parts: Entity[] };
type Progress = { unlocked: string[]; collection: string[]; builds: number; sound: boolean; holo: boolean };
type HighlightEntry = {
  standards: Array<{ material: MeshStandardMaterial; emissive: string; intensity: number }>;
  outlines: Array<{ mesh: Mesh; material: MeshBasicMaterial }>;
};
type Pose = { p: Vector3; q: Quaternion };

const UP = new Vector3(0, 1, 0);
const HL_COLOR: Record<number, string> = { 1: '#ffffff', 2: '#4fc3ff', 3: '#3dff8f', 4: '#ff4d5e', 5: '#ff4d5e', 6: '#ffb04a', 7: '#ffb04a' };
const HL_INTENSITY: Record<number, number> = { 1: 0.12, 2: 0.4, 3: 0.42, 4: 0.45, 5: 0.45, 6: 0.4, 7: 0.25 };
const SNAP_DISTANCE = 0.14;
const PROGRESS_KEY = 'gunmaker-progress-v1';
const WALLET_KEY = 'gunmaker-wallet-v1';
const TUTORIAL_KEY = 'gunmaker-tutorial-v1';

export class WorkshopSystem extends createSystem({
  items: { required: [WorkshopItem] },
  hovered: { required: [WorkshopItem, Hovered] },
  pressed: { required: [WorkshopItem, Pressed] },
  grabbed: { required: [WorkshopItem, Grabbed] },
  wallets: { required: [WorkshopWallet] },
  highlights: { required: [InteractionHighlight] },
  tutorials: { required: [TutorialProgress] },
  assemblyParts: { required: [AssemblyPart, WorkshopItem] },
}) {
  // ---- panels
  private hud = new PanelRef(undefined);
  private menu = new PanelRef(undefined);
  private guide = new PanelRef(undefined);
  private stats = new PanelRef(undefined);
  private wheel!: RadialMenu;

  // ---- game state
  private phase: Phase = 'idle';
  private activeGun: string | null = null;
  private previewGun: string | null = null;
  private tutorialMode = false;
  private tutorialDone = false;
  private mistakes = 0;
  private startTime = 0;
  private lastRank = { rank: 'B', mult: 1 };
  private lastValue = 0;
  private menuOpen = false;
  private resetArmed = false;
  private progress: Progress = { unlocked: [FREE_GUN], collection: [], builds: 0, sound: true, holo: true };
  private selected: Entity | null = null;
  private wallet: Entity | undefined;

  // ---- world bookkeeping
  private readonly kits = new Map<string, Kit>();
  private readonly gunEntities = new Map<string, Entity>();
  private readonly homes = new Map<Entity, Pose>();
  private readonly parked = new Set<Entity>();
  private readonly attachedStack: Entity[] = [];
  private readonly settling = new Map<Entity, { vy: number }>();
  private readonly returning = new Map<Entity, { t: number; from: Pose }>();
  private readonly highlightEntries = new Map<Entity, HighlightEntry>();
  private readonly redFlashUntil = new Map<Entity, number>();
  private readonly clickables = new Map<Object3D, () => void>();
  private readonly objectToItem = new Map<Object3D, Entity>();
  private readonly lastFire = new Map<unknown, number>();
  private readonly wallLabels = new Map<string, Mesh>();
  private readonly pulseStart = new Map<Entity, number>();

  // ---- hints / ghosts
  private hintEntity: Entity | null = null;
  private hintUntil = 0;
  private ghost: Object3D | null = null;
  private ghostFor: Entity | null = null;
  private bpGhost: Object3D | null = null;
  private bpGhostFor = '';
  private reticle!: Group;
  private holoMat: MeshBasicMaterial | null = null;
  private bpMat: MeshBasicMaterial | null = null;

  // ---- desktop crosshair
  private carried: { entity: Entity; dist: number } | null = null;
  private hoverEntity: Entity | null = null;
  private crosshairEl: HTMLDivElement | null = null;
  private readonly raycaster = new Raycaster();

  // ---- scratch (no allocation in update)
  private currentTime = 0;
  private audioContext: AudioContext | null = null;
  private readonly tmpA = new Vector3();
  private readonly tmpB = new Vector3();
  private readonly tmpC = new Vector3();
  private readonly tmpD = new Vector3();
  private readonly tmpQ = new Quaternion();
  private readonly tmpQ2 = new Quaternion();
  private readonly tmpE = new Euler();
  private readonly target = new Vector3();
  private readonly box = new Box3();
  private readonly lpV = new Vector3();
  private readonly lqQ = new Quaternion();
  private readonly pqQ = new Quaternion();
  private readonly psV = new Vector3();

  // =====================================================================
  init(): void {
    const panel = (id: string): PanelRef => {
      const root = this.world.getSceneObject<UIKitMLAsset>(id);
      if (!root) console.warn(`Scene panel "${id}" is missing from main.iwsdk.scene.json`);
      return new PanelRef(root);
    };
    this.hud = panel('workshop-panel');
    this.menu = panel('menu-panel');
    this.guide = panel('guide-panel');
    this.stats = panel('stats-panel');

    this.wallet = this.queries.wallets.entities.values().next().value;
    this.loadSave();

    this.wheel = new RadialMenu(
      (item) => this.onWheelPick(item),
      (o, fn) => this.clickables.set(o, fn),
      (o) => this.clickables.delete(o),
    );
    this.world.scene.add(this.wheel);
    this.reticle = this.makeReticle();
    this.world.scene.add(this.reticle);

    // Parts authored in the scene (the Assault Rifle kit)
    const byGun = new Map<string, Entity[]>();
    const receivers = new Map<string, Entity>();
    for (const entity of this.queries.assemblyParts.entities) {
      const part = this.registerPart(entity);
      if (!part) continue;
      byGun.set(part.weaponId, [...(byGun.get(part.weaponId) ?? []), entity]);
      if (isBase(part.id)) receivers.set(part.weaponId, entity);
    }
    for (const [gunId, list] of byGun) {
      const receiver = receivers.get(gunId);
      if (receiver) this.kits.set(gunId, { gunId, receiver, parts: list.filter((e) => e !== receiver) });
    }

    // Items: bind interactions, remember homes
    for (const entity of this.queries.items.entities) this.setupItem(entity);
    this.cleanupFuncs.push(this.queries.items.subscribe('qualify', (e) => this.setupItem(e)));

    // IWSDK Hovered / Pressed / Grabbed tags (XR rays, hands and mouse outside pointer lock)
    this.cleanupFuncs.push(
      this.queries.hovered.subscribe('qualify', (e) => { if (!this.isHeld(e) && e !== this.selected) this.setHighlight(e, 1); }),
      this.queries.hovered.subscribe('disqualify', (e) => { if (!this.isHeld(e)) this.restHighlight(e); }),
      this.queries.pressed.subscribe('qualify', (e) => this.onItemSelect(e)),
      this.queries.grabbed.subscribe('qualify', (e) => this.onGrabStart(e)),
      this.queries.grabbed.subscribe('disqualify', (e) => this.onRelease(e)),
    );

    this.bindUi();
    this.bindInput();

    const tut = this.queries.tutorials.entities.values().next().value;
    if (tut) {
      tut.setValue(TutorialProgress, 'complete', this.tutorialDone);
      tut.setValue(TutorialProgress, 'active', !this.tutorialDone);
    }
    this.cleanupFuncs.push(() => {
      for (const entry of this.highlightEntries.values()) for (const o of entry.outlines) { o.mesh.parent?.remove(o.mesh); o.material.dispose(); }
      this.highlightEntries.clear();
      void this.audioContext?.close();
      this.crosshairEl?.remove();
      this.world.scene.remove(this.wheel, this.reticle);
    });

    this.refreshWallLabels();
    this.openMenu(this.tutorialDone ? 'bp' : 'guide');
    this.refreshAll();
  }

  // =====================================================================  setup helpers
  private registerPart(entity: Entity): GunPart | undefined {
    const itemId = entity.getValue(WorkshopItem, 'itemId');
    const part = itemId ? PART_BY_ITEM_ID.get(itemId) : undefined;
    if (!part) { console.error(`Assembly part "${itemId}" is missing from the gun catalog.`); return undefined; }
    entity.setValue(AssemblyPart, 'weaponId', part.weaponId);
    entity.setValue(AssemblyPart, 'slot', part.slot);
    entity.setValue(AssemblyPart, 'attachX', part.attach_position[0]);
    entity.setValue(AssemblyPart, 'attachY', part.attach_position[1]);
    entity.setValue(AssemblyPart, 'attachZ', part.attach_position[2]);
    return part;
  }

  private setupItem(entity: Entity): void {
    const obj = entity.object3D;
    if (!obj) return;
    if (!entity.hasComponent(RayInteractable)) entity.addComponent(RayInteractable);
    obj.pointerEvents = 'auto';
    obj.traverse((c) => { c.pointerEvents = 'auto'; });
    this.objectToItem.set(obj, entity);
    obj.updateWorldMatrix(true, false);
    if (!this.homes.has(entity)) this.homes.set(entity, this.worldPose(obj));
    const itemId = entity.getValue(WorkshopItem, 'itemId') ?? '';
    if (WORKSHOP_ITEMS[itemId]?.category === 'gun') this.gunEntities.set(itemId.replace('gun-', '').replace(/-/g, '_'), entity);
    const enter = (): void => { if (!this.isHeld(entity) && entity !== this.selected) this.setHighlight(entity, 1); };
    const leave = (): void => { if (!this.isHeld(entity)) this.restHighlight(entity); };
    const click = (): void => this.onItemSelect(entity);
    obj.addEventListener('pointerenter', enter);
    obj.addEventListener('pointerleave', leave);
    obj.addEventListener('click', click);
    this.cleanupFuncs.push(() => {
      obj.removeEventListener('pointerenter', enter);
      obj.removeEventListener('pointerleave', leave);
      obj.removeEventListener('click', click);
    });
  }

  private bindUi(): void {
    const c = this.cleanupFuncs;
    const k = this.clickables;
    const on = (p: PanelRef, id: string, fn: () => void): void => p.onClick(id, fn, c, k);
    on(this.hud, 'btn-remove', () => this.removeLastPart());
    on(this.hud, 'btn-reset', () => this.resetBench());
    on(this.hud, 'btn-menu', () => this.toggleMenu());
    on(this.guide, 'gd-hint', () => this.hint());
    on(this.guide, 'gd-skip', () => this.skipTutorial());
    on(this.stats, 'sp-build', () => this.confirmBlueprint());
    on(this.stats, 'sp-store', () => this.storeGun());
    on(this.stats, 'sp-sell', () => this.sellGun());
    on(this.menu, 'nav-start', () => (this.tutorialDone ? this.showPage('bp') : this.startTutorial()));
    on(this.menu, 'nav-guide', () => this.showPage('guide'));
    on(this.menu, 'nav-stats', () => this.showPage('stats'));
    on(this.menu, 'nav-settings', () => this.showPage('settings'));
    on(this.menu, 'nav-exit', () => this.closeMenu());
    on(this.menu, 'bp-confirm', () => this.confirmBlueprint());
    on(this.menu, 'bp-tutorial', () => this.startTutorial());
    GUN_ORDER.forEach((gunId, i) => on(this.menu, `bp-${i + 1}`, () => this.previewBlueprint(gunId)));
    on(this.menu, 'set-sound', () => { this.progress.sound = !this.progress.sound; this.saveProgress(); this.refreshMenu(); });
    on(this.menu, 'set-holo', () => { this.progress.holo = !this.progress.holo; this.saveProgress(); this.refreshMenu(); });
    on(this.menu, 'set-reset', () => this.resetProgress());
  }

  private bindInput(): void {
    const keys = (ev: KeyboardEvent): void => {
      if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const key = ev.key.toLowerCase();
      if (key === 'm') this.toggleMenu();
      else if (key === 'b') this.toggleWheel();
      else if (key === 'h') this.hint();
      else if (key === 't') this.removeLastPart();
      else if (key >= '1' && key <= '5') this.previewBlueprint(GUN_ORDER[Number(key) - 1]);
      else if (key === 'enter') this.confirmBlueprint();
    };
    const down = (ev: MouseEvent): void => { if (document.pointerLockElement && ev.button === 0) this.crosshairDown(); };
    const up = (ev: MouseEvent): void => { if (ev.button === 0) this.crosshairUp(); };
    const wheel = (ev: WheelEvent): void => {
      if (!this.carried) return;
      this.carried.dist = Math.min(1.2, Math.max(0.25, this.carried.dist - Math.sign(ev.deltaY) * 0.04));
    };
    window.addEventListener('keydown', keys);
    document.addEventListener('mousedown', down);
    document.addEventListener('mouseup', up);
    document.addEventListener('wheel', wheel, { passive: true });
    this.cleanupFuncs.push(() => {
      window.removeEventListener('keydown', keys);
      document.removeEventListener('mousedown', down);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('wheel', wheel);
    });
  }

  // =====================================================================  persistence
  private loadSave(): void {
    try {
      const raw = window.localStorage.getItem(PROGRESS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Partial<Progress>;
        if (Array.isArray(s.unlocked)) this.progress.unlocked = Array.from(new Set([FREE_GUN, ...s.unlocked.filter((x) => typeof x === 'string')]));
        if (Array.isArray(s.collection)) this.progress.collection = s.collection.filter((x) => typeof x === 'string');
        if (typeof s.builds === 'number') this.progress.builds = s.builds;
        if (typeof s.sound === 'boolean') this.progress.sound = s.sound;
        if (typeof s.holo === 'boolean') this.progress.holo = s.holo;
      }
      this.tutorialDone = window.localStorage.getItem(TUTORIAL_KEY) === 'complete';
      const w = window.localStorage.getItem(WALLET_KEY);
      if (w && this.wallet) {
        const s = JSON.parse(w) as { credits?: number; xp?: number; score?: number };
        if (Number.isSafeInteger(s.credits) && Number.isSafeInteger(s.xp) && (s.credits as number) >= 0 && (s.xp as number) >= 0) {
          this.wallet.setValue(WorkshopWallet, 'credits', s.credits as number);
          this.wallet.setValue(WorkshopWallet, 'xp', s.xp as number);
          this.wallet.setValue(WorkshopWallet, 'level', levelFromXp(s.xp as number));
          this.wallet.setValue(WorkshopWallet, 'score', Number.isSafeInteger(s.score) ? (s.score as number) : 0);
        }
      }
    } catch (error) {
      console.warn('Saved progress could not be loaded; using defaults.', error);
    }
  }
  private saveProgress(): void {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(this.progress));
      window.localStorage.setItem(WALLET_KEY, JSON.stringify({ credits: this.credits(), xp: this.xp(), score: this.score() }));
      window.localStorage.setItem(TUTORIAL_KEY, this.tutorialDone ? 'complete' : 'pending');
    } catch (error) {
      console.error('Could not save progress.', error);
    }
  }
  private credits = (): number => this.wallet?.getValue(WorkshopWallet, 'credits') ?? 0;
  private xp = (): number => this.wallet?.getValue(WorkshopWallet, 'xp') ?? 0;
  private score = (): number => this.wallet?.getValue(WorkshopWallet, 'score') ?? 0;
  private award(credits: number, xp: number): void {
    if (!this.wallet) return;
    const total = this.xp() + xp;
    const before = levelFromXp(this.xp());
    this.wallet.setValue(WorkshopWallet, 'credits', Math.max(0, this.credits() + credits));
    this.wallet.setValue(WorkshopWallet, 'xp', total);
    this.wallet.setValue(WorkshopWallet, 'level', levelFromXp(total));
    this.wallet.setValue(WorkshopWallet, 'score', this.score() + Math.max(0, xp) + Math.max(0, credits));
    if (levelFromXp(total) > before) { this.refreshWallLabels(); this.beep(1040, 0.18); this.say(undefined, `LEVEL UP! You are now level ${levelFromXp(total)}`); }
    this.saveProgress();
  }

  // =====================================================================  blueprint / build flow
  private blueprintState(gunId: string): { owned: boolean; levelLocked: boolean; price: number } {
    const gun = gunById(gunId);
    return {
      owned: this.progress.unlocked.includes(gunId),
      levelLocked: levelFromXp(this.xp()) < (UNLOCK_LEVEL[gunId] ?? 1),
      price: gun?.price ?? 0,
    };
  }

  private previewBlueprint(gunId: string): void {
    if (!gunById(gunId)) return;
    if (this.phase === 'building' || this.phase === 'complete') {
      this.say('Finish or reset the current build first (RESET BENCH).', undefined);
      return;
    }
    this.previewGun = gunId;
    this.phase = 'preview';
    this.beep(780, 0.05);
    this.refreshAll();
  }

  private confirmBlueprint(): void {
    const gunId = this.previewGun;
    if (!gunId || this.phase === 'building' || this.phase === 'complete') {
      this.say('Select a blueprint first (wall gun, wheel, or keys 1-5).', undefined);
      return;
    }
    const s = this.blueprintState(gunId);
    if (s.levelLocked) { this.say(`Reach level ${UNLOCK_LEVEL[gunId]} to unlock this blueprint.`, 'LOCKED'); this.beep(260, 0.1); return; }
    if (!s.owned) {
      if (this.credits() < s.price) { this.say(`You need ${s.price - this.credits()} more credits.`, 'NOT ENOUGH CREDITS'); this.beep(260, 0.1); return; }
      this.progress.unlocked.push(gunId);
      this.award(-s.price, 0);
      this.refreshWallLabels();
      this.say(undefined, `Bought blueprint for ${s.price} CR`);
    }
    this.beginBuild(gunId, false);
  }

  private startTutorial(): void {
    if (this.phase === 'building' || this.phase === 'complete') this.resetBench();
    this.beginBuild(TUTORIAL_GUN, true);
  }

  private skipTutorial(): void {
    this.tutorialMode = false;
    this.tutorialDone = true;
    this.saveProgress();
    this.say('Tutorial skipped. Build any blueprint from the wall.', undefined);
    this.refreshAll();
  }

  private beginBuild(gunId: string, tutorial: boolean): void {
    const kit = this.ensureKit(gunId);
    if (!kit) { this.say('Parts for this gun could not be loaded.', 'ERROR'); return; }
    for (const [id, other] of this.kits) if (id !== gunId) this.parkKit(other);
    this.resetKit(kit);
    this.activeGun = gunId;
    this.previewGun = gunId;
    this.tutorialMode = tutorial && !this.tutorialDone;
    this.mistakes = 0;
    this.startTime = this.currentTime;
    this.phase = 'building';
    this.attachedStack.length = 0;
    this.closeMenu();
    this.hint();
    this.say(this.tutorialMode ? 'Tutorial: follow the glowing slot and release the part there.' : 'Pick each part and release it at its glowing slot.', 'BUILD STARTED');
    this.beep(900, 0.08);
    this.refreshAll();
  }

  private resetBench(): void {
    const kit = this.activeGun ? this.kits.get(this.activeGun) : undefined;
    if (kit) this.resetKit(kit);
    this.attachedStack.length = 0;
    this.mistakes = 0;
    this.startTime = this.currentTime;
    this.phase = this.activeGun ? 'building' : 'idle';
    this.say('Bench reset.', undefined);
    this.refreshAll();
  }

  private completeBuild(): void {
    const gunId = this.activeGun;
    if (!gunId) return;
    const item = WORKSHOP_ITEMS[`gun-${gunId.replace(/_/g, '-')}`];
    const seconds = this.currentTime - this.startTime;
    this.lastRank = rankFor(this.mistakes, seconds);
    this.lastValue = Math.round((item?.cashReward ?? 40) * this.lastRank.mult);
    this.phase = 'complete';
    this.hintEntity = null;
    let bonus = item?.xpReward ?? 20;
    if (this.tutorialMode) { bonus += TUTORIAL_XP; this.tutorialMode = false; this.tutorialDone = true; }
    this.award(0, bonus);
    this.say(`Rank ${this.lastRank.rank}  |  worth ${this.lastValue} CR`, `BUILD COMPLETE  +${bonus} XP`);
    this.beep(1180, 0.2);
    this.refreshAll();
  }

  private storeGun(): void {
    if (this.phase !== 'complete' || !this.activeGun) return;
    if (!this.progress.collection.includes(this.activeGun)) this.progress.collection.push(this.activeGun);
    this.progress.builds += 1;
    this.award(0, STORE_XP);
    this.finishRound(`Stored in the safe (${this.progress.collection.length}/${GUN_ORDER.length})`);
  }
  private sellGun(): void {
    if (this.phase !== 'complete' || !this.activeGun) return;
    this.progress.builds += 1;
    this.award(this.lastValue, 0);
    this.finishRound(`Sold for ${this.lastValue} CR`);
  }
  private finishRound(msg: string): void {
    const kit = this.activeGun ? this.kits.get(this.activeGun) : undefined;
    if (kit) this.resetKit(kit);
    this.attachedStack.length = 0;
    this.phase = 'idle';
    this.say('Choose your next blueprint from the wall or press M.', msg);
    this.saveProgress();
    this.refreshAll();
  }

  private resetProgress(): void {
    if (!this.resetArmed) { this.resetArmed = true; this.menu.text('set-reset', 'CLICK AGAIN TO CONFIRM'); return; }
    this.resetArmed = false;
    try { window.localStorage.removeItem(PROGRESS_KEY); window.localStorage.removeItem(WALLET_KEY); window.localStorage.removeItem(TUTORIAL_KEY); } catch { /* ignore */ }
    this.progress = { unlocked: [FREE_GUN], collection: [], builds: 0, sound: true, holo: true };
    this.tutorialDone = false;
    this.wallet?.setValue(WorkshopWallet, 'credits', 250);
    this.wallet?.setValue(WorkshopWallet, 'xp', 0);
    this.wallet?.setValue(WorkshopWallet, 'level', 1);
    this.wallet?.setValue(WorkshopWallet, 'score', 0);
    this.saveProgress();
    this.refreshAll();
    this.refreshWallLabels();
  }

  // =====================================================================  kits (parts on the bench)
  private ensureKit(gunId: string): Kit | undefined {
    const existing = this.kits.get(gunId);
    if (existing) return existing;
    try {
      const gun = gunById(gunId);
      if (!gun) return undefined;
      const spawned: Array<{ entity: Entity; part: GunPart }> = [];
      for (const part of gun.parts) {
        const gltf = AssetManager.getGLTF(part.assetId);
        if (!gltf) throw new Error(`Asset "${part.assetId}" is not loaded`);
        const entity = this.world.createTransformEntity(gltf.scene);
        entity.addComponent(WorkshopItem, { itemId: part.itemId });
        entity.addComponent(AssemblyPart);
        entity.addComponent(InteractionHighlight);
        entity.addComponent(Interactable);
        entity.addComponent(RayInteractable);
        entity.addComponent(OneHandGrabbable, { rotate: true, translate: true });
        this.registerPart(entity);
        spawned.push({ entity, part });
      }
      const base = spawned.find((s) => isBase(s.part.id));
      if (!base) throw new Error('Gun has no receiver/frame');
      this.layoutKit(spawned.map((s) => s.entity), base.entity, gunId);
      for (const s of spawned) {
        s.entity.addComponent(DistanceGrabbable, { movementMode: 'MoveTowardsTarget' as never, returnToOrigin: true, scale: false } as never);
      }
      const kit: Kit = { gunId, receiver: base.entity, parts: spawned.filter((s) => s.entity !== base.entity).map((s) => s.entity) };
      this.kits.set(gunId, kit);
      return kit;
    } catch (error) {
      console.error(`Could not build the parts kit for "${gunId}".`, error);
      return undefined;
    }
  }

  /** Lay a dynamically spawned kit out: receiver on the mat, other parts on the strip, all resting on the bench. */
  private layoutKit(entities: Entity[], receiver: Entity, gunId: string): void {
    const yaw = new Quaternion().setFromAxisAngle(UP, (BENCH.partYawDeg * Math.PI) / 180);
    const order = stepsFor(gunId).map((p) => p.itemId);
    const measure = (e: Entity): Box3 => {
      const o = e.object3D!;
      o.position.set(0, 0, 0); o.quaternion.copy(yaw); o.scale.setScalar(BENCH.partScale);
      o.updateMatrixWorld(true);
      return new Box3().setFromObject(o);
    };
    const place = (e: Entity, dx: number, dy: number, dz: number): void => {
      this.setWorldPose(e, this.tmpA.set(dx, dy, dz), yaw, BENCH.partScale);
      this.homes.set(e, this.worldPose(e.object3D!));
    };
    const rb = measure(receiver);
    place(receiver, BENCH.matCenter.x - (rb.min.x + rb.max.x) / 2, BENCH.matTop - rb.min.y + 0.0005, BENCH.matCenter.z - (rb.min.z + rb.max.z) / 2);
    let x = BENCH.stripMinX, row = 0;
    const rest = entities.filter((e) => e !== receiver).sort((a, b) => order.indexOf(a.getValue(WorkshopItem, 'itemId') ?? '') - order.indexOf(b.getValue(WorkshopItem, 'itemId') ?? ''));
    for (const e of rest) {
      const b = measure(e);
      const w = b.max.x - b.min.x;
      if (x + w > BENCH.stripMaxX && row < BENCH.stripRows.length - 1) { row += 1; x = BENCH.stripMinX; }
      place(e, x - b.min.x, BENCH.woodTop - b.min.y + 0.0005, BENCH.stripRows[row] - (b.min.z + b.max.z) / 2);
      x += w + BENCH.stripGap;
    }
  }

  private parkKit(kit: Kit): void {
    for (const e of [kit.receiver, ...kit.parts]) {
      this.detachFlag(e);
      if (e.object3D) { e.object3D.visible = false; this.setWorldPose(e, this.tmpA.set(0, -50, 0), this.tmpQ.identity()); }
      this.parked.add(e);
    }
  }
  private resetKit(kit: Kit): void {
    for (const e of [kit.receiver, ...kit.parts]) {
      this.parked.delete(e);
      this.detachFlag(e);
      this.settling.delete(e); this.returning.delete(e);
      if (e.object3D) e.object3D.visible = true;
      const home = this.homes.get(e);
      if (home) this.setWorldPose(e, home.p, home.q);
      this.restHighlight(e);
    }
    this.attachedStack.length = 0;
    if (kit.receiver) this.setHighlight(kit.receiver, 7);
  }
  private detachFlag(e: Entity): void {
    if (e.hasComponent(AssemblyPart)) e.setValue(AssemblyPart, 'attached', false);
  }

  // =====================================================================  assembly
  private partOf(entity: Entity): GunPart | undefined {
    const id = entity.getValue(WorkshopItem, 'itemId');
    return id ? PART_BY_ITEM_ID.get(id) : undefined;
  }

  private slotTarget(part: GunPart, receiver: Entity): boolean {
    const ro = receiver.object3D;
    if (!ro) return false;
    ro.updateWorldMatrix(true, false);
    this.target.set(part.attach_position[0], part.attach_position[1], part.attach_position[2]);
    ro.localToWorld(this.target);
    return true;
  }

  private tryAttach(entity: Entity): void {
    const part = this.partOf(entity);
    const kit = part ? this.kits.get(part.weaponId) : undefined;
    if (!part || !kit || isBase(part.id) || !entity.object3D) return;
    if (this.phase === 'idle' || this.phase === 'preview') {
      if (this.activeGun !== part.weaponId) {
        this.activeGun = part.weaponId; this.previewGun = part.weaponId;
        this.phase = 'building'; this.mistakes = 0; this.startTime = this.currentTime;
      }
      this.phase = 'building';
    }
    if (this.phase === 'complete' || this.activeGun !== part.weaponId) return;
    if (!this.slotTarget(part, kit.receiver)) return;
    entity.object3D.getWorldPosition(this.tmpA);
    if (this.tmpA.distanceTo(this.target) > SNAP_DISTANCE) {
      if (this.tmpA.distanceTo(kit.receiver.object3D!.getWorldPosition(this.tmpB)) < 0.32) {
        this.mistakes += 1;
        this.setHighlight(entity, 4);
        this.say(`Wrong place. The ${part.name} goes at the ${part.slot} slot.`, 'WRONG SLOT');
        this.beep(260, 0.08);
        this.refreshGuide();
      }
      return;
    }
    this.snapToSlot(entity, part, kit);
    entity.setValue(AssemblyPart, 'attached', true);
    if (!this.attachedStack.includes(entity)) this.attachedStack.push(entity);
    this.setHighlight(entity, 3);
    this.award(0, XP_PER_ATTACHMENT);
    this.beep(920, 0.1);
    const total = stepsFor(part.weaponId).length;
    if (this.attachedStack.length >= total) { this.completeBuild(); return; }
    this.say(`${part.slot.toUpperCase()} slot locked.`, `+${XP_PER_ATTACHMENT} XP`);
    this.hint();
    this.refreshAll();
  }

  private snapToSlot(entity: Entity, part: GunPart, kit: Kit): void {
    const ro = kit.receiver.object3D;
    if (!ro || !this.slotTarget(part, kit.receiver)) return;
    ro.getWorldQuaternion(this.tmpQ);
    ro.getWorldScale(this.tmpC);
    this.setWorldPose(entity, this.target, this.tmpQ, this.tmpC.x);
  }

  private detachPart(entity: Entity, sendHome: boolean): void {
    if (!entity.getValue(AssemblyPart, 'attached')) return;
    entity.setValue(AssemblyPart, 'attached', false);
    const i = this.attachedStack.indexOf(entity);
    if (i >= 0) this.attachedStack.splice(i, 1);
    if (this.phase === 'complete') this.phase = 'building';
    this.setHighlight(entity, 5);
    this.award(0, XP_PER_REMOVED_PART);
    if (sendHome) this.sendHome(entity);
    this.say('Part removed.', `+${XP_PER_REMOVED_PART} XP`);
    this.beep(420, 0.1);
    this.refreshAll();
  }

  private removeLastPart(): void {
    const e = this.attachedStack[this.attachedStack.length - 1];
    if (!e) { this.say('Nothing to remove yet. Attach a part first.', undefined); return; }
    this.detachPart(e, true);
  }

  private hint(): void {
    const gun = this.activeGun;
    const kit = gun ? this.kits.get(gun) : undefined;
    if (!kit) { this.say('Start a build first (menu or wall).', undefined); return; }
    const next = stepsFor(kit.gunId).find((p) => {
      const e = kit.parts.find((x) => x.getValue(WorkshopItem, 'itemId') === p.itemId);
      return e && !e.getValue(AssemblyPart, 'attached');
    });
    const entity = next ? kit.parts.find((x) => x.getValue(WorkshopItem, 'itemId') === next.itemId) : undefined;
    if (!entity) return;
    this.hintEntity = entity;
    this.hintUntil = this.currentTime + 8;
    this.setHighlight(entity, 6);
    this.say(`Next: ${next!.name}. Bring it to the glowing slot.`, undefined);
    this.refreshGuide();
  }

  // =====================================================================  selection / grab / release
  private isHeld(entity: Entity): boolean {
    return entity.hasComponent(Grabbed) || this.carried?.entity === entity;
  }

  private onItemSelect(entity: Entity): void {
    if (this.parked.has(entity)) return;
    const now = this.currentTime;
    if (now - (this.lastFire.get(entity) ?? -9) < 0.15) return;
    this.lastFire.set(entity, now);
    const itemId = entity.getValue(WorkshopItem, 'itemId') ?? '';
    const item = WORKSHOP_ITEMS[itemId];
    if (!item) return;
    if (this.selected && this.selected !== entity) this.restHighlight(this.selected);
    this.selected = entity;
    this.setHighlight(entity, 2);
    if (item.category === 'gun') {
      this.previewBlueprint(itemId.replace('gun-', '').replace(/-/g, '_'));
    } else {
      const part = this.partOf(entity);
      this.say(part ? `${part.name} (${part.slot}). Release it at its glowing slot.` : item.label, undefined);
      this.beep(780, 0.05);
    }
  }

  private onGrabStart(entity: Entity): void {
    if (this.parked.has(entity)) return;
    this.settling.delete(entity); this.returning.delete(entity);
    this.onItemSelect(entity);
    if (entity.getValue(AssemblyPart, 'attached')) this.detachPart(entity, false);
  }

  private onRelease(entity: Entity): void {
    if (this.parked.has(entity) || !entity.object3D) return;
    const itemId = entity.getValue(WorkshopItem, 'itemId') ?? '';
    if (WORKSHOP_ITEMS[itemId]?.category === 'gun') {
      entity.object3D.getWorldPosition(this.tmpA);
      if (surfaceY(this.tmpA.x, this.tmpA.z) > 0) this.settling.set(entity, { vy: 0 });
      else this.sendHome(entity);
      return;
    }
    this.tryAttach(entity);
    if (!entity.getValue(AssemblyPart, 'attached')) this.settling.set(entity, { vy: 0 });
    this.restHighlight(entity);
  }

  private sendHome(entity: Entity): void {
    const obj = entity.object3D;
    if (!obj) return;
    this.settling.delete(entity);
    this.returning.set(entity, { t: 0, from: this.worldPose(obj) });
  }

  // =====================================================================  desktop crosshair (pointer-lock play mode)
  private headRay(origin: Vector3, dir: Vector3): void {
    const head = this.player.head;
    head.getWorldPosition(origin);
    head.getWorldQuaternion(this.tmpQ2);
    dir.set(0, 0, -1).applyQuaternion(this.tmpQ2).normalize();
  }

  private resolveHit(): { clickable?: () => void; entity?: Entity; point: Vector3 } | null {
    const targets: Object3D[] = [];
    for (const p of [this.hud, this.menu, this.guide, this.stats]) if (p.root?.visible) targets.push(p.root);
    if (this.wheel.visible) targets.push(this.wheel);
    for (const [o, e] of this.objectToItem) if (o.visible && !this.parked.has(e)) targets.push(o);
    this.headRay(this.tmpC, this.tmpD);
    this.raycaster.set(this.tmpC, this.tmpD);
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      let o: Object3D | null = h.object;
      while (o) {
        const fn = this.clickables.get(o);
        if (fn) return { clickable: fn, point: h.point };
        const e = this.objectToItem.get(o);
        if (e) return { entity: e, point: h.point };
        o = o.parent;
      }
    }
    return null;
  }

  private crosshairDown(): void {
    const hit = this.resolveHit();
    if (!hit) return;
    if (hit.clickable) {
      const now = this.currentTime;
      if (now - (this.lastFire.get(hit.clickable) ?? -9) > 0.2) { this.lastFire.set(hit.clickable, now); hit.clickable(); }
      return;
    }
    if (hit.entity) {
      this.onItemSelect(hit.entity);
      this.settling.delete(hit.entity); this.returning.delete(hit.entity);
      if (hit.entity.getValue(AssemblyPart, 'attached')) this.detachPart(hit.entity, false);
      this.headRay(this.tmpA, this.tmpB);
      this.carried = { entity: hit.entity, dist: Math.min(1.1, Math.max(0.3, hit.point.distanceTo(this.tmpA))) };
    }
  }

  private crosshairUp(): void {
    if (!this.carried) return;
    const e = this.carried.entity;
    this.carried = null;
    this.onRelease(e);
  }

  private updateCrosshair(): void {
    const locked = !!document.pointerLockElement;
    if (locked && !this.crosshairEl) {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border:2px solid #4fc3ff;border-radius:50%;pointer-events:none;z-index:9999;box-shadow:0 0 6px #4fc3ff';
      document.body.appendChild(el);
      this.crosshairEl = el;
    }
    if (this.crosshairEl) this.crosshairEl.style.display = locked ? 'block' : 'none';
    if (!locked) { if (this.carried) this.crosshairUp(); return; }
    if (this.carried) {
      const e = this.carried.entity;
      if (!e.object3D) { this.carried = null; return; }
      this.headRay(this.tmpA, this.tmpB);
      this.tmpA.addScaledVector(this.tmpB, this.carried.dist);
      this.tmpA.y = Math.max(this.tmpA.y, surfaceY(this.tmpA.x, this.tmpA.z) + 0.03);
      e.object3D.getWorldQuaternion(this.tmpQ);
      this.setWorldPose(e, this.tmpA, this.tmpQ);
      return;
    }
    const hit = this.resolveHit();
    const e = hit?.entity ?? null;
    if (e !== this.hoverEntity) {
      if (this.hoverEntity && !this.isHeld(this.hoverEntity)) this.restHighlight(this.hoverEntity);
      this.hoverEntity = e;
      if (e && e !== this.selected) this.setHighlight(e, 1);
    }
  }

  // =====================================================================  per-frame
  update(delta: number, time: number): void {
    this.currentTime = time;
    const dt = Math.min(delta, 0.05);
    this.pollControllers();
    this.updateCrosshair();

    for (const entity of this.queries.highlights.entities) {
      const state = entity.getValue(InteractionHighlight, 'state') ?? 0;
      if (state === 3 || state === 6) {
        const started = this.pulseStart.get(entity) ?? time;
        if ((state === 3 && time - started > 1.2) || (state === 6 && time > this.hintUntil)) this.restHighlight(entity);
        else this.applyHighlight(entity, HL_COLOR[state], 0.3 + Math.sin(time * 8) * 0.14, state);
      }
      else if (state === 4 && time >= (this.redFlashUntil.get(entity) ?? time)) this.restHighlight(entity);
    }

    for (const e of this.attachedStack) {
      if (this.isHeld(e)) continue;
      const part = this.partOf(e);
      const kit = part ? this.kits.get(part.weaponId) : undefined;
      if (part && kit) this.snapToSlot(e, part, kit);
    }

    for (const [e, r] of this.returning) {
      const obj = e.object3D, home = this.homes.get(e);
      if (!obj || !home || this.isHeld(e)) { this.returning.delete(e); continue; }
      r.t = Math.min(1, r.t + dt / 0.5);
      const k = r.t * r.t * (3 - 2 * r.t);
      this.tmpA.copy(r.from.p).lerp(home.p, k);
      this.tmpQ.copy(r.from.q).slerp(home.q, k);
      this.setWorldPose(e, this.tmpA, this.tmpQ);
      if (r.t >= 1) this.returning.delete(e);
    }

    for (const [e, s] of this.settling) {
      const obj = e.object3D;
      if (!obj || this.isHeld(e) || this.parked.has(e)) { this.settling.delete(e); continue; }
      s.vy -= 9.81 * dt;
      obj.updateWorldMatrix(true, true);
      this.box.setFromObject(obj);
      const cx = (this.box.min.x + this.box.max.x) / 2, cz = (this.box.min.z + this.box.max.z) / 2;
      const ground = surfaceY(cx, cz);
      obj.getWorldPosition(this.tmpA);
      obj.getWorldQuaternion(this.tmpQ);
      const nextMin = this.box.min.y + s.vy * dt;
      if (nextMin <= ground) {
        this.tmpA.y += ground - this.box.min.y;
        this.tmpE.setFromQuaternion(this.tmpQ, 'YXZ');
        this.tmpQ.setFromAxisAngle(UP, this.tmpE.y);
        this.setWorldPose(e, this.tmpA, this.tmpQ);
        if (Math.abs(s.vy) > 1.2) s.vy = -s.vy * 0.18;
        else {
          this.settling.delete(e);
          if (ground === 0) this.sendHome(e);
          else this.beep(300, 0.03);
        }
      } else {
        this.tmpA.y += s.vy * dt;
        this.setWorldPose(e, this.tmpA, this.tmpQ);
      }
    }

    this.updateHelp();
  }

  private pollControllers(): void {
    const pads = this.input?.gamepads;
    const left = pads?.left, right = pads?.right;
    if (left?.getButtonDown(InputComponent.X_Button)) this.toggleMenu();
    if (left?.getButtonDown(InputComponent.Y_Button)) this.toggleWheel();
    if (right?.getButtonDown(InputComponent.A_Button)) this.hint();
    if (right?.getButtonDown(InputComponent.B_Button)) this.removeLastPart();
  }

  // =====================================================================  hints: ghost part, slot reticle, blueprint hologram
  private updateHelp(): void {
    const active = this.phase === 'building' ? this.activeHelpEntity() : null;
    const part = active ? this.partOf(active) : undefined;
    const kit = part ? this.kits.get(part.weaponId) : undefined;
    if (active && part && kit && !isBase(part.id) && !active.getValue(AssemblyPart, 'attached') && this.slotTarget(part, kit.receiver)) {
      kit.receiver.object3D!.getWorldQuaternion(this.tmpQ);
      kit.receiver.object3D!.getWorldScale(this.tmpC);
      this.showGhost(active, this.target, this.tmpQ, this.tmpC.x);
      this.reticle.visible = true;
      this.reticle.position.copy(this.target);
      this.player.head.getWorldPosition(this.tmpD);
      this.reticle.lookAt(this.tmpD);
      const near = this.isHeld(active) && active.object3D!.getWorldPosition(this.tmpA).distanceTo(this.target) < SNAP_DISTANCE;
      if (this.isHeld(active)) this.setHighlight(active, near ? 3 : 2);
    } else {
      if (this.ghost) this.ghost.visible = false;
      this.reticle.visible = false;
    }
    this.updateBlueprintGhost();
  }

  private activeHelpEntity(): Entity | null {
    if (this.carried) return this.carried.entity;
    for (const e of this.queries.grabbed.entities) return e;
    return this.currentTime < this.hintUntil ? this.hintEntity : null;
  }

  private holo(): MeshBasicMaterial {
    return (this.holoMat ??= new MeshBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: 0.3, depthWrite: false, side: DoubleSide }));
  }

  private showGhost(entity: Entity, pos: Vector3, quat: Quaternion, scale: number): void {
    if (!this.progress.holo || !entity.object3D) { if (this.ghost) this.ghost.visible = false; return; }
    if (this.ghostFor !== entity) {
      if (this.ghost) this.world.scene.remove(this.ghost);
      const g = entity.object3D.clone(true);
      const drop: Object3D[] = [];
      g.traverse((o) => {
        if (o.name === 'Interaction Outline') drop.push(o);
        else if (o instanceof Mesh) o.material = this.holo();
      });
      drop.forEach((o) => o.parent?.remove(o));
      g.traverse((o) => { o.pointerEvents = 'none'; });
      this.world.scene.add(g);
      this.ghost = g; this.ghostFor = entity;
    }
    if (!this.ghost) return;
    this.ghost.visible = true;
    this.ghost.position.copy(pos);
    this.ghost.quaternion.copy(quat);
    this.ghost.scale.setScalar(scale);
  }

  private updateBlueprintGhost(): void {
    const want = this.phase === 'building' && this.progress.holo ? this.activeGun : null;
    if (!want) { if (this.bpGhost) this.bpGhost.visible = false; return; }
    const kit = this.kits.get(want);
    if (!kit?.receiver.object3D) return;
    if (this.bpGhostFor !== want) {
      if (this.bpGhost) this.world.scene.remove(this.bpGhost);
      this.bpGhost = null; this.bpGhostFor = want;
      const gltf = AssetManager.getGLTF(`gun-${want.replace(/_/g, '-')}`);
      if (gltf) {
        this.bpMat ??= new MeshBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: 0.1, depthWrite: false, side: DoubleSide });
        gltf.scene.traverse((o) => { if (o instanceof Mesh) o.material = this.bpMat!; o.pointerEvents = 'none'; });
        this.world.scene.add(gltf.scene);
        this.bpGhost = gltf.scene;
      }
    }
    if (!this.bpGhost) return;
    const ro = kit.receiver.object3D;
    this.bpGhost.visible = true;
    ro.getWorldPosition(this.bpGhost.position);
    ro.getWorldQuaternion(this.bpGhost.quaternion);
    ro.getWorldScale(this.bpGhost.scale);
  }

  private makeReticle(): Group {
    const g = new Group();
    const mat = new MeshBasicMaterial({ color: '#3dff8f', transparent: true, opacity: 0.95, depthTest: false, side: DoubleSide });
    const ring = new Mesh(new RingGeometry(0.028, 0.034, 28), mat);
    g.add(ring);
    for (const [x, y, w, h] of [[0, 0.045, 0.004, 0.026], [0, -0.045, 0.004, 0.026], [0.045, 0, 0.026, 0.004], [-0.045, 0, 0.026, 0.004]]) {
      const bar = new Mesh(new PlaneGeometry(w, h), mat);
      bar.position.set(x, y, 0);
      g.add(bar);
    }
    g.traverse((o) => { o.raycast = () => {}; o.renderOrder = 20; });
    g.visible = false;
    return g;
  }

  // =====================================================================  wheel & menu
  private toggleWheel(): void {
    if (this.wheel.visible) { this.wheel.visible = false; return; }
    const gun = this.activeGun;
    const kit = gun ? this.kits.get(gun) : undefined;
    let items: WheelItem[];
    let title = 'SELECT BLUEPRINT', sub = `Credits ${this.credits()}`;
    if (kit && (this.phase === 'building' || this.phase === 'complete')) {
      title = 'PARTS'; sub = gunById(kit.gunId)?.name ?? '';
      items = stepsFor(kit.gunId).map((p) => {
        const e = kit.parts.find((x) => x.getValue(WorkshopItem, 'itemId') === p.itemId);
        const done = !!e?.getValue(AssemblyPart, 'attached');
        return { id: p.itemId, label: p.name.toUpperCase(), sub: done ? 'REMOVE' : 'LOCATE', color: SLOT_COLORS[p.slot] ?? '#dff4ff' };
      });
    } else {
      items = GUN_ORDER.map((id) => {
        const s = this.blueprintState(id);
        return { id, label: (gunById(id)?.name ?? id).toUpperCase(), sub: s.levelLocked ? `LV ${UNLOCK_LEVEL[id]}` : s.owned ? 'OWNED' : `${s.price} CR`, dim: s.levelLocked };
      });
    }
    this.wheel.setItems(title, sub, items);
    this.player.head.getWorldPosition(this.tmpA);
    this.player.head.getWorldQuaternion(this.tmpQ);
    this.tmpB.set(-0.1, -0.08, -0.6).applyQuaternion(this.tmpQ).add(this.tmpA);
    this.wheel.position.copy(this.tmpB);
    this.wheel.lookAt(this.tmpA);
    this.wheel.visible = true;
  }

  private onWheelPick(item: WheelItem): void {
    this.wheel.visible = false;
    const kit = this.activeGun ? this.kits.get(this.activeGun) : undefined;
    if (kit && (this.phase === 'building' || this.phase === 'complete')) {
      const e = kit.parts.find((x) => x.getValue(WorkshopItem, 'itemId') === item.id);
      if (!e) return;
      if (e.getValue(AssemblyPart, 'attached')) this.detachPart(e, true);
      else { this.hintEntity = e; this.hintUntil = this.currentTime + 8; this.setHighlight(e, 6); this.refreshGuide(); }
    } else {
      this.previewBlueprint(item.id);
    }
  }

  private openMenu(page: 'guide' | 'bp' | 'stats' | 'settings'): void {
    this.menuOpen = true;
    this.menu.visible = true;
    this.hud.visible = false;
    this.showPage(page);
  }
  private closeMenu(): void {
    this.menuOpen = false;
    this.menu.visible = false;
    this.hud.visible = true;
  }
  private toggleMenu(): void {
    if (this.menuOpen) this.closeMenu();
    else this.openMenu(this.activeGun || this.previewGun ? 'bp' : 'guide');
  }
  private showPage(page: 'guide' | 'bp' | 'stats' | 'settings'): void {
    this.menu.show('page-guide', page === 'guide');
    this.menu.show('page-bp', page === 'bp');
    this.menu.show('page-stats', page === 'stats');
    this.menu.show('page-settings', page === 'settings');
    if (page === 'bp' || page === 'stats' || page === 'settings') this.refreshMenu();
  }

  // =====================================================================  UI refresh (event-driven, never per frame)
  private say(hint?: string, reward?: string): void {
    if (hint !== undefined) this.hud.text('hint', hint);
    if (reward !== undefined) this.hud.text('reward', reward);
  }

  private refreshAll(): void {
    this.refreshHud(); this.refreshGuide(); this.refreshStats(); this.refreshMenu();
  }

  private gunName(id: string | null): string { return (id && gunById(id)?.name) || 'none'; }

  private refreshHud(): void {
    const xp = this.xp();
    this.hud.text('wallet', `${this.credits()} CR | LV ${levelFromXp(xp)} | ${xp} XP`);
    this.hud.size('xp-fill', (xpIntoLevel(xp) / XP_PER_LEVEL) * 73.6);
    const gun = this.activeGun ?? this.previewGun;
    this.hud.text('project', `Current Project: ${this.gunName(gun)}`);
    const total = this.activeGun ? stepsFor(this.activeGun).length : 0;
    const done = this.attachedStack.length;
    const status =
      this.phase === 'building' ? `Status: assembling ${done}/${total} parts | mistakes ${this.mistakes}` :
      this.phase === 'complete' ? 'Status: BUILD COMPLETE - store it or sell it' :
      this.phase === 'preview' ? 'Status: blueprint selected - press CONFIRM or Enter' :
      'Status: choose a blueprint from the wall';
    this.hud.text('status', status);
    this.hud.size('build-fill', total ? (done / total) * 73.6 : 0);
  }

  private refreshGuide(): void {
    const gun = this.activeGun ?? this.previewGun;
    const steps = gun ? stepsFor(gun) : [];
    const kit = this.activeGun ? this.kits.get(this.activeGun) : undefined;
    this.guide.text('gd-title', gun ? `ASSEMBLY: ${this.gunName(gun).toUpperCase()}` : 'ASSEMBLY GUIDE');
    let next = -1;
    for (let i = 0; i < 7; i += 1) {
      const step = steps[i];
      this.guide.show(`gs-${i + 1}`, !!step);
      if (!step) continue;
      const e = kit?.parts.find((x) => x.getValue(WorkshopItem, 'itemId') === step.itemId);
      const done = !!e?.getValue(AssemblyPart, 'attached');
      if (!done && next < 0 && this.phase === 'building') next = i;
      this.guide.text(`gs-${i + 1}-name`, `${i + 1}. ${step.name}`);
      this.guide.bg(`gs-${i + 1}-dot`, done ? '#3dff8f' : (SLOT_COLORS[step.slot] ?? '#334a58'));
      this.guide.fg(`gs-${i + 1}-name`, done ? '#3dff8f' : i === next ? '#ffffff' : '#9fb4c2');
    }
    const done = this.attachedStack.length;
    this.guide.text('gd-sub', steps.length ? `${done} / ${steps.length} PARTS${this.tutorialMode ? '  |  TUTORIAL' : ''}` : 'Pick a blueprint to begin');
    this.guide.text('gd-status',
      this.phase === 'complete' ? 'Build complete! Check the stats card.' :
      next >= 0 ? `Next: ${steps[next].name} (${steps[next].slot})` :
      this.phase === 'preview' ? 'Confirm the blueprint to start' : 'Waiting for a blueprint');
    this.guide.show('gd-skip', this.tutorialMode);
    this.guide.show('gd-hint', this.phase === 'building');
  }

  private refreshStats(): void {
    const complete = this.phase === 'complete';
    const gunId = this.activeGun ?? this.previewGun;
    const gun = gunId ? gunById(gunId) : undefined;
    this.stats.text('sp-title', complete ? 'BUILD COMPLETE' : gun ? gun.name.toUpperCase() : 'BLUEPRINT');
    if (gun) {
      const s = this.blueprintState(gun.id);
      this.stats.text('sp-sub', complete ? `Rank ${this.lastRank.rank}  |  Value ${this.lastValue} CR` :
        s.levelLocked ? `LOCKED - level ${UNLOCK_LEVEL[gun.id]}` : s.owned ? 'OWNED' : `Price ${s.price} CR`);
      const st = gun.stats;
      [st.damage, st.accuracy, st.fireRate, st.recoil, Math.min(100, st.magazine * 3)].forEach((v, i) => {
        this.stats.size(`sb-${i + 1}`, (Math.min(100, v) / 100) * 36);
        this.stats.text(`sb-${i + 1}-val`, i === 4 ? `${st.magazine}` : `${v}`);
      });
    } else {
      this.stats.text('sp-sub', 'Select a gun to see its stats');
    }
    this.stats.text('sp-note', complete ? `Rank ${this.lastRank.rank}: ${this.mistakes} mistakes` : ' ');
    this.stats.show('sp-build', this.phase === 'preview');
    this.stats.show('sp-store', complete);
    this.stats.show('sp-sell', complete);
  }

  private refreshMenu(): void {
    const xp = this.xp();
    this.menu.text('bp-wallet', `Credits: ${this.credits()} | XP: ${xpIntoLevel(xp)}/${XP_PER_LEVEL} | LV ${levelFromXp(xp)}`);
    GUN_ORDER.forEach((id, i) => {
      const s = this.blueprintState(id);
      const tag = s.levelLocked ? `LOCKED LV ${UNLOCK_LEVEL[id]}` : s.owned ? 'OWNED' : `${s.price} CR`;
      this.menu.text(`bp-${i + 1}`, `${i + 1}. ${gunById(id)?.name ?? id}  |  ${tag}`);
    });
    const gun = this.previewGun ? gunById(this.previewGun) : undefined;
    if (gun) {
      const s = this.blueprintState(gun.id), st = gun.stats;
      this.menu.text('bp-name', gun.name);
      this.menu.text('bp-stats', `DMG ${st.damage}  ACC ${st.accuracy}  RATE ${st.fireRate}\nRECOIL ${st.recoil}  MAG ${st.magazine}\n${stepsFor(gun.id).length} parts to assemble`);
      this.menu.text('bp-note', s.levelLocked ? `Reach level ${UNLOCK_LEVEL[gun.id]} to unlock.` : s.owned ? 'You own this blueprint.' : `Buy for ${s.price} CR.`);
      this.menu.text('bp-confirm', s.owned ? 'CONFIRM SELECTION' : `BUY FOR ${s.price} CR`);
    }
    this.menu.text('st-line1', `${this.credits()} credits | Level ${levelFromXp(xp)}`);
    this.menu.size('st-xp-fill', (xpIntoLevel(xp) / XP_PER_LEVEL) * 56);
    this.menu.text('st-line2', `${xp} XP | ${this.score()} score | ${this.progress.builds} builds`);
    this.menu.text('st-collection', this.progress.collection.length ? this.progress.collection.map((id) => gunById(id)?.name ?? id).join('\n') : 'Nothing stored yet.');
    this.menu.text('set-sound', `SOUND: ${this.progress.sound ? 'ON' : 'OFF'}`);
    this.menu.text('set-holo', `HOLOGRAM HINTS: ${this.progress.holo ? 'ON' : 'OFF'}`);
    this.menu.text('set-reset', 'RESET PROGRESS');
    this.resetArmed = false;
    this.menu.text('guide-note', this.tutorialDone ? 'Tutorial complete. Pick any blueprint.' : 'First time here? Press START ASSEMBLY for the tutorial.');
  }

  private refreshWallLabels(): void {
    for (const id of GUN_ORDER) {
      const entity = this.gunEntities.get(id), home = this.homes.get(entity as Entity);
      const obj = entity?.object3D;
      if (!entity || !home || !obj) continue;
      const old = this.wallLabels.get(id);
      if (old) { this.world.scene.remove(old); (old.material as MeshBasicMaterial).map?.dispose(); old.geometry.dispose(); (old.material as MeshBasicMaterial).dispose(); }
      const s = this.blueprintState(id);
      const tag = s.levelLocked ? `LOCKED LV ${UNLOCK_LEVEL[id]}` : s.owned ? 'OWNED' : `${s.price} CR`;
      const label = makeLabel(0.2, 0.05, [
        { t: (gunById(id)?.name ?? id).toUpperCase(), px: 52, color: '#dff4ff' },
        { t: tag, px: 44, color: s.levelLocked ? '#ff4d5e' : s.owned ? '#3dff8f' : '#ffb04a' },
      ]);
      const right = this.tmpA.set(1, 0, 0).applyQuaternion(home.q);
      this.box.setFromObject(obj);
      const cx = (this.box.min.x + this.box.max.x) / 2, cz = (this.box.min.z + this.box.max.z) / 2;
      label.position.set(cx + right.x * 0.045, this.box.min.y - 0.03, cz + right.z * 0.045);
      label.quaternion.copy(home.q).multiply(this.tmpQ.setFromAxisAngle(UP, Math.PI / 2));
      this.world.scene.add(label);
      this.wallLabels.set(id, label);
    }
  }

  // =====================================================================  highlight (inverted-hull outline + emissive tint)
  private restHighlight(entity: Entity): void {
    const isBaseNow = this.isActiveBase(entity);
    this.setHighlight(entity, entity === this.selected ? 2 : isBaseNow ? 7 : 0);
  }
  private isActiveBase(entity: Entity): boolean {
    const kit = this.activeGun ? this.kits.get(this.activeGun) : undefined;
    return !!kit && kit.receiver === entity && (this.phase === 'building');
  }

  private setHighlight(entity: Entity, state: number): void {
    if (!entity.hasComponent(InteractionHighlight)) return;
    if (state === 3 || state === 6) { if (!this.pulseStart.has(entity) || (entity.getValue(InteractionHighlight, 'state') !== state)) this.pulseStart.set(entity, this.currentTime); } else this.pulseStart.delete(entity);
    entity.setValue(InteractionHighlight, 'state', state);
    if (state === 4) this.redFlashUntil.set(entity, this.currentTime + 0.4);
    else this.redFlashUntil.delete(entity);
    this.applyHighlight(entity, HL_COLOR[state] ?? '#000000', HL_INTENSITY[state] ?? 0, state);
  }

  private applyHighlight(entity: Entity, color: string, intensity: number, state: number): void {
    const entry = this.getHighlightEntry(entity);
    for (const s of entry.standards) {
      if (state === 0) { s.material.emissive.set(s.emissive); s.material.emissiveIntensity = s.intensity; }
      else { s.material.emissive.set(color); s.material.emissiveIntensity = intensity; }
    }
    const opacity = state === 1 ? 0.28 : state === 2 ? 0.7 : state === 7 ? 0.45 : state >= 3 ? 0.72 : 0;
    const scale = state === 1 ? 1.025 : state === 2 ? 1.045 : state === 7 ? 1.03 : 1.05;
    for (const o of entry.outlines) {
      o.material.color.set(color);
      o.material.opacity = opacity;
      o.mesh.scale.setScalar(scale);
      o.mesh.visible = state !== 0;
    }
  }

  private getHighlightEntry(entity: Entity): HighlightEntry {
    const existing = this.highlightEntries.get(entity);
    if (existing) return existing;
    const entry: HighlightEntry = { standards: [], outlines: [] };
    const meshes: Mesh[] = [];
    entity.object3D?.traverse((o) => { if (o instanceof Mesh && o.name !== 'Interaction Outline') meshes.push(o); });
    for (const mesh of meshes) {
      const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const clones = source.map((m) => m.clone());
      mesh.material = Array.isArray(mesh.material) ? clones : clones[0];
      for (const m of clones) {
        if (m instanceof MeshStandardMaterial) entry.standards.push({ material: m, emissive: m.emissive.getHexString(), intensity: m.emissiveIntensity });
      }
      const mat = new MeshBasicMaterial({ color: '#4fc3ff', side: BackSide, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
      const outline = new Mesh(mesh.geometry, mat);
      outline.name = 'Interaction Outline';
      outline.scale.setScalar(1.045);
      outline.visible = false;
      outline.raycast = () => {};
      mesh.add(outline);
      entry.outlines.push({ mesh: outline, material: mat });
    }
    this.highlightEntries.set(entity, entry);
    return entry;
  }

  // =====================================================================  transforms
  private worldPose(obj: Object3D): Pose {
    obj.updateWorldMatrix(true, false);
    return { p: obj.getWorldPosition(new Vector3()), q: obj.getWorldQuaternion(new Quaternion()) };
  }

  /** Set an entity's world pose and keep its ECS Transform in sync (no allocation). */
  private setWorldPose(entity: Entity, pos: Vector3, quat: Quaternion, uniformScale?: number): void {
    const object = entity.object3D;
    if (!object) return;
    const parent = object.parent;
    const lp = this.lpV.copy(pos);
    const lq = this.lqQ.copy(quat);
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(lp);
      parent.getWorldQuaternion(this.pqQ).invert();
      lq.premultiply(this.pqQ);
    }
    object.position.copy(lp);
    object.quaternion.copy(lq);
    const position = entity.getVectorView(Transform, 'position');
    position[0] = lp.x; position[1] = lp.y; position[2] = lp.z;
    const o = entity.getVectorView(Transform, 'orientation');
    o[0] = lq.x; o[1] = lq.y; o[2] = lq.z; o[3] = lq.w;
    if (uniformScale !== undefined) {
      const ps = parent ? parent.getWorldScale(this.psV).x : 1;
      const k = uniformScale / (ps || 1);
      object.scale.setScalar(k);
      const sv = entity.getVectorView(Transform, 'scale');
      sv[0] = k; sv[1] = k; sv[2] = k;
    }
  }

  private beep(frequency: number, duration: number): void {
    if (!this.progress.sound) return;
    try {
      const ctx = (this.audioContext ??= new AudioContext());
      void ctx.resume();
      const osc = ctx.createOscillator(), vol = ctx.createGain(), t = ctx.currentTime;
      osc.frequency.setValueAtTime(frequency, t);
      vol.gain.setValueAtTime(0.0001, t);
      vol.gain.exponentialRampToValueAtTime(0.025, t + 0.008);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(vol); vol.connect(ctx.destination);
      osc.start(t); osc.stop(t + duration);
    } catch { /* audio is optional */ }
  }
}
