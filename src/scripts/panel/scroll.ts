/**
 * Scroll → program time and the slowed travel (MOTION-SPEC v5 §3; client note 6). Port of spec/v4/scroll.js.
 *
 *   Smooth   one critically damped follower of the native scroll position (exact per-frame solution,
 *            frame-rate independent): e(t) = (e0 + (v0 + ω e0) t)·e^(−ωt), ω = 2/τ
 *   Warp     program time ↔ "weighted seconds": key beats and the morph get more scroll per program
 *            second, so the wheel slows there like a detent
 *   Slow     one slow zone: the page's speed 1× → r → 1× with C¹ ramps (never 0: no pin)
 *   Glide    the whole page's slowed travel: the zones in order, G(Y) = the extra scroll absorbed so far
 *            (Σ zone offsets); every block of the page is drawn at layout + G(Y) − C (C = the runs above it)
 *   Track    one compartment: run length (CSS, read from the DOM), its zone, anchors in document px
 *            (Ŷ0 program start, Ŷend program end, zone end), t(Ŷ), its stage's displacement for the NATIVE Y
 */
import { H, smooth } from './core';
import { MORPH_DUR, type Compiled } from './program';
import { SimCache } from './sim';

export class Smooth {
	tau = 0.15;
	w = 2 / 0.15;
	y = 0;
	v = 0;
	constructor(tau: number) {
		this.setTau(tau);
	}
	setTau(tau: number) {
		this.tau = tau;
		this.w = 2 / tau;
	}
	step(dt: number, Y: number) {
		if (dt <= 0) return this;
		const w = this.w,
			e0 = this.y - Y,
			c = this.v + w * e0,
			X = Math.exp(-w * dt);
		this.y = Y + (e0 + c * dt) * X;
		this.v = (this.v - w * c * dt) * X;
		// sub-pixel and nearly still: snap (0.25 px of scroll is < 1 ms of program time) and let the ticker stop
		if (Math.abs(this.y - Y) < 0.25 && Math.abs(this.v) < 3) {
			this.y = Y;
			this.v = 0;
		}
		return this;
	}
	settled(Y: number) {
		return this.y === Y && this.v === 0;
	}
}

/** beats that read like detents under the wheel (v4; kept for the QA tools: the warp below uses narrative spans) */
export const KEY =
	/^(seat|power|miss|self-seat|7\/7|ready|dual probe contact|lever ON|tap \.\d|L: cage open|R: cage open|in: cage open|.*: torque reached|.*: tool → .*|04 execute)$/;

/**
 * Narrative weights (pacing pass, art 5, brief 4, client note 4): the scroll a program gets is spent by what the visitor
 * should see, not by program seconds. Transit (an arm travelling, a base turning to its rack, parking) is compressed to
 * `base`; each beat of the story gets a span of program time at a higher weight: the insertion, the screw run-down, the
 * cage, a probe contact, the tool coupling, the lever, the power-up and above all the morph. Weights are scroll per program
 * second relative to each other (the zone plan sets the absolute scale); the compartment's hero beats (cfg.pace.hero) ×1.25 (vignettes; v8 ×1.35).
 */
export const PACE_W = {
	base: 0.22,
	arrival: 0.32,
	pick: 0.9,
	miss: 1.5,
	perceive: 1.2,
	insert: 1.6,
	cage: 1.7,
	screw: 1.7,
	tool: 1.2,
	probe: 1.9,
	tap: 1.9,
	hover: 1.0,
	lever: 1.9,
	scan: 1.05,
	register: 1.2,
	plan: 1.0,
	execute: 0.9,
	read: 1.3,
	confirm: 1.2,
	power: 1.3,
	morph: 1.4,
	out: 0.3,
	ready: 1.0,
} as const;
export type PaceKind = keyof typeof PACE_W;
export interface PaceSpan {
	kind: string;
	t0: number;
	t1: number;
	w: number;
}
/** the narrative spans of a compiled program (program time) */
export function paceSpans(B: Compiled): PaceSpan[] {
	const out: PaceSpan[] = [];
	const hero = new Set(B.cfg.pace?.hero ?? []);
	const ov = B.cfg.pace?.w ?? {};
	const add = (kind: PaceKind, t0: number, t1: number) => {
		if (t1 > t0) out.push({ kind, t0, t1, w: (ov[kind] ?? PACE_W[kind]) * (hero.has(kind) ? 1.25 : 1) });
	};
	const find = (re: RegExp) => B.beats.find((b) => re.test(b.name));
	const a = B.cable.arrive;
	const hang = find(/^(hang|self-seat)$/);
	if (a) add('arrival', a.t0, hang ? hang.t : a.t0 + 0.6);
	for (const b of B.beats) {
		const t = b.t,
			nm = b.name;
		if (/: grip$/.test(nm)) add('pick', t - 0.35, t + 0.08);
		else if (nm === 'miss') add('miss', t - 0.3, t + 0.45);
		else if (nm === 'perceived') add('perceive', t - 0.05, t + 0.3);
		else if (nm === 'seat') add('insert', t - 0.38, t + 0.18);
		else if (nm === 'self-seat') add('insert', t - 0.45, t + 0.15);
		else if (/cage open$/.test(nm)) add('cage', t - 0.25, t + 0.12);
		else if (/cage shut$/.test(nm)) add('cage', t - 0.1, t + 0.25);
		else if (/: tool → /.test(nm)) add('tool', t - 0.75, t + 0.3);
		else if (/probe contact$/.test(nm)) add('probe', t - 0.4, t + 0.25);
		else if (/^tap \.\d$/.test(nm)) add('tap', t - 0.14, t + 0.1);
		else if (nm === 'not yet measured') add('hover', t - 0.2, t + 0.1);
		else if (nm === 'lever ON') add('lever', t - 0.45, t + 0.35);
		else if (nm === '01 perceive') add('scan', t - 0.05, t + 0.4);
		else if (nm === '03 plan') add('plan', t - 0.02, t + 0.3);
		// (review 3, V3: the drawing's outline held off the real tab from the lock, then its snap: both get the scroll)
		else if (nm === '02 integrate') add('register', t - 0.34, t + 0.32);
		else if (nm === '04 execute') add('execute', t - 0.05, t + 0.3);
		else if (nm === 'read') add('read', t - 0.08, t + 0.62);
		else if (nm === 'confirm') add('confirm', t - 0.2, t + 0.25);
		else if (nm === 'ready') add('ready', t - 0.7, t + 0.1);
	}
	const eng = find(/screw engaged$/),
		tq = find(/torque reached$/);
	if (eng && tq) add('screw', eng.t - 0.12, tq.t + 0.15);
	if (B.powerT > 0 && B.morphT > 0) add('power', B.powerT - 0.08, B.morphT);
	if (B.morphT > 0) add('morph', B.morphT, B.morphT + MORPH_DUR);
	const og = find(/^out: gripped$/),
		oi = find(/^out: into the duct$/);
	if (og && oi) add('out', og.t - 0.15, oi.t + 0.1);
	for (const q of B.paces) out.push({ kind: q.name, t0: q.t0, t1: q.t1, w: q.w });
	return out;
}

