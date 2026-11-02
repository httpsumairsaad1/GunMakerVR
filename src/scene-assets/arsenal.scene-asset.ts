import {
  BufferGeometry,
  CylinderGeometry,
  createScenePrimitiveObject,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from '@iwsdk/core';

const finish = {
  graphite: new MeshStandardMaterial({ color: '#303941', roughness: 0.48, metalness: 0.68 }),
  steel: new MeshStandardMaterial({ color: '#77838B', roughness: 0.38, metalness: 0.78 }),
  rubber: new MeshStandardMaterial({ color: '#252B2D', roughness: 0.91 }),
  brass: new MeshStandardMaterial({ color: '#C9934C', roughness: 0.39, metalness: 0.7 }),
  wood: new MeshStandardMaterial({ color: '#81533C', roughness: 0.74 }),
  teal: new MeshStandardMaterial({ color: '#42A99D', roughness: 0.4, metalness: 0.28 }),
  amber: new MeshStandardMaterial({ color: '#E59A43', roughness: 0.42, metalness: 0.24 }),
};

type Size = [number, number, number];
type Position = [number, number, number];

function mergeGroup(group: Group, baseMaterial: MeshStandardMaterial): void {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const meshes = group.children.filter((child): child is Mesh => child instanceof Mesh);

  for (const mesh of meshes) {
    mesh.updateMatrix();
    const geometry = mesh.geometry.clone().toNonIndexed();
    geometry.applyMatrix4(mesh.matrix);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const color = material instanceof MeshStandardMaterial ? material.color : baseMaterial.color;

    for (let index = 0; index < position.count; index += 1) {
      positions.push(position.getX(index), position.getY(index), position.getZ(index));
      if (normal) normals.push(normal.getX(index), normal.getY(index), normal.getZ(index));
      colors.push(color.r, color.g, color.b);
    }
    geometry.dispose();
  }

  if (positions.length === 0) return;
  const merged = new BufferGeometry();
  merged.setAttribute('position', new Float32BufferAttribute(positions, 3));
  if (normals.length === positions.length) {
    merged.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  } else {
    merged.computeVertexNormals();
  }
  merged.setAttribute('color', new Float32BufferAttribute(colors, 3));
  for (const mesh of meshes) {
    group.remove(mesh);
    mesh.geometry.dispose();
  }
  const surface = new Mesh(
    merged,
    new MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness: baseMaterial.roughness,
      metalness: baseMaterial.metalness,
    }),
  );
  surface.name = `${group.name} Surface`;
  group.add(surface);
}

