/**
 * The 120 Hz simulation of one compartment (port of spec/v3/engine.js Sim + Rope3 and spec/v4/scroll.js
 * SimCache). Fixed step, pure function of program time: the same t always gives the same state, whether
 * reached by scrolling down, by rewinding, or by stepping a cold sim from 0.
 *
 *   Rope3     the free span of a lead: Verlet nodes, distance constraints (i, i+1), push-only
 *             bending constraints (i, i+2), gravity, damping, hard pins (duct exit with a clamped tangent,
 *             gripper jaws, the terminal mouth)
 *   Sim       the robot pair's joint flex (rig) and the cable phases: arrival feed → free hang (seeded
 *             swing) → held by the grippers → seated → slack take-up into the laid S-bend; and the out-lead:
 *             presented by the out-mouth → held by a gripper, carried up into the duct slot (the device pays the
 *             conductor out) → let go, taken up straight by the duct
 *             A gripper holds a wire ACROSS its tool axis (the jaws close on it from both sides): the wire runs through
 *             the jaws along the tool's lateral axis; the stub from the jaws to the end is held straight, the span on
 *             the other side of the jaws is free (one soft node, the wire's own stiffness at the jaw edge)
 *   SimCache  snapshots every 24 steps (0.2 s of program time); any seek ≤ 23 steps; sample(t)
 *             interpolates the two 120 Hz states around t so slow scrubs never step in 1/120 s quanta
 */
import { H, SPRINGS, bezUniform, carrot, clamp01, drive, sBend, smooth, type Laid, type Pt } from './core';
import { ROPE, type Compiled, type RopeCfg } from './program';

export class Rope3 {
	n: number;
	x: Float64Array;
	p: Float64Array;
	pin: Uint8Array;
	L = 0;
	constructor(n: number) {
		this.n = n;
		this.x = new Float64Array(n * 2);
		this.p = new Float64Array(n * 2);
		this.pin = new Uint8Array(n);
	}
	place(pts: Pt[]) {
		for (let i = 0; i < this.n; i++) {
			this.x[2 * i] = this.p[2 * i] = pts[i].x;
			this.x[2 * i + 1] = this.p[2 * i + 1] = pts[i].y;
		}
	}
	step(h: number, c: RopeCfg, pins: { i: number; x: number; y: number; w?: number }[]) {
		const n = this.n,
			x = this.x,
			p = this.p,
			pin = this.pin;
		pin.fill(0);
		for (const q of pins) pin[q.i] = 1;
		const gg = c.g * h * h;
		for (let i = 0; i < n; i++) {
			if (pin[i]) continue;
			const ix = 2 * i,
				iy = ix + 1;
			const vx = (x[ix] - p[ix]) * c.damp,
				vy = (x[iy] - p[iy]) * c.damp;
			p[ix] = x[ix];
			p[iy] = x[iy];
			x[ix] += vx;
			x[iy] += vy + gg;
		}
		for (const q of pins) {
			p[2 * q.i] = x[2 * q.i];
			p[2 * q.i + 1] = x[2 * q.i + 1];
		}
		const apply = () => {
			for (const q of pins) {
				const w = q.w ?? 1;
				x[2 * q.i] += (q.x - x[2 * q.i]) * w;
				x[2 * q.i + 1] += (q.y - x[2 * q.i + 1]) * w;
			}
		};
		apply();
		const rest = this.L / (n - 1);
		for (let k = 0; k < c.iters; k++) {
			for (let i = 0; i < n - 1; i++) sat(x, pin, i, i + 1, rest, 1);
			for (let i = 0; i < n - 2; i++) sat(x, pin, i, i + 2, rest * 2 * 0.995, c.bend);
			apply();
		}
	}
}
function sat(x: Float64Array, pin: Uint8Array, a: number, b: number, rest: number, k: number) {
	const ax = 2 * a,
		bx = 2 * b;
	const dx = x[bx] - x[ax],
		dy = x[bx + 1] - x[ax + 1];
	const d = Math.hypot(dx, dy) || 1e-9;
	if (k < 1 && d > rest) return; // bending only pushes (resists folding), never pulls
	const diff = ((d - rest) / d) * k;
	const pa = pin[a],
		pb = pin[b];
	if (pa && pb) return;
	const wa = pa ? 0 : pb ? 1 : 0.5,
		wb = pb ? 0 : pa ? 1 : 0.5;
	x[ax] += dx * diff * wa;
	x[ax + 1] += dy * diff * wa;
	x[bx] -= dx * diff * wb;
	x[bx + 1] -= dy * diff * wb;
}

