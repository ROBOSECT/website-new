/**
 * The showpiece's frame state: everything one frame of the cell draws, a pure function of the film time t (or of a RESET's
 * clock τ). The renderer (render.ts) only reads it, so the live page, the build-time poster and the QA draw the same frame
 * for the same inputs. The form's side (which parts are built, the pulses) is form.ts, from the same film time.
 */
import { clamp01, smooth } from '../core';
import type { FK, ToolName } from '../robot/kin';
import type { ToolSt } from '../robot/draw';
import { flexAt, formParts, rackOf, resetFlex, resetToolSt, TEST_RUN, toolSt, type FlexTable, type Part, type ResetBranch, type Show, type Vf } from './program';
import { X0 } from './scene';
import { along, currentRoute, dropA, dropB, heldB, lenOf, springBack, type Drop } from './wire';
import type { Pt } from '../robot/kin';

export interface Compiled {
	S: Show;
	flex: FlexTable;
	/** the wire's route at the test (−F7:2 → −X0:7 → T7): the test current runs it end to end */
	route: Pt[];
	routeLen: number;
	/** the form's parts and the film times their jobs land */
	parts: Part[];
}
export function compiled(S: Show, flex: FlexTable): Compiled {
	const C: Compiled = { S, flex, route: [], routeLen: 0, parts: formParts(S) };
	const kL = S.L.tr.r.fk(flexAt(flex, 'L', S.tEnergize), 'probe');
	C.route = currentRoute(dropA(S, S.tEnergize, kL.T), dropB(S, S.tEnergize, kL.T));
	C.routeLen = lenOf(C.route);
	return C;
}

/** a RESET in progress: its branch, its clock, the wire's two ends as it found them */
export interface Reset {
	B: ResetBranch;
	tau: number;
	fromA: Drop;
	fromB: Drop | null;
}
/** a RESET from its source state (every start the player offers passed the build-time robot QA) */
export function startReset(C: Compiled, B: ResetBranch): Reset {
	const S = C.S;
	if (!B.flex) resetFlex(B);
	const J = S.L.tr.r.fk(B.src.q.L, B.src.tool.L).T;
	const fromA = dropA(S, B.src.t, J);
	const fromB = B.carryB ? null : dropB(S, B.src.t, J);
	return { B, tau: 0, fromA, fromB };
}

export interface ArmF {
	q: number[];
	tool: ToolName;
	st: ToolSt;
	lock: number;
	k: FK;
}
export interface FS {
	t: number;
	ready: boolean;
	L: ArmF;
	R: ArmF;
	racks: Record<'L' | 'R', (ToolName | null)[]>;
	A: Drop;
	B: Drop;
	scr: number;
	jawA: number;
	tgl: number;
	cage: number;
	jawB: number;
	plate: number;
	/** the test current along the wire (0…1 of its route), and its fade once it has run */
	current: number;
	currentFade: number;
	/** the connector's centre pin: lit once the circuit has been tested (copper: success) */
	pin: number;
	/** the camera's trace (the one vision job of the showpiece): drawn on the work itself, wordless */
	vf: Vf | null;
	vfOp: number;
	clicks: { x: number; y: number; r: number; op: number }[];
	cone: { T: Pt; P: Pt; op: number } | null;
}

const lookAt = (keys: { t: number; x: number; y: number }[], t: number): Pt => {
	if (t <= keys[0].t) return keys[0];
	for (let i = 1; i < keys.length; i++)
		if (t <= keys[i].t) {
			const u = smooth((t - keys[i - 1].t) / Math.max(1e-6, keys[i].t - keys[i - 1].t));
			return { x: keys[i - 1].x + (keys[i].x - keys[i - 1].x) * u, y: keys[i - 1].y + (keys[i].y - keys[i - 1].y) * u };
		}
	return keys[keys.length - 1];
};
export const vfLook = (v: Vf, t: number) => lookAt(v.look, t);

const qL = [0, 0, 0, 0],
	qR = [0, 0, 0, 0];
