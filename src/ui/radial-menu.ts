import {
  CanvasTexture, CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Object3D,
  PlaneGeometry, RingGeometry, SRGBColorSpace,
} from '@iwsdk/core';

export type WheelItem = { id: string; label: string; sub?: string; color?: string; dim?: boolean };

/** Small canvas-text plane used by the wheel and the wall price tags. */
export function makeLabel(w: number, h: number, lines: Array<{ t: string; px: number; color: string }>): Mesh {
  const c = document.createElement('canvas');
  const k = 600;
  c.width = k; c.height = Math.round((k * h) / w);
  const g = c.getContext('2d');
  if (g) {
    const gap = c.height / (lines.length + 1);
    lines.forEach((l, i) => {
      g.font = `700 ${l.px}px sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = l.color;
      g.fillText(l.t, c.width / 2, gap * (i + 1));
    });
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: DoubleSide }));
  m.raycast = () => {};
  return m;
}

/** Floating holographic wheel. Slices are real meshes so XR rays, pinch and the desktop crosshair all work. */
export class RadialMenu extends Group {
  private parts: Mesh[] = [];
  private mats: MeshBasicMaterial[] = [];
  constructor(
    private readonly onPick: (item: WheelItem) => void,
    private readonly register: (o: Object3D, fn: () => void) => void,
    private readonly unregister: (o: Object3D) => void,
  ) {
    super();
    this.visible = false;
  }

  setItems(title: string, subtitle: string, items: WheelItem[]): void {
    for (const p of this.parts) {
      this.unregister(p);
      this.remove(p);
      p.geometry.dispose();
      const mat = p.material as MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    this.parts = []; this.mats = [];
    const n = Math.max(1, items.length);
    const seg = (Math.PI * 2) / n, gap = 0.035, inner = 0.085, outer = 0.205;
    items.forEach((item, i) => {
      const a = Math.PI / 2 - i * seg;
      const geo = new RingGeometry(inner, outer, 24, 1, a - seg / 2 + gap, seg - gap * 2);
      const base = item.dim ? '#10202b' : '#0a2233';
      const mat = new MeshBasicMaterial({ color: base, transparent: true, opacity: 0.92, side: DoubleSide, depthWrite: false });
      const slice = new Mesh(geo, mat);
      slice.pointerEvents = 'auto';
      const hover = (on: boolean): void => { mat.color.set(on && !item.dim ? '#1b7aa3' : base); };
      const pick = (): void => { if (!item.dim) this.onPick(item); };
      slice.addEventListener('pointerenter', () => hover(true));
      slice.addEventListener('pointerleave', () => hover(false));
      slice.addEventListener('click', pick);
      this.register(slice, pick);
      this.add(slice);
      this.parts.push(slice); this.mats.push(mat);
      const r = (inner + outer) / 2;
      const label = makeLabel(0.15, 0.06, [
        { t: item.label, px: 40, color: item.color ?? '#dff4ff' },
        ...(item.sub ? [{ t: item.sub, px: 30, color: '#7fd8ff' }] : []),
      ]);
      label.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.003);
      slice.add(label);
    });
    const hub = new Mesh(new CircleGeometry(inner - 0.012, 32), new MeshBasicMaterial({ color: '#06101a', transparent: true, opacity: 0.95, side: DoubleSide, depthWrite: false }));
    hub.raycast = () => {};
    const hubLabel = makeLabel(0.15, 0.1, [
      { t: title, px: 38, color: '#ffb04a' },
      { t: subtitle, px: 30, color: '#dff4ff' },
    ]);
    hubLabel.position.z = 0.003;
    hub.add(hubLabel);
    this.add(hub);
    this.parts.push(hub);
  }
}
