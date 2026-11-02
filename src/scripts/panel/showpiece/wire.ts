/**
 * W07, the protagonist: an analytic constant-length model, a pure function of program time (seekable,
 * cheap, checkable). A free drop hangs from its duct slot, its last Lc units curled (coil memory) under one damped swing;
 * a held span is a cubic from the slot (leaving down) to the jaws (arriving down) whose sideways bow is solved by bisection
 * so its length stays constant; the tail under the jaws hangs from them; a seated drop is the same cubic down to the mouth.
 * The comb draws 15 units through the loose jaws while they glide: the curl relaxes with the glide and never returns.
 */
import { clamp01, smooth, spring } from '../core';
import type { Pt } from '../robot/kin';
import { CURL, DUCT, F7, G, LD, SEAT, TP, X0 } from './scene';
import type { Show } from './program';

interface Bz {
	p0: Pt;
	p1: Pt;
	p2: Pt;
	p3: Pt;
}
const bzAt = (c: Bz, u: number): Pt => {
	const v = 1 - u;
	return {
		x: v * v * v * c.p0.x + 3 * v * v * u * c.p1.x + 3 * v * u * u * c.p2.x + u * u * u * c.p3.x,
		y: v * v * v * c.p0.y + 3 * v * v * u * c.p1.y + 3 * v * u * u * c.p2.y + u * u * u * c.p3.y,
	};
};
function bzPts(c: Bz, n = 28) {
	const o: Pt[] = [];
	for (let i = 0; i <= n; i++) o.push(bzAt(c, i / n));
	return o;
}
export function lenOf(p: Pt[]) {
	let L = 0;
	for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
	return L;
}
/** the length of the span's cubic with bow b (no allocation: the bisection below calls it ~22 times a frame) */
function bzLen(S: Pt, E: Pt, a: number, b: number, n = 28) {
	const p1x = S.x + b,
		p1y = S.y + a,
		p2x = E.x + b,
		p2y = E.y - a;
	let L = 0,
		px = S.x,
		py = S.y;
	for (let i = 1; i <= n; i++) {
		const u = i / n,
			v = 1 - u;
		const x = v * v * v * S.x + 3 * v * v * u * p1x + 3 * v * u * u * p2x + u * u * u * E.x;
		const y = v * v * v * S.y + 3 * v * v * u * p1y + 3 * v * u * u * p2y + u * u * u * E.y;
		L += Math.hypot(x - px, y - py);
		px = x;
		py = y;
	}
	return L;
}
/** a few recent spans (the same inputs recur while a hand holds still, and between the stage and its loupe copy) */
const spanCache: { k: string; v: Pt[] }[] = [];
/** a span from S (leaving downward) to E (arriving downward) of length L: the sideways bow solved by bisection */
function span(S: Pt, E: Pt, L: number, sign: number): Pt[] {
	const key = `${S.x},${S.y},${E.x.toFixed(4)},${E.y.toFixed(4)},${L.toFixed(4)},${sign}`;
	for (const c of spanCache) if (c.k === key) return c.v;
	const d = Math.hypot(E.x - S.x, E.y - S.y);
	const a = Math.max(4, 0.36 * d);
	const mk = (b: number): Bz => ({ p0: S, p1: { x: S.x + sign * b, y: S.y + a }, p2: { x: E.x + sign * b, y: E.y - a }, p3: E });
	let out: Pt[];
	if (bzLen(S, E, a, 0) >= L) out = bzPts(mk(0));
	else {
		let lo = 0,
			hi = 120;
		for (let i = 0; i < 22; i++) {
			const m = (lo + hi) / 2;
			if (bzLen(S, E, a, sign * m) < L) lo = m;
			else hi = m;
		}
		out = bzPts(mk((lo + hi) / 2));
	}
	spanCache.unshift({ k: key, v: out });
	if (spanCache.length > 8) spanCache.pop();
	return out;
}
/** a hanging piece from P (direction down, turned by phi) of length len, its last Lc curling by ang·k */
function hang(P: Pt, len: number, phi: number, Lc: number, ang: number, sign: number, k: number, n = 26): Pt[] {
	const o: Pt[] = [{ ...P }];
	let x = P.x,
		y = P.y;
	const ds = len / n;
	for (let i = 1; i <= n; i++) {
		const s = (i - 0.5) * ds;
		const c0 = len - Lc;
		const curl = s > c0 ? sign * ang * k * Math.pow((s - c0) / Lc, 1.5) : 0;
		const th = Math.PI / 2 + phi + curl;
		x += Math.cos(th) * ds;
		y += Math.sin(th) * ds;
		o.push({ x, y });
	}
	return o;
}
export const SA = { x: DUCT.slotA, y: DUCT.y1 },
	SB = { x: DUCT.slotB, y: DUCT.y1 };
