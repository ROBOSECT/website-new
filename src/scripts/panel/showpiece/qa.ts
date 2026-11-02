/**
 * The showpiece's robot QA, run at build time (robot/buildqa.ts assertShowpiece: the build fails
 * on any violation). The site's rules (robot/qa.ts), on this scene: the drawn, flexed shapes (draw.ts
 * armPieces) sampled at 120 Hz over the film (the robots build the form) and every RESET it offers:
 *
 *   motion    commanded joint speed and acceleration (1 ms samples), roll speed, the tool centre point within SPEED.tcp;
 *             zero IK clamps; drawn joints within their limits; the drawn tool within 0.6 u of the commanded one
 *   peer      arm–arm ≥ 2 u (fingers at their opening, tools at full width)
 *   self      tool, flange, wrist against the arm's own upper arm, shoulder, pedestal, foot ≥ 0.5 u
 *   world     nothing below the bench; nothing inside a device tab but a tip in its own channel (mouth, pocket, slot, bore);
 *             the breaker toggle (except the fingertips that push it); the racks and their docked tools (except the arm's
 *             own docking) ≥ 0.4 u; tools, flange and wrist ≥ 1 u under the duct; everything inside the stage's viewBox
 *   W07       never through a palm, flange, plate or wrist; ≥ 1 u from every tool that does not hold it (the held wire runs
 *             between the fingers); its length constant within ±1 % in every state; the curl never returns after the comb
 *   contacts  every grip, seat, screw and cage engagement, knob push and probe touch: the drawn tool centre point on its
 *             target ≤ 0.3 u (docking: the flange ≤ 0.2 u, 0.5°)
 *   timeline  READY in 24–32 s; every hit on the 0.3 s grid; four tool changes, no click within 0.6 s of the other arm's hero
 *             hit; the hero beats' lengths; 2½ clockwise turns, the head sinks 1.25 u, the clamp closes at 55 %
 */
import { SCREW, SOCKET_Y, TAB, TOGGLE, screwTop } from '../devices';
import { ArmTrack } from '../robot/arm';
import { DEG, LIM, SPEED, type Pt, type Q } from '../robot/kin';
import { BAR_TOP, PLATE as TPLATE, armPieces, type Piece, type Poly } from '../robot/draw';
import { sepConvex } from '../robot/qa';
import { CAGE_D0, CAGE_PUSH, DUCT, F7, G, LD, REL_TILT, VB, X0, rack3, relAt } from './scene';
import {
	filmSrc,
	flexAt,
	flexSteps,
	rackOf,
	resetBranch,
	resetCandidates,
	resetFlex,
	resetToolSt,
	restQ,
	toolSt,
	type FlexTable,
	type Id,
	type ResetSrc,
	type Show,
} from './program';
import { dropA, dropB, heldB, lenOf, springBack } from './wire';

const rectP = (x0: number, y0: number, x1: number, y1: number): Poly => [
	{ x: x0, y: y0 },
	{ x: x1, y: y0 },
	{ x: x1, y: y1 },
	{ x: x0, y: y1 },
];
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
function segPt(p: Pt, a: Pt, b: Pt) {
	const vx = b.x - a.x,
		vy = b.y - a.y,
		l = vx * vx + vy * vy || 1e-12;
	let u = ((p.x - a.x) * vx + (p.y - a.y) * vy) / l;
	u = u < 0 ? 0 : u > 1 ? 1 : u;
	return Math.hypot(a.x + vx * u - p.x, a.y + vy * u - p.y);
}
function polyDist(p: Pt, poly: Poly) {
	if (inConvex(p, poly)) return 0;
	let d = Infinity;
	for (let i = 0; i < poly.length; i++) d = Math.min(d, segPt(p, poly[i], poly[(i + 1) % poly.length]));
	return d;
}

