import { Object3D, UIKit, UIKitMLAsset } from '@iwsdk/core';

type Props = Record<string, unknown>;
const apply = (e: unknown, p: Props): void => {
  (e as { setProperties(p: Props): void } | null)?.setProperties(p);
};

/** Thin, null-safe wrapper around a UIKitML panel. Missing ids are ignored, never thrown. */
export class PanelRef {
  constructor(public readonly root: UIKitMLAsset | undefined) {}
  el(id: string): UIKit.Component | null {
    return this.root?.getElementById(id) ?? null;
  }
  text(id: string, text: string): void { apply(this.el(id), { text }); }
  show(id: string, on: boolean): void { apply(this.el(id), { display: on ? 'flex' : 'none' }); }
  size(id: string, cm: number): void { apply(this.el(id), { width: Math.max(0, cm) }); }
  bg(id: string, color: string): void { apply(this.el(id), { backgroundColor: color }); }
  fg(id: string, color: string): void { apply(this.el(id), { color }); }
  set visible(v: boolean) { if (this.root) this.root.visible = v; }
  /** Bind a click handler and register it so the desktop crosshair can trigger it too. */
  onClick(id: string, fn: () => void, cleanup: Array<() => void>, registry: Map<Object3D, () => void>): void {
    const e = this.el(id);
    if (!e) { console.warn(`UI element "${id}" not found`); return; }
    e.addEventListener('click', fn);
    registry.set(e as unknown as Object3D, fn);
    cleanup.push(() => { e.removeEventListener('click', fn); registry.delete(e as unknown as Object3D); });
  }
}