/** program time ↔ weighted seconds: the scroll per program second follows the narrative weight of what happens then
 * (paceSpans; smooth 50 ms edges, the strongest span wins), so the wheel slows on the beats and hurries the transits */
export class Warp {
	n: number;
	tEnd: number;
	S: Float64Array;
	total: number;
	spans: PaceSpan[];
	constructor(B: Compiled, tEnd: number) {
		this.spans = paceSpans(B);
		const base: number = B.cfg.pace?.w?.base ?? PACE_W.base,
			e = 0.05;
		const n = Math.ceil(tEnd / H) + 1;
		this.n = n;
		this.tEnd = tEnd;
		this.S = new Float64Array(n);
		let acc = 0;
		for (let i = 1; i < n; i++) {
			const t = (i - 0.5) * H;
			let r = base;
			for (const q of this.spans) {
				if (t < q.t0 - e || t > q.t1 + e) continue;
				const win = smooth((t - q.t0 + e) / (2 * e)) * smooth((q.t1 + e - t) / (2 * e));
				r = Math.max(r, base + (q.w - base) * win);
			}
			acc += r * H;
			this.S[i] = acc;
		}
		this.total = acc;
	}
	/** weighted seconds at program time t */
	w(t: number) {
		if (t <= 0) return 0;
		if (t >= this.tEnd) return this.total;
		const x = t / H,
			i = Math.floor(x);
		return this.S[i] + (this.S[Math.min(this.n - 1, i + 1)] - this.S[i]) * (x - i);
	}
	/** program time at weighted seconds w (binary search) */
	t(w: number) {
		if (w <= 0) return 0;
		if (w >= this.total) return this.tEnd;
		let lo = 0,
			hi = this.n - 1;
		while (hi - lo > 1) {
			const m = (lo + hi) >> 1;
			if (this.S[m] <= w) lo = m;
			else hi = m;
		}
		const d = this.S[hi] - this.S[lo] || 1;
		return Math.min(this.tEnd, (lo + (w - this.S[lo]) / d) * H);
	}
}

/** the zone plan's targets for a program (cfg.pace): its hold ratio r, and a cap on its scroll (n notches of 100 px) so a
 * tall screen does not make a program endless (r rises there instead) */
export function paceOf(B: Compiled, wT: number, vh = 900) {
	const T = B.G.T;
	const pc = B.cfg.pace;
	if (!pc) return { kMax: T.k, rMin: T.rMin, rMax: T.rMax };
	// (phones: a touch flick covers more than a wheel notch; their programs are capped a little shorter)
	const n = pc.n * (T.bp === 'phone' ? 0.85 : 1);
	const r = paceR(B, vh);
	return { kMax: (n * 100) / Math.max(0.1, wT), rMin: r, rMax: Math.max(T.rMax, r + 0.15), preferDelay: true };
}
/** short landscape screens (height ≤ 520, vignettes §10.4): the cell has ≈ 70–110 px of travel while it is whole on screen
 * (a physical limit); there a vignette plans at this hold ratio (1.6–2.9 notches) rather than flash by in one */