/** the duct part of W07 (fixed): up out of slot A, along, down into slot B */
export const DUCT_W: Pt[] = (() => {
	const y = (DUCT.y0 + DUCT.y1) / 2 + 1.5;
	const o: Pt[] = [];
	for (let i = 0; i <= 6; i++) {
		const a = (Math.PI / 2) * (i / 6);
		o.push({ x: SA.x + 5 - 5 * Math.cos(a), y: SA.y - (SA.y - y) * Math.sin(a) });
	}
	for (let i = 0; i <= 6; i++) {
		const a = (Math.PI / 2) * (1 - i / 6);
		o.push({ x: SB.x - 5 + 5 * Math.cos(a), y: SB.y - (SB.y - y) * Math.sin(a) });
	}
	return o;
})();
/** a free drop's swing: one damped pendulum (period 0.95 s) from t0 (the ends were just laid) */
const swing = (t: number, t0: number, A = 0.055) => {
	const u = t - t0;
	if (u < 0) return 0;
	const w = (2 * Math.PI) / 0.95;
	return A * Math.exp(-0.9 * u) * Math.sin(w * u);
};
export interface Drop {
	/** slot → insulation end */
	pts: Pt[];
	end: Pt;
	/** the end's tangent angle (the copper stub) */
	dir: number;
	seated: boolean;
}
function finish(pts: Pt[], seated: boolean): Drop {
	const n = pts.length;
	const a = pts[n - 2],
		b = pts[n - 1];
	return { pts, end: b, dir: Math.atan2(b.y - a.y, b.x - a.x), seated };
}
/** a polyline resampled to n points evenly spaced by arc length */
function resample(pts: Pt[], n: number): Pt[] {
	const L = lenOf(pts);
	const out: Pt[] = [{ ...pts[0] }];
	let i = 1,
		acc = 0;
	for (let k = 1; k < n - 1; k++) {
		const s = (L * k) / (n - 1);
		while (i < pts.length - 1 && acc + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) < s) {
			acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
			i++;
		}
		const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) || 1e-9;
		const u = Math.min(1, (s - acc) / d);
		out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u });
	}
	out.push({ ...pts[pts.length - 1] });
	return out;
}
/** a seated drop held at J: the span above the jaws takes what the piece from the jaws to the mouth does not (the pull test
 * straightens it) */
