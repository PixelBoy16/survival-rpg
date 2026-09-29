// Generates HUD pixel-art icons with the PixelLab API. Existing files are kept, so re-runs only fill gaps
// (delete a PNG to regenerate it). Requires PIXELLAB_API_KEY in .env; the key is never logged.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const key = process.env.PIXELLAB_API_KEY;
if (!key) { console.error('PIXELLAB_API_KEY is missing; add it to .env'); process.exit(1); }
const out = 'apps/web-client/public/assets/hud';
const style = 'dark post-apocalyptic survival game inventory icon, muted gritty colors, centered, no text';
const icons: Record<string, { description: string; size: number }> = {
  emblem: { description: 'glowing pale blue crystal shard emblem, round badge symbol', size: 64 },
  attack: { description: 'two crossed rusty blades, attack symbol', size: 48 },
  pipe: { description: 'long straight rusty metal pipe rod, plain gray cylinder, no head, diagonal from bottom-left to top-right', size: 48 },
  hatchet: { description: 'hand axe with wide curved steel blade and wooden handle, diagonal', size: 48 },
  bandage: { description: 'red first aid medical kit box with white cross', size: 48 },
  collect: { description: 'worn canvas backpack full of scavenged scrap', size: 48 },
  // Bottom-right menu bar: light monochrome UI glyphs.
  'menu-character': { description: 'simple light gray monochrome UI icon, survivor head and shoulders bust silhouette', size: 32 },
  'menu-inventory': { description: 'simple light gray monochrome UI icon, backpack silhouette', size: 32 },
  'menu-skill': { description: 'simple light gray monochrome UI icon, diamond shaped rune crest', size: 32 },
  'menu-map': { description: 'simple light gray monochrome UI icon, folded paper map with markings', size: 32 },
  'menu-menu': { description: 'simple light gray monochrome UI icon, three thick horizontal bars hamburger menu', size: 32 }
};

mkdirSync(out, { recursive: true });
for (const [name, icon] of Object.entries(icons)) {
  const file = join(out, `${name}.png`);
  if (existsSync(file)) { console.log(`skip ${name} (exists)`); continue; }
  const response = await fetch('https://api.pixellab.ai/v1/generate-image-pixflux', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: `${icon.description}, ${style}`,
      image_size: { width: icon.size, height: icon.size },
      no_background: true,
      outline: 'single color black outline',
      shading: 'medium shading',
      detail: 'medium detail'
    })
  });
  if (!response.ok) { console.error(`${name}: HTTP ${response.status} ${await response.text()}`); process.exitCode = 1; continue; }
  const { image } = await response.json() as { image: { base64: string } };
  writeFileSync(file, Buffer.from(image.base64.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log(`wrote ${file}`);
}
