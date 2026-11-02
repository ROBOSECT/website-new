/**
 * Panel maths (MOTION-SPEC v4 §6), shared by the build (Node, pin lengths) and the browser.
 * Port of spec/v2/physics.js and the helpers of spec/v3/engine.js: same formulas and constants.
 *
 *   springs   closed-form damped oscillator (unit mass) + semi-implicit Euler for driven springs
 *   carrot    trapezoidal motion profile (the copper front the lead follows along a route)
 *   Route     straight runs + constant-radius fillets (the R's own construction), exact arc length
 *   crPath    uniform Catmull-Rom through rope nodes -> cubic Bézier path data
 *   sBend     the laid S-bend (cubic Bézier, vertical tangents), arc-length parameterised
 *   Chan      keyframed scalar channel (eased or spring-driven), a pure function of program time
 */

/** fixed simulation step: 120 Hz */
export const H = 1 / 120;

export const f = (v: number) => Math.round(v * 100) / 100;
/**
 * String(f(v)) without the double → string conversion (engine pass, the frame budget: a path of 21 cubics formats 126
 * numbers; an integer comes from V8's number cache, a fraction from the slower shortest-double algorithm). The same text
 * as String(f(v)) for every finite |v| < 2·10⁷ (checked on 200 000 random values), NaN and larger values fall back to it.
 */
export function fs(v: number): string {
	let n = Math.round(v * 100);
	if (n === 0) return '0';
	if (!(n > -2e9 && n < 2e9)) return String(n / 100);
	let s = '';
	if (n < 0) {
		s = '-';
		n = -n;
	}
	const ip = Math.floor(n / 100),
		fp = n - ip * 100;
	if (fp === 0) return s + ip;
	return s + ip + (fp < 10 ? '.0' + fp : fp % 10 === 0 ? '.' + fp / 10 : '.' + fp);
}

/* ------------------------------------------------------------------ QA: the frame's JS by section */
/** ?panel-prof=1: every frame's JS time by section (window.__ptF: one record per frame); otherwise lap0/lap are no-ops */
export const PROF = typeof location !== 'undefined' && /[?&]panel-prof=1\b/.test(location.search);
export const PT: { cur: Record<string, number> | null } = { cur: null };
let lapT = 0;
export function lap0() {
	if (PROF) lapT = performance.now();
}
export function lap(k: string) {
	if (!PROF || !PT.cur) return;
	const n = performance.now();
	PT.cur[k] = (PT.cur[k] || 0) + n - lapT;
	lapT = n;
}
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (v: number) => {
	v = clamp01(v);
	return v * v * (3 - 2 * v);
};
/** minimum-jerk time scaling: zero velocity and acceleration at both ends */
export const quintic = (u: number) => {
	u = clamp01(u);
	return u * u * u * (10 - 15 * u + 6 * u * u);
};
/** smooth minimum (log-sum-exp), κ = softness in px */
export const softmin = (a: number, b: number, k: number) => Math.min(a, b) - k * Math.log1p(Math.exp(-Math.abs(a - b) / k));