/* ------------------------------------------------------------------ simulation */
export type Pin = { i: number; x: number; y: number; w?: number };
export class Sim {
	B: Compiled;
	rc: RopeCfg;
	/** the pins each rope was stepped with in the last step (null: not stepped as a rope: feeding, laid, not out). Read by
	 * the display-only relaxation after the wheel stops (relax.ts); never part of the state */
	ropePins: Pin[] | null = null;
	oropePins: Pin[] | null = null;
	t = 0;
	i = 0;
	rope: Rope3;
	ropeOn = false;
	headV: number | null = null;
	laid: Laid | null = null;
	takeT = -1;
	laidCurve: Laid | null = null;
	Lslack = 0;
	/** the copper fronts, each a spring (chase: ω 30, ζ .8) chasing its trapezoidal carrot: the arrival
	 * along the duct (arc length on the arrival route) and the out-lead (distance from the out-mouth) */
	fr = { x: 0, v: 0 };
	fo = { x: 0, v: 0 };
	/** the robot rig's own state (joint flex) */
	rig: unknown = null;
	/** the out-lead's free span (rope), whether it is out, laid (straight in the duct's draw), when the take-up began */
	orope: Rope3;
	oOn = false;
	oLaid = false;
	oTakeT = -1;
	oL0 = 0;
	constructor(B: Compiled) {
		this.B = B;
		this.rc = { ...(B.G.sc < 0.9 ? ROPE.phone : ROPE.desktop) };
		this.rc.g *= Math.max(1, B.G.sc); // same apparent dynamics at the larger desktop stage
		this.rope = new Rope3(this.rc.n);
		this.orope = new Rope3(this.rc.n);
		this.reset();
	}
	reset() {
		this.t = 0;
		this.i = 0;
		this.rope = new Rope3(this.rc.n);
		this.ropeOn = false;
		this.headV = null;
		this.laid = null;
		this.takeT = -1;
		this.laidCurve = null;
		this.Lslack = 0;
		const a = this.B.cable.arrive;
		this.fr = { x: a ? a.sStart : 0, v: 0 };
		this.fo = { x: this.B.out ? this.B.out.s0 : 0, v: 0 };
		this.rig = this.B.rig ? this.B.rig.simInit() : null;
		this.orope = new Rope3(this.rc.n);
		this.oOn = false;
		this.oLaid = false;
		this.oTakeT = -1;
		this.oL0 = 0;
	}
	step() {
		this.i++;
		const t = (this.t = this.i * H);
		this.ropePins = this.oropePins = null;
		const B = this.B,
			T = B.G.T,
			a = B.cable.arrive;
		if (a && t >= a.t0) drive(this.fr, a.sStart + carrot(t - a.t0, a.sEnd - a.sStart, a.vmax, a.acc)[0], SPRINGS.chase, H);
		if (B.out && t >= B.out.t) drive(this.fo, B.out.s0 + carrot(t - B.out.t, B.out.D - B.out.s0, T.vmax, T.acc)[0], SPRINGS.chase, H);
		if (B.rig) B.rig.simStep(this.rig, t);
		this.cable();
		outCableStep(this);
	}
	/** the wire's direction through a gripper's jaws (across the tool axis), toward the end it holds: down (`end` = 1) for
	 * the in-lead's copper, up (−1) for the out-lead's */
	private static across(phi: number, end: 1 | -1) {
		let dx = -Math.sin(phi),
			dy = Math.cos(phi);
		if (dy * end < 0) {
			dx = -dx;
			dy = -dy;
		}
		return { x: dx, y: dy };
	}
	/** pins for a wire held in a gripper's jaws at J (end stub straight along u, one soft node past the jaws) */
	private static gripPins(pins: { i: number; x: number; y: number; w?: number }[], n: number, r: number, J: { x: number; y: number }, u: { x: number; y: number }, gOff: number, w: number) {
		// the stub from the jaws to the end straight; past the jaws the insulation's own stiffness: two nodes eased onto the
		// jaws' line (the wire leaves the jaws straight and bends away gently)
		let soft = 0;
		for (let i = n - 1; i >= 2 && soft < 2; i--) {
			const d = (n - 1 - i) * r;
			if (d <= gOff + 0.5 * r) pins.push({ i, x: J.x + u.x * (gOff - d), y: J.y + u.y * (gOff - d), w });
			else {
				pins.push({ i, x: J.x - u.x * (d - gOff), y: J.y - u.y * (d - gOff), w: (soft ? 0.25 : 0.6) * w });
				soft++;
			}
		}
	}
	private grips(t: number) {
		const st: Record<string, { id: string; gOff: number } | null> = {};
		for (const g of this.B.cable.grips) if (g.t <= t) st[g.id] = g.on ? { id: g.id, gOff: g.gOff ?? this.B.G.gIns } : null;
		return Object.entries(st)
			.filter(([, v]) => v)
			.map(([, v]) => v!);
	}
	private gripStart(id: string, t: number) {
		let s = -1;
		for (const g of this.B.cable.grips) if (g.id === id && g.on && g.t <= t) s = g.t;
		return s;
	}
	private cable() {
		const B = this.B,
			G = B.G,
			t = this.t,
			a = B.cable.arrive;
		if (!a || this.laid) return;
		const sFront = this.fr.x;
		// the free span starts when the copper front has come out of the duct's down-bend
		if (!this.ropeOn && sFront < a.sA + G.CU) return;
		const rope = this.rope,
			n = rope.n;
		const A = a.A;
		// the duct feeds until the chased front has settled (its spring overshoot is the lead's little bounce)
		const feeding = t < a.tHang + 0.2;
		if (!this.ropeOn) {
			const L0 = Math.max(0.5, sFront - G.CU - a.sA);
			const pts: Pt[] = [];
			for (let i = 0; i < n; i++) pts.push({ x: A.x, y: A.y + (L0 * i) / (n - 1) });
			rope.place(pts);
			rope.L = L0;
			this.ropeOn = true;
		}
		const pins: { i: number; x: number; y: number; w?: number }[] = [];
		const rest = () => rope.L / (n - 1);
		pins.push({ i: 0, x: A.x, y: A.y });
		pins.push({ i: 1, x: A.x, y: A.y + rest() });
		const seatT = B.cable.seatT ?? Infinity;
		const grips = this.grips(t);
		if (feeding || (a.selfSeat && t < seatT + 1)) {
			// the duct extrudes the lead straight down (self-seat: into the mouth). Kinematic and uniformly spaced:
			// a freshly fed span is straight, so it can never start folded; each node carries its feed velocity
			// (Verlet: p = where it was), so the free hang that follows starts from the real motion
			const L = Math.max(0.5, sFront - G.CU - a.sA),
				L0 = rope.L;
			rope.L = L;
			const x = rope.x,
				p = rope.p;
			for (let i = 0; i < n; i++) {
				const u = i / (n - 1);
				x[2 * i] = p[2 * i] = A.x;
				x[2 * i + 1] = A.y + L * u;
				p[2 * i + 1] = A.y + L0 * u;
			}
			if (!feeding) this.headV = null;
			return;
		} else if (t >= seatT || (grips.length && B.rig)) {
			const seated = t >= seatT;
			if (seated) {
				// seated: the insulation end sits on the mouth with a vertical tangent; grips may still hold it
				pins.push({ i: n - 1, x: G.inX, y: G.mouthY }, { i: n - 2, x: G.inX, y: G.mouthY - rest() });
				if (!grips.length && this.takeT < 0) this.takeT = t;
			}
			// held by one or two grippers, across the jaws: the stub to the copper straight, the span above free
			let J: Pt | null = null;
			if (B.rig)
				for (const g of grips) {
					const k = B.rig.pose(this.rig, g.id, t);
					const u = Sim.across(k.phi, 1);
					const blend = clamp01((t - this.gripStart(g.id, t)) / 0.07);
					Sim.gripPins(pins, n, rest(), k, u, g.gOff, 0.25 + 0.75 * blend);
					J = k;
					if (seated) continue;
					// the duct feeds cable when the jaws pull away, and draws the slack back when they come up: a held lead stays
					// nearly taut between the duct slot and the jaws (it bows in fast moves, the rope's follow-through)
					const dist = Math.hypot(k.x - A.x, k.y - A.y) + g.gOff;
					if (dist > rope.L * 0.9995) rope.L = dist / 0.9995;
					else if (rope.L > dist * 1.002) rope.L = Math.max(dist * 1.002, rope.L - 140 * G.sc * H);
				}
			// held at both ends, the span is under the feed's light tension: it drifts back toward the straight line (and
			// never buckles under its own weight between two fixed ends)
			const E = J ?? { x: G.inX, y: G.mouthY };
			if (this.takeT < 0)
				for (let i = 2; i < n - 4; i++) {
					const f = i / (n - 1);
					pins.push({ i, x: A.x + (E.x - A.x) * f, y: A.y + (E.y - A.y) * f, w: 0.035 });
				}
		} else if (this.headV === null && !feeding) {
			// released at the end of the feed: the head carries a seeded lateral swing out of the bend
			this.headV = a.swing;
			const i = 2 * (n - 1);
			rope.p[i] = rope.x[i] - a.swing * H;
		}
		// slack take-up after the lead is seated and let go: the duct draws it back into the laid S-bend
		if (this.takeT >= 0) {
			const u = clamp01((t - this.takeT - 0.05) / 0.34);
			if (!this.laidCurve) {
				this.laidCurve = bezUniform(sBend(A, { x: G.inX, y: G.mouthY }, 0.5), n);
				this.Lslack = rope.L;
			}
			rope.L = this.Lslack + (this.laidCurve.len - this.Lslack) * smooth(u);
			const w = smooth(clamp01((u - 0.25) / 0.75)) * 0.6;
			if (w > 0) for (let i = 2; i < n - 2; i++) pins.push({ i, x: this.laidCurve.pts[i].x, y: this.laidCurve.pts[i].y, w });
			if (u >= 1) {
				this.laid = this.laidCurve;
				return;
			}
		}
		this.ropePins = pins;
		rope.step(H, this.rc, pins);
	}
}