export const SHORT_R = 0.35;
export const SHORT_VH = 520;
/** the hold ratio a compartment aims for at a viewport height */
export const paceR = (B: Compiled, vh: number) => {
	const r = B.cfg.pace?.r ?? B.G.T.rMin;
	return vh <= SHORT_VH ? Math.min(r, SHORT_R) : r;
};
/** the page's speed floor at a height: R_FLOOR, or a little under SHORT_R on short screens */
export const rFloor = (vh: number) => (vh <= SHORT_VH ? SHORT_R - 0.02 : R_FLOOR);

/* ------------------------------------------------------------------ the slowed travel (client note 6) */

/** unit ramp: q(u) 0 → 1 on [0, 1], a piecewise-quadratic smoothstep (q'(0) = q'(1) = 0, q' continuous):
 * the stage's speed 1 − (1 − r)·q is C¹, its offset (∫q) piecewise cubic, so CSS cubic-bezier keyframes
 * reproduce it exactly */
export const rampq = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u <= 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
/** ∫₀ᵘ q */
export const rampQ = (u: number) => (u <= 0 ? 0 : u >= 1 ? u - 0.5 : u <= 0.5 ? (2 / 3) * u * u * u : u - 0.5 + (2 / 3) * (1 - u) ** 3);

/**
 * One slow zone, in px of scroll from its start A:
 *   ramp-down [0, rd] (1× → r) · hold at r until the program end (x = S) · ramp-up [S, S + ru] (r → 1×) right after it,
 *   so the page only speeds up once the program is complete (a brisk scroll that runs ahead of the smoothed program
 *   time then carries the cell up by r·lag at most).
 * Offset of the page off(x) = (1 − r)·Q(x), Q = ∫q; screen speed = 1 − (1 − r)·q(x) ∈ [r, 1].
 * Extra scroll the zone adds (the run) P = (1 − r)·(S − rd/2 + ru/2). Screen travel from the zone start to the
 * program end = S − (1 − r)·(S − rd/2).
 */
export class Slow {
	r = 1;
	rd = 0;
	ru = 0;
	S = 0;
	L = 0;
	P = 0;
	constructor(o: { r: number; rd: number; ru: number; S: number }) {
		this.r = o.r;
		this.rd = o.rd;
		this.ru = o.ru;
		this.S = o.S;
		this.L = o.S + o.ru;
		this.P = (1 - o.r) * this.Q(this.L);
	}
	/** ∫₀ˣ q (px) */
	Q(x: number) {
		const { rd, ru, L } = this;
		if (x <= 0) return 0;
		if (x >= L) return L - rd / 2 - ru / 2;
		if (x < rd) return rd * rampQ(x / rd);
		if (x <= L - ru) return rd / 2 + (x - rd);
		return L - rd / 2 - ru / 2 - ru * rampQ((L - x) / ru);
	}
	q(x: number) {
		const { rd, ru, L } = this;
		if (x <= 0 || x >= L) return 0;
		if (x < rd) return rampq(x / rd);
		if (x <= L - ru) return 1;
		return rampq((L - x) / ru);
	}
	off(x: number) {
		return Math.min(this.P, (1 - this.r) * this.Q(x));
	}
	speed(x: number) {
		return 1 - (1 - this.r) * this.q(x);
	}
	/** CSS keyframes (progress 0…1 over [0, L]) that reproduce off(x) exactly: Hermite cubics as cubic-béziers */
	keyframes() {
		const { rd, ru, L } = this;
		const xs = [0, rd / 2, rd, L - ru, L - ru / 2, L];
		const ease = ['cubic-bezier(0.333333,0,0.666667,0)', 'cubic-bezier(0.333333,0.2,0.666667,0.6)', 'linear', 'cubic-bezier(0.333333,0.4,0.666667,0.8)', 'cubic-bezier(0.333333,1,0.666667,1)', 'linear'];
		return xs.map((x, i) => ({ p: x / L, v: (1 - this.r) * this.Q(x), ease: ease[i] }));
	}
}

/** the device beats: from the first of them to the end of the program the device must be fully on screen (client note 7) */
export const DEVICE_BEAT = /^(seat|miss|self-seat|.*: cage open|.*: torque reached|tap \.\d|01 perceive|04 execute|read|lever ON|dual probe contact|power)$/;

export interface ZoneIn {
	/** weighted seconds to the first device beat and to the program end */
	w1: number;
	wT: number;
	/** screen distance the bench travels from program start to end */
	D: number;
	/** how far it must have travelled by the first device beat (the device then fully on screen; ≤ 0: no constraint) */
	need: number;
	/** ramp-up length, shortest ramp-down */
	ru: number;
	rdMin: number;
}
export interface Zone {
	/** px of scroll per weighted second, program scroll S, 1× lead-in a (zone start = Ŷ0 + a), ramp-down rd, hold r, run P */
	k: number;
	S: number;
	a: number;
	rd: number;
	r: number;
	P: number;
	/** travel by the first device beat, and whether it meets `need` */
	t1: number;
	vis: boolean;
	/** the 1× rise before the program starts (px of scroll; 0 unless the cell must come up first, short viewports) */
	d: number;
}