const heldSeated = (Sl: Pt, J: Pt, seat: Pt, Ld: number, sign = -1) => [...span(Sl, J, Ld - Math.hypot(J.x - seat.x, J.y - seat.y), sign), { x: seat.x, y: seat.y }];
/** the seated drop guided by the open jaws at J (the wire runs through them): two spans sharing the slack */
function guided(Sl: Pt, J: Pt, seat: Pt, Ld: number) {
	const d1 = Math.hypot(J.x - Sl.x, J.y - Sl.y),
		d2 = Math.hypot(seat.x - J.x, seat.y - J.y);
	const k = Ld / Math.max(1e-6, d1 + d2);
	return [...span(Sl, J, d1 * k, -1), ...span(J, seat, d2 * k, -1).slice(1)];
}
const RELAX = { w: 13, z: 0.35 };
const restShape: Partial<Record<'A' | 'B', Drop>> = {};
/** a free drop at its swing angle; at rest (the swing died away) always the same object */
function freeDrop(which: 'A' | 'B', sw: number): Drop {
	const cu = CURL[which];
	if (Math.abs(sw) < 2e-4) return (restShape[which] ??= finish(hang(which === 'A' ? SA : SB, LD[which], 0, cu.Lc, cu.ang, cu.sign, 1), false));
	return finish(hang(which === 'A' ? SA : SB, LD[which], sw, cu.Lc, cu.ang, cu.sign, 1), false);
}
let relaxFrom: WeakMap<Show, Pt[]> | undefined, freeA: WeakMap<Show, Pt[]> | undefined;
/** drop A at t; J: the jaws' (drawn) tool centre point while L holds or guides it */
export function dropA(S: Show, t: number, J: Pt): Drop {
	const e = S.ends.A,
		Ld = LD.A,
		cu = CURL.A;
	if (t < e.tLoose) return freeDrop('A', swing(t, S.tSwing));
	if (t < e.tSeat) {
		// the comb: the wire drawn through the jaws from sLoose to Ld − GIA as they glide from loose to firm
		const k = t < e.tGrip ? smooth((t - e.tLoose) / Math.max(0.05, e.tGrip - e.tLoose)) : 1;
		const sj = e.sLoose + (Ld - G.GIA - e.sLoose) * k;
		const top = span(SA, J, sj, -1);
		const tail = hang(J, Ld - sj, 0, Math.min(cu.Lc, Ld - sj), cu.ang * (1 - k) * Math.min(1, (Ld - sj) / cu.Lc), cu.sign, 1, 10);
		return finish([...top, ...tail.slice(1)], false);
	}
	if (t < e.tRel) return finish(heldSeated(SA, J, SEAT.A, Ld), true);
	const tOff = e.tOff ?? e.tRel;
	if (t < tOff) return finish(guided(SA, J, SEAT.A, Ld), true);
	// the jaws let go of it: one damped swing from the guided shape to its free span
	const free = span(SA, SEAT.A, Ld, -1);
	const k = spring(t - tOff, RELAX, 1, 0)[0];
	if (Math.abs(k) < 2e-3) return finish(free, true);
	const g0 = (relaxFrom ??= new WeakMap()).get(S) ?? resample(guided(SA, S.L.tr.r.fk(S.L.tr.qAt(tOff), S.L.tr.toolAt(tOff)).T, SEAT.A, Ld), 29);
	relaxFrom.set(S, g0);
	const f0 = (freeA ??= new WeakMap()).get(S) ?? resample(free, 29);
	freeA.set(S, f0);
	return finish(
		f0.map((p, i) => ({ x: p.x + (g0[i].x - p.x) * k, y: p.y + (g0[i].y - p.y) * k })),
		true,
	);
}
export function dropB(S: Show, t: number, J: Pt): Drop {
	const e = S.ends.B,
		Ld = LD.B,
		cu = CURL.B;
	if (t < e.tGrip) return freeDrop('B', swing(t, S.tSwing, 0.045));
	if (t < e.tRel) {
		if (t >= e.tSeat) return finish(heldSeated(SB, J, SEAT.B, Ld, 1), true);
		const top = span(SB, J, Ld - G.GIB, 1);
		// the tail under the jaws: its curl relaxes (0.4 s), it swings once after the grip (follow-through)
		const sw = 0.14 * Math.exp(-5 * (t - e.tGrip)) * Math.sin(((2 * Math.PI) / 0.5) * (t - e.tGrip));
		const relax = clamp01(1 - (t - e.tGrip) / 0.4);
		const tail = hang(J, G.GIB, sw, cu.Lc * 0.6, cu.ang * relax, cu.sign, 1, 8);
		return finish([...top, ...tail.slice(1)], false);
	}
	return finish(span(SB, SEAT.B, Ld, 1), true);
}
/* ------------------------------------------------------------------ RESET */
const BACK = { w: 9.5, z: 0.3 };
const restCache: Partial<Record<'A' | 'B', Pt[]>> = {};
const fromCache = new WeakMap<Pt[], Pt[]>();
/** where each drop rests at the film's first frame: hanging from its slot, its last Lc units curled */
export function restDrop(which: 'A' | 'B'): Drop {
	const cu = CURL[which];
	return finish(hang(which === 'A' ? SA : SB, LD[which], 0, cu.Lc, cu.ang, cu.sign, 1), false);
}
/** RESET: an end let go at u = 0 springs from `from` back to its curled hang (one damped swing); the wire keeps its length
 * (the blended shape is rebuilt from the slot with equal segments) */
