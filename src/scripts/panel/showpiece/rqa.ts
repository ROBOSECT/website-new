/**
 * The finale's robot QA (build time, robot/buildqa.ts): no IK clamp, joint speeds and accelerations within the limits, joint
 * limits, the two arms ≥ 2 units apart, nothing below the bench or outside the stage, no link (and no tool that is not on
 * the cable) through the cable.
 */
import { LIM, SPEED, type Pt } from '../robot/kin';
import { armPieces } from '../robot/draw';
import { sepConvex } from '../robot/qa';
import { VB, at, cable, film, holderAt, type Id } from './rfilm';

export interface RQa {
	ok: boolean;
	violations: string[];
	tEnd: number;
	minPeer: number;
	maxSpeedRatio: number;
	maxAccRatio: number;
	clamps: string[];
}
const inPoly = (p: Pt, poly: Pt[]) => {
	let sgn = 0;
	for (let i = 0; i < poly.length; i++) {
		const a = poly[i],
			b = poly[(i + 1) % poly.length];
		const c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
		if (Math.abs(c) < 1e-9) continue;
		const s = Math.sign(c);
		if (sgn && s !== sgn) return false;
		sgn = s;
	}
	return true;
};
/** the film's robot QA (the build fails on a violation) */
export function qa(): RQa {
	const F = film();
	const bad: string[] = [];
	const seen = new Set<string>();
	const add = (k: string, m: string) => {
		if (seen.has(k)) return;
		seen.add(k);
		bad.push(m);
	};
	const clamps = [...F.L.log, ...F.R.log];
	for (const c of clamps) add('clamp' + c, `IK clamp: ${c}`);
	let minPeer = Infinity,
		maxV = 0,
		maxA = 0;
	const ms = (t: number) => Math.round(t * 1000);
	// joint speeds and accelerations (1 ms)
	const dt = 0.001;
	for (const id of ['L', 'R'] as Id[]) {
		const tr = id === 'L' ? F.L : F.R;
		let qa0 = tr.qAt(0),
			qa1 = tr.qAt(dt);
		for (let t = dt; t < F.tEnd - dt; t += dt) {
			const q2 = tr.qAt(t + dt);
			for (let j = 0; j < 4; j++) {
				const v = (q2[j] - qa0[j]) / (2 * dt),
					a = (q2[j] - 2 * qa1[j] + qa0[j]) / (dt * dt);
				const rv = Math.abs(v) / SPEED.w[j],
					ra = Math.abs(a) / SPEED.a[j];
				maxV = Math.max(maxV, rv);
				maxA = Math.max(maxA, ra);
				if (rv > 1.05) add(`v${id}${j}`, `${id} joint ${j} speed ×${rv.toFixed(2)} at ${ms(t)} ms`);
				if (ra > 1.2) add(`a${id}${j}`, `${id} joint ${j} acceleration ×${ra.toFixed(2)} at ${ms(t)} ms`);
			}
			if (qa1[0] < LIM.q1[0] - 1e-6 || qa1[0] > LIM.q1[1] + 1e-6 || qa1[1] < LIM.q2[0] - 1e-6 || qa1[1] > LIM.q2[1] + 1e-6) add(`lim${id}`, `${id} joint limit at ${ms(t)} ms`);
			qa0 = qa1;
			qa1 = q2;
		}
	}
	// the drawn shapes every 10 ms: the arms against each other, the bench, the viewBox, the cable
	const st = { open: 1, comp: 0, led: 0, spin: 0, cw: 3, roll: 0, hold: 0 };
	for (let t = 0; t <= F.tEnd; t += 0.01) {
		const pc = { L: armPieces(F.robs.L, F.L.qAt(t), 'gripper', { ...st, open: F.L.grip.at(t) }).pcs, R: armPieces(F.robs.R, F.R.qAt(t), 'gripper', { ...st, open: F.R.grip.at(t) }).pcs };
		for (const a of pc.L) {
			if (a.kind === 'base') continue;
			for (const b of pc.R) {
				if (b.kind === 'base') continue;
				const d = sepConvex(a.p, b.p);
				minPeer = Math.min(minPeer, d);
				if (d < 2) add(`peer${a.n}${b.n}`, `peer clearance ${d.toFixed(2)} (L ${a.n} / R ${b.n}) at ${ms(t)} ms`);
			}
		}
		const cb = cable(F, t);
		const cab = cb.pts;
		// (the cable already laid: the free part beyond the jaws is flexible and may hang past the holding hand's wrist)
		const nLaid = cab.findIndex((p, i) => i > 0 && Math.hypot(p.x - at(cb.laid).P.x, p.y - at(cb.laid).P.y) < 1e-6) + 1 || cab.length;
		const h = holderAt(F, t);
		for (const id of ['L', 'R'] as Id[]) {
			for (const p of pc[id]) {
				if (p.kind === 'base') continue;
				for (const v of p.p) {
					// (the jaws on the cable lying on the bench rest on it: their fingertips to 1 unit)
					if (v.y > (p.kind === 'finger' ? 1 : 0.01)) add(`bench${id}${p.n}`, `${id} ${p.n} below the bench at ${ms(t)} ms`);
					if (v.y < VB.y + 1 || v.x < VB.x + 1 || v.x > VB.x + VB.w - 1) add(`vb${id}${p.n}`, `${id} ${p.n} outside the stage at ${ms(t)} ms`);
				}
				// the links never through the cable (the leading jaws hold it: their tool may)
				const link = p.n === 'upper' || p.n === 'fore' || p.n === 'capE' || p.n === 'capW' || p.n === 'wrist';
				// (a hand's jaws are on the cable from its grip to its letting go: the left's from the pick to the handoff, the
				// right's from the handoff to the crimp)
				const tool = !link && (p.kind === 'body' || p.kind === 'plate' || p.kind === 'flange' || p.kind === 'finger');
				const busy = id === 'L' ? t > F.k.pick - 0.4 && t < F.k.handDone + 0.4 : t > F.k.grab - 0.4;
				if (!link && !(tool && !busy)) continue;
				const n = h === id ? nLaid : cab.length;
				for (let i = 0; i < n; i += 2) if (inPoly(cab[i], p.p)) {
					add(`cab${id}${p.n}`, `the cable through ${id}'s ${p.n} at ${ms(t)} ms`);
					break;
				}
			}
		}
	}
	return { ok: bad.length === 0, violations: bad, tEnd: F.tEnd, minPeer: +minPeer.toFixed(2), maxSpeedRatio: +maxV.toFixed(2), maxAccRatio: +maxA.toFixed(2), clamps };
}
