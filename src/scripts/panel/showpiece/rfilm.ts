/**
 * The Contact finale: the robots make the R of the logo out of a straight cable.
 *
 * The page's cable comes into the card, runs in the duct under the bench and comes up through the bench where the R's stem
 * will stand; the rest of it lies straight along the bench (its free end off stage, to the right). The left arm takes it
 * just past its root and lays it, step by step, along the R: the stem, the top corner, the top. It hands it to the right
 * arm, which lays the bowl, the leg and the foot of the R. The cable on the bench is drawn in as it goes (its length never
 * changes). Then the right arm takes the ferrule from its tray, slides it onto the free end and crimps it: the one copper
 * moment. The finished cable is the logo's R exactly: its centreline is the logo kit's own (lib/cable-geometry.ts, generated
 * from the kit), stroked at the kit's width, with the kit's ferrule, in the logo's own units (cap height 96 = 96 units).
 *
 * Units are the robot grid (1 unit = 1 px × the stage scale), x right, y down, the bench at y = 0; the stage's viewBox is
 * fixed (VB). Everything is a pure function of film time t (s): the arms' commanded joints (robot/arm.ts tracks, timed so
 * no joint or tool exceeds its limits), the cable's shape, the ferrule. The build runs the QA (qa below): no IK clamp, joint
 * speeds and accelerations within the limits, the arms clear of each other, the bench and the viewBox, no link through the
 * cable.
 */
import { R_GEOMETRY as RG } from '../../../lib/cable-geometry';
import { ArmTrack } from '../robot/arm';
import { PARK, Robot, type Pt } from '../robot/kin';

export const VB = { x: -150, y: -126, w: 300, h: 150 };
const DOWN = Math.PI / 2;
/** the logo's units → the stage: X = x·K + RX, Y = (y − 96)·K (the R's stem foot on the bench, the R with its ferrule
 * centred); K keeps the R's top within the arms' reach with their tools straight down */
export const K = 0.75;
export const RX = -38 * K,
	RY = -96 * K;
/** the R's transform as an SVG attribute (the finished R is the kit's own path data under it) */
export const R_TF = `translate(${RX} ${RY}) scale(${K})`;
/** the cable's width (the kit's), half of it: the centreline of a cable lying on the bench */
export const CW = RG.w * K;
const LIE = -CW / 2;
/** the arms' bases */
export const BX = 84;