/* the out-lead (art 9): presented by the out-mouth, held and carried up by a gripper, let go into the duct slot */
export function outCableStep(s: Sim) {
	const B = s.B,
		G = B.G,
		O = B.outLead,
		t = s.t;
	if (!O || s.oLaid || t < O.t0) return;
	const rope = s.orope,
		n = rope.n;
	const A = { x: G.outX, y: G.mouthY };
	const hIns = O.E - G.CU; // the insulation end's height above the tab when the jaws close
	if (t < O.tG || !B.rig) {
		// presented: the conductor rises straight out of the out-mouth (the terminal pushes it into the open jaws)
		const h = Math.max(0.5, hIns * smoothE((t - O.t0) / Math.max(0.01, O.tG - O.t0)));
		const L0 = s.oOn ? rope.L : h;
		rope.L = h;
		for (let i = 0; i < n; i++) {
			const u = i / (n - 1);
			rope.x[2 * i] = rope.p[2 * i] = A.x;
			rope.x[2 * i + 1] = A.y - h * u;
			rope.p[2 * i + 1] = A.y - L0 * u;
		}
		s.oOn = true;
		return;
	}
	const rest = rope.L / (n - 1);
	const pins: { i: number; x: number; y: number; w?: number }[] = [
		{ i: 0, x: A.x, y: A.y },
		{ i: 1, x: A.x, y: A.y - rest },
	];
	if (t < O.tR) {
		// held: the end stub straight up from the jaws; the device pays the conductor out as the arm lifts
		const k = B.rig.pose(s.rig, O.id, t);
		const u = { x: -Math.sin(k.phi), y: Math.cos(k.phi) };
		if (u.y > 0) {
			u.x = -u.x;
			u.y = -u.y;
		}
		const blend = clamp01((t - O.tG) / 0.06);
		// the jaw-side pins, mirrored: index from the top end (n − 1) down
		for (let i = n - 1; i >= 2; i--) {
			const d = (n - 1 - i) * rest;
			if (d <= O.gOff + 0.5 * rest) pins.push({ i, x: k.x + u.x * (O.gOff - d), y: k.y + u.y * (O.gOff - d), w: 0.25 + 0.75 * blend });
			else {
				pins.push({ i, x: k.x - u.x * (d - O.gOff), y: k.y - u.y * (d - O.gOff), w: 0.3 * (0.25 + 0.75 * blend) });
				break;
			}
		}
		// the terminal pays the conductor out as the arm lifts (a light tension: the span bows only in the arc)
		const dist = Math.hypot(k.x - A.x, k.y - A.y) + O.gOff;
		if (dist > rope.L * 0.996) rope.L = dist / 0.996;
		const J = { x: k.x - u.x * O.gOff * 0, y: k.y };
		for (let i = 2; i < n - 4; i++) {
			const f = i / (n - 1);
			pins.push({ i, x: A.x + (J.x - A.x) * f, y: A.y + (J.y - A.y) * f, w: 0.02 });
		}
		s.oL0 = rope.L;
	} else {
		// let go into the duct slot: the duct draws it straight (the laid route's first leg) over 0.3 s
		if (s.oTakeT < 0) s.oTakeT = t;
		const u = clamp01((t - s.oTakeT) / 0.3);
		const end = { x: rope.x[2 * (n - 1)], y: rope.x[2 * (n - 1) + 1] };
		const Lstraight = Math.hypot(end.x - A.x, end.y - A.y);
		rope.L = s.oL0 + (Lstraight - s.oL0) * smoothE(u);
		pins.push({ i: n - 1, x: end.x + (G.outX - end.x) * smoothE(u), y: end.y });
		const w = smoothE(clamp01((u - 0.2) / 0.8)) * 0.6;
		if (w > 0) for (let i = 2; i < n - 1; i++) pins.push({ i, x: A.x, y: A.y + ((end.y - A.y) * i) / (n - 1), w });
		if (u >= 1) {
			s.oLaid = true;
			return;
		}
	}
	s.oropePins = pins;
	rope.step(H, s.rc, pins);
}
const smoothE = (v: number) => smooth(clamp01(v));