function rounded(
  parent: Group,
  name: string,
  size: Size,
  position: Position,
  material: MeshStandardMaterial,
  bevel = 0.006,
): Mesh {
  const radius = Math.min(bevel, size[0] * 0.35, size[1] * 0.35, size[2] * 0.35);
  const mesh = createScenePrimitiveObject(
    { geometry: { type: 'roundedBox', size, radius, segments: 2 } },
    material,
  );
  mesh.name = name;
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function tube(
  parent: Group,
  name: string,
  length: number,
  radius: number,
  position: Position,
  material: MeshStandardMaterial,
  segments = 8,
): Mesh {
  const mesh = new Mesh(new CylinderGeometry(radius, radius, length, segments), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.z = Math.PI / 2;
  parent.add(mesh);
  return mesh;
}

type GunSpec = {
  id: string;
  barrel: number;
  grip: number;
  accent: MeshStandardMaterial;
  stock?: number;
  magazine?: number;
  optic?: boolean;
  cylinder?: boolean;
  pump?: boolean;
  silenced?: boolean;
};

export function createGun(spec: GunSpec): Group {
  const root = new Group();
  root.name = spec.id;

  const barrel = new Group();
  barrel.name = 'Barrel Assembly';
  root.add(barrel);
  tube(barrel, 'Steel Barrel', spec.barrel, 0.018, [spec.barrel * 0.53, 0.025, 0], finish.steel, 8);
  tube(barrel, 'Muzzle Collar', 0.025, 0.027, [spec.barrel + 0.04, 0.025, 0], spec.accent);
  if (spec.silenced) {
    tube(barrel, 'Suppressor Sleeve', 0.19, 0.031, [spec.barrel + 0.14, 0.025, 0], finish.graphite, 8);
    rounded(barrel, 'Suppressor Index Band', [0.018, 0.052, 0.052], [spec.barrel + 0.22, 0.025, 0], spec.accent, 0.004);
  }

  const receiver = new Group();
  receiver.name = 'Receiver Assembly';
  root.add(receiver);
  rounded(receiver, 'Upper Receiver', [0.34, 0.095, 0.09], [0, 0.015, 0], finish.graphite);
  rounded(receiver, 'Lower Receiver', [0.25, 0.07, 0.084], [-0.015, -0.052, 0], finish.steel);
  rounded(receiver, 'Side Plate', [0.16, 0.012, 0.094], [-0.045, 0.018, 0.05], spec.accent, 0.003);
  for (const x of [-0.1, 0.1]) {
    const pin = new Mesh(new CylinderGeometry(0.008, 0.008, 0.006, 8), finish.brass);
    pin.name = 'Receiver Pin';
    pin.position.set(x, -0.015, 0.052);
    pin.rotation.x = Math.PI / 2;
    receiver.add(pin);
  }
  rounded(receiver, 'Top Rail', [0.27, 0.014, 0.035], [-0.01, 0.07, 0], finish.steel, 0.003);

  const gripAssembly = new Group();
  gripAssembly.name = 'Grip Assembly';
  gripAssembly.position.set(-0.08, -0.105, 0);
  gripAssembly.rotation.z = 0.22;
  root.add(gripAssembly);
  rounded(gripAssembly, 'Grip Core', [0.09, spec.grip, 0.068], [0, -spec.grip * 0.42, 0], finish.rubber, 0.012);
  rounded(gripAssembly, 'Grip Heel', [0.105, 0.025, 0.074], [0, -spec.grip * 0.83, 0], spec.accent, 0.006);
  for (const y of [-0.04, -0.08, -0.12]) {
    if (y > -spec.grip * 0.78) {
      rounded(gripAssembly, 'Grip Texture', [0.071, 0.004, 0.072], [0, y, 0], finish.graphite, 0.001);
    }
  }

  if (spec.magazine) {
    const mag = new Group();
    mag.name = 'Magazine Assembly';
    mag.position.set(0.015, -0.11, 0);
    root.add(mag);
    rounded(mag, 'Magazine Body', [0.075, spec.magazine, 0.064], [0, -spec.magazine * 0.4, 0], finish.steel, 0.009);
    rounded(mag, 'Magazine Floorplate', [0.088, 0.018, 0.07], [0, -spec.magazine * 0.82, 0], spec.accent, 0.004);
    for (const y of [-0.055, -0.09]) {
      rounded(mag, 'Magazine Groove', [0.05, 0.004, 0.068], [0, y, 0], finish.graphite, 0.001);
    }
  }

  if (spec.stock) {
    const stock = new Group();
    stock.name = 'Stock Assembly';
    stock.position.set(-0.19, 0.005, 0);
    root.add(stock);
    rounded(stock, 'Stock Neck', [0.2, 0.065, 0.075], [-0.12, -0.005, 0], finish.graphite);
    rounded(stock, 'Shoulder Pad', [0.12, 0.12, 0.085], [-0.27, -0.015, 0], finish.rubber, 0.014);
    rounded(stock, 'Stock Cheek Rest', [0.12, 0.025, 0.074], [-0.17, 0.045, 0], spec.accent, 0.006);
  }

  if (spec.cylinder) {
    const cylinder = new Group();
    cylinder.name = 'Cylinder Assembly';
    root.add(cylinder);
    const drum = new Mesh(new CylinderGeometry(0.064, 0.064, 0.072, 8), finish.steel);
    drum.name = 'Rotating Cylinder';
    drum.position.set(-0.015, -0.012, 0.066);
    drum.rotation.x = Math.PI / 2;
    cylinder.add(drum);
    const hub = new Mesh(new CylinderGeometry(0.022, 0.022, 0.078, 8), spec.accent);
    hub.name = 'Cylinder Hub';
    hub.position.copy(drum.position);
    hub.rotation.x = Math.PI / 2;
    cylinder.add(hub);
    mergeGroup(cylinder, finish.steel);
  }

  if (spec.pump) {
    rounded(root, 'Pump Foregrip', [0.14, 0.065, 0.082], [spec.barrel * 0.35, -0.055, 0], finish.wood, 0.012);
    tube(root, 'Underbarrel Tube', spec.barrel * 0.78, 0.018, [spec.barrel * 0.4, -0.025, 0], finish.graphite);
  }

  if (spec.optic) {
    const optic = new Group();
    optic.name = 'Optic Assembly';
    root.add(optic);
    rounded(optic, 'Optic Mount', [0.11, 0.045, 0.055], [-0.005, 0.105, 0], finish.steel, 0.005);
    tube(optic, 'Optic Body', 0.13, 0.032, [-0.005, 0.14, 0], finish.graphite, 8);
    tube(optic, 'Amber Lens', 0.005, 0.026, [0.065, 0.14, 0], spec.accent, 8);
    mergeGroup(optic, finish.graphite);
  }

  const details = new Group();
  details.name = 'Detail Assembly';
  root.add(details);
  rounded(details, 'Trigger Guard', [0.085, 0.012, 0.064], [-0.03, -0.092, 0.012], spec.accent, 0.004);
  rounded(details, 'Front Sight', [0.018, 0.035, 0.025], [spec.barrel * 0.8, 0.065, 0], finish.brass, 0.003);
  rounded(details, 'Rear Sight', [0.025, 0.025, 0.04], [-0.115, 0.067, 0], finish.brass, 0.003);
  mergeGroup(barrel, finish.steel);
  mergeGroup(receiver, finish.graphite);
  mergeGroup(gripAssembly, finish.rubber);
  mergeGroup(details, finish.brass);
  const magazine = root.getObjectByName('Magazine Assembly');
  if (magazine instanceof Group) mergeGroup(magazine, finish.steel);
  const stock = root.getObjectByName('Stock Assembly');
  if (stock instanceof Group) mergeGroup(stock, finish.wood);
  if (spec.pump) {
    const pump = new Group();
    pump.name = 'Pump Assembly';
    const foregrip = root.getObjectByName('Pump Foregrip');
    const tube = root.getObjectByName('Underbarrel Tube');
    if (foregrip && tube) {
      root.remove(foregrip, tube);
      pump.add(foregrip, tube);
      root.add(pump);
      mergeGroup(pump, finish.wood);
    }
  }
  return root;
}

type AccessoryKind = 'optic' | 'suppressor' | 'drum' | 'foregrip' | 'laser' | 'brake';

export function createAccessory(kind: AccessoryKind): Group {
  const root = new Group();
  root.name = `${kind} accessory`;
  if (kind === 'optic') {
    rounded(root, 'Optic Foot', [0.12, 0.025, 0.06], [0, 0, 0], finish.steel);
    tube(root, 'Optic Housing', 0.12, 0.038, [0, 0.042, 0], finish.graphite, 8);
    tube(root, 'Lens Ring', 0.006, 0.03, [0.065, 0.042, 0], finish.teal, 8);
  } else if (kind === 'suppressor' || kind === 'brake') {
    const length = kind === 'suppressor' ? 0.2 : 0.08;
    tube(root, 'Outer Sleeve', length, 0.034, [0, 0, 0], finish.graphite, 12);
    tube(root, 'Attachment Collar', 0.025, 0.042, [-length / 2, 0, 0], finish.brass);
    rounded(root, 'Index Mark', [0.018, 0.012, 0.068], [length / 4, 0.034, 0], finish.amber, 0.002);
  } else if (kind === 'drum') {
    const drum = new Mesh(new CylinderGeometry(0.065, 0.065, 0.09, 8), finish.steel);
    drum.name = 'Drum Magazine';
    drum.rotation.x = Math.PI / 2;
    root.add(drum);
    rounded(root, 'Drum Catch', [0.09, 0.028, 0.075], [0, 0.046, 0], finish.amber, 0.005);
  } else if (kind === 'foregrip') {
    rounded(root, 'Grip Saddle', [0.11, 0.035, 0.08], [0, 0.028, 0], finish.steel);
    rounded(root, 'Vertical Grip', [0.066, 0.12, 0.062], [0, -0.045, 0], finish.rubber, 0.012);
    rounded(root, 'Grip Cap', [0.076, 0.014, 0.07], [0, -0.107, 0], finish.amber, 0.004);
  } else {
    rounded(root, 'Laser Housing', [0.1, 0.042, 0.055], [0, 0, 0], finish.graphite);
    rounded(root, 'Laser Emitter', [0.025, 0.025, 0.06], [0.045, 0, 0], finish.teal, 0.004);
    rounded(root, 'Mount Rail', [0.12, 0.012, 0.035], [0, -0.028, 0], finish.steel, 0.003);
  }
  mergeGroup(root, finish.steel);
  return root;
}

type ToolKind = 'torch' | 'driver' | 'wrench' | 'hammer' | 'pliers' | 'oil-can';

export function createTool(kind: ToolKind): Group {
  const root = new Group();
  root.name = `${kind} maker tool`;
  rounded(root, 'Rubberized Handle', [0.065, 0.19, 0.06], [0, -0.025, 0], finish.rubber, 0.014);
  rounded(root, 'Grip Band', [0.071, 0.018, 0.066], [0, -0.065, 0], finish.amber, 0.004);

  if (kind === 'torch') {
    rounded(root, 'Torch Collar', [0.088, 0.05, 0.08], [0, 0.095, 0], finish.steel, 0.008);
    tube(root, 'Torch Nozzle', 0.1, 0.026, [0.07, 0.105, 0], finish.brass);
    rounded(root, 'Heat Shield', [0.052, 0.06, 0.085], [0.025, 0.1, 0], finish.graphite, 0.008);
  } else if (kind === 'driver') {
    rounded(root, 'Driver Ferrule', [0.065, 0.035, 0.065], [0, 0.09, 0], finish.brass, 0.005);
    tube(root, 'Driver Shaft', 0.18, 0.009, [0, 0.195, 0], finish.steel, 8);
    rounded(root, 'Driver Tip', [0.01, 0.035, 0.01], [0, 0.305, 0], finish.graphite, 0.002);
  } else if (kind === 'wrench') {
    rounded(root, 'Wrench Neck', [0.025, 0.17, 0.018], [0, 0.105, 0], finish.steel, 0.006);
    rounded(root, 'Open Jaw', [0.085, 0.035, 0.02], [0, 0.205, 0], finish.steel, 0.006);
    rounded(root, 'Jaw Slot', [0.035, 0.034, 0.023], [0, 0.205, 0], finish.graphite, 0.003);
  } else if (kind === 'hammer') {
    rounded(root, 'Hammer Head', [0.19, 0.065, 0.075], [0, 0.13, 0], finish.steel, 0.012);
    rounded(root, 'Soft Face', [0.018, 0.056, 0.061], [0.103, 0.13, 0], finish.amber, 0.006);
    rounded(root, 'Peen', [0.05, 0.035, 0.046], [-0.115, 0.13, 0], finish.steel, 0.008);
  } else if (kind === 'pliers') {
    rounded(root, 'Pliers Pivot', [0.04, 0.04, 0.035], [0, 0.105, 0], finish.brass, 0.01);
    rounded(root, 'Pliers Jaw Left', [0.035, 0.12, 0.025], [-0.035, 0.18, 0], finish.steel, 0.009).rotation.z = -0.18;
    rounded(root, 'Pliers Jaw Right', [0.035, 0.12, 0.025], [0.035, 0.18, 0], finish.steel, 0.009).rotation.z = 0.18;
    rounded(root, 'Handle Loop', [0.14, 0.025, 0.05], [0, -0.14, 0], finish.amber, 0.012);
  } else {
    rounded(root, 'Oil Reservoir', [0.12, 0.1, 0.085], [0, 0.105, 0], finish.teal, 0.018);
    tube(root, 'Oil Spout', 0.1, 0.009, [0.085, 0.15, 0], finish.brass, 8);
    rounded(root, 'Oil Cap', [0.04, 0.022, 0.04], [-0.02, 0.17, 0], finish.brass, 0.006);
  }
  mergeGroup(root, finish.steel);
  return root;
}

export function createGunWall(): Group {
  const root = new Group();
  root.name = 'Collection Wall';
  rounded(root, 'Pegboard', [3.55, 1.95, 0.055], [0, 0, 0], finish.graphite, 0.016);
  for (const y of [-0.93, 0.93]) {
    rounded(root, 'Frame Rail', [3.62, 0.045, 0.075], [0, y, 0.015], finish.brass, 0.008);
  }
  for (const x of [-1.78, 1.78]) {
    rounded(root, 'Frame Stile', [0.045, 1.88, 0.075], [x, 0, 0.015], finish.steel, 0.008);
  }
  for (let row = 0; row < 4; row += 1) {
    rounded(root, 'Display Shelf', [3.28, 0.028, 0.11], [0, -0.72 + row * 0.48, 0.055], finish.wood, 0.006);
    for (let col = 0; col < 11; col += 1) {
      const x = -1.5 + col * 0.3;
      const peg = new Mesh(new CylinderGeometry(0.006, 0.006, 0.11, 6), finish.brass);
      peg.name = 'Wall Mount Peg';
      peg.position.set(x, -0.48 + row * 0.48, 0.085);
      peg.rotation.x = Math.PI / 2;
      root.add(peg);
    }
  }
  mergeGroup(root, finish.graphite);
  return root;
}

export const guns = {
  'gun-revolver': () => createGun({ id: 'Trailblazer Revolver', barrel: 0.2, grip: 0.15, accent: finish.brass, cylinder: true }),
  'gun-pistol': () => createGun({ id: 'Sparrow Compact', barrel: 0.19, grip: 0.17, accent: finish.teal }),
  'gun-smg': () => createGun({ id: 'Rook Burst SMG', barrel: 0.3, grip: 0.16, accent: finish.amber, stock: 0.3, magazine: 0.18, silenced: true }),
  'gun-rifle': () => createGun({ id: 'Longshot Scout Rifle', barrel: 0.48, grip: 0.18, accent: finish.wood, stock: 0.34, magazine: 0.14 }),
  'gun-shotgun': () => createGun({ id: 'Boreal Pump Shotgun', barrel: 0.44, grip: 0.17, accent: finish.brass, stock: 0.32, pump: true }),
  'gun-sniper': () => createGun({ id: 'Aster Precision Rifle', barrel: 0.56, grip: 0.18, accent: finish.teal, stock: 0.38, magazine: 0.13, optic: true }),
} as const;

export const accessories = {
  'accessory-optic': () => createAccessory('optic'),
  'accessory-suppressor': () => createAccessory('suppressor'),
  'accessory-drum': () => createAccessory('drum'),
  'accessory-foregrip': () => createAccessory('foregrip'),
  'accessory-laser': () => createAccessory('laser'),
  'accessory-brake': () => createAccessory('brake'),
} as const;

export const tools = {
  'tool-torch': () => createTool('torch'),
  'tool-driver': () => createTool('driver'),
  'tool-wrench': () => createTool('wrench'),
  'tool-hammer': () => createTool('hammer'),
  'tool-pliers': () => createTool('pliers'),
  'tool-oil-can': () => createTool('oil-can'),
} as const;
