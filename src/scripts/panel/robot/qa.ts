/**
 * Robot QA: the real simulation (the drawn, flexed joints, 120 Hz) stepped over the
 * whole program (Contact: through its finale), and the drawn shapes tested, as convex polygons from the same geometry the
 * renderer draws (draw.ts armPieces):
 *
 *   peer      every piece of one arm against every piece of the other, fingers at their opening, tools at full width:
 *             clearance ≥ 2 units
 *   self      the tool, flange and wrist against the arm's own upper arm, shoulder, pedestal and foot: ≥ 0.5
 *   world     nothing below the bench line; nothing in the tab's solid parts (a tool's tip may enter only its port's
 *             pocket or bore); the breaker toggle (except the fingertips that push it); the -X4 body (except the needle
 *             in its socket); the racks and the tools resting in them (except the arm's own docking); ≥ 1 unit under
 *             the H duct
 *   cable     no lead node inside any arm's palm, flange, plate, wrist link or wrist joint (the held wire runs between
 *             the fingers only); the clearance between the leads and the tools of the arm that does not hold them
 *   contacts  at each contact event the drawn tool centre point (docking: the flange, and its angle) on its target:
 *             ≤ 0.3 units (0.2, 0.5°)
 *   motion    commanded joint speed and acceleration within the limits (1 ms samples), tool roll speed, the tool centre
 *             point's speed in 3D within SPEED.tcp (joint moves) / its lin speed; the drawn tool within 0.6 units of the
 *             commanded one; drawn joints within their limits; zero IK clamps
 *
 * runQa returns the measurements and the list of violations (empty = pass). The build fails on a violation
 * (Compartment.astro), and __panel.qa(n) runs it on the live layout.
 */
import { DEV, CAGE, SOCKET_Y, TAB, TOGGLE, inputs as devInputs, ports as devPorts, toggleLean, togglePivot } from '../devices';
import { Sim } from '../sim';
import type { Compiled } from '../program';
import { DEG, LIM, SPEED, TOOLS, type Pt, type Q } from './kin';
import { RACK_X, SLOT, armPieces, dockedPieces, rackPieces, unitRobots, x4Pieces, X4_SOCKET_DEPTH, type Piece, type Poly } from './draw';
import type { Rig } from './rig';

/* ------------------------------------------------------------------ convex geometry */
interface Box {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}
const bbox = (p: Poly): Box => {
	let x0 = Infinity,
		y0 = Infinity,
		x1 = -Infinity,
		y1 = -Infinity;
	for (const v of p) {
		if (v.x < x0) x0 = v.x;
		if (v.x > x1) x1 = v.x;
		if (v.y < y0) y0 = v.y;
		if (v.y > y1) y1 = v.y;
	}
	return { x0, y0, x1, y1 };
};
const boxGap = (a: Box, b: Box) => Math.max(b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1);
/** separation of two convex polygons along the best separating axis (≤ the true distance); negative = overlap depth */
export function sepConvex(A: Poly, B: Poly) {
	let best = -Infinity;
	for (const poly of [A, B]) {
		for (let i = 0; i < poly.length; i++) {
			const p = poly[i],
				q = poly[(i + 1) % poly.length];
			let nx = -(q.y - p.y),
				ny = q.x - p.x;
			const l = Math.hypot(nx, ny);
			if (l < 1e-9) continue;
			nx /= l;
			ny /= l;
			let a0 = Infinity,
				a1 = -Infinity,
				b0 = Infinity,
				b1 = -Infinity;
			for (const v of A) {
				const d = v.x * nx + v.y * ny;
				if (d < a0) a0 = d;
				if (d > a1) a1 = d;
			}
			for (const v of B) {
				const d = v.x * nx + v.y * ny;
				if (d < b0) b0 = d;
				if (d > b1) b1 = d;
			}
			const gap = Math.max(b0 - a1, a0 - b1);
			if (gap > best) best = gap;
		}
	}
	return best;
}
function inConvex(p: Pt, poly: Poly) {
	let sign = 0;
	for (let i = 0; i < poly.length; i++) {
		const a = poly[i],
			b = poly[(i + 1) % poly.length];
		const c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
		if (Math.abs(c) < 1e-12) continue;
		const s = c > 0 ? 1 : -1;
		if (!sign) sign = s;
		else if (s !== sign) return false;
	}
	return true;
}
const rectP = (x0: number, y0: number, x1: number, y1: number): Poly => [
	{ x: x0, y: y0 },
	{ x: x1, y: y0 },
	{ x: x1, y: y1 },
	{ x: x0, y: y1 },
];
function segPt(p: Pt, a: Pt, b: Pt) {
	const vx = b.x - a.x,
		vy = b.y - a.y,
		l = vx * vx + vy * vy || 1e-12;
	let u = ((p.x - a.x) * vx + (p.y - a.y) * vy) / l;
	u = u < 0 ? 0 : u > 1 ? 1 : u;
	return Math.hypot(a.x + vx * u - p.x, a.y + vy * u - p.y);
}
/** distance from a polyline's points to a convex polygon (0 if inside): the minimum over the polygon's edges */
function polyDist(p: Pt, poly: Poly) {
	if (inConvex(p, poly)) return 0;
	let d = Infinity;
	for (let i = 0; i < poly.length; i++) d = Math.min(d, segPt(p, poly[i], poly[(i + 1) % poly.length]));
	return d;
}

