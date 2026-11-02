/**
 * One arm's program (MOTION-SPEC §5.3). A program is a list of motion segments authored once per layout, then
 * evaluated as a pure function of program time:
 *
 *   ptp    joint-space move with quintic (minimum-jerk) time scaling; its duration keeps every joint within its speed
 *          and acceleration limit and the tool centre point within SPEED.tcp (Robot.ptpTime)
 *   lin    Cartesian straight line, the tool axis interpolated the same way, analytic IK at every sample; its duration
 *          keeps the tool centre point at v and every joint within its limits (sampled along the line). Profile `quint`
 *          (minimum jerk) or `stop`: a protective stop, cruising into an unexpected contact and decelerating in 20 ms
 *   via    blended joint-space moves through free-space waypoints (each a quintic step, the next one starting before the
 *          previous one ends: a blend radius, as a cobot program blends through via points instead of stopping)
 *   linVia the same in Cartesian space
 *   hold   stand still
 *
 * plus effector channels (gripper opening, tool roll, lock ring, screwdriver spindle, probe plunger, LED), tool events
 * (what hangs on the flange when), contact windows (the joint flex is held off while the tool touches something),
 * contact events (QA checks them against the drawn tool) and kicks (small joint velocity impulses along the tool axis).
 */
import { Chan } from '../core';
import { PARK, Robot, SPEED, quintic, wrap, type Pt, type Q, type ToolName } from './kin';

interface SegHold {
	k: 'hold';
	t0: number;
	t1: number;
	q: Q;
}
interface SegPtp {
	k: 'ptp';
	t0: number;
	t1: number;
	q0: Q;
	q1: Q;
}
interface SegLin {
	k: 'lin';
	t0: number;
	t1: number;
	P0: Pt;
	P1: Pt;
	phi0: number;
	phi1: number;
	q0: Q;
	q1: Q;
	prof: 'quint' | 'stop';
	tool: ToolName;
}
/** blended joint-space chain: q0 + Σ dq·quintic((t − a)/T) */
interface SegSum {
	k: 'sum';
	t0: number;
	t1: number;
	q0: Q;
	q1: Q;
	parts: { a: number; T: number; d: Q }[];
}
/** blended Cartesian chain: P0 + Σ dP·quintic((t − a)/T), IK per sample */
interface SegLsum {
	k: 'lsum';
	t0: number;
	t1: number;
	P0: Pt;
	phi0: number;
	q0: Q;
	q1: Q;
	parts: { a: number; T: number; dx: number; dy: number; dphi: number }[];
	tool: ToolName;
}
type Seg = SegHold | SegPtp | SegLin | SegSum | SegLsum;

export interface Kick {
	t: number;
	v: [number, number, number];
}
/** a contact the QA checks: the drawn tool centre point within tol (units) of P at t (lock: the flange, and its angle) */
export interface ContactEv {
	t: number;
	k: string;
	P: Pt;
	phi?: number;
	tool: ToolName;
	flange?: boolean;
}

/* the protective-stop profile: cruise into the contact, decelerate over the last 20 ms (a table per duration) */
function stopProfile(T: number) {
	const N = 200,
		dl = Math.min(0.5, 0.02 / T);
	const v = (u: number) => {
		const up = Math.min(1, u / 0.3),
			dn = Math.min(1, Math.max(0, (u - (1 - dl)) / dl));
		return up * up * (3 - 2 * up) * (1 - dn * dn * (3 - 2 * dn));
	};
	const tab = new Float64Array(N + 1);
	let acc = 0,
		vmax = 0;
	for (let i = 1; i <= N; i++) {
		const a = v((i - 1) / N),
			b = v(i / N);
		acc += (a + b) / (2 * N);
		tab[i] = acc;
		vmax = Math.max(vmax, b);
	}
	for (let i = 0; i <= N; i++) tab[i] /= acc;
	return {
		at: (u: number) => {
			if (u <= 0) return 0;
			if (u >= 1) return 1;
			const x = u * N,
				i = Math.floor(x);
			return tab[i] + (tab[Math.min(N, i + 1)] - tab[i]) * (x - i);
		},
		peak: vmax / acc,
	};
}

