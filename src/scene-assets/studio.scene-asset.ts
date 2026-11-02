import {
  createScenePrimitiveObject,
  DataTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from '@iwsdk/core';

function createFloorTexture(size = 256): DataTexture {
  const pixels = new Uint8Array(size * size * 4);
  const half = size / 2;
  const concrete = [67, 57, 50];
  const seams = [89, 74, 62];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance =
        Math.abs(Math.abs(x + 0.5 - half) + Math.abs(y + 0.5 - half) - half) /
        Math.SQRT2;
      const line = Math.max(0, 1 - distance / 1.8) * 0.18;
      const index = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[index + channel] = Math.round(
          concrete[channel] + (seams[channel] - concrete[channel]) * line,
        );
      }
      pixels[index + 3] = 255;
    }
  }

  const texture = new DataTexture(
    pixels,
    size,
    size,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function createStudioFloor(size = 36): Group {
  const texture = createFloorTexture();
  texture.repeat.set(size / 1.2, size / 1.2);
  const floor = createScenePrimitiveObject(
    { geometry: { type: 'plane', size: [size, size] } },
    new MeshStandardMaterial({
      map: texture,
      roughness: 0.92,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;

  const root = new Group();
  root.add(floor);
  return root;
}
