/**
 * The robot pair's kinematics (MOTION-SPEC §5.1–5.3).
 *
 * A stylized collaborative arm in the screen plane (the honest front view of a UR-type cobot), drawn on the
 * logo grid (modulo 4; 1 unit = 1 px × the stage scale s):
 *
 *   foot 32 × 4 · pedestal 20 wide · shoulder J2 at h0 = 24 above the bench
 *   upper arm L1 = 64 (tube 12) · elbow J3 · forearm L2 = 56 (tube 10) · wrist J4 · wrist link L3 = 12
 *   flange 14 × 3 with the tool-changer lock ring · tool (gripper, probe, camera, screwdriver)
 *   J1 base yaw about the vertical axis: 0 = the arm plane faces the viewer, π = turned to the rack behind
 *   J6 tool roll about the tool axis (a channel, not part of the planar chain): 0 = the gripper's jaws close in the
 *   screen plane, π/2 = they close across it (the transverse wire grasp)
 *
 * Angles are screen angles (y down, radians); φ is the tool-axis angle (π/2 = pointing straight down).
 * Local frame of an arm: x′ = c·(x − Sx), y′ = y − Sy with c = m·cos J1 (m = +1 left arm, −1 right arm).
 * q = [q1 upper-arm angle (absolute), q2 elbow (relative), q3 wrist (relative), J1 yaw].
 *
 * IK (analytic, closed form): W = P − (L3 + tcp)·u(φ); d = |W − S|; cos q2 = (d² − L1² − L2²)/(2·L1·L2);
 * q2 = +acos (elbow up: the one configuration ever used, so the elbow never flips); q1 = atan2(W′) −
 * atan2(L2 sin q2, L1 + L2 cos q2); q3 = φ′ − q1 − q2, wrapped to the branch nearest the previous q3.
 * Limits: q1 ∈ [−178°, 25°], q2 ∈ [8°, 172°], |q3| ≤ 200°; reach 1.05·|L1 − L2| ≤ d ≤ 0.985·(L1 + L2).
 * Anything outside is clamped and flagged (programs are checked at build time: zero clamps, zero limit hits).
 *
 * Speed and acceleration limits are one consistent set, as on a real small cobot (base, shoulder and elbow alike,
 * the wrists faster): every joint move and every Cartesian move is timed so that no joint and no tool centre point
 * exceeds them (ptpTime, ArmTrack.lin), and the robot QA checks the result on the drawn arm.
 */
export const DEG = Math.PI / 180;

/** link and body geometry, units */
export const GEO = { h0: 24, L1: 64, L2: 56, L3: 12, w1: 12, w2: 10, w3: 10, r1: 10, r2: 8, r3: 6.5, flangeW: 14, flangeT: 3, pedW: 20, footW: 32, footH: 4 };

export type ToolName = 'gripper' | 'probe' | 'camera' | 'driver' | 'opener' | 'none';
/** tcp = distance from the flange centre to the tool centre point along the tool axis; len = drawn length from the flange
 * face (the tool's lowest point when it hangs in a rack) */
export const TOOLS: Record<ToolName, { tcp: number; len: number }> = {
	gripper: { tcp: 18, len: 20 },
	probe: { tcp: 29, len: 27.5 },
	camera: { tcp: 16, len: 14.5 },
	driver: { tcp: 31, len: 29.5 },
	/** vignettes (C3): the spring-cage opener, a lever blade (a flat blade with a side lever fin) */
	opener: { tcp: 26, len: 24.5 },
	none: { tcp: 0, len: 0 },
};
export const LIM = { q1: [-178 * DEG, 25 * DEG], q2: [8 * DEG, 172 * DEG], q3: [-200 * DEG, 200 * DEG] } as const;
/**
 * one consistent set of limits: joint speed w (rad/s) and acceleration a (rad/s²) for J2, J3, J4, J1 (base = shoulder =
 * elbow; the wrist faster), the tool roll, the tool centre point's speed on joint moves (tcp) and the default Cartesian
 * speed (lin), units/s × the stage scale. A quintic of duration T over Δ peaks at 1.875·Δ/T and 5.77·Δ/T².
 */
export const SPEED = { w: [8, 8, 12, 8], a: [80, 80, 120, 80], roll: 12, lin: 230, tcp: 320, tmin: 0.15, linMin: 0.09 };
/** the parked (home) pose: upper arm up, forearm folded down, tool hanging just above the bench */
export const PARK: Q = [-108 * DEG, 152 * DEG, 46 * DEG, 0];