/** ∫ speed over [0, x] of a zone (lead-in a at 1×, ramp-down rd to r, hold), x before the ramp-up */
function travelTo(x: number, a: number, rd: number, r: number) {
	if (x <= a) return x;
	const u = Math.min(x - a, rd);
	let t = a + u - (1 - r) * rd * rampQ(u / rd);
	if (x - a > rd) t += r * (x - a - rd);
	return t;
}

/**
 * The zone for a scroll rate k: the ramp-down ends at the first device beat (the page still moves fast while the cell
 * comes up, and the device is fully on screen from then on); if that is not enough travel, a 1× lead-in `a` comes
 * first. r follows from the total distance: D = S − (1 − r)·(S − a − rd/2).
 * d: the program starts d px of 1× scroll later than the pen meeting its arrival (the cell has risen d px by then:
 * less travel left, less to rise before the first device beat).
 */
export function zoneAt(k: number, o: ZoneIn, d = 0): Zone {
	const S = k * o.wT,
		L1 = k * o.w1,
		ru = o.ru,
		Dd = o.D - d,
		need = o.need - d;
	const solve = (a: number) => {
		const rd = Math.max(o.rdMin, L1 - a);
		const Iq = S - a - rd / 2;
		const r = Math.max(0.02, Math.min(1, 1 - (S - Dd) / Math.max(1, Iq)));
		return { a, rd, r, t1: travelTo(L1, a, rd, r) };
	};
	let z = solve(0);
	const aMax = Math.max(0, L1 - o.rdMin);
	if (z.t1 < need && aMax > 0) {
		const zMax = solve(aMax);
		if (zMax.t1 < need) z = zMax;
		else {
			let lo = 0,
				hi = aMax;
			for (let i = 0; i < 40; i++) {
				const m = (lo + hi) / 2;
				if (solve(m).t1 < need) lo = m;
				else hi = m;
			}
			z = solve(hi);
		}
	}
	const P = (1 - z.r) * (S - z.a - z.rd / 2 + ru / 2);
	return { k, S, a: z.a, rd: z.rd, r: z.r, P, t1: z.t1, vis: z.t1 >= need - 0.5, d };
}

/** the floor of the page's screen speed in a zone: below it the page reads as stopped (client note 6) */
export const R_FLOOR = 0.42;
/** the lowest scroll rate (px of scroll per program second) the planner may use to keep r ≥ rMin: only binding on landscape
 * phones, where the cell has ≈ 290 px to travel and the longest programs (+C4, 9 s with its tool change) need it */
const K_FLOOR = 12;

/** the largest k ≤ kMax with r ≥ rMin (r ≤ rMax kept by lengthening short programs), at a delay d */
function planAtDelay(o: ZoneIn & { kMax: number; rMin: number; rMax: number }, d: number) {
	const bis = (f: (k: number) => boolean, lo: number, hi: number) => {
		for (let i = 0; i < 34; i++) {
			const m = (lo + hi) / 2;
			if (f(m)) hi = m;
			else lo = m;
		}
		return hi;
	};
	let k = o.kMax;
	let z = zoneAt(k, o, d);
	if (z.r < o.rMin) {
		k = Math.max(K_FLOOR, bis((x) => zoneAt(x, o, d).r < o.rMin, K_FLOOR, o.kMax) - 1e-6);
		z = zoneAt(k, o, d);
	} else if (z.r > o.rMax) {
		k = bis((x) => zoneAt(x, o, d).r <= o.rMax, o.kMax, o.kMax * 4);
		z = zoneAt(k, o, d);
	}
	return { k, z };
}

/** build time and runtime: the largest k ≤ kMax with r ≥ rMin, then (note 7, a blocker) enough scroll before the first device
 * beat for the device to be on screen; rMax is kept by lengthening short programs. When the cell cannot both come on
 * screen by its first device beat and keep the page moving at ≥ R_FLOOR (short viewports: little travel left once
 * the device is fully on screen), the program waits while the cell rises at 1× (delay d) instead of nearly stopping
 * the page: the smallest d that makes it feasible */
export function zonePlan(o: ZoneIn & { kMax: number; rMin: number; rMax: number; preferDelay?: boolean; rFloor?: number }) {
	const floor = o.rFloor ?? (o.rMin < R_FLOOR ? o.rMin - 0.02 : R_FLOOR);
	const bis = (f: (k: number) => boolean, lo: number, hi: number) => {
		for (let i = 0; i < 50; i++) {
			const m = (lo + hi) / 2;
			if (f(m)) hi = m;
			else lo = m;
		}
		return hi;
	};
	// delay: scan, then refine (vis is monotone enough in d: less to rise, less travel left); null if none works
	const delayed = () => {
		const dMax = Math.max(0, Math.min(o.need, o.D - 40));
		const okAt = (d: number) => planAtDelay(o, d).z.vis;
		const n = 24;
		let lo = 0,
			hi = -1;
		for (let i = 1; i <= n; i++) {
			const d = (dMax * i) / n;
			if (okAt(d)) {
				hi = d;
				lo = (dMax * (i - 1)) / n;
				break;
			}
		}
		if (hi < 0) return null;
		for (let i = 0; i < 16; i++) {
			const m = (lo + hi) / 2;
			if (okAt(m)) hi = m;
			else lo = m;
		}
		return planAtDelay(o, hi).z;
	};
	const { k, z: z0 } = planAtDelay(o, 0);
	let z = z0;
	if (z.vis) return z;
	// a paced compartment (cfg.pace) keeps its hold ratio: the program starts a little later (the cell rises at 1× first)
	// rather than spending more scroll on its first beats than its dramaturgy gives them
	if (o.preferDelay) {
		const zd = delayed();
		if (zd) return zd;
	}
	if (zoneAt(o.kMax * 4, o).vis) z = zoneAt(bis((x) => zoneAt(x, o).vis, k, o.kMax * 4), o);
	if (z.vis && z.r >= Math.min(o.rMin, floor + 0.03) - 1e-6) return z;
	return delayed() ?? planAtDelay(o, Math.max(0, Math.min(o.need, o.D - 40))).z;
}

