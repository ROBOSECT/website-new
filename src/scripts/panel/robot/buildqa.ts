/**
 * The robot QA at build time (the build fails on any violation): every program, at the stage scales
 * the site uses (desktop 2.4 to 1.7, tablet 1.8 and 1.15, phone 0.88 and the short-viewport cell), stepped through the real
 * simulation and its drawn shapes tested (robot/qa.ts). Run once per compartment per build (both languages share it).
 */
import { PROGRAMS } from '../programs';
import { compile, tokens, type Bp } from '../program';
import { runQa } from './qa';
import { soloDu, soloK } from '../solo';

// (each layout at its step's key: a one-arm cell runs there at the scale × solo.ts's multiplier, centred)
const LAYOUTS: { W: number; bp: Bp; sc: number; key: string }[] = [
	{ W: 1440, bp: 'desktop', sc: 2.4, key: 'd' },
	{ W: 1440, bp: 'desktop', sc: 2.4, key: 'd1' },
	{ W: 1440, bp: 'desktop', sc: 2.4, key: 'd1b' },
	{ W: 1440, bp: 'desktop', sc: 2.3, key: 'd2' },
	// (1440 × 900 runs at 2.15, 1366 × 768 at 1.85)
	{ W: 1440, bp: 'desktop', sc: 2.15, key: 'd3' },
	{ W: 1366, bp: 'desktop', sc: 1.85, key: 'd4' },
	{ W: 1280, bp: 'desktop', sc: 1.7, key: 'd5' },
	// (tablets at 1.8 from 760 px tall, 1.15 under)
	{ W: 768, bp: 'tablet', sc: 1.8, key: 't2' },
	{ W: 1024, bp: 'tablet', sc: 1.8, key: 't3' },
	{ W: 1024, bp: 'tablet', sc: 1.15, key: 't4' },
	{ W: 390, bp: 'phone', sc: 0.88, key: 'p' },
	{ W: 360, bp: 'phone', sc: 0.88, key: 'p2' },
	{ W: 900, bp: 'tablet', sc: 0.88, key: 'ts' },
];
const done = new Map<number, string[]>();
/** throws (fails the build) if the robots of compartment n break a rule anywhere in their program */
export function assertRobots(n: number) {
	if (!done.has(n)) {
		const bad: string[] = [];
		const seen = new Set<string>();
		for (const L of LAYOUTS) {
			const cfg = PROGRAMS[n];
			const T = tokens(L.W, L.bp);
			const sc = L.sc * soloK(cfg, L.key);
			if (seen.has(`${L.W}/${sc}`)) continue;
			seen.add(`${L.W}/${sc}`);
			T.sc = sc;
			T.band = 112 * sc;
			T.y0 = 400;
			T.cx = L.W / 2 + soloDu(cfg) * sc;
			if (n === 7) T.cx = 360;
			if (L.bp !== 'phone' && sc < 0.95) Object.assign(T, { cable: 5, cu: 6.75, cuw: 2.15 });
			const B = compile(T, cfg);
			if (!B.rig) continue;
			const r = runQa(B, B.tEnd, { maxViolations: 6 });
			for (const v of r.violations) bad.push(`+C${n} at ${L.bp} × ${sc.toFixed(2)}: ${v}`);
		}
		done.set(n, bad);
	}
	const bad = done.get(n)!;
	if (bad.length) throw new Error(`robot QA failed (robot/qa.ts):\n  ${bad.join('\n  ')}`);
}

/* ------------------------------------------------------------------ +C7 the showpiece */
import { compileNow } from '../showpiece/compile';
import { runShowQa, type SpQa } from '../showpiece/qa';
let spDone: SpQa | null = null;
/** throws (fails the build) if the showpiece's robots break a rule anywhere in the film, at any arming level or in any Send
 * branch (scale-free: one run covers every layout) */
export function assertShowpiece() {
	if (!spDone) {
		const C = compileNow();
		spDone = runShowQa(C.S, { flex: C.flex, branches: true, maxViolations: 12 });
	}
	if (!spDone.ok) throw new Error(`showpiece robot QA failed (showpiece/qa.ts):\n  ${spDone.violations.join('\n  ')}`);
	return spDone;
}