export type Q = [number, number, number, number];
export interface Pt {
	x: number;
	y: number;
}
export interface FK {
	S: Pt;
	E: Pt;
	W: Pt;
	F: Pt;
	T: Pt;
	/** projected facing (m·cos J1) and the yaw's sine (the depth component of the arm plane's horizontal axis) */
	c: number;
	s: number;
	/** absolute wrist angle in the arm plane (for the tool frame) */
	la3: number;
	/** projected (screen) link angles */
	a1: number;
	a2: number;
	a3: number;
}

export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export const near = (a: number, ref: number) => ref + wrap(a - ref);
/** minimum-jerk time scaling s(τ) = 10τ³ − 15τ⁴ + 6τ⁵ */
export const quintic = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (10 + t * (-15 + 6 * t)));
/** its derivatives (per unit τ) */
export const quinticD = (t: number) => (t <= 0 || t >= 1 ? 0 : 30 * t * t * (1 - t) * (1 - t));

export class Robot {
	id: 'L' | 'R';
	m: 1 | -1;
	sc: number;
	bx: number;
	floor: number;
	L1: number;
	L2: number;
	L3: number;
	S: Pt;
	constructor(o: { id: 'L' | 'R'; m: 1 | -1; sc: number; bx: number; floor: number }) {
		this.id = o.id;
		this.m = o.m;
		this.sc = o.sc;
		this.bx = o.bx;
		this.floor = o.floor;
		this.L1 = GEO.L1 * o.sc;
		this.L2 = GEO.L2 * o.sc;
		this.L3 = GEO.L3 * o.sc;
		this.S = { x: o.bx, y: o.floor - GEO.h0 * o.sc };
	}
	tcpOff(tool: ToolName) {
		return this.L3 + TOOLS[tool].tcp * this.sc;
	}
	/** analytic IK for the tool centre point P with tool axis φ (J1 ∈ {0, π} at targets) */
	ik(P: Pt, phi: number, tool: ToolName, prev: ArrayLike<number> | null, yaw = 0): { q: Q; ok: boolean; reach: number } {
		const c = this.m * Math.cos(yaw) >= 0 ? 1 : -1;
		const off = this.tcpOff(tool);
		const Wx = P.x - off * Math.cos(phi),
			Wy = P.y - off * Math.sin(phi);
		let x = c * (Wx - this.S.x),
			y = Wy - this.S.y;
		let d = Math.hypot(x, y);
		const L1 = this.L1,
			L2 = this.L2;
		const dmax = (L1 + L2) * 0.985,
			dmin = Math.abs(L1 - L2) * 1.05 + 1e-6;
		let ok = true;
		if (d > dmax) {
			x *= dmax / d;
			y *= dmax / d;
			d = dmax;
			ok = false;
		} else if (d < dmin) {
			const k = dmin / (d || 1e-6);
			x *= k;
			y *= k;
			d = dmin;
			ok = false;
		}
		const c2 = Math.max(-1, Math.min(1, (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2)));
		const q2 = Math.acos(c2);
		const q1 = Math.atan2(y, x) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
		const phiL = c > 0 ? phi : Math.PI - phi;
		let q3 = wrap(phiL - q1 - q2);
		if (prev) q3 = near(q3, prev[2]);
		if (q1 < LIM.q1[0] || q1 > LIM.q1[1] || q2 < LIM.q2[0] || q2 > LIM.q2[1] || Math.abs(q3) > LIM.q3[1]) ok = false;
		return { q: [q1, q2, q3, yaw], ok, reach: d / (L1 + L2) };
	}
	/** forward kinematics, base yaw projected onto the screen (horizontal components × c) */
	fk(q: ArrayLike<number>, tool: ToolName): FK {
		const S = this.S;
		const c = this.m * Math.cos(q[3] || 0);
		const a1 = q[0],
			a2 = q[0] + q[1],
			a3 = a2 + q[2];
		const c1 = Math.cos(a1),
			s1 = Math.sin(a1),
			c2 = Math.cos(a2),
			s2 = Math.sin(a2),
			c3 = Math.cos(a3),
			s3 = Math.sin(a3);
		const E = { x: S.x + c * this.L1 * c1, y: S.y + this.L1 * s1 };
		const W = { x: E.x + c * this.L2 * c2, y: E.y + this.L2 * s2 };
		const F = { x: W.x + c * this.L3 * c3, y: W.y + this.L3 * s3 };
		const off = this.tcpOff(tool);
		const T = { x: W.x + c * off * c3, y: W.y + off * s3 };
		return { S, E, W, F, T, c, s: Math.sin(q[3] || 0), la3: a3, a1: Math.atan2(s1, c * c1), a2: Math.atan2(s2, c * c2), a3: Math.atan2(s3, c * c3) };
	}
	/** the tool centre point in 3D (x, y on screen, z depth): for speed limits, which are about the real motion */
	tcp3(q: ArrayLike<number>, tool: ToolName) {
		const a1 = q[0],
			a2 = a1 + q[1],
			a3 = a2 + q[2];
		const u = this.L1 * Math.cos(a1) + this.L2 * Math.cos(a2) + this.tcpOff(tool) * Math.cos(a3);
		const v = this.L1 * Math.sin(a1) + this.L2 * Math.sin(a2) + this.tcpOff(tool) * Math.sin(a3);
		const j = q[3] || 0;
		return { x: this.S.x + this.m * Math.cos(j) * u, y: this.S.y + v, z: Math.sin(j) * u };
	}
	/**
	 * joint-move duration: every joint within its speed and acceleration limit (a quintic peaks at 1.875·Δ/T and
	 * 5.77·Δ/T²), the tool roll within the wrist's, and the tool centre point (in 3D) within SPEED.tcp
	 */
	ptpTime(q0: ArrayLike<number>, q1: ArrayLike<number>, tool: ToolName, speed = 1, dRoll = 0) {
		let T = SPEED.tmin;
		for (let i = 0; i < 4; i++) {
			const d = Math.abs(q1[i] - q0[i]);
			T = Math.max(T, (1.875 * d) / (SPEED.w[i] * speed), Math.sqrt((5.77 * d) / (SPEED.a[i] * speed * speed)));
		}
		T = Math.max(T, (1.875 * Math.abs(dRoll)) / (SPEED.roll * speed));
		// the tool centre point along the joint-space path: max |dP/ds| (s ∈ [0, 1]) → peak speed 1.875·max/T
		let gmax = 0;
		const N = 24;
		let p = this.tcp3(q0, tool);
		const q = [0, 0, 0, 0];
		for (let k = 1; k <= N; k++) {
			for (let i = 0; i < 4; i++) q[i] = q0[i] + ((q1[i] - q0[i]) * k) / N;
			const p1 = this.tcp3(q, tool);
			gmax = Math.max(gmax, Math.hypot(p1.x - p.x, p1.y - p.y, p1.z - p.z) * N);
			p = p1;
		}
		T = Math.max(T, (1.875 * gmax) / (SPEED.tcp * this.sc * speed));
		return T;
	}
	/**
	 * the joint-space Jacobian of the tool centre point and the tool angle (in the arm plane, J1 = 0 or π), by central
	 * differences; used to turn a Cartesian velocity impulse along the tool axis into joint velocities (contact kicks)
	 */
	jointVel(q: ArrayLike<number>, tool: ToolName, v: Pt): [number, number, number] {
		const h = 1e-5;
		const J: number[][] = [[], [], []];
		for (let j = 0; j < 3; j++) {
			const a = Array.from(q),
				b = Array.from(q);
			a[j] -= h;
			b[j] += h;
			const ka = this.fk(a, tool),
				kb = this.fk(b, tool);
			J[0][j] = (kb.T.x - ka.T.x) / (2 * h);
			J[1][j] = (kb.T.y - ka.T.y) / (2 * h);
			J[2][j] = 1; // the tool angle is q1 + q2 + q3 (in the arm plane)
		}
		// solve J·dq = [vx, vy, 0] (3×3, Cramer)
		const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
		const D = det(J);
		if (Math.abs(D) < 1e-9) return [0, 0, 0];
		const rhs = [v.x, v.y, 0];
		const out: [number, number, number] = [0, 0, 0];
		for (let j = 0; j < 3; j++) {
			const M = J.map((row, i) => row.map((x, k) => (k === j ? rhs[i] : x)));
			out[j] = det(M) / D;
		}
		return out;
	}
}

/** distance between segments ab and cd (0 when they cross) */
export function segDist(a: Pt, b: Pt, c: Pt, d: Pt) {
	const r = (p: Pt, q: Pt, s: Pt) => {
		const vx = q.x - p.x,
			vy = q.y - p.y,
			l = vx * vx + vy * vy || 1e-9;
		let t = ((s.x - p.x) * vx + (s.y - p.y) * vy) / l;
		t = t < 0 ? 0 : t > 1 ? 1 : t;
		return Math.hypot(p.x + vx * t - s.x, p.y + vy * t - s.y);
	};
	const cross = (p: Pt, q: Pt, s: Pt) => (q.x - p.x) * (s.y - p.y) - (q.y - p.y) * (s.x - p.x);
	const d1 = cross(a, b, c),
		d2 = cross(a, b, d),
		d3 = cross(c, d, a),
		d4 = cross(c, d, b);
	if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
	return Math.min(r(a, b, c), r(a, b, d), r(c, d, a), r(c, d, b));
}