/* ------------------------------------------------------------------ the world (units) */
/** a tab's solid parts between its channels (each channel: x0, x1 and the depth a tip may reach) */
function tabSolids(x0: number, x1: number, ch: { x0: number; x1: number; bottom: number }[]): Poly[] {
	ch.sort((a, b) => a.x0 - b.x0);
	const out: Poly[] = [];
	let x = x0;
	for (const c of ch) {
		if (c.x0 > x) out.push(rectP(x, -TAB.h, c.x0, 0));
		out.push(rectP(c.x0, c.bottom, c.x1, 0));
		x = Math.max(x, c.x1);
	}
	if (x < x1) out.push(rectP(x, -TAB.h, x1, 0));
	return out;
}
const mouth = (x: number) => ({ x0: x - TAB.mw / 2, x1: x + TAB.mw / 2, bottom: -TAB.h + TAB.md });
const TABS: Poly[] = [
	...tabSolids(F7.x0, F7.x0 + F7.w, [mouth(F7.m1), mouth(F7.m2), { x0: F7.s1 - 3.6, x1: F7.s1 + 3.6, bottom: -3.5 }, { x0: F7.s2 - 3.6, x1: F7.s2 + 3.6, bottom: -3.5 }]),
	// −X0's showpiece tab: mouth 7, the release slot (angled 20°: its channel spans the slot's projection), T7's bore
	...tabSolids(X0.tab0, X0.tab1, [mouth(X0.m7), { x0: X0.rel - 9.5 * Math.sin(REL_TILT) - 1.8, x1: X0.rel + 1.8, bottom: -TAB.h + 9.5 * Math.cos(REL_TILT) }, { x0: X0.t7 - 1.1, x1: X0.t7 + 1.1, bottom: SOCKET_Y }]),
];
/** the three-slot racks and the tools resting in them (scene.ts rack3: the drawing's own geometry) */
function rackPieces3(id: Id): Piece[] {
	const r = rack3(id);
	const out: Piece[] = [
		{ n: 'rack-foot', kind: 'rack', p: rectP(r.foot[0], -4, r.foot[1], 0) },
		{ n: 'rack-post', kind: 'rack', p: rectP(r.post - 2, BAR_TOP, r.post + 2, -4) },
	];
	r.bars.forEach(([x0, x1], i) => out.push({ n: `rack-bar${i}`, kind: 'rack', p: rectP(x0, BAR_TOP, x1, BAR_TOP + 4) }));
	return out;
}
const LEN = { gripper: 20, probe: 27.5, camera: 14.5, driver: 29.5, opener: 24.5, none: 0 } as const;
const WID = { gripper: 6, probe: 3.6, camera: 6, driver: 4, opener: 6.2, none: 0 } as const;
function docked(x: number, tool: keyof typeof LEN): Piece[] {
	if (tool === 'none') return [];
	return [
		{ n: `rack-${tool}-plate`, kind: 'rack', p: rectP(x - TPLATE.r, BAR_TOP - TPLATE.t, x + TPLATE.r, BAR_TOP) },
		{ n: `rack-${tool}`, kind: 'rack', p: rectP(x - WID[tool], BAR_TOP, x + WID[tool], BAR_TOP - TPLATE.t + LEN[tool]) },
	];
}
const toggleSolids = (act: number) => {
	const th = -TOGGLE.lean * (1 - 2 * act),
		px = F7.piv;
	const k = { x: px + Math.sin(th) * TOGGLE.len, y: -TAB.h - Math.cos(th) * TOGGLE.len };
	const lev = [
		{ x: px - 1.3 * Math.cos(th), y: -TAB.h - 1.3 * Math.sin(th) },
		{ x: px + 1.3 * Math.cos(th), y: -TAB.h + 1.3 * Math.sin(th) },
		{ x: k.x + 1.3 * Math.cos(th), y: k.y + 1.3 * Math.sin(th) },
		{ x: k.x - 1.3 * Math.cos(th), y: k.y - 1.3 * Math.sin(th) },
	];
	return [lev, rectP(k.x - TOGGLE.knob, k.y - TOGGLE.knob, k.x + TOGGLE.knob, k.y + TOGGLE.knob)];
};

export interface SpQa {
	ok: boolean;
	violations: string[];
	samples: number;
	tReady: number;
	minPeer: number;
	peerAt: number;
	minSelf: number;
	minTab: number;
	minRack: number;
	minDuct: number;
	minToolWire: number;
	maxContactErr: number;
	contacts: number;
	maxFlex: number;
	maxSpeedRatio: number;
	maxAccRatio: number;
	maxTcpRatio: number;
	clamps: number;
	limits: number;
	extents: { x0: number; x1: number; y0: number; y1: number };
	wireLen: { A: [number, number]; B: [number, number] };
	hitsOffGrid: number;
	changes: number;
	clickClash: string[];
	heroBeats: Record<string, number>;
	/** RESET: the film times it may start from (each passed this QA), how many were tried */
	resets: { safe: number[]; tried: number; longestGap: number; worst: string[] };
}