/** no scroll-driven animations (the page cannot glide on the compositor): no slow zone, the page moves at 1× and the
 * program spans the cell's own travel, delayed so the device is on screen by its first device beat */
export function zoneLinear(o: ZoneIn): Zone {
	// k·w1 = need − d (the device fully on screen at its first beat) and k·wT = D − d (the cell at its end position at the end)
	const span = Math.max(1e-6, o.wT - o.w1);
	const d = Math.min(Math.max(0, o.need), Math.max(0, (o.need * o.wT - o.D * o.w1) / span));
	// (a cell that barely fits — a landscape phone — gets a near-instant device part rather than a clipped one)
	const k = Math.max(4, (o.D - d) / Math.max(1e-6, o.wT));
	return { k, S: k * o.wT, a: 0, rd: 0, r: 1, P: 0, t1: k * o.w1, vis: k * o.w1 >= o.need - d - 0.5, d };
}

/** runtime: the zone whose run equals the CSS run P (P grows with k: bisection), at a delay d */
export function zoneForRun(P: number, o: ZoneIn, d = 0) {
	let lo = 5,
		hi = 5000;
	for (let i = 0; i < 40; i++) {
		const m = (lo + hi) / 2;
		if (zoneAt(m, o, d).P < P) lo = m;
		else hi = m;
	}
	return zoneAt((lo + hi) / 2, o, d);
}

/** the bench's screen positions: program start (the tip meets the arrival start on the pen line), program end (the
 * cell's H duct `endGap`·vh under the nav: the robots finish fully on screen), and the lowest it may be once the device
 * beats begin */
/** the smallest gap under the nav at the program end, and the shortest ramp-up (px): the program time trails the native
 * scroll by v·τ (≈ 120–140 px of scroll at a brisk wheel), during which the page already rises a little faster; on short
 * viewports a gap and a ramp in vh would be a few px only, and the robots' last moves would pass under the nav */
export const END_GAP_MIN = 40;
export const RAMP_U_MIN = 200;
/** vignettes: the bench's lowest end position (× vh): the cell ends in the upper half, the opened module mid-screen */
export const END_FRAC = 0.46;
/** short screens (≤ SHORT_VH): a longer ramp-up. There the cell's whole travel is ≈ 70–110 px, so the extra rise of a program
 * that trails a brisk wheel into the ramp-up (`lagRise`) would cost most of the program's scroll if the bench had to end
 * lower for it; a gentler ramp (speed r → 1 over 4 notches) keeps that rise small instead (real-wheel audit, 844 × 390:
 * +C1's parked arm 11 px under the nav with the 200 px ramp) */
export const RAMP_U_SHORT = 400;
export const rampUpPx = (T: { rampU: number }, vh: number) => Math.max(T.rampU * vh, vh <= SHORT_VH ? RAMP_U_SHORT : RAMP_U_MIN);
/** no slow zones (no scroll timelines): program time follows the native scroll almost directly (τ 0.012 s: the browser's
 * own smooth scrolling is the smoothing; at 1× any lag is screen travel) and the cell ends this much lower */
export const LINEAR_SLACK = 120;
export const LINEAR_TAU = 0.012;

/** the gap under the nav at the program end (px). Tall screens (pacing pass): the notch cap of a paced compartment keeps
 * its scroll short there, so r is higher (≈ 0.35 at 1440 px tall) and the program's lag behind a brisk wheel (r·v·τ) is
 * more screen travel; the gap grows with the height so the last moves (an out-lead lifted into the duct) stay below the nav */
export const endGapPx = (endGap: number, vh: number, r = 0.2) => Math.max(endGap * vh, END_GAP_MIN, 0.11 * vh - 70, 140 * r - 10);
/** vignettes: how far the cell rises beyond its program-end position while the smoothed program time trails a brisk wheel by
 * LAG px of scroll (the audit's wheel, 100 px every 110 ms: ≈ 150 px, measured from the frame it caught): at r over the zone's last LAG px and through the ramp-up's start (its speed going r
 * → 1). The program's last moves (arms parking after the morph) must stay under the nav by that much: `tailUp` below (the
 * real-wheel audit: +C4's left arm, parking from -X4's socket just under the duct, 15 px under the nav at 1366 × 768) */
export const LAG = 150;
/** the arms' highest point at the program end stays this far under the nav (px) once `lagRise` is counted (1024 × 600: the
 * audit's wheel ran ≈ 7 px past the model's 150 px lag at +C6) */
