import {
  CylinderGeometry,
  createScenePrimitiveObject,
  Group,
  Mesh,
  MeshStandardMaterial,
} from '@iwsdk/core';

const materials = {
  maple: new MeshStandardMaterial({
    color: '#A9683B',
    roughness: 0.62,
    metalness: 0,
  }),
  edgeMaple: new MeshStandardMaterial({
    color: '#70452F',
    roughness: 0.7,
    metalness: 0,
  }),
  steel: new MeshStandardMaterial({
    color: '#59646D',
    roughness: 0.48,
    metalness: 0.55,
  }),
  satinSteel: new MeshStandardMaterial({
    color: '#8A949B',
    roughness: 0.34,
    metalness: 0.58,
  }),
  rubber: new MeshStandardMaterial({
    color: '#22272B',
    roughness: 0.9,
    metalness: 0,
  }),
  brass: new MeshStandardMaterial({
    color: '#C58D4A',
    roughness: 0.32,
    metalness: 0.74,
  }),
  mat: new MeshStandardMaterial({
    color: '#30383A',
    roughness: 0.88,
    metalness: 0.05,
  }),
  amber: new MeshStandardMaterial({
    color: '#D58B45',
    roughness: 0.42,
    metalness: 0.35,
  }),
};

function addBlock(
  parent: Group,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: MeshStandardMaterial,
  bevel = 0.008,
  cornerRadius = 0.01,
): Mesh {
  const radius = Math.min(
    bevel,
    cornerRadius,
    size[0] * 0.45,
    size[1] * 0.45,
    size[2] * 0.45,
  );
  const mesh = createScenePrimitiveObject(
    {
      geometry: {
        type: 'roundedBox',
        size,
        radius,
        segments: 3,
      },
    },
    material,
  );
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  parent.add(mesh);
  return mesh;
}

function addFastener(
  parent: Group,
  name: string,
  x: number,
  y: number,
  z: number,
): void {
  const head = new Mesh(new CylinderGeometry(0.008, 0.008, 0.004, 8), materials.satinSteel);
  head.name = `${name} Head`;
  head.position.set(x, y, z);
  parent.add(head);

  const slot = addBlock(
    parent,
    `${name} Slot`,
    [0.009, 0.0012, 0.0014],
    [x, y + 0.0025, z],
    materials.rubber,
    0.0002,
    0.0003,
  );
  slot.rotation.y = Math.PI / 4;
}

function addCylinder(
  parent: Group,
  name: string,
  radius: number,
  height: number,
  position: [number, number, number],
  material: MeshStandardMaterial,
  segments = 12,
): Mesh {
  const mesh = new Mesh(
    new CylinderGeometry(radius, radius, height, segments),
    material,
  );
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  parent.add(mesh);
  return mesh;
}