/* ------------------------------------------------------------------ snapshot cache */
interface Snap {
	t: number;
	i: number;
	rx: Float64Array;
	rp: Float64Array;
	rL: number;
	ropeOn: boolean;
	headV: number | null;
	laid: Laid | null;
	takeT: number;
	laidCurve: Laid | null;
	Lslack: number;
	fr: { x: number; v: number };
	fo: { x: number; v: number };
	rig: unknown;
	ox: Float64Array;
	op: Float64Array;
	oL: number;
	oOn: boolean;
	oLaid: boolean;
	oTakeT: number;
	oL0: number;
}
function snap(s: Sim): Snap {
	return {
		t: s.t,
		i: s.i,
		rx: Float64Array.from(s.rope.x),
		rp: Float64Array.from(s.rope.p),
		rL: s.rope.L,
		ropeOn: s.ropeOn,
		headV: s.headV,
		laid: s.laid, // immutable once built
		takeT: s.takeT,
		laidCurve: s.laidCurve,
		Lslack: s.Lslack,
		fr: { ...s.fr },
		fo: { ...s.fo },
		rig: s.B.rig ? s.B.rig.snap(s.rig) : null,
		ox: Float64Array.from(s.orope.x),
		op: Float64Array.from(s.orope.p),
		oL: s.orope.L,
		oOn: s.oOn,
		oLaid: s.oLaid,
		oTakeT: s.oTakeT,
		oL0: s.oL0,
	};
}
function restore(s: Sim, z: Snap) {
	s.t = z.t;
	s.i = z.i;
	s.rope.x.set(z.rx);
	s.rope.p.set(z.rp);
	s.rope.L = z.rL;
	s.ropeOn = z.ropeOn;
	s.headV = z.headV;
	s.laid = z.laid;
	s.takeT = z.takeT;
	s.laidCurve = z.laidCurve;
	s.Lslack = z.Lslack;
	s.fr = { ...z.fr };
	s.fo = { ...z.fo };
	if (s.B.rig) s.rig = s.B.rig.restore(z.rig);
	s.orope.x.set(z.ox);
	s.orope.p.set(z.op);
	s.orope.L = z.oL;
	s.oOn = z.oOn;
	s.oLaid = z.oLaid;
	s.oTakeT = z.oTakeT;
	s.oL0 = z.oL0;
}