/** QA of a compiled film. flex: its table (compiled here if not given). branches: QA every Send branch and every RESET too */
export function runShowQa(S: Show, o: { flex?: FlexTable; branches?: boolean; maxViolations?: number } = {}): SpQa {
	const maxV = o.maxViolations ?? 30;
	const R: SpQa = {
		ok: true,
		violations: [],
		samples: 0,
		tReady: S.tReady,
		minPeer: Infinity,
		peerAt: -1,
		minSelf: Infinity,
		minTab: Infinity,
		minRack: Infinity,
		minDuct: Infinity,
		minToolWire: Infinity,
		maxContactErr: 0,
		contacts: 0,
		maxFlex: 0,
		maxSpeedRatio: 0,
		maxAccRatio: 0,
		maxTcpRatio: 0,
		clamps: S.L.tr.log.length + S.R.tr.log.length,
		limits: 0,
		extents: { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity },
		wireLen: { A: [Infinity, -Infinity], B: [Infinity, -Infinity] },
		hitsOffGrid: 0,
		changes: S.changes.length,
		clickClash: [],
		heroBeats: {},
		resets: { safe: [], tried: 0, longestGap: 0, worst: [] },
	};
	const seen = new Set<string>();
	/** a RESET candidate's QA collects its own violations (a failing candidate is not a build failure: it is not offered) */
	let vSink: ((key: string, msg: string) => void) | null = null;
	const bad = (key: string, msg: string) => {
		if (vSink) return vSink(key, msg);
		R.ok = false;
		if (seen.has(key) || R.violations.length >= maxV) return;
		seen.add(key);
		R.violations.push(msg);
	};
	const ms = (t: number) => Math.round(t * 1000);
	for (const c of [...S.L.tr.log, ...S.R.tr.log]) bad('clamp' + c, `IK clamp: ${c}`);

	/* ---------------- timeline */
	if (S.tReady < 24 || S.tReady > 32) bad('ready', `READY at ${S.tReady.toFixed(2)} s (24–32)`);
	for (const h of S.hits) if (Math.abs(h.t / 0.3 - Math.round(h.t / 0.3)) * 0.3 > 1 / 120 + 1e-6) {
		R.hitsOffGrid++;
		bad('grid' + h.k + h.t, `hit ${h.label} at ${h.t.toFixed(3)} s off the 0.3 s grid`);
	}
	if (S.changes.length !== 4) bad('changes', `${S.changes.length} tool changes (4)`);
	const heroK = new Set(['seat', 'torque', 'open', 'snap', 'on', 'touch', 'grip', 'comb', 'pull', 'check', 'stop']);
	for (const c of S.changes)
		for (const h of S.hits)
			if (h.id !== c.id && heroK.has(h.k) && Math.abs(h.t - c.click) < 0.6 - 1e-6) {
				R.clickClash.push(`${c.id} click ${c.click.toFixed(2)} / ${h.id} ${h.k} ${h.t.toFixed(2)}`);
				bad('clash' + c.click, `${c.id}'s click at ${c.click.toFixed(2)} s within 0.6 s of ${h.id}'s ${h.label}`);
			}
	const ev = (id: Id, k: string) => (id === 'L' ? S.L : S.R).tr.ev.filter((e) => e.k === k).map((e) => e.t);
	const scrEng = ev('R', 'screw engaged')[0];
	const cageEng = ev('R', 'cage engaged')[0];
	const knob = ev('L', 'knob push')[0];
	const snap = S.hits.find((h) => h.k === 'snap')!.t;
	const tight = S.hits.find((h) => h.k === 'torque')!.t;
	// the screw: engage → back-off (the driver leaves the head 0.1 s after the settle, then 1 u slowly)
	R.heroBeats = {
		screw: +(tight + 0.1 + 1 / 20 - scrEng).toFixed(2),
		cage: +(snap - cageEng).toFixed(2),
		toggle: +(S.hits.find((h) => h.k === 'on')!.t + 0.12 + 0.6 - (knob - 0.42 - 0.08)).toFixed(2),
		comb: +(S.ends.A.tGrip - S.ends.A.tLoose + 0.08).toFixed(2),
	};
	for (const [k, v] of Object.entries(R.heroBeats)) if (v < 1.2) bad('hero' + k, `hero beat ${k} ${v} s (≥ 1.2)`);
	const turns = (S.f7scr.end() - SCREW.rest - 0.07) / (2 * Math.PI);
	if (Math.abs(turns - 2.5) > 0.01) bad('turns', `the screw turns ${turns.toFixed(2)} (2½)`);
	const sink = screwTop(S.f7scr.end()) - SCREW.top0;
	if (Math.abs(sink - 1.25) > 0.01) bad('sink', `the head sinks ${sink.toFixed(2)} u (1.25)`);

	/* ---------------- commanded motion (1 ms) */
	const motion = (tr: ArmTrack, t0: number, t1: number, tag: string) => {
		const dt = 0.001;
		let q0 = tr.qAt(t0),
			q1 = tr.qAt(t0 + dt);
		let rl0 = tr.roll.at(t0);
		for (let t = t0 + dt; t <= t1 + 1e-9; t += dt) {
			const q2 = tr.qAt(t + dt);
			const tool = tr.toolAt(t);
			for (let j = 0; j < 4; j++) {
				const v = (q2[j] - q0[j]) / (2 * dt);
				const a = (q2[j] - 2 * q1[j] + q0[j]) / (dt * dt);
				const rv = Math.abs(v) / SPEED.w[j],
					ra = Math.abs(a) / SPEED.a[j];
				R.maxSpeedRatio = Math.max(R.maxSpeedRatio, rv);
				R.maxAccRatio = Math.max(R.maxAccRatio, ra);
				if (rv > 1.03) bad(`v${tag}${j}`, `${tag} J${[2, 3, 4, 1][j]} speed ${Math.abs(v).toFixed(2)} rad/s at ${ms(t)} ms`);
				if (ra > 1.12) bad(`a${tag}${j}`, `${tag} J${[2, 3, 4, 1][j]} acceleration ${Math.abs(a).toFixed(0)} rad/s² at ${ms(t)} ms`);
			}
			const rl = tr.roll.at(t);
			if (Math.abs(rl - rl0) / dt > SPEED.roll * 1.03) bad(`roll${tag}`, `${tag} roll speed at ${ms(t)} ms`);
			rl0 = rl;
			if (tool === tr.toolAt(t + dt) && tool === tr.toolAt(t - dt)) {
				const a3 = tr.r.tcp3(q0, tool),
					b3 = tr.r.tcp3(q2, tool);
				const vt = Math.hypot(b3.x - a3.x, b3.y - a3.y, b3.z - a3.z) / (2 * dt);
				R.maxTcpRatio = Math.max(R.maxTcpRatio, vt / SPEED.tcp);
				if (vt / SPEED.tcp > 1.05) bad(`tcp${tag}`, `${tag} tool centre point ${vt.toFixed(0)} u/s at ${ms(t)} ms`);
			}
			q0 = q1;
			q1 = q2;
		}
	};
	motion(S.L.tr, 0, S.tHold, 'L');
	motion(S.R.tr, 0, S.tHold, 'R');

	/* ---------------- the drawn shapes (120 Hz, flexed) */
	let flex = o.flex;
	if (!flex) {
		const g = flexSteps([S.L.tr, S.R.tr], 0, S.tHold + 0.5, 1e9);
		let r = g.next();
		while (!r.done) r = g.next();
		flex = r.value;
	}
	const racks = { L: rackPieces3('L'), R: rackPieces3('R') };
	const evs = (['L', 'R'] as const).flatMap((id) => S.arm(id).tr.ev.map((e) => ({ id, e })));
	const evDone = new Set<number>();
	const shapes = (
		t: number,
		qs: Record<Id, ArrayLike<number>>,
		tools: Record<Id, ReturnType<ArmTrack['toolAt']>>,
		sts: Record<Id, ReturnType<typeof toolSt>>,
		o2: { rack: (id: Id, k: number) => string | null; tgl: number; contact: Record<Id, number>; wire: Pt[][] | null; hold: boolean; cmd?: Record<Id, ArrayLike<number>>; tag: string },
	) => {
		R.samples++;
		const arms: Record<Id, (Piece & { b: Box })[]> = { L: [], R: [] };
		for (const id of ['L', 'R'] as const) {
			const rob = S.arm(id).tr.r;
			const q = qs[id];
			const a = armPieces(rob, q, tools[id], sts[id]);
			arms[id] = a.pcs.map((p) => ({ ...p, b: bbox(p.p) }));
			if (q[0] < LIM.q1[0] - 1e-6 || q[0] > LIM.q1[1] + 1e-6 || q[1] < LIM.q2[0] - 1e-6 || q[1] > LIM.q2[1] + 1e-6 || Math.abs(q[2]) > LIM.q3[1]) {
				R.limits++;
				bad(`lim${o2.tag}${id}`, `${o2.tag} ${id} drawn joint limit at ${ms(t)} ms`);
			}
			if (o2.cmd) {
				const kc = rob.fk(o2.cmd[id], tools[id]);
				const fx = Math.hypot(a.k.T.x - kc.T.x, a.k.T.y - kc.T.y);
				R.maxFlex = Math.max(R.maxFlex, fx);
				if (fx > 0.62) bad(`flex${o2.tag}${id}`, `${o2.tag} ${id} drawn tool ${fx.toFixed(2)} u off its commanded pose at ${ms(t)} ms`);
			}
			for (const p of arms[id]) {
				const e = R.extents;
				e.x0 = Math.min(e.x0, p.b.x0);
				e.x1 = Math.max(e.x1, p.b.x1);
				e.y0 = Math.min(e.y0, p.b.y0);
				e.y1 = Math.max(e.y1, p.b.y1);
				if (p.b.x0 < VB.x || p.b.x1 > VB.x + VB.w || p.b.y0 < VB.y || p.b.y1 > VB.y + VB.h) bad(`vb${o2.tag}${id}${p.n}`, `${o2.tag} ${id} ${p.n} outside the stage at ${ms(t)} ms`);
			}
		}
		// peer
		for (const a of arms.L) {
			if (a.kind === 'base') continue;
			for (const b of arms.R) {
				if (b.kind === 'base') continue;
				const bg = boxGap(a.b, b.b);
				if (bg > 2.5) {
					if (bg < R.minPeer) {
						R.minPeer = bg;
						R.peerAt = t;
					}
					continue;
				}
				const d = sepConvex(a.p, b.p);
				if (d < R.minPeer) {
					R.minPeer = d;
					R.peerAt = t;
				}
				if (d < 2) bad(`peer${o2.tag}${a.n}${b.n}`, `${o2.tag} peer clearance ${d.toFixed(2)} u (L ${a.n} / R ${b.n}) at ${ms(t)} ms`);
			}
		}
		for (const id of ['L', 'R'] as const) {
			const pcs = arms[id];
			const q = qs[id];
			const own = Math.abs(q[3]) > 1e-4 ? armPieces(S.arm(id).tr.r, [q[0], q[1], q[2], 0], tools[id], sts[id]).pcs.map((p) => ({ ...p, b: bbox(p.p) })) : pcs;
			const by = (n: string) => own.find((p) => p.n === n)!;
			for (const p of own) {
				if (!['plate', 'body', 'finger', 'tip', 'flange'].includes(p.kind) && p.n !== 'wrist' && p.n !== 'capW') continue;
				for (const sn of ['upper', 'capS', 'ped', 'foot']) {
					const s = by(sn);
					if (boxGap(p.b, s.b) > 1) continue;
					const d = sepConvex(p.p, s.p);
					R.minSelf = Math.min(R.minSelf, d);
					if (d < 0.5) bad(`self${o2.tag}${id}${p.n}${sn}`, `${o2.tag} ${id} ${p.n} against its own ${sn}: ${d.toFixed(2)} at ${ms(t)} ms`);
				}
			}
			for (const p of pcs) {
				if (p.kind === 'base') continue;
				if (p.b.y1 > 0.01) bad(`bench${o2.tag}${id}${p.n}`, `${o2.tag} ${id} ${p.n} below the bench (${p.b.y1.toFixed(2)}) at ${ms(t)} ms`);
				// the duct: tools, flange and wrist stay ≥ 1 u under it where they are over it
				if ((['plate', 'body', 'finger', 'tip', 'flange'].includes(p.kind) || p.n === 'wrist') && p.b.x1 > DUCT.x0 && p.b.x0 < DUCT.x1) {
					const dd = p.b.y0 - DUCT.y1;
					R.minDuct = Math.min(R.minDuct, dd);
					if (dd < 1) bad(`duct${o2.tag}${id}${p.n}`, `${o2.tag} ${id} ${p.n} ${dd.toFixed(2)} u under the duct at ${ms(t)} ms`);
				}
				for (const s of TABS) {
					const sb = bbox(s);
					if (boxGap(p.b, sb) > 0.6) continue;
					const d = sepConvex(p.p, s);
					if (p.kind !== 'tip') R.minTab = Math.min(R.minTab, d);
					if (d < (p.kind === 'tip' || p.kind === 'finger' ? -0.02 : 0)) bad(`tab${o2.tag}${id}${p.n}`, `${o2.tag} ${id} ${p.n} into a device tab (${d.toFixed(2)}) at ${ms(t)} ms`);
				}
				if (!(id === 'L' && p.kind === 'finger' && o2.contact.L > 0))
					for (const s of toggleSolids(o2.tgl)) {
						const d = sepConvex(p.p, s);
						if (d < 0.3) bad(`tgl${o2.tag}${id}${p.n}`, `${o2.tag} ${id} ${p.n} into the breaker toggle (${d.toFixed(2)}) at ${ms(t)} ms`);
					}
				for (const rid of ['L', 'R'] as const) {
					const ownDock = rid === id && o2.contact[id] > 0;
					const pieces: Piece[] = [...racks[rid]];
					for (let k = 0; k < 3; k++) {
						const tl = o2.rack(rid, k);
						if (tl) pieces.push(...docked(G.slots[rid][k], tl as keyof typeof LEN));
					}
					for (const s of pieces) {
						if (ownDock && s.n.startsWith('rack-') && s.n !== 'rack-foot' && s.n !== 'rack-post') continue;
						const sb = bbox(s.p);
						if (boxGap(p.b, sb) > 1) continue;
						const d = sepConvex(p.p, s.p);
						R.minRack = Math.min(R.minRack, d);
						if (d < 0.4) bad(`rack${o2.tag}${id}${p.n}${s.n}`, `${o2.tag} ${id} ${p.n} against ${rid} ${s.n} (${d.toFixed(2)}) at ${ms(t)} ms`);
					}
				}
			}
		}
		// W07 against the arms
		if (o2.wire) {
			const cw = G.wire;
			for (const Lp of o2.wire) {
				const dense: Pt[] = [];
				for (let j = 0; j < Lp.length - 1; j++) for (let k = 0; k < 3; k++) dense.push({ x: Lp[j].x + ((Lp[j + 1].x - Lp[j].x) * k) / 3, y: Lp[j].y + ((Lp[j + 1].y - Lp[j].y) * k) / 3 });
				dense.push(Lp[Lp.length - 1]);
				const lb = bbox(dense);
				for (const id of ['L', 'R'] as const) {
					// an arm turned toward the viewer passes IN FRONT of the wire (its wrist, flange and tool ≥ 8 u nearer than the
					// wire's plane): nothing to collide with
					if (frontOf(id, qs[id], tools[id]) >= 8) continue;
					const holdingNow = id === 'L' && o2.hold;
					const across = Math.abs(Math.sin(sts[id].roll)) > 0.9 && tools[id] === 'gripper';
					for (const p of arms[id]) {
						if (boxGap(p.b, lb) > 4) continue;
						if (p.kind === 'finger' && (across || holdingNow)) continue;
						const solid = ['plate', 'body', 'flange'].includes(p.kind) || p.n === 'wrist' || p.n === 'capW';
						let inside = 0,
							near = Infinity;
						for (const v of dense) {
							if (inConvex(v, p.p)) inside++;
							else near = Math.min(near, polyDist(v, p.p));
						}
						if (solid && inside && !(holdingNow && p.kind === 'body')) bad(`wire${o2.tag}${id}${p.n}`, `${o2.tag} W07 through ${id}'s ${p.n} (${inside} points) at ${ms(t)} ms`);
						if (!holdingNow && (p.kind === 'tip' || p.kind === 'body' || p.kind === 'finger')) {
							if (inside) near = 0;
							const c = near - cw / 2;
							R.minToolWire = Math.min(R.minToolWire, c);
							// (a gripper rolled across may touch a wire with its palm, between its fingers: it does as it takes one)
							if (c < (across && p.kind === 'body' ? -0.6 : 1)) bad(`tw${o2.tag}${id}${p.n}`, `${o2.tag} ${id}'s ${p.n} ${c.toFixed(2)} u from W07 at ${ms(t)} ms`);
						}
					}
				}
			}
		}
		return arms;
	};

	/** how far the arm's wrist, flange and tool centre point are in front of the work plane (units; 0 at J1 = 0) */
	const frontOf = (id: Id, q: ArrayLike<number>, tool: ReturnType<ArmTrack['toolAt']>) => {
		const j = q[3] || 0;
		if (Math.abs(Math.sin(j)) < 1e-4) return 0;
		const rob = S.arm(id).tr.r,
			k = rob.fk(q, tool);
		const c = rob.m * Math.cos(j);
		if (Math.abs(c) < 1e-3) return 0;
		const z = (P: Pt) => Math.sin(j) * ((P.x - rob.S.x) / c);
		return Math.min(z(k.W), z(k.F), z(k.T));
	};
	const nSteps = Math.round(S.tHold * 120) + 1;
	const q = { L: [0, 0, 0, 0], R: [0, 0, 0, 0] };
	let curlMin = Infinity;
	for (let i = 0; i < nSteps; i++) {
		const t = i / 120;
		flexAt(flex, 'L', t, q.L);
		flexAt(flex, 'R', t, q.R);
		const tools = { L: S.L.tr.toolAt(t), R: S.R.tr.toolAt(t) };
		const sts = { L: toolSt(S, 'L', t, q.L), R: toolSt(S, 'R', t, q.R) };
		const kL = S.L.tr.r.fk(q.L, tools.L);
		const A = dropA(S, t, kL.T),
			B = dropB(S, t, kL.T);
		const la = lenOf(A.pts),
			lb = lenOf(B.pts);
		R.wireLen.A = [Math.min(R.wireLen.A[0], la), Math.max(R.wireLen.A[1], la)];
		R.wireLen.B = [Math.min(R.wireLen.B[0], lb), Math.max(R.wireLen.B[1], lb)];
		if (Math.abs(la / LD.A - 1) > 0.01) bad(`lenA${Math.round(t * 10)}`, `drop A ${la.toFixed(1)} u (${LD.A.toFixed(1)} ±1 %) at ${ms(t)} ms`);
		if (Math.abs(lb / LD.B - 1) > 0.01) bad(`lenB${Math.round(t * 10)}`, `drop B ${lb.toFixed(1)} u (${LD.B.toFixed(1)} ±1 %) at ${ms(t)} ms`);
		// the curl never returns after the comb: end A's tangent stays within 30° of the drop's after the firm grip
		if (t >= S.ends.A.tGrip) curlMin = Math.min(curlMin, Math.cos(A.dir - Math.PI / 2));
		const hold = (t >= S.ends.A.tLoose && t < S.ends.A.tRel) || (t >= S.ends.B.tGrip && t < S.ends.B.tRel);
		shapes(t, q, tools, sts, {
			rack: (id, k) => S.arm(id).rackAt(k, t),
			tgl: S.f7tgl.at(t),
			contact: { L: S.L.tr.inContact(t), R: S.R.tr.inContact(t) },
			wire: [A.pts, B.pts],
			hold,
			cmd: { L: S.L.tr.qAt(t), R: S.R.tr.qAt(t) },
			tag: 'film',
		});
		// contact events
		for (let e = 0; e < evs.length; e++) {
			if (evDone.has(e)) continue;
			const { id, e: E } = evs[e];
			if (E.t > t + 0.5 / 120) continue;
			evDone.add(e);
			const k = S.arm(id).tr.r.fk(q[id], E.tool === 'none' ? tools[id] : E.tool);
			const at = E.flange ? k.F : k.T;
			const err = Math.hypot(at.x - E.P.x, at.y - E.P.y);
			R.contacts++;
			R.maxContactErr = Math.max(R.maxContactErr, err);
			if (err > (E.flange ? 0.2 : 0.3)) bad(`ev${e}`, `${id} ${E.k} at ${ms(E.t)} ms: drawn ${E.flange ? 'flange' : 'tool'} ${err.toFixed(2)} u off target`);
			if (E.flange && E.phi != null) {
				const da = Math.abs(Math.atan2(Math.sin(k.la3 - E.phi), Math.cos(k.la3 - E.phi)));
				if (da > 0.5 * DEG) bad(`eva${e}`, `${id} ${E.k} at ${ms(E.t)} ms: flange ${(da / DEG).toFixed(2)}° off`);
			}
		}
	}
	if (curlMin < Math.cos((30 * Math.PI) / 180)) bad('curl', `end A's curl returns after the comb (cos ${curlMin.toFixed(2)})`);

	/* ---------------- RESET: from the end frame (the robots parked), from the film's candidate rests */
	const qaReset = (src: ResetSrc, tag: string): string[] => {
		const errs: string[] = [];
		const keys = new Set<string>();
		const prevSink = vSink;
		vSink = (k, m) => {
			if (keys.has(k)) return;
			keys.add(k);
			errs.push(m);
		};
		const B = resetBranch(S, src);
		for (const c of [...B.L.log, ...B.R.log]) bad('rclamp' + c, `${tag}: IK clamp ${c}`);
		motion(B.L, 0, B.tEnd, `${tag} L`);
		motion(B.R, 0, B.tEnd, `${tag} R`);
		const F = resetFlex(B);
		const J = S.L.tr.r.fk(src.q.L, src.tool.L).T;
		const fromA = dropA(S, src.t, J),
			fromB = B.carryB ? heldB(S.L.tr.r.fk(flexAt(F, 'L', B.rel.B), B.L.toolAt(B.rel.B)).T) : dropB(S, src.t, J);
		const qq = { L: [0, 0, 0, 0], R: [0, 0, 0, 0] };
		const rEv = (['L', 'R'] as const).flatMap((id) => (id === 'L' ? B.L : B.R).ev.map((e) => ({ id, e })));
		const rDone = new Set<number>();
		for (let i = 0; i <= Math.round(B.tEnd * 120); i++) {
			const t = i / 120;
			flexAt(F, 'L', t, qq.L);
			flexAt(F, 'R', t, qq.R);
			const tools = { L: B.L.toolAt(t), R: B.R.toolAt(t) };
			const A = springBack('A', fromA, t - B.rel.A),
				Bw = B.carryB && t < B.rel.B ? heldB(S.L.tr.r.fk(qq.L, tools.L).T) : springBack('B', fromB, t - B.rel.B);
			const la = lenOf(A.pts),
				lb = lenOf(Bw.pts);
			if (Math.abs(la / LD.A - 1) > 0.01) bad(`rlenA`, `${tag}: drop A ${la.toFixed(1)} u at ${ms(t)} ms`);
			if (Math.abs(lb / LD.B - 1) > 0.01) bad(`rlenB`, `${tag}: drop B ${lb.toFixed(1)} u at ${ms(t)} ms`);
			shapes(
				t,
				qq,
				tools,
				{ L: resetToolSt(B, 'L', t, qq.L), R: resetToolSt(B, 'R', t, qq.R) },
				{
					rack: (id, k) => rackOf(B, id, k, t),
					tgl: B.tgl.at(t),
					contact: { L: B.L.inContact(t), R: B.R.inContact(t) },
					wire: [A.pts, Bw.pts],
					// the jaws let go: the wire leaves between the fingers (a gripper across keeps them across until it has)
					hold: src.tool.L === 'gripper' && t < (Math.abs(Math.sin(src.roll.L)) > 0.9 && (src.held.A || src.held.B) ? Math.max(B.rel.A, B.rel.B) + 0.75 : 0.5),
					cmd: { L: B.L.qAt(t), R: B.R.qAt(t) },
					tag,
				},
			);
			for (let e = 0; e < rEv.length; e++) {
				if (rDone.has(e)) continue;
				const { id, e: E } = rEv[e];
				if (E.t > t + 0.5 / 120) continue;
				rDone.add(e);
				const k = S.arm(id).tr.r.fk(qq[id], tools[id]);
				const err = Math.hypot(k.F.x - E.P.x, k.F.y - E.P.y);
				if (E.flange && err > 0.2) bad(`rev${e}`, `${tag}: ${id} ${E.k} flange ${err.toFixed(2)} u off`);
			}
		}
		// it ends where the film begins
		for (const id of ['L', 'R'] as const) {
			const qe = (id === 'L' ? B.L : B.R).qAt(B.tEnd),
				q0 = restQ(S.arm(id).tr.r, id);
			const d = Math.max(...[0, 1, 2, 3].map((j) => Math.abs(Math.atan2(Math.sin(qe[j] - q0[j]), Math.cos(qe[j] - q0[j])))));
			if (d > 1e-4) bad(`rend${id}`, `${tag}: ${id} ends ${d.toFixed(4)} rad off the film's first pose`);
			for (let k = 0; k < 3; k++) if (rackOf(B, id, k, B.tEnd) !== S.arm(id).rackAt(k, 0)) bad(`rrack${id}${k}`, `${tag}: ${id} rack slot ${k} not as at the film's start`);
		}
		vSink = prevSink;
		return errs;
	};
	if (o.branches !== false) {
		// the end frame (READY: both arms parked with their probes): the build fails if its RESET breaks a rule
		const strict = (src: ResetSrc, tag: string) => {
			for (const m of qaReset(src, tag)) bad('rs' + m, m);
		};
		strict(filmSrc(S, S.tHold), 'reset@ready');
		// mid-film: each candidate rest that passes is a point the protective stop may land on before the reset
		const cands = resetCandidates(S);
		R.resets.tried = cands.length;
		const worst: string[] = [];
		// (a candidate's numbers are not the film's: the summary keeps the film's and the strict resets' maxima)
		const keep = { ...R, extents: { ...R.extents }, wireLen: { A: [...R.wireLen.A] as [number, number], B: [...R.wireLen.B] as [number, number] } };
		for (const t of cands) {
			const e = qaReset(filmSrc(S, t), `reset@${t.toFixed(2)}`);
			if (!e.length) R.resets.safe.push(t);
			else if (worst.length < 40) worst.push(e.slice(0, 2).join(" · "));
		}
		R.resets.worst = worst;
		for (const k of ['minPeer', 'peerAt', 'minSelf', 'minTab', 'minRack', 'minDuct', 'minToolWire', 'maxFlex', 'maxSpeedRatio', 'maxAccRatio', 'maxTcpRatio', 'extents', 'wireLen', 'samples'] as const) (R as unknown as Record<string, unknown>)[k] = keep[k];
		const pts = [0, ...R.resets.safe, S.tReady];
		for (let i = 1; i < pts.length; i++) R.resets.longestGap = Math.max(R.resets.longestGap, +(pts[i] - pts[i - 1]).toFixed(2));
	}
	void CAGE_D0;
	void CAGE_PUSH;
	void relAt;
	const r2 = (v: number) => +v.toFixed(2);
	return {
		...R,
		minPeer: r2(R.minPeer),
		minSelf: r2(R.minSelf),
		minTab: r2(R.minTab),
		minRack: r2(R.minRack),
		minDuct: r2(R.minDuct),
		minToolWire: r2(R.minToolWire),
		maxContactErr: +R.maxContactErr.toFixed(3),
		maxFlex: +R.maxFlex.toFixed(3),
		maxSpeedRatio: r2(R.maxSpeedRatio),
		maxAccRatio: r2(R.maxAccRatio),
		maxTcpRatio: r2(R.maxTcpRatio),
		extents: { x0: r2(R.extents.x0), x1: r2(R.extents.x1), y0: r2(R.extents.y0), y1: r2(R.extents.y1) },
		wireLen: { A: [r2(R.wireLen.A[0]), r2(R.wireLen.A[1])], B: [r2(R.wireLen.B[0]), r2(R.wireLen.B[1])] },
	};
}
export type { Q };