export const TAIL_MARGIN = 12;
export const lagRise = (r: number, ru: number) => r * LAG + (1 - r) * ru * rampQ(Math.min(1, LAG / ru));

export function benchMarks(o: { penY: number; vh: number; nav: number; startOff: number; duct: number; band: number; devH: number; endGap: number; r?: number; below?: number; ru?: number; tailUp?: number }) {
	const b0 = o.penY + o.startOff + o.duct + o.band,
		// (vignettes: and the highest point of the arms over the program's last 0.6 s stays under the nav at a brisk wheel)
		tail = o.ru && o.tailUp ? o.nav + TAIL_MARGIN + o.tailUp + lagRise(o.r ?? 0.46, o.ru) : 0,
		b1 = Math.max(o.nav + endGapPx(o.endGap, o.vh, o.r) + o.duct + o.band, END_FRAC * o.vh, tail),
		vis = o.vh - Math.max(o.devH, o.below ?? 0) - 12;
	return { b0, b1, vis, D: b0 - b1, need: b0 - vis };
}

/** the zone inputs of a compiled program at a viewport (band and duct from the layout, stage px) */
/** r: the hold ratio the zone is expected to have (the end gap grows with it: the program's lag behind a brisk wheel, r·v·τ,
 * is screen travel; ≈ 0.2 unless a notch cap raised it) */
/** program time of the first device beat: from then to the end the device must be fully on screen (client note 7). A job's
 * detail moment (B.focus) or a camera job (B.vf) counts from its start: the work it shows is on the device */
export function firstDeviceT(B: Compiled) {
	const first = B.beats.find((b) => DEVICE_BEAT.test(b.name));
	const tIns = Math.min(Infinity, ...B.focus.map((l) => l.t0), ...B.vf.map((v) => v.t0));
	return Math.min(first ? first.t : 0, tIns);
}
export function zoneInputs(B: Compiled, warp: Warp, m: { penY: number; vh: number; nav: number; band?: number; r?: number }) {
	const T = B.G.T;
	const w1 = warp.w(firstDeviceT(B));
	// (review 3, V5: the room phones kept under the bench for the close-ups is gone: client note 17 removed them, and the
	// one-arm cells now use that height themselves, drawn ≈ 2× larger: scripts/panel/solo.ts)
	const below = 0;
	// (every height: on short screens too, with their longer ramp-up; the real-wheel audit of 844 × 390, 915 × 412,
	// 932 × 430 and 740 × 360 caught parked arms 1–20 px under the nav without it)
	const lagged = !!B.cfg.pace;
	const bm = benchMarks({ penY: m.penY, vh: m.vh, nav: m.nav, startOff: T.startOff, duct: T.duct, band: m.band ?? T.band, devH: B.G.devH, endGap: T.endGap, r: m.r ?? paceR(B, m.vh), below, ru: lagged ? rampUpPx(T, m.vh) : 0, tailUp: lagged && B.rig?.topAbove ? B.rig.topAbove(B.tEnd - 0.6, B.tEnd) : 0 });
	return { w1, wT: warp.total, D: bm.D, need: bm.need, ru: rampUpPx(T, m.vh), rdMin: T.rampD * m.vh, bm };
}

/** build-time run length (px) for a compiled program at a viewport height (the reference layouts) */
export function runPx(B: Compiled, vh: number) {
	const T = B.G.T;
	const warp = new Warp(B, B.tEnd);
	let zi = zoneInputs(B, warp, { penY: T.pen * vh, vh, nav: T.nav });
	let z = zonePlan({ ...zi, ...paceOf(B, warp.total, vh), rFloor: rFloor(vh) });
	// a notch cap raised r: plan again with the end gap that r needs (one step is enough: the gap moves r by little)
	if (z.r > paceR(B, vh) + 0.02) {
		zi = zoneInputs(B, warp, { penY: T.pen * vh, vh, nav: T.nav, r: z.r });
		z = zonePlan({ ...zi, ...paceOf(B, warp.total, vh), rFloor: rFloor(vh) });
	}
	return { P: z.P, r: z.r, S: z.S, D: zi.D, k: z.k, a: z.a, rd: z.rd, vis: z.vis, need: zi.need, d: z.d };
}

/** the whole page's slowed travel: zones in scroll order, disjoint. G(Y) = Σ zone offsets = how far every
 * block of the page lags behind the native scroll so far; a block with runs C above it is drawn at
 * layout + G(Y) − C, so the runs never show and everything on screen moves together at 1 − G'(Y) ∈ [r, 1] */