/* ------------------------------------------------------------------ the world, in cell units */
interface World {
	tab: Poly[];
	ports: { x: number; hw: number; bottom: number }[];
	housing: Poly;
	ductY: number;
	racks: { id: 'L' | 'R'; p: Piece[] }[];
}
function world(B: Compiled): World {
	const D = DEV[B.cfg.dev],
		cx = D.w / 2,
		hw = D.tabW / 2;
	// the tab's channels: mouths (8 wide, 7 deep), ports (screw pocket ±3.6 to −3.5, cage slot ±1.8 to −2.5, socket ±1.1)
	const ch: { x0: number; x1: number; bottom: number }[] = [];
	for (const s of [-1, 1]) ch.push({ x0: s * D.mouth - TAB.mw / 2, x1: s * D.mouth + TAB.mw / 2, bottom: -TAB.h + TAB.md });
	const ports: World['ports'] = [];
	if (D.tp !== 'none') {
		const pw = D.tp === 'screw' ? 3.6 : D.tp === 'cage' ? 1.8 : 1.1;
		const pb = D.tp === 'screw' ? -3.5 : D.tp === 'cage' ? -2.5 : SOCKET_Y;
		for (const x of devPorts(B.cfg.dev, B.cfg.dir)) {
			ch.push({ x0: x - cx - pw, x1: x - cx + pw, bottom: pb });
			ports.push({ x: x - cx, hw: pw, bottom: pb });
		}
		for (const x of devInputs(B.cfg.dev, B.cfg.dir)) {
			ch.push({ x0: x - cx - 1.1, x1: x - cx + 1.1, bottom: SOCKET_Y });
			ports.push({ x: x - cx, hw: 1.1, bottom: SOCKET_Y });
		}
	}
	ch.sort((a, b) => a.x0 - b.x0);
	const tab: Poly[] = [];
	let x = -hw;
	for (const c of ch) {
		if (c.x0 > x) tab.push(rectP(x, -TAB.h, c.x0, 0));
		tab.push(rectP(c.x0, c.bottom, c.x1, 0));
		x = Math.max(x, c.x1);
	}
	if (x < hw) tab.push(rectP(x, -TAB.h, hw, 0));
	return {
		tab,
		ports,
		housing: rectP(-D.w / 2, 0, D.w / 2, D.h),
		ductY: -(B.G.floor - B.G.ductBot) / B.G.sc,
		racks: [
			{ id: 'L', p: rackPieces(-RACK_X) },
			{ id: 'R', p: rackPieces(RACK_X) },
		],
	};
}