export class ArmTrack {
	r: Robot;
	segs: Seg[] = [];
	t = 0;
	q: Q;
	tool: ToolName;
	toolEv: { t: number; tool: ToolName }[];
	speed: number;
	/** gripper opening 0 closed … 1 open */
	grip = new Chan(1);
	/** tool roll about its own axis (rad): 0 jaws close in the screen plane, π/2 across it */
	roll = new Chan(0);
	/** tool-changer lock ring 0 unlocked … 1 locked */
	lock = new Chan(1);
	/** screwdriver spindle angle (rad) */
	spin = new Chan(0);
	/** probe plunger compression (units) */
	comp = new Chan(0);
	/** probe LED / camera status */
	led = new Chan(0);
	kicks: Kick[] = [];
	/** contact windows: the joint flex is held off (the tool is pinned by what it touches) */
	contacts: { t0: number; t1: number }[] = [];
	/** contact events for the QA */
	ev: ContactEv[] = [];
	/** probe touches: while one lasts, the plunger compresses by how far the arm has pushed past the contact */
	touches: { t0: number; t1: number; P: Pt; phi: number }[] = [];
	/** IK clamps logged while authoring (QA: must stay empty) */
	log: string[] = [];
	private profs = new Map<number, ReturnType<typeof stopProfile>>();
	constructor(r: Robot, tool: ToolName, speed = 1) {
		this.r = r;
		this.q = PARK.slice() as Q;
		this.tool = tool;
		this.toolEv = [{ t: -1e9, tool }];
		this.speed = speed;
	}
	get id() {
		return this.r.id;
	}
	m() {
		return this.r.m;
	}
	/** tool-axis angle: straight down, tilted by `tilt` (rad) toward this arm's own side */
	down(tilt = 0) {
		return Math.PI / 2 - this.r.m * tilt;
	}
	/** the tool axis pointing across the work toward the other arm (horizontal): the transverse wire grasp */
	across() {
		return this.r.m > 0 ? 0 : Math.PI;
	}
	pose() {
		const k = this.r.fk(this.q, this.tool);
		return { P: k.T, phi: k.a3 };
	}
	wait(t: number) {
		if (t > this.t + 1e-6) {
			this.segs.push({ k: 'hold', t0: this.t, t1: t, q: this.q.slice() as Q });
			this.t = t;
		}
		return this;
	}
	hold(dt: number) {
		return this.wait(this.t + dt);
	}
	private solve(P: Pt, phi: number, why: string, yaw: number, prev: ArrayLike<number> = this.q) {
		const s = this.r.ik(P, phi, this.tool, prev, yaw);
		if (!s.ok) this.log.push(`${this.r.id} IK clamp at ${Math.round(this.t * 1000)} ms (${why}) reach ${s.reach.toFixed(2)}`);
		return s.q;
	}
	/**
	 * joint-space move to a Cartesian target. `arrive`: do not get there before this time (the arm stays where it is and
	 * leaves just in time). `roll`: the tool roll to reach on the way
	 */
	ptp(P: Pt, phi: number, o: { speed?: number; T?: number; yaw?: number; arrive?: number; roll?: number } = {}) {
		return this.ptpQ(this.solve(P, phi, 'ptp', o.yaw ?? 0), o);
	}
	/** duration of a joint-space move from the current pose (no side effects) */
	ptpDur(P: Pt, phi: number, o: { speed?: number; yaw?: number; roll?: number } = {}) {
		const q1 = this.r.ik(P, phi, this.tool, this.q, o.yaw ?? 0).q;
		return this.r.ptpTime(this.q, q1, this.tool, (o.speed ?? 1) * this.speed, o.roll != null ? o.roll - this.roll.end() : 0);
	}
	ptpQ(q1: Q, o: { speed?: number; T?: number; arrive?: number; roll?: number } = {}) {
		const dRoll = o.roll != null ? o.roll - this.roll.end() : 0;
		const T = o.T ?? this.r.ptpTime(this.q, q1, this.tool, (o.speed ?? 1) * this.speed, dRoll);
		if (o.arrive != null) this.wait(o.arrive - T);
		if (o.roll != null && Math.abs(dRoll) > 1e-9) this.roll.to(this.t, o.roll, T, 'quint');
		this.segs.push({ k: 'ptp', t0: this.t, t1: this.t + T, q0: this.q.slice() as Q, q1: q1.slice() as Q });
		this.t += T;
		this.q = q1.slice() as Q;
		return this;
	}
	/** blended joint-space moves through Cartesian waypoints (free space only: contacts stop) */
	via(pts: { P: Pt; phi: number; yaw?: number }[], o: { speed?: number; blend?: number; roll?: number; arrive?: number } = {}) {
		const beta = o.blend ?? 0.3;
		const qs: Q[] = [];
		let prev: Q = this.q;
		for (const p of pts) {
			const q = this.solve(p.P, p.phi, 'via', p.yaw ?? 0, prev);
			qs.push(q);
			prev = q;
		}
		const sp = (o.speed ?? 1) * this.speed;
		const parts: { a: number; T: number; d: Q }[] = [];
		let a = 0,
			end = 0,
			from = this.q;
		for (let i = 0; i < qs.length; i++) {
			// blended parts overlap: their accelerations add, so each one is timed for 1/1.4 of the limit
			const T = this.r.ptpTime(from, qs[i], this.tool, sp * (qs.length > 1 ? 0.78 : 1), i === 0 && o.roll != null ? o.roll - this.roll.end() : 0);
			parts.push({ a, T, d: [qs[i][0] - from[0], qs[i][1] - from[1], qs[i][2] - from[2], qs[i][3] - from[3]] });
			// (a long part followed by a short one ends after it: the move lasts until every part has)
			end = Math.max(end, a + T);
			a += T * (1 - beta);
			from = qs[i];
		}
		if (o.arrive != null) this.wait(o.arrive - end);
		if (o.roll != null) this.roll.to(this.t, o.roll, Math.max(parts[0].T, end * 0.6), 'quint');
		this.segs.push({ k: 'sum', t0: this.t, t1: this.t + end, q0: this.q.slice() as Q, q1: qs[qs.length - 1].slice() as Q, parts: parts.map((p) => ({ ...p, a: p.a + this.t })) });
		this.t += end;
		this.q = qs[qs.length - 1].slice() as Q;
		return this;
	}
	/** the timing of a Cartesian line from the current pose: TCP speed v and every joint within its limits */
	private linTime(P0: Pt, P1: Pt, ph0: number, ph1: number, v: number, peak: number) {
		const dist = Math.hypot(P1.x - P0.x, P1.y - P0.y) + Math.abs(ph1 - ph0) * 20 * this.r.sc;
		let T = Math.max(SPEED.linMin, (peak * dist) / v);
		// joint rates along the line (per unit path parameter), first and second differences
		const N = 24;
		const qs: Q[] = [];
		let prev: ArrayLike<number> = this.q;
		for (let i = 0; i <= N; i++) {
			const u = i / N;
			const q = this.r.ik({ x: P0.x + (P1.x - P0.x) * u, y: P0.y + (P1.y - P0.y) * u }, ph0 + (ph1 - ph0) * u, this.tool, prev, this.q[3]).q;
			qs.push(q);
			prev = q;
		}
		for (let j = 0; j < 3; j++) {
			let d1 = 0,
				d2 = 0;
			for (let i = 1; i <= N; i++) d1 = Math.max(d1, Math.abs(qs[i][j] - qs[i - 1][j]) * N);
			for (let i = 1; i < N; i++) d2 = Math.max(d2, Math.abs(qs[i + 1][j] - 2 * qs[i][j] + qs[i - 1][j]) * N * N);
			const sp = this.speed;
			T = Math.max(T, (peak * d1) / (SPEED.w[j] * sp), Math.sqrt((3.52 * d2 + 5.77 * d1) / (SPEED.a[j] * sp * sp)));
		}
		return T;
	}
	/** Cartesian straight line; v in units/s (× scale) */
	lin(P: Pt, phi: number | null, o: { v?: number; T?: number; prof?: 'quint' | 'stop' } = {}) {
		const p0 = this.pose();
		// the tool angle by the shortest way (a tool pointing left is at ±π)
		const ph = phi == null ? p0.phi : p0.phi + wrap(phi - p0.phi);
		const v = (o.v ?? SPEED.lin) * this.r.sc * this.speed;
		const prof = o.prof ?? 'quint';
		const peak = prof === 'stop' ? 1.4 : 1.875;
		let T = o.T ?? this.linTime(p0.P, P, p0.phi, ph, v, peak);
		if (o.T != null) T = Math.max(o.T, this.linTime(p0.P, P, p0.phi, ph, 1e9, peak));
		const q0 = this.q.slice() as Q;
		const q1 = this.solve(P, ph, 'lin', this.q[3]);
		this.segs.push({ k: 'lin', t0: this.t, t1: this.t + T, P0: p0.P, P1: { x: P.x, y: P.y }, phi0: p0.phi, phi1: ph, q0, q1, prof, tool: this.tool });
		if (prof === 'stop') this.profs.set(this.t, stopProfile(T));
		this.t += T;
		this.q = q1;
		return this;
	}
	/** blended Cartesian moves through waypoints (free space: never into a contact) */
	linVia(pts: { P: Pt; phi?: number }[], o: { v?: number; blend?: number } = {}) {
		const beta = o.blend ?? 0.3;
		const p0 = this.pose();
		const v = (o.v ?? SPEED.lin) * this.r.sc * this.speed;
		const parts: { a: number; T: number; dx: number; dy: number; dphi: number }[] = [];
		let a = 0,
			end = 0,
			from = p0.P,
			fph = p0.phi;
		const save = this.q;
		for (const w of pts) {
			const ph = w.phi == null ? fph : fph + wrap(w.phi - fph);
			const T = this.linTime(from, w.P, fph, ph, v * 0.78, 1.875) / 0.78;
			parts.push({ a, T, dx: w.P.x - from.x, dy: w.P.y - from.y, dphi: ph - fph });
			end = a + T;
			a += T * (1 - beta);
			this.q = this.r.ik(w.P, ph, this.tool, this.q, this.q[3]).q;
			from = w.P;
			fph = ph;
		}
		this.q = save;
		const last = pts[pts.length - 1];
		const q1 = this.solve(last.P, fph, 'linVia', this.q[3]);
		this.segs.push({ k: 'lsum', t0: this.t, t1: this.t + end, P0: p0.P, phi0: p0.phi, q0: this.q.slice() as Q, q1, parts: parts.map((p) => ({ ...p, a: p.a + this.t })), tool: this.tool });
		this.t += end;
		this.q = q1;
		return this;
	}
	/** relative straight line, units (× scale) */
	rel(dx: number, dy: number, o: { v?: number; T?: number } = {}) {
		const p = this.pose(),
			s = this.r.sc;
		return this.lin({ x: p.P.x + dx * s, y: p.P.y + dy * s }, p.phi, o);
	}
	/** along the tool axis by d units (negative = back off) */
	axis(d: number, o: { v?: number; T?: number } = {}) {
		const p = this.pose(),
			s = this.r.sc;
		return this.lin({ x: p.P.x + Math.cos(p.phi) * d * s, y: p.P.y + Math.sin(p.phi) * d * s }, p.phi, o);
	}
	setTool(tool: ToolName) {
		this.toolEv.push({ t: this.t, tool });
		this.tool = tool;
		return this;
	}
	toolAt(t: number): ToolName {
		let tool = this.toolEv[0].tool;
		for (const e of this.toolEv) if (e.t <= t) tool = e.tool;
		return tool;
	}
	/** a joint velocity impulse equivalent to a tool-centre-point velocity v (units/s) along the tool axis (sign: + = into
	 * the work), each joint capped at 0.1 rad/s: the tiny settle a contact, a click or the final torque gives the arm */
	kickAxis(v: number, t?: number) {
		const k = this.r.fk(this.q, this.tool);
		const u = { x: Math.cos(k.a3) * v * this.r.sc, y: Math.sin(k.a3) * v * this.r.sc };
		const dq = this.r.jointVel(this.q, this.tool, u);
		const mx = Math.max(Math.abs(dq[0]), Math.abs(dq[1]), Math.abs(dq[2]));
		const s = mx > 0.1 ? 0.1 / mx : 1;
		this.kicks.push({ t: t ?? this.t, v: [dq[0] * s, dq[1] * s, dq[2] * s] });
		return this;
	}
	/** a joint velocity impulse equivalent to a tool-centre-point velocity v (units/s) along dir (screen), capped at 0.1 rad/s */
	kickDir(dir: Pt, v: number, t?: number) {
		const l = Math.hypot(dir.x, dir.y) || 1;
		const u = { x: (dir.x / l) * v * this.r.sc, y: (dir.y / l) * v * this.r.sc };
		const dq = this.r.jointVel(this.q, this.tool, u);
		const mx = Math.max(Math.abs(dq[0]), Math.abs(dq[1]), Math.abs(dq[2]));
		const s = mx > 0.1 ? 0.1 / mx : 1;
		this.kicks.push({ t: t ?? this.t, v: [dq[0] * s, dq[1] * s, dq[2] * s] });
		return this;
	}
	/** the tool touches something from t0 to t1: no flex (QA: drawn tool on target) */
	contact(t0: number, t1: number) {
		this.contacts.push({ t0, t1 });
		return this;
	}
	/** a contact event for the QA, at the current (commanded) pose unless P is given */
	event(k: string, o: { t?: number; P?: Pt; flange?: boolean } = {}) {
		const kk = this.r.fk(this.q, this.tool);
		this.ev.push({ t: o.t ?? this.t, k, P: o.P ?? (o.flange ? kk.F : kk.T), phi: kk.la3, tool: this.tool, flange: o.flange });
		return this;
	}
	gripTo(v: number, d = 0.08) {
		this.grip.to(this.t, v, d, 'smooth');
		return this.hold(d);
	}
	/** the segment active at t (binary search: segments are contiguous in time) */
	private seg(t: number): Seg | null {
		const g = this.segs;
		if (!g.length || t < g[0].t0) return null;
		let lo = 0,
			hi = g.length - 1;
		while (lo < hi) {
			const m = (lo + hi + 1) >> 1;
			if (g[m].t0 <= t) lo = m;
			else hi = m - 1;
		}
		return g[lo];
	}
	private ease(s: SegLin, u: number) {
		return s.prof === 'stop' ? this.profs.get(s.t0)!.at(u) : quintic(u);
	}
	/** commanded joint vector at t */
	qAt(t: number): Q {
		const s = this.seg(t);
		if (!s) {
			const g = this.segs[0];
			return (g ? (g.k === 'hold' ? g.q : g.q0) : this.q).slice() as Q;
		}
		if (s.k === 'hold') return s.q.slice() as Q;
		if (t >= s.t1) return s.q1.slice() as Q;
		if (s.k === 'ptp') {
			const e = quintic((t - s.t0) / (s.t1 - s.t0));
			return [s.q0[0] + (s.q1[0] - s.q0[0]) * e, s.q0[1] + (s.q1[1] - s.q0[1]) * e, s.q0[2] + (s.q1[2] - s.q0[2]) * e, s.q0[3] + (s.q1[3] - s.q0[3]) * e];
		}
		if (s.k === 'sum') {
			const q = s.q0.slice() as Q;
			for (const p of s.parts) {
				const e = quintic((t - p.a) / p.T);
				for (let i = 0; i < 4; i++) q[i] += p.d[i] * e;
			}
			return q;
		}
		const tg = this.target(s, t)!;
		return this.r.ik(tg.P, tg.phi, s.tool, s.q0, s.q0[3]).q;
	}
	private target(s: SegLin | SegLsum, t: number) {
		if (s.k === 'lin') {
			const e = this.ease(s, (t - s.t0) / (s.t1 - s.t0));
			return { P: { x: s.P0.x + (s.P1.x - s.P0.x) * e, y: s.P0.y + (s.P1.y - s.P0.y) * e }, phi: s.phi0 + (s.phi1 - s.phi0) * e };
		}
		let x = s.P0.x,
			y = s.P0.y,
			ph = s.phi0;
		for (const p of s.parts) {
			const e = quintic((t - p.a) / p.T);
			x += p.dx * e;
			y += p.dy * e;
			ph += p.dphi * e;
		}
		return { P: { x, y }, phi: ph };
	}
	/** the commanded Cartesian target of a Cartesian segment at t (QA: FK of the solved joints must reach it) */
	linTarget(t: number): { P: Pt; phi: number; tool: ToolName } | null {
		const s = this.seg(t);
		if (!s || (s.k !== 'lin' && s.k !== 'lsum') || t >= s.t1) return null;
		return { ...this.target(s, t)!, tool: s.tool };
	}
	/** the contact window factor at t: 1 inside a contact, eased over 30 ms at both ends */
	inContact(t: number) {
		let w = 0;
		for (const c of this.contacts) {
			if (t < c.t0 - 0.03 || t > c.t1 + 0.03) continue;
			const a = Math.min(1, (t - (c.t0 - 0.03)) / 0.03),
				b = Math.min(1, (c.t1 + 0.03 - t) / 0.03);
			w = Math.max(w, Math.max(0, Math.min(a, b)));
		}
		return w;
	}
	end() {
		return this.t;
	}
}