/** deterministic sequence (sparks, drop side, swing) */
export function lcg(seed: number) {
	let s = seed >>> 0 || 1;
	return () => {
		s = (1664525 * s + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

/* ------------------------------------------------------------------ springs */
export interface Spring {
	w: number;
	z: number;
}
export const SPRINGS = {
	follow: { w: 14, z: 1.0 },
	chase: { w: 30, z: 0.8 },
	seat: { w: 44, z: 0.62 },
	recoil: { w: 38, z: 0.32 },
	actuate: { w: 34, z: 0.45 },
	halo: { w: 26, z: 0.5 },
	morphX: { w: 21, z: 0.86 },
	morphY: { w: 16, z: 0.92 },
	content: { w: 26, z: 0.9 },
	pop: { w: 40, z: 0.42 },
	catch: { w: 14, z: 0.62 },
	ring: { w: 22, z: 1.0 },
	jaw: { w: 46, z: 0.55 },
	cage: { w: 52, z: 0.38 },
	lever: { w: 30, z: 0.42 },
	ledk: { w: 24, z: 0.7 },
	flash: { w: 18, z: 1 },
} satisfies Record<string, Spring>;
export type SpringName = keyof typeof SPRINGS;

/** released spring, closed form: [x, v] at time t from displacement x0 and velocity v0 */
export function spring(t: number, s: Spring, x0 = 1, v0 = 0): [number, number] {
	if (t <= 0) return [x0, v0];
	const { w, z } = s;
	if (z < 1) {
		const wd = w * Math.sqrt(1 - z * z);
		const e = Math.exp(-z * w * t);
		const A = x0,
			B = (v0 + z * w * x0) / wd;
		const c = Math.cos(wd * t),
			si = Math.sin(wd * t);
		return [e * (A * c + B * si), e * (-z * w * (A * c + B * si) + (-A * wd * si + B * wd * c))];
	}
	if (z === 1) {
		const e = Math.exp(-w * t);
		const A = x0,
			B = v0 + w * x0;
		return [e * (A + B * t), e * (B - w * (A + B * t))];
	}
	const r = w * Math.sqrt(z * z - 1);
	const r1 = -z * w + r,
		r2 = -z * w - r;
	const C2 = (v0 - r1 * x0) / (r2 - r1),
		C1 = x0 - C2;
	return [C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t), C1 * r1 * Math.exp(r1 * t) + C2 * r2 * Math.exp(r2 * t)];
}
/** step response 0 -> 1 (with the spring's own overshoot) */
export const prog = (t: number, s: Spring) => (t <= 0 ? 0 : 1 - spring(t, s, 1, 0)[0]);
/** impulse response of a spring kicked with v0 from rest */
export const kick = (t: number, s: Spring, v0: number) => (t <= 0 ? 0 : spring(t, s, 0, v0)[0]);
/** one semi-implicit Euler step of a spring driven toward a moving target */
export function drive(st: { x: number; v: number }, target: number, s: Spring, h: number) {
	st.v += (s.w * s.w * (target - st.x) - 2 * s.z * s.w * st.v) * h;
	st.x += st.v * h;
	return st;
}

/* ------------------------------------------------------------------ carrot */
/** trapezoidal profile: [distance covered at t, total time] for D px at vmax with acceleration a */
export function carrot(t: number, D: number, vmax: number, a: number): [number, number] {
	if (D <= 0) return [0, 0];
	const ta = vmax / a;
	if (a * ta * ta >= D) {
		const tp = Math.sqrt(D / a),
			T = 2 * tp;
		if (t <= 0) return [0, T];
		if (t <= tp) return [0.5 * a * t * t, T];
		if (t >= T) return [D, T];
		const u = T - t;
		return [D - 0.5 * a * u * u, T];
	}
	const da = 0.5 * a * ta * ta,
		tc = (D - 2 * da) / vmax,
		T = 2 * ta + tc;
	if (t <= 0) return [0, T];
	if (t <= ta) return [0.5 * a * t * t, T];
	if (t <= ta + tc) return [da + vmax * (t - ta), T];
	if (t >= T) return [D, T];
	const u = T - t;
	return [D - 0.5 * a * u * u, T];
}

/* ------------------------------------------------------------------ route */
export interface Pt {
	x: number;
	y: number;
}
interface SegL {
	t: 'L';
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	s0: number;
	len: number;
	chan: number;
	tx: number;
	ty: number;
}
interface SegA {
	t: 'A';
	cx: number;
	cy: number;
	r: number;
	a0: number;
	da: number;
	ex: number;
	ey: number;
	s0: number;
	len: number;
	chan: number;
}
type Seg = SegL | SegA;

/** corner polyline with a fillet radius per corner: tangent-continuous, exact arc length */
export class Route {
	segs: Seg[] = [];
	len = 0;
	constructor(pts: Pt[], radii: number[], chans?: number[]) {
		const n = pts.length;
		let cur = { x: pts[0].x, y: pts[0].y };
		for (let i = 1; i < n; i++) {
			const P = pts[i];
			const chan = chans ? chans[i - 1] : Infinity;
			if (i < n - 1) {
				const A = pts[i - 1],
					B = pts[i + 1];
				let ux = P.x - A.x,
					uy = P.y - A.y;
				const ul = Math.hypot(ux, uy);
				ux /= ul;
				uy /= ul;
				let wx = B.x - P.x,
					wy = B.y - P.y;
				const wl = Math.hypot(wx, wy);
				wx /= wl;
				wy /= wl;
				const cross = ux * wy - uy * wx,
					dot = Math.max(-1, Math.min(1, ux * wx + uy * wy));
				const th = Math.acos(dot);
				const r = radii[i] || 0;
				if (r > 0 && th > 1e-6) {
					const tl = r * Math.tan(th / 2);
					const sx = P.x - ux * tl,
						sy = P.y - uy * tl;
					const ex = P.x + wx * tl,
						ey = P.y + wy * tl;
					this.line(cur.x, cur.y, sx, sy, chan);
					const sg = cross > 0 ? 1 : -1;
					const cx = sx + -uy * r * sg,
						cy = sy + ux * r * sg;
					this.arc(cx, cy, r, Math.atan2(sy - cy, sx - cx), sg * th, ex, ey, Math.min(chan, chans ? chans[i] : Infinity));
					cur = { x: ex, y: ey };
					continue;
				}
			}
			this.line(cur.x, cur.y, P.x, P.y, chan);
			cur = { x: P.x, y: P.y };
		}
	}
	private line(x0: number, y0: number, x1: number, y1: number, chan: number) {
		const l = Math.hypot(x1 - x0, y1 - y0);
		if (l < 1e-6) return;
		this.segs.push({ t: 'L', x0, y0, x1, y1, s0: this.len, len: l, chan, tx: (x1 - x0) / l, ty: (y1 - y0) / l });
		this.len += l;
	}
	private arc(cx: number, cy: number, r: number, a0: number, da: number, ex: number, ey: number, chan: number) {
		const l = Math.abs(da) * r;
		this.segs.push({ t: 'A', cx, cy, r, a0, da, ex, ey, s0: this.len, len: l, chan });
		this.len += l;
	}
	seg(s: number): Seg {
		const g = this.segs;
		let lo = 0,
			hi = g.length - 1;
		while (lo < hi) {
			const m = (lo + hi + 1) >> 1;
			if (g[m].s0 <= s) lo = m;
			else hi = m - 1;
		}
		return g[lo];
	}
	/** point and unit tangent at arc length s (clamped) */
	at(s: number) {
		const g = this.seg(Math.max(0, Math.min(this.len, s)));
		const u = Math.max(0, Math.min(this.len, s)) - g.s0;
		if (g.t === 'L') return { x: g.x0 + g.tx * u, y: g.y0 + g.ty * u, tx: g.tx, ty: g.ty, chan: g.chan };
		const sg = g.da > 0 ? 1 : -1;
		const a = g.a0 + sg * (u / g.r);
		return { x: g.cx + g.r * Math.cos(a), y: g.cy + g.r * Math.sin(a), tx: -Math.sin(a) * sg, ty: Math.cos(a) * sg, chan: g.chan };
	}
	/** SVG path data from s0 to s1 */
	d(s0 = 0, s1 = this.len): string {
		if (s1 <= s0) return '';
		const p0 = this.at(s0);
		let d = 'M' + fs(p0.x) + ' ' + fs(p0.y);
		for (const g of this.segs) {
			const a = Math.max(s0, g.s0),
				b = Math.min(s1, g.s0 + g.len);
			if (b <= a) continue;
			const q = this.at(b);
			if (g.t === 'L') d += 'L' + fs(q.x) + ' ' + fs(q.y);
			else d += 'A' + fs(g.r) + ' ' + fs(g.r) + ' 0 0 ' + (g.da > 0 ? 1 : 0) + ' ' + fs(q.x) + ' ' + fs(q.y);
		}
		return d;
	}
	/** arc length where a vertical run passes y (from arc length fromS on) */
	sAtY(y: number, fromS = 0): number {
		for (const g of this.segs) {
			if (g.t !== 'L' || g.s0 + g.len < fromS) continue;
			if (Math.abs(g.tx) < 1e-6 && (y - g.y0) * g.ty >= 0 && (y - g.y1) * g.ty <= 0) return g.s0 + Math.abs(y - g.y0);
		}
		return -1;
	}
}

/* ------------------------------------------------------------------ curves */
/** uniform Catmull-Rom through n points (flat xy array) -> cubic Bézier path data (starts with M) */
export function crPath(x: ArrayLike<number>, n: number, cmd: 'M' | 'L' = 'M'): string {
	if (n < 2) return '';
	let d = cmd + fs(x[0]) + ' ' + fs(x[1]);
	// a lead fed straight out of the duct (its nodes on one vertical or horizontal line, in order: the feed and the presented
	// out-lead are placed so): the curve through them is that straight line, one segment (engine pass: no 21 cubics to build
	// and parse every frame of a feed; the same line on screen)
	let vx = true,
		vy = true,
		mono = true;
	for (let i = 1; i < n && (vx || vy); i++) {
		if (x[2 * i] !== x[0]) vx = false;
		if (x[2 * i + 1] !== x[1]) vy = false;
	}
	if (vx || vy) {
		const k = vx ? 1 : 0;
		const s = Math.sign(x[2 * n - 2 + k] - x[k]);
		for (let i = 1; i < n && mono; i++) if (Math.sign(x[2 * i + k] - x[2 * i - 2 + k]) !== s) mono = false;
		if (mono && s !== 0) return d + 'L' + fs(x[2 * n - 2]) + ' ' + fs(x[2 * n - 1]);
	}
	for (let i = 0; i < n - 1; i++) {
		const i0 = Math.max(0, i - 1),
			i3 = Math.min(n - 1, i + 2);
		const p0x = x[2 * i0],
			p0y = x[2 * i0 + 1],
			p1x = x[2 * i],
			p1y = x[2 * i + 1],
			p2x = x[2 * i + 2],
			p2y = x[2 * i + 3],
			p3x = x[2 * i3],
			p3y = x[2 * i3 + 1];
		d += 'C' + fs(p1x + (p2x - p0x) / 6) + ' ' + fs(p1y + (p2y - p0y) / 6) + ' ' + fs(p2x - (p3x - p1x) / 6) + ' ' + fs(p2y - (p3y - p1y) / 6) + ' ' + fs(p2x) + ' ' + fs(p2y);
	}
	return d;
}

/** cubic Bézier with vertical tangents from A (going down) to B (going down): the laid S-bend */
export function sBend(A: Pt, B: Pt, k = 0.55): Pt[] {
	const h = B.y - A.y;
	return [A, { x: A.x, y: A.y + h * k }, { x: B.x, y: B.y - h * k }, B];
}
export function bez(c: Pt[], t: number): Pt {
	const u = 1 - t;
	return {
		x: u * u * u * c[0].x + 3 * u * u * t * c[1].x + 3 * u * t * t * c[2].x + t * t * t * c[3].x,
		y: u * u * u * c[0].y + 3 * u * u * t * c[1].y + 3 * u * t * t * c[2].y + t * t * t * c[3].y,
	};
}
export interface Laid {
	pts: Pt[];
	len: number;
}
/** n points uniformly spaced in arc length along a cubic (64-sample table) */
export function bezUniform(c: Pt[], n: number): Laid {
	const N = 64,
		tab = [0];
	let prev = bez(c, 0),
		L = 0;
	for (let i = 1; i <= N; i++) {
		const q = bez(c, i / N);
		L += Math.hypot(q.x - prev.x, q.y - prev.y);
		tab.push(L);
		prev = q;
	}
	const out: Pt[] = [];
	for (let j = 0; j < n; j++) {
		const s = (L * j) / (n - 1);
		let i = 1;
		while (i < N && tab[i] < s) i++;
		const t = (i - 1 + (s - tab[i - 1]) / (tab[i] - tab[i - 1] || 1)) / N;
		out.push(bez(c, t));
	}
	return { pts: out, len: L };
}

/* ------------------------------------------------------------------ channels */
export type Ease = 'lin' | 'smooth' | 'quint' | 'out' | 'in' | 'step' | 'torque' | `spring:${SpringName}`;
const EASE: Record<string, (u: number) => number> = {
	lin: (u) => u,
	smooth,
	quint: quintic,
	out: (u) => 1 - Math.pow(1 - u, 3),
	in: (u) => u * u * u,
	step: (u) => (u > 0 ? 1 : 0),
	torque: (u) => 1 - Math.pow(1 - u, 2.4),
};
interface Key {
	t: number;
	v: number;
	d: number;
	e: Ease;
	/** its spring, resolved once (engine pass: at() used to slice the ease's name on every call); null: an eased key */
	sp: Spring | null;
}
/** keyframed scalar: each key eases (or springs) from the value at its start to v */
export class Chan {
	k: Key[] = [];
	constructor(public v0 = 0) {}
	to(t: number, v: number, d = 0, e: Ease = 'smooth') {
		this.k.push({ t, v, d, e, sp: e.startsWith('spring:') ? SPRINGS[e.slice(7) as SpringName] : null });
		this.k.sort((a, b) => a.t - b.t);
		return this;
	}
	at(t: number): number {
		if (!this.k.length || t < this.k[0].t) return this.v0;
		let v = this.v0;
		for (const k of this.k) {
			if (t < k.t) break;
			const dt = t - k.t;
			const p = k.sp ? prog(dt, k.sp) : EASE[k.e](k.d > 0 ? Math.min(1, dt / k.d) : 1);
			v = v + (k.v - v) * p;
		}
		return v;
	}
	end() {
		return this.k.length ? this.k[this.k.length - 1].v : this.v0;
	}
}
