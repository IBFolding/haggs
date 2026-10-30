import { atlasDemo } from '../../playable/atlas-demo';
import { atlasFiles } from './atlas-file';

export async function loadAtlasDemo() {
  const art = await Promise.all(['05-animation-moveset-builder', '06-enemy-intent-painter'].map(async slug => {
    const base = '/workflows/game-director';
    const [png, json] = await Promise.all([fetch(`${base}/previews/${slug}-atlas.png`), fetch(`${base}/playable-examples/${slug}-atlas.json`)]);
    if (!png.ok || !json.ok) throw new Error('The bundled atlas sample could not be loaded. Try again.');
    const imported = await atlasFiles(new File([await png.blob()], 'atlas.png'), new File([await json.blob()], 'atlas.json'));
    return { ...imported, atlas: { ...imported.atlas, loop: true }, prompt: 'Deterministic Game Director guide sample', color: '#35e48a', shape: 'circle' as const };
  }));
  return atlasDemo(art[0]!, art[1]!);
}