export interface QaReport {
	n: number;
	ok: boolean;
	violations: string[];
	samples: number;
	tEnd: number;
	minPeer: number;
	peerAt: number;
	peerPair: string;
	minSelf: number;
	minDuct: number;
	minRack: number;
	minWorld: number;
	maxBelowBench: number;
	cableInArm: number;
	cableInLinks: number;
	minToolCable: number;
	/** the held wire's direction against the tool axis at the jaws: |cos| (≤ 0.5: ≥ 60° across) */
	maxGripCos: number;
	contacts: { id: string; k: string; t: number; err: number }[];
	maxContactErr: number;
	maxFlex: number;
	maxJointSpeed: number[];
	maxJointAcc: number[];
	maxSpeedRatio: number;
	maxAccRatio: number;
	maxTcp: number;
	maxTcpRatio: number;
	clamps: string[];
	limits: number;
	ikErrMax: number;
	/** the feeder rule (vignettes): the lead's simulated copper front, the most it travels in 1/60 s of program time (units) */
	maxFeed: number;
}

/** the robot QA of one compiled program (tEnd: the program end; Contact runs on through its finale) */
export function runQa(B: Compiled, tEnd: number, o: { strict?: boolean; maxViolations?: number } = {}): QaReport {
	const rig = B.rig as unknown as Rig;
	// a solo cell (vignettes): the partner arm and its rack are not drawn and never move; they constrain nothing
	const IDS = rig.ids;
	const G = B.G,
		sc = G.sc;
	const tAll = B.cfg.finale && B.finaleEnd > 0 ? B.finaleEnd : tEnd;
	const W = world(B);
	const U = unitRobots();
	const toU = (x: number, y: number): Pt => ({ x: (x - G.cx) / sc, y: (y - G.floor) / sc });
	const cw = G.T.cable / sc;
	const R: QaReport = {
		n: B.cfg.n,
		ok: true,
		violations: [],
		samples: 0,
		tEnd: tAll,
		minPeer: Infinity,
		peerAt: -1,
		peerPair: '',
		minSelf: Infinity,
		minDuct: Infinity,
		minRack: Infinity,
		minWorld: Infinity,
		maxBelowBench: -Infinity,
		cableInArm: 0,
		cableInLinks: 0,
		minToolCable: Infinity,
		maxGripCos: 0,
		contacts: [],
		maxContactErr: 0,
		maxFlex: 0,
		maxJointSpeed: [0, 0, 0, 0],
		maxJointAcc: [0, 0, 0, 0],
		maxSpeedRatio: 0,
		maxAccRatio: 0,
		maxTcp: 0,
		maxTcpRatio: 0,
		clamps: [...rig.L.log, ...rig.R.log],
		limits: 0,
		ikErrMax: 0,
		maxFeed: 0,
	};
	const maxV = o.maxViolations ?? 40;
	const seen = new Set<string>();
	const bad = (key: string, msg: string) => {
		R.ok = false;
		if (seen.has(key) || R.violations.length >= maxV) return;
		seen.add(key);
		R.violations.push(msg);
	};
	const ms = (t: number) => Math.round(t * 1000);
	for (const c of R.clamps) bad('clamp' + c, `IK clamp: ${c}`);

	/* ---------------- 1. commanded motion: joint speed and acceleration, roll, tool centre point (1 ms) */
	const dt = 0.001;
	for (const id of IDS) {
		const tr = rig.track(id);
		// a protective stop brakes harder than the normal limits allow (its last 20 ms): exempt from the acceleration check
		const stops = tr.segs.filter((g) => g.k === 'lin' && (g as { prof?: string }).prof === 'stop').map((g) => g.t1);
		const braking = (t: number) => stops.some((t1) => t > t1 - 0.035 && t < t1 + 0.012);
		let q0 = tr.qAt(0),
			q1 = tr.qAt(dt);
		let v0 = [0, 0, 0, 0];
		let rl0 = tr.roll.at(0);
		for (let t = dt; t <= tAll + 1e-9; t += dt) {
			const q2 = tr.qAt(t + dt);
			const tool = tr.toolAt(t);
			for (let j = 0; j < 4; j++) {
				const v = (q2[j] - q0[j]) / (2 * dt);
				const a = (q2[j] - 2 * q1[j] + q0[j]) / (dt * dt);
				R.maxJointSpeed[j] = Math.max(R.maxJointSpeed[j], Math.abs(v));
				R.maxJointAcc[j] = Math.max(R.maxJointAcc[j], Math.abs(a));
				const rv = Math.abs(v) / SPEED.w[j],
					ra = Math.abs(a) / SPEED.a[j];
				if (rv > R.maxSpeedRatio) R.maxSpeedRatio = rv;
				if (ra > R.maxAccRatio && !braking(t)) R.maxAccRatio = ra;
				if (rv > 1.03) bad(`v${id}${j}`, `${id} J${[2, 3, 4, 1][j]} speed ${Math.abs(v).toFixed(2)} rad/s > ${SPEED.w[j]} at ${ms(t)} ms`);
				if (ra > 1.12 && !braking(t)) bad(`a${id}${j}`, `${id} J${[2, 3, 4, 1][j]} acceleration ${Math.abs(a).toFixed(0)} rad/s² > ${SPEED.a[j]} at ${ms(t)} ms`);
				v0[j] = v;
			}
			const rl = tr.roll.at(t);
			if (Math.abs(rl - rl0) / dt > SPEED.roll * 1.03) bad(`roll${id}`, `${id} roll speed ${(Math.abs(rl - rl0) / dt).toFixed(2)} rad/s at ${ms(t)} ms`);
			rl0 = rl;
			if (tool === tr.toolAt(t + dt) && tool === tr.toolAt(t - dt)) {
				const a3 = tr.r.tcp3(q0, tool),
					b3 = tr.r.tcp3(q2, tool);
				const vt = Math.hypot(b3.x - a3.x, b3.y - a3.y, b3.z - a3.z) / (2 * dt) / sc;
				R.maxTcp = Math.max(R.maxTcp, vt);
				const rt = vt / SPEED.tcp;
				R.maxTcpRatio = Math.max(R.maxTcpRatio, rt);
				if (rt > 1.05) bad(`tcp${id}`, `${id} tool centre point ${vt.toFixed(0)} units/s > ${SPEED.tcp} at ${ms(t)} ms`);
			}
			const tg = tr.linTarget(t);
			if (tg) {
				const kk = tr.r.fk(q1, tg.tool);
				R.ikErrMax = Math.max(R.ikErrMax, Math.hypot(kk.T.x - tg.P.x, kk.T.y - tg.P.y));
			}
			q0 = q1;
			q1 = q2;
		}
		void v0;
	}
	if (R.ikErrMax > 1e-6) bad('ikerr', `IK error ${R.ikErrMax.toExponential(2)} px on a Cartesian move`);

	/* ---------------- 2. the simulation: drawn shapes */
	const sim = new Sim(B);
	const nSteps = Math.round(tAll * 120) + 1;
	const evs = IDS.flatMap((id) => rig.track(id).ev.map((e) => ({ id, e })));
	const evDone = new Set<number>();
	const D = DEV[B.cfg.dev];
	const x4 = B.x4;
	const x4solid: Poly[] = x4
		? (() => {
				const face = x4.x + x4.side * x4.w,
					deep = face - x4.side * X4_SOCKET_DEPTH;
				const xa = Math.min(face, deep),
					xb = Math.max(face, deep);
				return [
					rectP(x4.x - x4.w, x4.top, x4.x + x4.w, x4.sy - 1),
					rectP(x4.x - x4.w, x4.sy + 1, x4.x + x4.w, x4.top + x4.h),
					x4.side < 0 ? rectP(xb, x4.sy - 1, x4.x + x4.w, x4.sy + 1) : rectP(x4.x - x4.w, x4.sy - 1, xa, x4.sy + 1),
				];
			})()
		: [];
	void x4Pieces;
	// the feeder rule: the lead's front never moves more than 10 units per 1/60 s of program time
	const fh: number[] = [];
	for (let i = 0; i < nSteps; i++) {
		if (i > 0) sim.step();
		const t = sim.t;
		R.samples++;
		if (!B.cfg.finale && B.cable.arrive) {
			fh.push(sim.fr.x);
			if (fh.length > 2) {
				const d = Math.abs(fh[fh.length - 1] - fh[fh.length - 3]) / sc;
				R.maxFeed = Math.max(R.maxFeed, d);
				if (d > 10.05) bad('feed', `the lead's front ${d.toFixed(1)} units in 1/60 s at ${ms(t)} ms (feeder rule: ≤ 10)`);
			}
		}
		const view = rig.view(sim.rig) as { L: Q; R: Q };
		const arms: Record<'L' | 'R', { pcs: (Piece & { b: Box })[]; tool: string }> = { L: { pcs: [], tool: '' }, R: { pcs: [], tool: '' } };
		for (const id of IDS) {
			const tr = rig.track(id),
				tool = tr.toolAt(t);
			const q = view[id];
			const st = rig.toolSt(id, t, q);
			const a = armPieces(U[id], q, tool, st);
			arms[id] = { pcs: a.pcs.map((p) => ({ ...p, b: bbox(p.p) })), tool };
			// drawn joint limits
			if (q[0] < LIM.q1[0] - 1e-6 || q[0] > LIM.q1[1] + 1e-6 || q[1] < LIM.q2[0] - 1e-6 || q[1] > LIM.q2[1] + 1e-6 || Math.abs(q[2]) > LIM.q3[1]) {
				R.limits++;
				bad(`lim${id}`, `${id} drawn joint limit at ${ms(t)} ms`);
			}
			// flex: the drawn tool centre point vs the commanded one
			const kc = U[id].fk(tr.qAt(t), tool);
			const fx = Math.hypot(a.k.T.x - kc.T.x, a.k.T.y - kc.T.y);
			if (fx > R.maxFlex) R.maxFlex = fx;
			if (fx > 0.62) bad(`flex${id}`, `${id} drawn tool ${fx.toFixed(2)} units off its commanded pose at ${ms(t)} ms`);
		}
		const contactW = { L: rig.L.inContact(t), R: rig.R.inContact(t) };
		// peer (two drawn arms only)
		if (IDS.length === 2) for (const a of arms.L.pcs) {
			if (a.kind === 'base') continue;
			for (const b of arms.R.pcs) {
				if (b.kind === 'base') continue;
				const bg = boxGap(a.b, b.b);
				if (bg > 2.5) {
					if (bg < R.minPeer) {
						R.minPeer = bg;
						R.peerAt = t;
						R.peerPair = `${a.n}/${b.n}`;
					}
					continue;
				}
				const d = sepConvex(a.p, b.p);
				if (d < R.minPeer) {
					R.minPeer = d;
					R.peerAt = t;
					R.peerPair = `${a.n}/${b.n}`;
				}
				if (d < 2) bad(`peer${a.n}${b.n}`, `peer clearance ${d.toFixed(2)} units (L ${a.n} / R ${b.n}) at ${ms(t)} ms`);
			}
		}
		for (const id of IDS) {
			const pcs = arms[id].pcs;
			// self-collisions are about the arm's own plane: tested unprojected (a turned arm overlaps itself on screen only)
			const q = view[id];
			const own = Math.abs(q[3]) > 1e-4 ? armPieces(U[id], [q[0], q[1], q[2], 0], rig.track(id).toolAt(t), rig.toolSt(id, t, q)).pcs.map((p) => ({ ...p, b: bbox(p.p) })) : pcs;
			const by = (n: string) => own.find((p) => p.n === n)!;
			// self: tool parts, flange, wrist against the upper arm, the shoulder, the pedestal and the foot
			for (const p of own) {
				if (!['plate', 'body', 'finger', 'tip', 'flange'].includes(p.kind) && p.n !== 'wrist' && p.n !== 'capW') continue;
				for (const sn of ['upper', 'capS', 'ped', 'foot']) {
					const s = by(sn);
					if (boxGap(p.b, s.b) > 1) continue;
					const d = sepConvex(p.p, s.p);
					R.minSelf = Math.min(R.minSelf, d);
					if (d < 0.5) bad(`self${id}${p.n}${sn}`, `${id} ${p.n} against its own ${sn}: ${d.toFixed(2)} at ${ms(t)} ms`);
				}
			}
			// the forearm and elbow against the pedestal
			for (const pn of ['fore', 'capE']) {
				const p = by(pn);
				for (const sn of ['ped', 'foot']) {
					const d = sepConvex(p.p, by(sn).p);
					if (d < 0) bad(`self${id}${pn}${sn}`, `${id} ${pn} into its own ${sn} at ${ms(t)} ms`);
				}
			}
			for (const p of pcs) {
				if (p.kind === 'base') continue;
				// the bench and the duct
				R.maxBelowBench = Math.max(R.maxBelowBench, p.b.y1);
				if (p.b.y1 > 0.01) bad(`bench${id}${p.n}`, `${id} ${p.n} below the bench (${p.b.y1.toFixed(2)}) at ${ms(t)} ms`);
				const dd = p.b.y0 - W.ductY;
				R.minDuct = Math.min(R.minDuct, dd);
				if (dd < 1) bad(`duct${id}${p.n}`, `${id} ${p.n} ${dd.toFixed(2)} units under the duct at ${ms(t)} ms`);
				// the tab's solid parts (a tool's tip only into its port's channel)
				for (const s of W.tab) {
					const sb = bbox(s);
					if (boxGap(p.b, sb) > 0.6) continue;
					const d = sepConvex(p.p, s);
					R.minWorld = Math.min(R.minWorld, d);
					if (d < (p.kind === 'tip' ? -0.02 : 0.3)) bad(`tab${id}${p.n}`, `${id} ${p.n} into the head tab (${d.toFixed(2)}) at ${ms(t)} ms`);
				}
				// the breaker toggle
				if (D.toggle != null && !(p.kind === 'finger' && contactW[id] > 0)) {
					const th = toggleLean(B.cfg.dir, B.dev.act.at(t)),
						px = togglePivot(B.cfg.dev, B.cfg.dir) - D.w / 2;
					const k = { x: px + Math.sin(th) * TOGGLE.len, y: -TAB.h - Math.cos(th) * TOGGLE.len };
					const lev = [
						{ x: px - 1.3 * Math.cos(th), y: -TAB.h - 1.3 * Math.sin(th) },
						{ x: px + 1.3 * Math.cos(th), y: -TAB.h + 1.3 * Math.sin(th) },
						{ x: k.x + 1.3 * Math.cos(th), y: k.y + 1.3 * Math.sin(th) },
						{ x: k.x - 1.3 * Math.cos(th), y: k.y - 1.3 * Math.sin(th) },
					];
					const knob = rectP(k.x - TOGGLE.knob, k.y - TOGGLE.knob, k.x + TOGGLE.knob, k.y + TOGGLE.knob);
					for (const s of [lev, knob]) {
						const d = sepConvex(p.p, s);
						if (d < 0.3) bad(`tgl${id}${p.n}`, `${id} ${p.n} into the breaker toggle (${d.toFixed(2)}) at ${ms(t)} ms`);
					}
				}
				// -X4
				for (const s of x4solid) {
					if (p.kind === 'tip' && contactW[id] > 0) continue;
					const d = sepConvex(p.p, s);
					if (d < (p.kind === 'tip' ? -0.02 : 0.3)) bad(`x4${id}${p.n}`, `${id} ${p.n} into -X4 (${d.toFixed(2)}) at ${ms(t)} ms`);
				}
				// racks and the tools in them (except the arm's own docking and coupling)
				for (const rk of W.racks.filter((r) => IDS.includes(r.id))) {
					const own = rk.id === id && contactW[id] > 0;
					const tools: Piece[] = [];
					for (let k = 0; k < 2; k++) {
						const tl = rig.rackAt(rk.id, k, t);
						if (tl) tools.push(...dockedPieces(SLOT[rk.id][k], tl));
					}
					for (const s of [...rk.p, ...tools]) {
						if (own && (s.n.startsWith('rack-') && s.n !== 'rack-foot' && s.n !== 'rack-post')) continue;
						const sb = bbox(s.p);
						if (boxGap(p.b, sb) > 1) continue;
						const d = sepConvex(p.p, s.p);
						R.minRack = Math.min(R.minRack, d);
						if (d < 0.4) bad(`rack${id}${p.n}${s.n}`, `${id} ${p.n} against ${rk.id} ${s.n} (${d.toFixed(2)}) at ${ms(t)} ms`);
					}
				}
			}
		}
		// the leads against the arms
		const leads: Pt[][] = [];
		const a0 = B.cable.arrive;
		if (sim.ropeOn && !sim.laid) {
			const L: Pt[] = [];
			for (let j = 0; j < sim.rope.n; j++) L.push(toU(sim.rope.x[2 * j], sim.rope.x[2 * j + 1]));
			leads.push(L);
		} else if (sim.laid) leads.push(sim.laid.pts.map((p) => toU(p.x, p.y)));
		else if (a0 && sim.fr.x > a0.sA) leads.push([toU(a0.A.x, a0.A.y), toU(a0.A.x, a0.A.y + Math.min(sim.fr.x - a0.sA - G.CU, G.mouthY - a0.A.y))]);
		if (sim.oOn && !sim.oLaid) {
			const L: Pt[] = [];
			for (let j = 0; j < sim.orope.n; j++) L.push(toU(sim.orope.x[2 * j], sim.orope.x[2 * j + 1]));
			leads.push(L);
		} else if (sim.oLaid) leads.push([toU(G.outX, G.mouthY), toU(G.outX, G.ductBot)]);
		for (const L of leads) {
			let dense: Pt[] = [];
			for (let j = 0; j < L.length - 1; j++) for (let k = 0; k < 4; k++) dense.push({ x: L[j].x + ((L[j + 1].x - L[j].x) * k) / 4, y: L[j].y + ((L[j + 1].y - L[j].y) * k) / 4 });
			dense.push(L[L.length - 1]);
			// inside -X4 the lead runs through the terminal's body (hidden; its test socket reaches the clamp bar on it)
			if (x4) dense = dense.filter((v) => !(v.x > x4.x - x4.w && v.x < x4.x + x4.w && v.y > x4.top && v.y < x4.top + x4.h));
			const lb = bbox(dense);
			for (const id of IDS) {
				const holding = rig.holding(id, t) > 0;
				// jaws rolled across the screen: the fingers pass in front of and behind a wire, never through it
				const across = Math.abs(Math.sin(rig.track(id).roll.at(t))) > 0.9 && arms[id].tool === 'gripper';
				for (const p of arms[id].pcs) {
					if (boxGap(p.b, lb) > 4) continue;
					if (p.kind === 'finger' && across) continue;
					const solid = ['plate', 'body', 'flange'].includes(p.kind) || p.n === 'wrist' || p.n === 'capW';
					const link = p.n === 'upper' || p.n === 'fore' || p.n === 'capE' || p.n === 'capS';
					let inside = 0,
						near = Infinity;
					for (const v of dense) {
						if (inConvex(v, p.p)) inside++;
						else if (!holding && (p.kind === 'tip' || p.kind === 'body' || p.kind === 'finger')) near = Math.min(near, polyDist(v, p.p));
					}
					if (solid && inside) {
						R.cableInArm += inside;
						bad(`cab${id}${p.n}`, `a lead through ${id}'s ${p.n} (${inside} points) at ${ms(t)} ms`);
					}
					if (link && inside) R.cableInLinks += inside;
					if (!holding && (p.kind === 'tip' || p.kind === 'body' || p.kind === 'finger')) {
						if (inside) near = 0;
						const c = near - cw / 2;
						R.minToolCable = Math.min(R.minToolCable, c);
						// (a gripper rolled across may touch a wire with its palm, between its fingers: it does as it takes one)
						if (c < (across && p.kind === 'body' ? -0.6 : 0.3)) bad(`tc${id}${p.n}`, `${id}'s ${p.n} ${c.toFixed(2)} units from a lead at ${ms(t)} ms`);
					}
					void inside;
				}
			}
		}
		// a held wire crosses the jaws (≥ 60° from the tool axis), it never runs along the tool
		for (const id of IDS) {
			if (!(rig.holding(id, t) > 0) || arms[id].tool !== 'gripper') continue;
			const k = U[id].fk(view[id], 'gripper');
			const ax = { x: k.c * Math.cos(k.la3), y: Math.sin(k.la3) };
			const al = Math.hypot(ax.x, ax.y) || 1;
			let best = Infinity,
				dir = { x: 0, y: 1 };
			for (const L of leads)
				for (let j = 0; j < L.length - 1; j++) {
					const d = segPt(k.T, L[j], L[j + 1]);
					if (d < best) {
						best = d;
						dir = { x: L[j + 1].x - L[j].x, y: L[j + 1].y - L[j].y };
					}
				}
			if (best < 3) {
				const c = Math.abs(ax.x * dir.x + ax.y * dir.y) / (al * (Math.hypot(dir.x, dir.y) || 1));
				R.maxGripCos = Math.max(R.maxGripCos, c);
				if (c > 0.5) bad(`along${id}`, `the lead held by ${id} runs ${((Math.acos(Math.min(1, c)) * 180) / Math.PI).toFixed(0)}° from the tool axis at ${ms(t)} ms`);
			}
		}
		// contact events at this step
		for (let e = 0; e < evs.length; e++) {
			if (evDone.has(e)) continue;
			const { id, e: ev } = evs[e];
			if (ev.t > t + 0.5 / 120) continue;
			evDone.add(e);
			const k = U[id].fk(view[id], ev.tool === 'none' ? rig.track(id).toolAt(t) : ev.tool);
			const P = toU(ev.P.x, ev.P.y);
			const at = ev.flange ? k.F : k.T;
			const err = Math.hypot(at.x - P.x, at.y - P.y);
			R.contacts.push({ id, k: ev.k, t: ms(ev.t), err: +err.toFixed(3) });
			R.maxContactErr = Math.max(R.maxContactErr, err);
			const tol = ev.flange ? 0.2 : 0.3;
			if (err > tol) bad(`ev${e}`, `${id} ${ev.k} at ${ms(ev.t)} ms: drawn ${ev.flange ? 'flange' : 'tool'} ${err.toFixed(2)} units off target`);
			if (ev.flange && ev.phi != null) {
				const da = Math.abs(Math.atan2(Math.sin(k.la3 - ev.phi), Math.cos(k.la3 - ev.phi)));
				if (da > 0.5 * DEG) bad(`eva${e}`, `${id} ${ev.k} at ${ms(ev.t)} ms: flange ${(da / DEG).toFixed(2)}° off`);
			}
		}
	}
	void TOOLS;
	void CAGE;
	const r2 = (v: number) => +v.toFixed(2);
	return {
		...R,
		minPeer: r2(R.minPeer),
		minSelf: r2(R.minSelf),
		minDuct: r2(R.minDuct),
		minRack: r2(R.minRack),
		minWorld: r2(R.minWorld),
		maxBelowBench: r2(R.maxBelowBench),
		minToolCable: r2(R.minToolCable),
		maxContactErr: +R.maxContactErr.toFixed(3),
		maxFlex: +R.maxFlex.toFixed(3),
		maxJointSpeed: R.maxJointSpeed.map(r2),
		maxJointAcc: R.maxJointAcc.map((v) => Math.round(v)),
		maxSpeedRatio: r2(R.maxSpeedRatio),
		maxAccRatio: r2(R.maxAccRatio),
		maxTcp: Math.round(R.maxTcp),
		maxTcpRatio: r2(R.maxTcpRatio),
		maxFeed: r2(R.maxFeed),
	};
}