export class Glide {
	zones: { A: number; z: Slow; C: number }[] = [];
	/** Σ of every run */
	total = 0;
	add(A: number, z: Slow) {
		this.zones.push({ A, z, C: this.total });
		this.total += z.P;
	}
	/** the zone whose range holds Y (or the last one before it) */
	private at(Y: number) {
		const Z = this.zones;
		let lo = 0,
			hi = Z.length - 1,
			k = -1;
		while (lo <= hi) {
			const m = (lo + hi) >> 1;
			if (Z[m].A <= Y) {
				k = m;
				lo = m + 1;
			} else hi = m - 1;
		}
		return k;
	}
	G(Y: number) {
		const k = this.at(Y);
		if (k < 0) return 0;
		const Z = this.zones[k];
		return Z.C + Z.z.off(Y - Z.A);
	}
	speed(Y: number) {
		const k = this.at(Y);
		return k < 0 ? 1 : this.zones[k].z.speed(Y - this.zones[k].A);
	}
	/** the end of the last zone */
	get end() {
		const Z = this.zones[this.zones.length - 1];
		return Z ? Z.A + Z.z.L : 0;
	}
	/** CSS keyframes of G over [A₀, end] (exact: Hermite cubics as cubic-béziers, flat between zones) */
	keyframes() {
		const Z = this.zones;
		if (!Z.length) return { from: 0, to: 0, frames: [] as { p: number; v: number; ease: string }[] };
		const from = Z[0].A,
			to = this.end,
			span = Math.max(1, to - from);
		const frames: { p: number; v: number; ease: string }[] = [];
		for (const { A, z, C } of Z)
			for (const k of z.keyframes()) {
				const p = (A + k.p * z.L - from) / span;
				const prev = frames[frames.length - 1];
				if (prev && p <= prev.p + 1e-9) {
					prev.ease = k.ease;
					continue;
				}
				frames.push({ p, v: C + k.v, ease: k.ease });
			}
		return { from, to, frames };
	}
}