/* ------------------------------------------------------------------ the R's centreline, from the stem foot */
interface Cl {
	x: Float64Array;
	y: Float64Array;
	s: Float64Array;
	/** the unit tangent at each sample (interpolated between them: continuous along the cable) */
	tx: Float64Array;
	ty: Float64Array;
	/** the tangent averaged over ±BLUR units: the jaws lead the cable along it (its turn is spread over the R's line–arc
	 * joints, where the true tangent's turn rate jumps: the arm's acceleration stays finite) */
	bx: Float64Array;
	by: Float64Array;
	len: number;
}
const BLUR = 4;
function parseR(): Cl {
	const tok = RG.rD.trim().split(/[\s,]+/);
	const pts: Pt[] = [];
	let i = 0,
		cur = { x: 0, y: 0 };
	const STEP = 0.25;
	while (i < tok.length) {
		const c = tok[i++];
		if (c === 'M') {
			cur = { x: +tok[i++], y: +tok[i++] };
			pts.push(cur);
		} else if (c === 'L') {
			const b = { x: +tok[i++], y: +tok[i++] };
			const n = Math.max(1, Math.ceil(Math.hypot(b.x - cur.x, b.y - cur.y) / STEP));
			for (let k = 1; k <= n; k++) pts.push({ x: cur.x + ((b.x - cur.x) * k) / n, y: cur.y + ((b.y - cur.y) * k) / n });
			cur = b;
		} else if (c === 'A') {
			const r = +tok[i++];
			i += 2;
			const fa = +tok[i++],
				fs = +tok[i++];
			const b = { x: +tok[i++], y: +tok[i++] };
			// the SVG arc's centre (a circle, no rotation): the spec's endpoint-to-centre conversion
			const x1p = (cur.x - b.x) / 2,
				y1p = (cur.y - b.y) / 2;
			const sq = Math.sqrt(Math.max(0, (r * r - x1p * x1p - y1p * y1p) / (x1p * x1p + y1p * y1p)));
			const sg = fa === fs ? -1 : 1;
			const cxp = sg * sq * y1p,
				cyp = -sg * sq * x1p;
			const cx = cxp + (cur.x + b.x) / 2,
				cy = cyp + (cur.y + b.y) / 2;
			const a0 = Math.atan2((y1p - cyp) / r, (x1p - cxp) / r);
			let da = Math.atan2((-y1p - cyp) / r, (-x1p - cxp) / r) - a0;
			if (fs === 0 && da > 0) da -= 2 * Math.PI;
			if (fs === 1 && da < 0) da += 2 * Math.PI;
			const n = Math.max(2, Math.ceil((Math.abs(da) * r) / STEP));
			for (let k = 1; k <= n; k++) pts.push({ x: cx + r * Math.cos(a0 + (da * k) / n), y: cy + r * Math.sin(a0 + (da * k) / n) });
			cur = b;
		}
	}
	// from the stem foot (the path runs ferrule → foot), on the stage
	pts.reverse();
	const N = pts.length;
	const cl: Cl = { x: new Float64Array(N), y: new Float64Array(N), s: new Float64Array(N), tx: new Float64Array(N), ty: new Float64Array(N), bx: new Float64Array(N), by: new Float64Array(N), len: 0 };
	for (let k = 0; k < N; k++) {
		cl.x[k] = pts[k].x * K + RX;
		cl.y[k] = pts[k].y * K + RY;
		cl.s[k] = k ? cl.s[k - 1] + Math.hypot(cl.x[k] - cl.x[k - 1], cl.y[k] - cl.y[k - 1]) : 0;
	}
	cl.len = cl.s[N - 1];
	for (let k = 0; k < N; k++) {
		const a = Math.max(0, k - 1),
			b = Math.min(N - 1, k + 1);
		const dx = cl.x[b] - cl.x[a],
			dy = cl.y[b] - cl.y[a],
			l = Math.hypot(dx, dy) || 1;
		cl.tx[k] = dx / l;
		cl.ty[k] = dy / l;
	}
	let a = 0,
		b = 0,
		sx = 0,
		sy = 0;
	for (let k = 0; k < N; k++) {
		while (b < N && cl.s[b] <= cl.s[k] + BLUR) {
			sx += cl.tx[b];
			sy += cl.ty[b];
			b++;
		}
		while (cl.s[a] < cl.s[k] - BLUR) {
			sx -= cl.tx[a];
			sy -= cl.ty[a];
			a++;
		}
		const l = Math.hypot(sx, sy) || 1;
		cl.bx[k] = sx / l;
		cl.by[k] = sy / l;
	}
	return cl;
}
export const CL = parseR();
/** arc lengths of the R's parts from the foot: the stem's top, the top's end (where the bowl starts) */
const S_TOP = (81 + (Math.PI / 2) * 9) * K,
	S_HAND = S_TOP + 31 * K;