/** the rendered state at a continuous program time */
export interface Sample {
	t: number;
	ropeOn: boolean;
	laid: Laid | null;
	/** rope nodes (flat xy), or null when laid / not out yet */
	pts: Float64Array | null;
	n: number;
	L: number;
	/** arrival front (arc length on the arrival route) and out-lead front (distance from the out-mouth) */
	front: number;
	outFront: number;
	rig: unknown;
	/** the out-lead's rope (flat xy) while it is held or being taken up, null otherwise; whether it is laid */
	opts: Float64Array | null;
	oLaid: boolean;
}
interface View {
	ropeOn: boolean;
	laid: Laid | null;
	x: Float64Array | null;
	L: number;
	n: number;
	fr: number;
	fo: number;
	rig: unknown;
	ox: Float64Array | null;
	oLaid: boolean;
}
const view = (s: Sim): View => ({
	ropeOn: s.ropeOn,
	laid: s.laid,
	x: s.ropeOn && !s.laid ? Float64Array.from(s.rope.x) : null,
	L: s.rope.L,
	n: s.rope.n,
	fr: s.fr.x,
	fo: s.fo.x,
	rig: s.B.rig ? s.B.rig.view(s.rig) : null,
	ox: s.oOn && !s.oLaid ? Float64Array.from(s.orope.x) : null,
	oLaid: s.oLaid,
});

