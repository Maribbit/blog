/**
 * Codex (图鉴) — the notebook's collection of creatures & vessels
 * seen in the window world.
 *
 * Each entry documents one recurring visitor. The rarity reflects how
 * often it appears in the world-clock schedule (ships.ts / aircraft.ts):
 *
 *   - Faraway Cargo Ship: 55% presence per 25 min cycle → rare
 *   - Floatplane:         85% presence per  4 min cycle → common
 *
 * ## Asset workflow
 *
 * 1. Draw the asset in `src/assets/svg/scene/`.
 * 2. Import it with `?raw` below.
 * 3. Add a CodexEntry row.
 *
 * The codex view renders cards statically from this manifest at build
 * time (see CodexView.astro): SVG via set:html, plus name / nameEn /
 * rarity / desc.
 */

import cargoShipSvg from '../assets/svg/scene/Cargo_Ship_Faraway.svg?raw';
import floatplaneSvg from '../assets/svg/scene/Floatplane.svg?raw';

export type CodexCategory = 'ship' | 'aircraft';
export type CodexRarity = 'common' | 'rare';

export interface CodexEntry {
  /** Stable id — also used as card key. */
  id: string;
  /** Chinese name — primary line. */
  name: string;
  /** English name — secondary line. */
  nameEn: string;
  category: CodexCategory;
  /** Raw SVG markup (imported via ?raw). */
  svg: string;
  rarity: CodexRarity;
  /** Chinese description (default language). */
  desc: string;
  /** English description — shown when the codex is in EN mode. */
  descEn: string;
}

export const CODEX_ENTRIES: CodexEntry[] = [
  {
    id: 'cargo-ship-faraway',
    name: '远洋货轮',
    nameEn: 'Ocean-going Cargo Ship',
    category: 'ship',
    svg: cargoShipSvg,
    rarity: 'rare',
    desc: '满载集装箱的远洋货轮，每隔一段时间会从海平线的那一头驶过。遇到它，需要一点点运气。',
    descEn: 'An ocean-going container ship, passing by every so often beyond the horizon. Spotting it takes a little luck.',
  },
  {
    id: 'floatplane',
    name: '水上飞机',
    nameEn: 'Floatplane',
    category: 'aircraft',
    svg: floatplaneSvg,
    rarity: 'common',
    desc: '喜欢在云下盘旋的水上飞机，螺旋桨转个不停。它是窗外最常见的过客，抬头就能看到。',
    descEn: 'A floatplane that likes to circle beneath the clouds, propeller spinning without end. The most frequent visitor outside your window.',
  },
];

export const CODEX_RARITY_LABELS: Record<CodexRarity, string> = {
  common: '常见',
  rare: '稀有',
};

export const CODEX_RARITY_LABELS_EN: Record<CodexRarity, string> = {
  common: 'Common',
  rare: 'Rare',
};