function idx(s: number) {
	let lo = 0,
		hi = CL.s.length - 1;
	while (lo < hi - 1) {
		const m = (lo + hi) >> 1;
		if (CL.s[m] <= s) lo = m;
		else hi = m;
	}
	return lo;
}
/** the point at arc length s and the unit tangent there */
export function at(s: number): { P: Pt; T: Pt; Tb: Pt } {
	const c = Math.max(0, Math.min(CL.len, s));
	const k = idx(c),
		k1 = Math.min(CL.s.length - 1, k + 1);
	const u = CL.s[k1] > CL.s[k] ? (c - CL.s[k]) / (CL.s[k1] - CL.s[k]) : 0;
	const P = { x: CL.x[k] + (CL.x[k1] - CL.x[k]) * u, y: CL.y[k] + (CL.y[k1] - CL.y[k]) * u };
	const tx = CL.tx[k] + (CL.tx[k1] - CL.tx[k]) * u,
		ty = CL.ty[k] + (CL.ty[k1] - CL.ty[k]) * u,
		l = Math.hypot(tx, ty) || 1;
	const bx = CL.bx[k] + (CL.bx[k1] - CL.bx[k]) * u,
		by = CL.by[k] + (CL.by[k1] - CL.by[k]) * u,
		lb = Math.hypot(bx, by) || 1;
	return { P, T: { x: tx / l, y: ty / l }, Tb: { x: bx / lb, y: by / lb } };
}