export class Track {
	B: Compiled;
	tEnd: number;
	warp: Warp;
	cache: SimCache;
	kEff = 1;
	glide: Glide | null = null;
	/** this compartment's zone (null: a free stage, Contact), the runs above it (C) */
	z: Slow | null = null;
	C = 0;
	pinLen = 0;
	startY = 0;
	penY = 0;
	vh = 0;
	/** screen travel of the bench from program start to end (target), its end position */
	D = 0;
	b1 = 0;
	pinTop = 0;
	/** program start, zone start, program end, zone end (document scroll px) */
	y0 = 0;
	yA = 0;
	yEnd = 0;
	yB = 0;
	latched = false;
	/** Contact: READY reached once; it never rewinds after that (the form is filled above and below it) */
	held = false;
	/** the run this track needs when the CSS run (build time) does not fit this viewport (px), or null */
	runOverride: number | null = null;
	/** prev: the track of the previous layout; its warp and snapshot cache are kept when the program is the same one */
	constructor(B: Compiled, prev?: Track | null) {
		this.B = B;
		this.tEnd = B.tEnd;
		if (prev && prev.B === B) {
			this.warp = prev.warp;
			this.cache = prev.cache;
			this.held = prev.held;
		} else {
			this.warp = new Warp(B, this.tEnd);
			this.cache = new SimCache(B);
		}
	}
	/**
	 * P: the run length (from the DOM: track height − stage height); vh; penY (the pen line); nav (nav height);
	 * startY, floor, y0 (stage px: arrival start, bench, H duct top); band; linear: no slow zone (no scroll timelines)
	 * The zone is the CSS run's when it keeps the page moving (r ≥ R_FLOOR) with the device on screen from its first
	 * beat; otherwise (a viewport the build-time runs do not fit: landscape phones, short tablets) it is planned here and
	 * `runOverride` says the run it needs.
	 */
	plan(L: { P: number; vh: number; penY: number; nav: number; startY: number; floor: number; y0: number; band: number; linear?: boolean }) {
		this.pinLen = L.P;
		this.startY = L.startY;
		this.penY = L.penY;
		this.vh = L.vh;
		// bench on screen at the program start (the tip meets the arrival start on the pen line), at its end, and the lowest
		// it may be from the first device beat on (the device fully on screen)
		let zi = (this.zi = zoneInputs(this.B, this.warp, { penY: L.penY, vh: L.vh, nav: L.nav, band: L.band }));
		this.D = zi.D;
		this.b1 = zi.bm.b1;
		this.runOverride = null;
		if (L.linear) {
			// at 1× the program's lag behind the native scroll (v·τ, τ short here) is all screen travel: the cell ends
			// LINEAR_SLACK px lower, so its last moves stay below the nav at a brisk scroll
			this.zone = zoneLinear({ ...zi, D: zi.D - LINEAR_SLACK });
			this.runOverride = L.P > 0.5 ? 0 : null;
			this.pinLen = 0;
			return this;
		}
		// the CSS run is kept when it keeps the page moving with the device on screen from its first beat, near the hold
		// ratio this compartment aims for (vignettes: a gentle r ≥ ≈ 0.45; a build-time run fitted over a range of heights
		// may be a little long at some of them); otherwise this viewport plans its own (runOverride)
		const rWant = Math.max(rFloor(L.vh), paceR(this.B, L.vh) - 0.015);
		const fits = (z: Zone) => z.vis && z.r >= rWant - 1e-6;
		const solve = () => {
			let z = zoneForRun(L.P, zi, 0);
			this.runOverride = null;
			this.pinLen = L.P;
			if (!fits(z)) {
				const zp = zonePlan({ ...zi, ...paceOf(this.B, this.warp.total, L.vh), rFloor: rFloor(L.vh) });
				const zc = zp.d > 0 ? zoneForRun(L.P, zi, zp.d) : null;
				if (zc && fits(zc)) z = zc;
				else {
					z = zp;
					this.runOverride = zp.P;
					this.pinLen = zp.P;
				}
			}
			return z;
		};
		let z = solve();
		// the end gap for the r this viewport gets (a notch cap raises it on tall screens and phones): plan once more
		if (z.r > paceR(this.B, L.vh) + 0.02) {
			zi = this.zi = zoneInputs(this.B, this.warp, { penY: L.penY, vh: L.vh, nav: L.nav, band: L.band, r: z.r });
			this.D = zi.D;
			this.b1 = zi.bm.b1;
			z = solve();
		}
		this.zone = z;
		return this;
	}
	zi: ReturnType<typeof zoneInputs> | null = null;
	zone: Zone | null = null;
	/**
	 * place the program and its zone on the page, in order (the glide holds the zones above this one):
	 * Ŷ0 = where the pen meets the arrival start; the zone starts there (or where the previous one ends)
	 */
	place(pinTop: number, glide: Glide) {
		const T = this.B.G.T;
		this.pinTop = pinTop;
		this.glide = glide;
		this.C = glide.total;
		// Ŷ0: Ŷ0 + penY − (pinTop + G(Ŷ0) − C) = startY (the previous zones may still be running: bisection)
		const g = (Y: number) => Y + this.penY - (pinTop + glide.G(Y) - this.C) - this.startY;
		let lo = pinTop + this.startY - this.penY - this.C - 1,
			hi = pinTop + this.startY - this.penY + 1;
		for (let i = 0; i < 48 && g(lo) > 0; i++) lo -= this.vh;
		for (let i = 0; i < 48; i++) {
			const m = (lo + hi) / 2;
			if (g(m) < 0) lo = m;
			else hi = m;
		}
		// the zone (plan): k, the 1× lead-in a, the ramp-down (ending at the first device beat), r; a delay d starts the
		// program later, once the cell has risen d px at 1×
		const zn = this.zone!;
		this.y0 = (lo + hi) / 2 + zn.d;
		// zones never overlap: a zone that would start inside the previous one starts at its end
		this.yA = Math.max(this.y0 + zn.a, glide.end);
		const S = this.y0 + zn.S - this.yA;
		this.z = new Slow({ r: zn.r, rd: Math.min(zn.rd, Math.max(1, S)), ru: rampUpPx(T, this.vh), S });
		glide.add(this.yA, this.z);
		this.kEff = Math.max(4, zn.k);
		this.yEnd = this.y0 + zn.S;
		this.yB = this.yA + this.z.L;
		return this;
	}
	/** a stage that never slows (Contact): the program runs from Ŷ0 until the bench reaches `benchAt` (screen px) */
	placeFree(L: { pinTop: number; startY: number; penY: number; floor: number; vh: number; benchAt: number; maxY: number }, glide: Glide) {
		this.pinLen = 0;
		this.z = null;
		this.glide = glide;
		this.C = glide.total;
		this.startY = L.startY;
		this.penY = L.penY;
		this.vh = L.vh;
		this.pinTop = L.pinTop;
		this.y0 = Math.max(glide.end, L.pinTop + L.startY - L.penY);
		this.yEnd = Math.max(this.y0 + 120, L.pinTop + L.floor - L.benchAt);
		// client note 7: the end state never depends on scroll that may not exist: complete ≥ 0.25·vh before the bottom
		const last = L.maxY - 0.25 * L.vh;
		if (this.yEnd > last) {
			this.yEnd = Math.max(glide.end + 60, last);
			this.y0 = Math.min(this.y0, this.yEnd - 120);
		}
		this.kEff = (this.yEnd - this.y0) / this.warp.total;
		this.yA = this.yB = this.yEnd;
		return this;
	}
	/** program time for the smoothed scroll Ŷ */
	tAt(Yh: number) {
		if (this.latched || this.held) return this.tEnd;
		return this.warp.t((Yh - this.y0) / this.kEff);
	}
	/** document scroll position where the program reaches t */
	yAt(t: number) {
		return this.y0 + this.warp.w(t) * this.kEff;
	}
	/** the stage's displacement from its layout position for the NATIVE scroll position (what CSS draws) */
	offset(Y: number) {
		return this.glide ? this.glide.G(Y) - this.C : 0;
	}
	/** screen speed of the page (× the scroll speed) at the native scroll position */
	speed(Y: number) {
		return this.glide ? this.glide.speed(Y) : 1;
	}
	/** document y of the stage top at the native scroll position */
	stageTop(Y: number) {
		return this.pinTop + this.offset(Y);
	}
	/** native scroll position where stage-local y sits at screen y (the page's screen speed is > 0: bisection) */
	yForScreen(localY: number, screenY: number) {
		const tot = this.glide ? this.glide.total : 0;
		let lo = this.pinTop + localY - screenY - this.C - 2,
			hi = this.pinTop + localY - screenY + (tot - this.C) + 2;
		for (let i = 0; i < 48; i++) {
			const m = (lo + hi) / 2;
			if (this.stageTop(m) + localY - m > screenY) lo = m;
			else hi = m;
		}
		return (lo + hi) / 2;
	}
}