export function createWorkbench(): Group {
  const root = new Group();
  root.name = 'Workbench';

  const frame = new Group();
  frame.name = 'Powder-Coated Steel Frame';
  root.add(frame);

  for (const x of [-0.49, 0.49]) {
    for (const z of [-0.225, 0.225]) {
      addBlock(
        frame,
        `Leg ${x < 0 ? 'Left' : 'Right'} ${z < 0 ? 'Rear' : 'Front'}`,
        [0.052, 0.645, 0.052],
        [x, 0.355, z],
        materials.steel,
        0.009,
        0.012,
      );
      addBlock(
        frame,
        `Rubber Foot ${x < 0 ? 'Left' : 'Right'} ${z < 0 ? 'Rear' : 'Front'}`,
        [0.06, 0.07, 0.06],
        [x, 0.035, z],
        materials.rubber,
        0.008,
        0.014,
      );
    }
  }

  addBlock(frame, 'Front Apron Rail', [0.91, 0.09, 0.045], [0, 0.595, 0.205], materials.steel);
  addBlock(frame, 'Rear Apron Rail', [0.91, 0.09, 0.045], [0, 0.595, -0.205], materials.steel);
  addBlock(frame, 'Left Side Rail', [0.045, 0.09, 0.37], [-0.465, 0.595, 0], materials.steel);
  addBlock(frame, 'Right Side Rail', [0.045, 0.09, 0.37], [0.465, 0.595, 0], materials.steel);
  addBlock(frame, 'Front Lower Stretcher', [0.92, 0.045, 0.035], [0, 0.19, 0.205], materials.steel);
  addBlock(frame, 'Rear Lower Stretcher', [0.92, 0.045, 0.035], [0, 0.19, -0.205], materials.steel);
  addBlock(frame, 'Left Lower Brace', [0.035, 0.045, 0.39], [-0.465, 0.19, 0], materials.steel);
  addBlock(frame, 'Right Lower Brace', [0.035, 0.045, 0.39], [0.465, 0.19, 0], materials.steel);

  const top = new Group();
  top.name = 'Maple Worktop';
  root.add(top);
  addBlock(top, 'Steel Underplate', [1.08, 0.035, 0.55], [0, 0.685, 0], materials.steel, 0.008, 0.014);
  addBlock(top, 'Maple Butcher Block', [1.12, 0.065, 0.58], [0, 0.7175, 0], materials.maple, 0.014, 0.025);
  addBlock(top, 'Front Edge Inlay', [1.03, 0.008, 0.009], [0, 0.713, 0.286], materials.edgeMaple, 0.002, 0.004);
  addBlock(top, 'Rear Edge Inlay', [1.03, 0.008, 0.009], [0, 0.713, -0.286], materials.edgeMaple, 0.002, 0.004);

  const workMat = new Group();
  workMat.name = 'Heat-Resistant Bench Mat';
  top.add(workMat);
  addBlock(workMat, 'Rubber Mat', [0.69, 0.012, 0.34], [0, 0.756, -0.035], materials.mat, 0.004, 0.018);
  addBlock(workMat, 'Mat Front Brass Index', [0.6, 0.003, 0.006], [0, 0.7635, 0.115], materials.brass, 0.001, 0.002);
  for (const x of [-0.24, -0.12, 0, 0.12, 0.24]) {
    addBlock(workMat, `Mat Guide Groove ${x}`, [0.0025, 0.0015, 0.17], [x, 0.763, -0.025], materials.rubber, 0.0005, 0.0008);
  }

  const drawers = new Group();
  drawers.name = 'Front Tool Drawers';
  root.add(drawers);
  for (const x of [-0.235, 0.235]) {
    const side = x < 0 ? 'Left' : 'Right';
    addBlock(drawers, `${side} Drawer Face`, [0.405, 0.105, 0.018], [x, 0.525, 0.238], materials.steel, 0.006, 0.012);
    addBlock(drawers, `${side} Drawer Recess`, [0.32, 0.004, 0.003], [x, 0.525, 0.248], materials.rubber, 0.001, 0.0015);
    addBlock(drawers, `${side} Drawer Pull`, [0.105, 0.012, 0.016], [x, 0.528, 0.26], materials.satinSteel, 0.004, 0.006);
    addBlock(drawers, `${side} Pull Mount Left`, [0.012, 0.023, 0.012], [x - 0.04, 0.528, 0.254], materials.brass, 0.003, 0.004);
    addBlock(drawers, `${side} Pull Mount Right`, [0.012, 0.023, 0.012], [x + 0.04, 0.528, 0.254], materials.brass, 0.003, 0.004);
  }

  const vise = new Group();
  vise.name = 'Bench Vise';
  root.add(vise);
  addBlock(vise, 'Vise Mount Plate', [0.18, 0.018, 0.15], [-0.405, 0.762, 0.205], materials.steel, 0.005, 0.01);
  addBlock(vise, 'Vise Base', [0.15, 0.045, 0.12], [-0.405, 0.79, 0.205], materials.steel, 0.009, 0.016);
  addBlock(vise, 'Fixed Jaw', [0.13, 0.075, 0.035], [-0.405, 0.84, 0.242], materials.steel, 0.008, 0.012);
  addBlock(vise, 'Moving Jaw', [0.13, 0.075, 0.035], [-0.405, 0.84, 0.156], materials.steel, 0.008, 0.012);
  addBlock(vise, 'Fixed Jaw Face', [0.105, 0.045, 0.006], [-0.405, 0.84, 0.261], materials.satinSteel, 0.002, 0.004);
  addBlock(vise, 'Moving Jaw Face', [0.105, 0.045, 0.006], [-0.405, 0.84, 0.137], materials.satinSteel, 0.002, 0.004);
  const viseScrew = addCylinder(vise, 'Vise Lead Screw', 0.009, 0.15, [-0.405, 0.79, 0.11], materials.satinSteel, 10);
  viseScrew.rotation.x = Math.PI / 2;
  const handle = addCylinder(vise, 'Vise Handle', 0.006, 0.22, [-0.405, 0.77, 0.105], materials.brass, 10);
  handle.rotation.z = Math.PI / 2;
  addCylinder(vise, 'Handle End Cap Left', 0.012, 0.012, [-0.515, 0.77, 0.105], materials.steel, 10).rotation.z = Math.PI / 2;
  addCylinder(vise, 'Handle End Cap Right', 0.012, 0.012, [-0.295, 0.77, 0.105], materials.steel, 10).rotation.z = Math.PI / 2;

  for (const x of [-0.5, 0.5]) {
    for (const z of [-0.235, 0.235]) {
      addFastener(top, `Top Bolt ${x} ${z}`, x, 0.751, z);
    }
  }

  addBlock(root, 'Amber Maker Mark', [0.055, 0.028, 0.004], [0.49, 0.44, 0.229], materials.amber, 0.003, 0.006);

  return root;
}