export function springBack(which: 'A' | 'B', from: Drop, u: number): Drop {
	if (u <= 0) return from;
	const N = 29;
	const to = (restCache[which] ??= resample(restDrop(which).pts, N));
	let fr = fromCache.get(from.pts);
	if (!fr) {
		fr = resample(from.pts, N);
		fromCache.set(from.pts, fr);
	}
	const k = spring(u, BACK, 1, 0)[0];
	if (Math.abs(k) < 1e-3) return finish(to, false);
	const ds = LD[which] / (N - 1);
	const out: Pt[] = [{ ...to[0] }];
	let px = to[0].x + (fr[0].x - to[0].x) * k,
		py = to[0].y + (fr[0].y - to[0].y) * k;
	for (let i = 1; i < N; i++) {
		const ax = to[i].x + (fr[i].x - to[i].x) * k,
			ay = to[i].y + (fr[i].y - to[i].y) * k;
		const dx = ax - px,
			dy = ay - py,
			d = Math.hypot(dx, dy) || 1;
		out.push({ x: out[i - 1].x + (dx / d) * ds, y: out[i - 1].y + (dy / d) * ds });
		px = ax;
		py = ay;
	}
	return finish(out, false);
}

/** end B held across the jaws at J (not seated): the span from slot B to the jaws, the tail under them (RESET: the hand
 * carries it back to where it hangs before it lets go) */
export function heldB(J: Pt): Drop {
	const cu = CURL.B;
	const top = span(SB, J, LD.B - G.GIB, 1);
	const tail = hang(J, G.GIB, 0, cu.Lc * 0.6, 0, cu.sign, 1, 8);
	return finish([...top, ...tail.slice(1)], false);
}

/** a point at fraction u along a polyline, with the partial polyline up to it */
export function along(pts: Pt[], u: number) {
	const L = lenOf(pts);
	let s = u * L;
	const out: Pt[] = [pts[0]];
	for (let i = 1; i < pts.length; i++) {
		const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
		if (s <= d) {
			const k = d ? s / d : 0;
			const p = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
			out.push(p);
			return { pts: out, head: p };
		}
		s -= d;
		out.push(pts[i]);
	}
	return { pts: out, head: pts[pts.length - 1] };
}
/** the wire-marker sleeve's pose `fromEnd` units above the insulation end (pts run slot → end) */
export function sleeveAt(pts: Pt[], fromEnd: number) {
	const rev = pts.slice().reverse();
	const a = along(rev, Math.min(0.98, fromEnd / lenOf(rev)));
	const h = a.head,
		p = a.pts[a.pts.length - 2] ?? rev[0];
	return { x: h.x, y: h.y, deg: (Math.atan2(h.y - p.y, h.x - p.x) * 180) / Math.PI };
}
/** the whole W07: end A → slot A → duct → slot B → end B (the trace's path) */
export function w07Path(A: Drop, B: Drop) {
	return [...A.pts.slice().reverse(), ...DUCT_W.slice(1, -1), ...B.pts];
}
/** the test current's route: probe A on −F7:1 → through −F7's contacts → −F7:2 → W07 → −X0:7 → T7 */
export function currentRoute(A: Drop, B: Drop): Pt[] {
	const f1 = TP.f71;
	const inF7: Pt[] = [
		{ x: f1.x, y: f1.y },
		{ x: f1.x, y: 27 },
		{ x: F7.piv, y: 27 },
		{ x: F7.m2, y: 27 },
		{ x: F7.m2, y: SEAT.A.y },
	];
	const toT7: Pt[] = [
		{ x: X0.m7, y: SEAT.B.y },
		{ x: X0.m7, y: 5 },
		{ x: X0.t7, y: 5 },
		{ x: X0.t7, y: TP.t7.y },
	];
	return [...inF7, ...A.pts.slice().reverse().slice(1), ...DUCT_W.slice(1, -1), ...B.pts, ...toT7];
}
/** W07's drawn length (units = mm on the drawing): for the report's R = ρ·L/A */
export const W07_LEN = LD.A + lenOf(DUCT_W) + LD.B;