/** the frame at film time t (clamped to the held end frame), or a RESET's frame */
export function frameState(C: Compiled, tIn: number, reset: Reset | null = null): FS {
	if (reset) return resetState(C, reset);
	const S = C.S;
	const t = Math.max(0, Math.min(tIn, S.tHold));
	const a = flexAt(C.flex, 'L', t, qL.slice()),
		b = flexAt(C.flex, 'R', t, qR.slice());
	const tl = S.L.tr.toolAt(t),
		tr = S.R.tr.toolAt(t);
	const L: ArmF = { q: a, tool: tl, st: toolSt(S, 'L', t, a), lock: S.L.tr.lock.at(t), k: S.L.tr.r.fk(a, tl) };
	const R: ArmF = { q: b, tool: tr, st: toolSt(S, 'R', t, b), lock: S.R.tr.lock.at(t), k: S.R.tr.r.fk(b, tr) };
	const A = dropA(S, t, L.k.T),
		B = dropB(S, t, L.k.T);
	// the test current: the two probes' contact runs it along the wire end A → end B, then it calms back to the insulation
	const u = (t - S.tEnergize) / TEST_RUN;
	const current = S.tEnergize > 0 && u > 0 ? clamp01(u) : 0;
	// (held a beat, then it narrows: ease in)
	const cf = current >= 1 ? clamp01((t - S.tEnergize - TEST_RUN - 0.1) / 0.5) : 0;
	const currentFade = cf * cf;
	const pin = S.tEnergize > 0 ? clamp01((t - S.tEnergize - TEST_RUN) / 0.15) : 0;
	const vf = S.vf.find((v) => t >= v.t0 && t < v.t1) ?? null;
	const vfOp = vf ? Math.min(clamp01((t - vf.t0) / 0.12), clamp01((vf.t1 - t) / 0.12)) : 0;
	const clicks: FS['clicks'] = [];
	for (const arm of [S.L, S.R])
		for (const fx of arm.fx)
			if (fx.k === 'click' && t >= fx.t && t < fx.t + 0.35) {
				const v = (t - fx.t) / 0.35;
				const k = arm.tr.r.fk(arm.tr.qAt(fx.t), arm.tr.toolAt(fx.t));
				clicks.push({ x: k.F.x, y: k.F.y, r: 4 + 7 * v, op: 0.9 * (1 - v) });
			}
	let cone: FS['cone'] = null;
	const sv = S.vf.find((v) => t >= v.t0 - 0.1 && t <= v.t1);
	if (sv) cone = { T: L.k.T, P: lookAt(sv.look, t), op: Math.min(1, (t - sv.t0 + 0.1) / 0.1) * clamp01((sv.t1 - t) / 0.12) };
	return {
		t,
		ready: tIn >= S.tReady,
		L,
		R,
		racks: { L: [0, 1, 2].map((k) => S.L.rackAt(k, t)), R: [0, 1, 2].map((k) => S.R.rackAt(k, t)) },
		A,
		B,
		scr: S.f7scr.at(t),
		jawA: S.f7jaw.at(t),
		tgl: S.f7tgl.at(t),
		cage: S.x0cage.at(t),
		jawB: S.x0jaw.at(t),
		plate: S.plate.at(t),
		current,
		currentFade,
		pin,
		vf,
		vfOp,
		clicks,
		cone,
	};
}
const qa = [0, 0, 0, 0],
	qb = [0, 0, 0, 0];
/** a frame of the RESET: the arms from the branch's flex, the racks filling, the devices letting go, the
 * wire's ends springing back to their curled hang */
function resetState(C: Compiled, R: Reset): FS {
	const S = C.S,
		B = R.B,
		tau = R.tau;
	const F = B.flex!;
	const a = flexAt(F, 'L', tau, qa.slice()),
		b = flexAt(F, 'R', tau, qb.slice());
	const tl = B.L.toolAt(tau),
		tr = B.R.toolAt(tau);
	const L: ArmF = { q: a, tool: tl, st: resetToolSt(B, 'L', tau, a), lock: B.L.lock.at(tau), k: S.L.tr.r.fk(a, tl) };
	const R2: ArmF = { q: b, tool: tr, st: resetToolSt(B, 'R', tau, b), lock: B.R.lock.at(tau), k: S.R.tr.r.fk(b, tr) };
	const A = springBack('A', R.fromA, tau - B.rel.A);
	const Bw = B.carryB && tau < B.rel.B ? heldB(L.k.T) : springBack('B', R.fromB ?? heldB(S.L.tr.r.fk(flexAt(F, 'L', B.rel.B), B.L.toolAt(B.rel.B)).T), tau - B.rel.B);
	// the centre pin (lit once tested) goes out with the breaker
	const out = 1 - clamp01((tau - 0.05) / 0.2);
	return {
		t: 0,
		ready: false,
		L,
		R: R2,
		racks: { L: [0, 1, 2].map((k) => rackOf(B, 'L', k, tau)), R: [0, 1, 2].map((k) => rackOf(B, 'R', k, tau)) },
		A,
		B: Bw,
		scr: B.scr.at(tau),
		jawA: B.jawA.at(tau),
		tgl: B.tgl.at(tau),
		cage: B.cage.at(tau),
		jawB: B.jawB.at(tau),
		plate: B.plate.at(tau),
		current: 0,
		currentFade: 1,
		pin: B.src.pin * out,
		vf: null,
		vfOp: 0,
		clicks: [],
		cone: null,
	};
}
/** the test current's head and lit part along the wire */
export function currentAt(C: Compiled, u: number) {
	return along(C.route, u);
}
export const X0_RIGHT = { x: X0.x0 + X0.w, y: 30 };
