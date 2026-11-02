/**
 * The one-arm vignettes, staged for viewing without zooms (review 3: V1, V2, S5).
 *
 * Since client note 17 removed the loupes and viewfinders, a one-arm cell (+C1, +C2, +C3, +C5, +C6: one robot, its rack and
 * the device) shows its job at the stage scale alone, and it sat at the side of a band laid out for two robots. Two moves:
 *
 *   scale   a one-arm cell runs at the stage scale × SOLO_K for the viewport's height step (the same steps as the stage
 *           scale and the build-time runs, global.css / panel.css). Phones have room above and below the cell: ×2 (×1.8 on
 *           shorter phones); tall tablets ×1.3; desktops as much as the note-7 window allows while every vignette keeps
 *           ≈ 4 notches or more (the whole cell must stay on screen from its first device beat to its end, and a taller cell
 *           leaves less travel: qa/r3/node/pk.ts measured every step). Two-arm +C4 keeps the stage scale
 *   centre  the cell is offset so the arm, its rack and the device sit centred on the page (SOLO_DU units × the scale):
 *           the free half of the band is not left empty any more
 *
 * One source for the build (Compartment.astro: the CSS variables, the runs, the robot QA layouts) and the page (stage.ts reads
 * the scale CSS resolved).
 */
import type { CellCfg } from './program';
import { DEV } from './devices';

/** the scale multiplier of a one-arm cell, per height step (keys as the runs': --pin-<key>) */
export const SOLO_K: Record<string, number> = {
	// phones (≥ 780 px tall, 560–779), short screens keep the phone scale
	p: 2,
	p2: 1.8,
	ps: 1,
	// tablets: tall (≥ 840 px tall) ×1.3; 760–839 and the 1.15 step keep theirs; short screens keep the phone scale
	t: 1.3,
	t2: 1.3,
	t2b: 1.3,
	t3: 1,
	t4: 1,
	ts: 1,
	// desktops: 2560 × 1440 (d, d0), 1920 × 1200 (d1), 1920 × 1080 (d1b), 1680 × 1050 (d2), 1440 × 900 and 1536 × 864 (d3),
	// 1366 × 768 (d4), 1280 × 720 (d5)
	d: 1.45,
	d0: 1.45,
	d1: 1.35,
	d1b: 1.25,
	d2: 1.18,
	d3: 1.1,
	// (1366 × 768 and 1280 × 720: no room to grow and keep ≥ 4 notches: centred only)
	d4: 1,
	d5: 1,
	ds: 1,
};

/** the rack's outer edge from the arm's side of the cell (units: SLOT 148 + the rack's half width) */
const RACK_EDGE = 156;
/** a one-arm cell's offset (units × the scale) that centres its arm, rack and device on the page; 0 for +C4 */
export function soloDu(cfg: CellCfg) {
	if (!cfg.solo) return 0;
	const half = DEV[cfg.dev].w / 2;
	const c0 = (-RACK_EDGE + half) / 2;
	return Math.round((cfg.solo === 'L' ? -c0 : c0) * 10) / 10;
}
/** the multiplier of a cell at a step (1 for the two-arm cell) */
export const soloK = (cfg: CellCfg, key: string) => (cfg.solo ? (SOLO_K[key] ?? 1) : 1);
