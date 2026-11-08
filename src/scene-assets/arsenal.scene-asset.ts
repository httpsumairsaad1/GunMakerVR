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
