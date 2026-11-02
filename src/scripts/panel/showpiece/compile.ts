/**
 * The showpiece compiled: the film (program.ts), its joint flex (a 120 Hz table) and what the page reads from it (chapters,
 * READY, the report's values). In the browser it compiles in idle slices (compileSteps: one chapter or 120 flex steps per
 * slice); the build compiles it once (compileNow) for the robot QA and the poster.
 */
import { buildSteps, flexSteps, type Show } from './program';
import { compiled, type Compiled } from './state';
import { LD } from './scene';
import { SA, W07_LEN, dropA } from './wire';
import { SHOW } from '../../../data/panel';

export function* compileSteps(): Generator<void, Compiled> {
	const b = buildSteps();
	let r = b.next();
	while (!r.done) {
		yield;
		r = b.next();
	}
	const S: Show = r.value;
	yield;
	const g = flexSteps([S.L.tr, S.R.tr], 0, S.tHold + 0.5, 120);
	let q = g.next();
	while (!q.done) {
		yield;
		q = g.next();
	}
	return compiled(S, q.value);
}
let cache: Compiled | null = null;
export function compileNow(): Compiled {
	if (cache) return cache;
	const g = compileSteps();
	let r = g.next();
	while (!r.done) r = g.next();
	cache = r.value;
	return cache;
}
/** the numbers the page prints: READY (s), the chapters, end A's Δ against the model (mm), R of W07 (mΩ) */
export function facts(C: Compiled) {
	const S = C.S;
	// end A's real end against the EPLAN model's straight drop, at the moment the trace finds it (units are mm on the drawing)
	const tDelta = S.hits.find((h) => h.k === 'delta')?.t ?? 3.9;
	const A = dropA(S, tDelta, { x: 0, y: 0 });
	const dA = Math.round(Math.hypot(A.end.x - SA.x, A.end.y - (SA.y + LD.A)));
	const rmOhm = ((SHOW.rho * W07_LEN) / 1000 / SHOW.section) * 1000;
	return {
		ready: S.tReady,
		hold: S.tHold,
		energize: S.tEnergize,
		chapters: S.chapters.map((c) => ({ n: c.n, t0: c.t0, t1: c.t1 })),
		ticks: S.ticks.map((k) => ({ k: k.k, t: k.t })),
		dA,
		rmOhm,
		lenMm: W07_LEN,
	};
}