/* ------------------------------------------------------------------ the film */
const ease = (u: number) => {
	const x = Math.min(1, Math.max(0, u));
	return x * x * x * (10 + x * (-15 + 6 * x));
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export type Id = 'L' | 'R';
interface Sched {
	t0: number;
	t1: number;
	s0: number;
	s1: number;
	g0: number;
	g1: number;
}
export interface Film {
	L: ArmTrack;
	R: ArmTrack;
	robs: { L: Robot; R: Robot };
	/** forming schedules (s and the grip's lead g along the tangent), the hand that leads the cable when */
	sched: Sched[];
	/** who holds the cable's working point: [t, id | null] in order */
	hold: [number, Id | null][];
	/** the first grip (the pick), the handoff (both hands), the end laid, the ferrule picked, on, crimped */
	k: { pick: number; grab: number; hand: number; handDone: number; laid: number; fPick: number; fOn: number; crimp: number; done: number };
	/** the ferrule's grip point when it is on (stage units) and its tray */
	fGrip: Pt;
	tray: Pt;
	tEnd: number;
}
/** the jaws hold the ferrule here (its collar's middle), and its rest in the tray */
const F_GRIP = { x: ((RG.ferrule.x0 + 59.4) / 2) * K + RX, y: RG.ferrule.y * K + RY - 1.2 };
/** (on a stand: the cable lies under it until it is drawn in) */
const TRAY = { x: 40, y: -18 };
/** how far ahead of the laid cable the leading jaws hold it (units along the tangent) */
const LEAD = 12;

let cache: Film | null = null;
export function film(): Film {
	if (cache) return cache;
	const robs = { L: new Robot({ id: 'L', m: 1, sc: 1, bx: -BX, floor: 0 }), R: new Robot({ id: 'R', m: -1, sc: 1, bx: BX, floor: 0 }) };
	const L = new ArmTrack(robs.L, 'gripper'),
		R = new ArmTrack(robs.R, 'gripper');
	const sched: Sched[] = [];
	const hold: [number, Id | null][] = [[0, null]];
	const Q = (s: number, g: number) => {
		const a = at(s);
		return { x: a.P.x + a.Tb.x * g, y: a.P.y + a.Tb.y * g };
	};
	/** each hand's tool axis along the R (by laid length): the left from the side on the stem, from above on the top; the
	 * right from above on the bowl's top, from the side down its right and the leg, from above-right at the R's foot (no
	 * link ever reaches across the laid cable) */
	const sm = (a: number, b: number, s: number) => ease((s - a) / (b - a));
	const phiL = (s: number) => lerp(0, DOWN - 0.5, sm(46, S_TOP + 3, s));
	const sB0 = S_HAND,
		sB1 = S_HAND + 10 * Math.PI * K,
		sEnd = CL.len;
	const phiR = (s: number) => {
		if (s < sB1) return lerp(DOWN + 0.3, Math.PI + 0.35, sm(sB0 + 2, sB1 - 6, s));
		return lerp(Math.PI + 0.35, Math.PI - 0.6, sm(sEnd - 33, sEnd - 14, s));
	};
	/** lay the cable from s0 to s1 with arm tr, its jaws g0 → g1 ahead of the laid cable; at least T s */
	const lay = (tr: ArmTrack, s0: number, s1: number, g0: number, g1: number, T: number, phi: (s: number) => number) => {
		const t0 = tr.t;
		tr.follow(T, (u) => {
			const e = ease(u);
			const s = lerp(s0, s1, e);
			return { P: Q(s, lerp(g0, g1, e)), phi: phi(s) };
		});
		sched.push({ t0, t1: tr.t, s0, s1, g0, g1 });
	};

	// the cable lies still; the left arm comes down onto it just past its root and takes it
	const pickP = { x: CL.x[0] + 16, y: LIE - 2 };
	L.wait(0.5);
	L.gripTo(1, 0.1);
	L.ptp({ x: pickP.x, y: pickP.y - 16 }, DOWN);
	L.lin(pickP, DOWN, { v: 90 });
	L.gripTo(0.1, 0.1);
	const tPick = L.t;
	hold.push([tPick - 0.04, 'L']);
	L.contact(tPick - 0.1, tPick + 0.1);
	// it lifts the cable to the R's stem line, turning its jaws to the side: the first lead point
	const q0 = Q(0, LEAD);
	const tUp0 = L.t;
	L.follow(0.7, (u) => {
		const e = ease(u);
		// (up first, then across onto the stem line)
		const ey = ease(Math.min(1, u * 1.6)),
			ex = ease(Math.max(0, u * 1.6 - 0.6));
		return { P: { x: lerp(pickP.x, q0.x, ex), y: lerp(pickP.y, q0.y, ey) }, phi: lerp(DOWN, phiL(0), e) };
	});
	sched.push({ t0: tUp0, t1: L.t, s0: 0, s1: 0, g0: -1, g1: LEAD });
	// the stem, the corner, the top
	lay(L, 0, S_TOP - 2, LEAD, LEAD, 1.7, phiL);
	lay(L, S_TOP - 2, S_HAND, LEAD, LEAD, 1.1, phiL);
	// the handoff: the right arm takes the cable further along the same line, from above; the left lets go
	const qH = Q(S_HAND, 36);
	R.wait(Math.max(0.6, L.t - 1.6));
	R.gripTo(1, 0.1);
	R.ptp({ x: qH.x, y: qH.y - 14 }, DOWN + 0.3);
	R.wait(Math.max(R.t, L.t));
	R.lin(qH, DOWN + 0.3, { v: 80 });
	R.gripTo(0.1, 0.1);
	const tGrab = R.t;
	hold.push([tGrab - 0.04, 'R']);
	L.wait(tGrab + 0.05);
	L.gripTo(1, 0.1);
	const tHandDone = L.t;
	// (back off its jaws, up and away over the stem before it folds home: never across the laid cable)
	L.axis(-10, { v: 120 });
	L.lin({ x: CL.x[0] - 30, y: L.pose().P.y - 6 }, DOWN, { v: 160 });
	L.ptpQ(PARK);
	// the bowl, the leg, the foot of the R; the lead shortens to nothing as the end comes in
	R.wait(Math.max(R.t, tHandDone));
	const sB = S_HAND + (Math.PI * 20 + 4) * K;
	lay(R, S_HAND, sB, 36, LEAD, 2.0, phiR);
	lay(R, sB, CL.len, LEAD, 0, 2.0, phiR);
	const tLaid = R.t;
	hold.push([tLaid + 0.06, null]);
	R.gripTo(0.22, 0.1);
	// (back along its axis, out from under the bowl, to the right)
	R.axis(-8, { v: 100 });
	R.lin({ x: 30, y: -16 }, Math.PI - 0.6, { v: 140 });
	// the ferrule: from its tray, onto the free end, crimped
	R.ptp({ x: TRAY.x, y: TRAY.y - 14 }, DOWN);
	R.lin(TRAY, DOWN, { v: 90 });
	R.gripTo(0.3, 0.1);
	const tFPick = R.t;
	R.lin({ x: TRAY.x, y: TRAY.y - 12 }, DOWN, { v: 120 });
	const fPre = { x: F_GRIP.x + 14, y: F_GRIP.y };
	// (in from the right, its axis down-left: the wrist stays clear under the bowl)
	const PHF = Math.PI - 0.6;
	R.lin({ x: fPre.x + 4, y: fPre.y - 10 }, PHF, { v: 140 });
	R.lin(fPre, PHF, { v: 90 });
	R.lin(F_GRIP, PHF, { v: 50 });
	const tFOn = R.t;
	R.contact(tFOn - 0.3, tFOn + 0.5);
	// the crimp: the jaws close hard on the collar
	R.grip.to(R.t, 0.12, 0.14, 'smooth');
	R.hold(0.22);
	const tCrimp = R.t;
	R.kickDir({ x: 0, y: 1 }, 1.5);
	R.gripTo(0.45, 0.1);
	R.axis(-8, { v: 100 });
	R.lin({ x: 34, y: -18 }, PHF, { v: 140 });
	R.ptpQ(PARK);
	const tDone = Math.max(L.t, R.t);
	L.wait(tDone);
	R.wait(tDone);
	cache = { L, R, robs, sched, hold, k: { pick: tPick, grab: tGrab, hand: tGrab, handDone: tHandDone, laid: tLaid, fPick: tFPick, fOn: tFOn, crimp: tCrimp, done: tDone }, fGrip: F_GRIP, tray: TRAY, tEnd: tDone + 0.4 };
	return cache;
}

/* ------------------------------------------------------------------ the cable at t */
/** the laid length s and the lead g at t */
function sgAt(F: Film, t: number) {
	let s = 0,
		g = -1;
	for (const q of F.sched) {
		if (t < q.t0) break;
		const e = ease((t - q.t0) / (q.t1 - q.t0));
		s = lerp(q.s0, q.s1, e);
		g = lerp(q.g0, q.g1, e);
	}
	if (t >= F.k.laid) s = CL.len;
	return { s, g };
}
export function holderAt(F: Film, t: number): Id | null {
	let h: Id | null = null;
	for (const [t0, id] of F.hold) if (t >= t0) h = id;
	return h;
}
export function tcp(F: Film, id: Id, t: number) {
	const tr = id === 'L' ? F.L : F.R;
	return tr.r.fk(tr.qAt(t), tr.toolAt(t)).T;
}
/** a cubic Bézier's points (n segments) */
function bez(a: Pt, b: Pt, c: Pt, d: Pt, n: number, out: Pt[]) {
	for (let i = 1; i <= n; i++) {
		const u = i / n,
			v = 1 - u;
		out.push({ x: v * v * v * a.x + 3 * v * v * u * b.x + 3 * v * u * u * c.x + u * u * u * d.x, y: v * v * v * a.y + 3 * v * v * u * b.y + 3 * v * u * u * c.y + u * u * u * d.y });
	}
}
const plen = (p: Pt[]) => {
	let l = 0;
	for (let i = 1; i < p.length; i++) l += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
	return l;
};
/** cut a polyline at arc length L */
function cut(p: Pt[], L: number) {
	const out: Pt[] = [p[0]];
	let l = 0;
	for (let i = 1; i < p.length; i++) {
		const d = Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
		if (l + d >= L) {
			const u = d > 0 ? (L - l) / d : 0;
			out.push({ x: p[i - 1].x + (p[i].x - p[i - 1].x) * u, y: p[i - 1].y + (p[i].y - p[i - 1].y) * u });
			return out;
		}
		l += d;
		out.push(p[i]);
	}
	return out;
}
/**
 * The cable's centreline at t, from the stem foot to its free end (stage units), and its free end's direction. It is the
 * R's own centreline up to the laid length s, then a span to the leading jaws (the cable passes straight through them along
 * the R's tangent), a span hanging down from the jaws to the bench, and the rest lying straight along the bench. Its length
 * is the R's, always.
 */
export function cable(F: Film, t: number): { pts: Pt[]; laid: number; end: Pt; dir: Pt } {
	const { s } = sgAt(F, t);
	const pts: Pt[] = [];
	const k1 = idx(s);
	for (let k = 0; k <= k1; k++) pts.push({ x: CL.x[k], y: CL.y[k] });
	const A = at(s);
	pts.push(A.P);
	const left = CL.len - s;
	if (left < 0.05) return { pts, laid: s, end: A.P, dir: A.T };
	const h = holderAt(F, t);
	const tail: Pt[] = [A.P];
	let J: Pt, dJ: Pt;
	if (!h) {
		// not held yet: the cable comes up through the bench and lies along it to the right
		J = { x: CL.x[0] + 14, y: LIE };
		dJ = { x: 1, y: 0 };
	} else {
		J = tcp(F, h, t);
		// through the jaws along the R's tangent (lifting: turning from the bench's direction to it)
		const lift = F.sched[0];
		const w = ease((t - lift.t0) / (lift.t1 - lift.t0));
		dJ = { x: lerp(1, A.T.x, w), y: lerp(0, A.T.y, w) };
		const l = Math.hypot(dJ.x, dJ.y) || 1;
		dJ = { x: dJ.x / l, y: dJ.y / l };
	}
	const dPJ = Math.hypot(J.x - A.P.x, J.y - A.P.y);
	const c1 = Math.max(2, 0.4 * dPJ);
	bez(A.P, { x: A.P.x + A.T.x * c1, y: A.P.y + A.T.y * c1 }, { x: J.x - dJ.x * c1, y: J.y - dJ.y * c1 }, J, 10, tail);
	// from the jaws down to the bench (to the right), then lying along it
	const drop = Math.max(0, LIE - J.y);
	const B0 = { x: J.x + 3, y: LIE };
	if (drop > 0.5 || Math.abs(dJ.y) > 0.01) {
		const c2 = Math.max(3, 0.45 * Math.hypot(B0.x - J.x, B0.y - J.y));
		bez(J, { x: J.x + dJ.x * c2, y: J.y + dJ.y * c2 }, { x: B0.x - c2, y: B0.y }, B0, 14, tail);
	}
	const lt = plen(tail);
	let rest: Pt[];
	if (lt >= left) rest = cut(tail, left);
	else {
		const last = tail[tail.length - 1];
		rest = [...tail, { x: last.x + (left - lt), y: last.y }];
	}
	for (let i = 1; i < rest.length; i++) pts.push(rest[i]);
	const e = pts[pts.length - 1],
		p = pts[pts.length - 2];
	const dl = Math.hypot(e.x - p.x, e.y - p.y) || 1;
	return { pts, laid: s, end: e, dir: { x: (e.x - p.x) / dl, y: (e.y - p.y) / dl } };
}
/** the ferrule's offset from its place on the finished R at t (it rides the jaws from its pick to the crimp), and its
 * crimp state 0 … 1 */
export function ferrule(F: Film, t: number) {
	if (t < F.k.fPick) return { dx: F.tray.x - F.fGrip.x, dy: F.tray.y - F.fGrip.y + 0, crimp: 0 };
	if (t < F.k.fOn) {
		const T = tcp(F, 'R', t);
		return { dx: T.x - F.fGrip.x, dy: T.y - F.fGrip.y, crimp: 0 };
	}
	return { dx: 0, dy: 0, crimp: Math.min(1, Math.max(0, (t - F.k.fOn) / (F.k.crimp - F.k.fOn))) };
}