export class SimCache {
	sim: Sim;
	every: number;
	snaps: Snap[];
	stats = { steps: 0, restores: 0 };
	private _n = -1;
	private _A: View | null = null;
	private _B: View | null = null;
	private _pts: Float64Array | null = null;
	private _opts: Float64Array | null = null;
	/** every 120 Hz state already simulated, as a light view (≈ 0.35 kB each): after the idle prefill a
	 * sample is a lookup and an interpolation, whatever the scroll speed or direction */
	views: View[] = [];
	constructor(B: Compiled, every = 24) {
		this.sim = new Sim(B);
		this.every = every;
		this.snaps = [snap(this.sim)];
		this.views[0] = view(this.sim);
	}
	/** bring the sim to program time t (at most maxSteps steps); returns the steps taken */
	seek(t: number, maxSteps = Infinity) {
		const s = this.sim,
			n = Math.round(Math.max(0, t) / H),
			e = this.every;
		const k = Math.min(Math.floor(n / e), this.snaps.length - 1);
		if (n < s.i || k * e > s.i) {
			restore(s, this.snaps[k]);
			this.stats.restores++;
		}
		let steps = 0;
		while (s.i < n && steps < maxSteps) {
			s.step();
			steps++;
			if (s.i % e === 0 && !this.snaps[s.i / e]) this.snaps[s.i / e] = snap(s);
			if (!this.views[s.i]) this.views[s.i] = view(s);
		}
		this.stats.steps += steps;
		return steps;
	}
	/** state at a continuous time: the 120 Hz states at ⌊t/h⌋ and ⌊t/h⌋ + 1, interpolated */
	sample(t: number): Sample {
		t = Math.max(0, t);
		const n = Math.floor(t / H + 1e-7),
			al = Math.min(1, Math.max(0, t / H - n));
		if (this._n !== n) {
			if (this.views[n] && this.views[n + 1]) {
				this._A = this.views[n];
				this._B = this.views[n + 1];
			} else {
				if (this._n === n - 1 && this._B) this._A = this._B;
				else {
					this.seek(n * H);
					this._A = this.views[n] ?? view(this.sim);
				}
				this.seek((n + 1) * H);
				this._B = this.views[n + 1] ?? view(this.sim);
			}
			this._n = n;
		}
		const A = this._A!,
			B = this._B!,
			near = al < 0.5 ? A : B;
		let pts: Float64Array | null = null;
		if (A.x && B.x && A.ropeOn && B.ropeOn && A.n === B.n) {
			// one buffer per cache (a sample is drawn at once; no garbage per frame)
			if (!this._pts || this._pts.length !== A.x.length) this._pts = new Float64Array(A.x.length);
			pts = this._pts;
			for (let i = 0; i < pts.length; i++) pts[i] = A.x[i] + (B.x[i] - A.x[i]) * al;
		} else if (near.x) pts = near.x;
		const rig = this.sim.B.rig && A.rig && B.rig ? this.sim.B.rig.lerp(A.rig, B.rig, al) : near.rig;
		let opts: Float64Array | null = null;
		if (A.ox && B.ox) {
			if (!this._opts || this._opts.length !== A.ox.length) this._opts = new Float64Array(A.ox.length);
			opts = this._opts;
			for (let i = 0; i < opts.length; i++) opts[i] = A.ox[i] + (B.ox[i] - A.ox[i]) * al;
		} else if (near.ox) opts = near.ox;
		return { t, ropeOn: near.ropeOn, laid: near.laid, pts, n: near.n, L: A.L + (B.L - A.L) * al, front: A.fr + (B.fr - A.fr) * al, outFront: A.fo + (B.fo - A.fo) * al, rig, opts, oLaid: near.oLaid };
	}
	cachedTo() {
		return (this.snaps.length - 1) * this.every * H;
	}
	/** invalidate the interpolation views (after the program changed) */
	reset() {
		this._n = -1;
	}
}
