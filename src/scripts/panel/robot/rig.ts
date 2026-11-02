/**
 * The robot pair of one compartment: the RobotRig the timeline plugs in (program.ts). It owns the two arms' programs
 * (ArmTrack), the tool racks, and the joint-flex simulation that runs inside the 120 Hz Sim (and therefore inside the
 * snapshot cache: forward, backward and cold give the same state).
 *
 *   flex   each joint deflection e follows ë = −ω²e − 2ζωė − κ·q̈_cmd with ω = 2π·11 Hz, ζ = 0.65, κ = 0.2 (the wrist
 *          couples × 0.6, the base × 0.5): a stiff, well-damped cobot: a lag of a few hundredths of a unit in fast moves,
 *          a settle of one small, quickly damped swing after a stop. Kicks (joint velocity impulses ≤ 0.1 rad/s along the
 *          tool axis) at seats, contacts, clicks and the final torque. The drawn tool never strays more than 0.6 units
 *          from the commanded one, and while the tool touches something (contact windows: seat to release, probe contact
 *          to retreat, screw engaged to backed off, docking to lift) the flex is held off: the tool stays on its target.
 *          The leads follow the actual (flexed) tool centre point.
 *   qa     robot/qa.ts: the drawn shapes of the drawn arms, the whole program
 */
import { H, f, prog, SPRINGS, clamp01 } from '../core';
import type { Builder, GripPose, RobotRig } from '../program';
import { ArmTrack } from './arm';
import { PARK, Robot, type FK, type Q, type ToolName } from './kin';
import { CELL_BOX, LiveCell, unitRobots, type ArmFrame, type ArmFx, type CellState, type ToolSt } from './draw';
import { runQa } from './qa';

export type Id = 'L' | 'R';
type Slots = [ToolName | null, ToolName | null];
export interface RigCfg {
	tools: { L: ToolName; R: ToolName };
	racks: { L: Slots; R: Slots };
	speed?: number;
}
interface Flex {
	e: number[];
	v: number[];
	qm: Q | null;
	qmm: Q | null;
	ki: number;
	q: Q;
}
interface State {
	L: Flex;
	R: Flex;
}
export interface RigView {
	L: Q;
	R: Q;
}
/** effects bound to an arm (drawn by the rig): the tool-coupling flash ring, the camera's scan cone */
export interface RigFx {
	k: 'click' | 'scan';
	t: number;
	t1?: number;
	id: Id;
	len?: number;
}
export const FLEX = { w: 2 * Math.PI * 11, z: 0.65, k: 0.2, max: 0.6 };
const COUPLE = [1, 1, 0.6, 0.5];

export class Rig implements RobotRig {
	B: Builder;
	rob: { L: Robot; R: Robot };
	L: ArmTrack;
	R: ArmTrack;
	/** rack contents: per arm, per slot, a list of {t, tool} */
	racks: { L: { t: number; tool: ToolName | null }[][]; R: { t: number; tool: ToolName | null }[][] };
	fx: RigFx[] = [];
	constructor(B: Builder, cfg: RigCfg) {
		this.B = B;
		const G = B.G,
			sc = G.sc;
		const mk = (id: Id, m: 1 | -1) => new Robot({ id, m, sc, bx: G.bx[id], floor: G.floor });
		this.rob = { L: mk('L', 1), R: mk('R', -1) };
		this.L = new ArmTrack(this.rob.L, cfg.tools.L, cfg.speed);
		this.R = new ArmTrack(this.rob.R, cfg.tools.R, cfg.speed);
		this.racks = {
			L: [[{ t: -1e9, tool: cfg.racks.L[0] }], [{ t: -1e9, tool: cfg.racks.L[1] }]],
			R: [[{ t: -1e9, tool: cfg.racks.R[0] }], [{ t: -1e9, tool: cfg.racks.R[1] }]],
		};
		B.rig = this;
	}
	track(id: Id) {
		return id === 'L' ? this.L : this.R;
	}
	/** the arms that are drawn and simulated: a solo cell (vignettes) has one, its partner is not drawn and never moves */
	get ids(): Id[] {
		const s = this.B.cfg.solo;
		return s ? [s] : ['L', 'R'];
	}
	rackAt(id: Id, k: number, t: number): ToolName | null {
		let tool: ToolName | null = null;
		for (const e of this.racks[id][k]) if (e.t <= t) tool = e.tool;
		return tool;
	}
	/** the static cell (parked pair) at program time t: arm tools and rack contents */
	cellState(t: number): CellState {
		return {
			tool: { L: this.L.toolAt(t), R: this.R.toolAt(t) },
			rack: { L: [this.rackAt('L', 0, t), this.rackAt('L', 1, t)], R: [this.rackAt('R', 0, t), this.rackAt('R', 1, t)] },
			x4: this.B.x4,
			solo: this.B.cfg.solo ?? null,
		};
	}

	/* ---------------------------------------------------------------- RobotRig: timeline */
	end() {
		return Math.max(this.L.end(), this.R.end());
	}
	below(t: number) {
		const fl = this.B.G.floor + 1;
		for (const tr of this.ids.map((id) => this.track(id))) {
			const k = tr.r.fk(tr.qAt(t), tr.toolAt(t));
			if (Math.max(k.E.y, k.W.y, k.T.y) > fl) return true;
		}
		return false;
	}

	/* ---------------------------------------------------------------- RobotRig: simulation */
	simInit(): State {
		const fl = (tr: ArmTrack): Flex => ({ e: [0, 0, 0, 0], v: [0, 0, 0, 0], qm: null, qmm: null, ki: 0, q: tr.qAt(0) });
		return { L: fl(this.L), R: fl(this.R) };
	}
	simStep(state: unknown, t: number) {
		const st = state as State;
		const w2 = FLEX.w * FLEX.w,
			c = 2 * FLEX.z * FLEX.w;
		// (a solo cell's partner arm is not drawn and never moves: it is not simulated, its state stays parked)
		for (const id of this.ids) {
			const tr = this.track(id),
				F = st[id];
			const qc = tr.qAt(t);
			if (F.qm) {
				for (let k = 0; k < 4; k++) {
					const acc = F.qmm ? (qc[k] - 2 * F.qm[k] + F.qmm[k]) / (H * H) : 0;
					const a = -w2 * F.e[k] - c * F.v[k] - FLEX.k * COUPLE[k] * acc;
					F.v[k] += a * H;
					F.e[k] += F.v[k] * H;
				}
			}
			while (F.ki < tr.kicks.length && tr.kicks[F.ki].t <= t) {
				const kv = tr.kicks[F.ki++].v;
				for (let k = 0; k < 3; k++) F.v[k] += kv[k];
			}
			F.qmm = F.qm;
			F.qm = qc;
			// drawn: the commanded pose plus the flex, held off in a contact, never more than FLEX.max units at the tool
			const hold = 1 - tr.inContact(t);
			const d = [F.e[0] * hold, F.e[1] * hold, F.e[2] * hold, F.e[3] * hold];
			if (hold > 0) {
				const tool = tr.toolAt(t);
				const kc = tr.r.fk(qc, tool),
					kd = tr.r.fk([qc[0] + d[0], qc[1] + d[1], qc[2] + d[2], qc[3] + d[3]], tool);
				const off = Math.hypot(kd.T.x - kc.T.x, kd.T.y - kc.T.y) / tr.r.sc;
				if (off > FLEX.max) for (let k = 0; k < 4; k++) d[k] *= FLEX.max / off;
			}
			F.q = [qc[0] + d[0], qc[1] + d[1], qc[2] + d[2], qc[3] + d[3]];
		}
	}
	snap(state: unknown) {
		const st = state as State;
		const c = (F: Flex): Flex => ({ e: F.e.slice(), v: F.v.slice(), qm: F.qm ? (F.qm.slice() as Q) : null, qmm: F.qmm ? (F.qmm.slice() as Q) : null, ki: F.ki, q: F.q.slice() as Q });
		return { L: c(st.L), R: c(st.R) };
	}
	restore(z: unknown) {
		return this.snap(z);
	}
	view(state: unknown): RigView {
		const st = state as State;
		return { L: st.L.q.slice() as Q, R: st.R.q.slice() as Q };
	}
	lerp(a: unknown, b: unknown, al: number): RigView {
		const A = a as RigView,
			B = b as RigView;
		const l = (x: Q, y: Q): Q => [x[0] + (y[0] - x[0]) * al, x[1] + (y[1] - x[1]) * al, x[2] + (y[2] - x[2]) * al, x[3] + (y[3] - x[3]) * al];
		return { L: l(A.L, B.L), R: l(A.R, B.R) };
	}
	pose(state: unknown, id: string, t: number): GripPose {
		const tr = this.track(id as Id);
		const k = tr.r.fk((state as State)[id as Id].q, tr.toolAt(t));
		return { x: k.T.x, y: k.T.y, phi: k.a3 };
	}

	/* ---------------------------------------------------------------- RobotRig: rendering */
	/** whether arm id's jaws hold a lead at t (the in-lead's grips, the out-lead's) */
	holding(id: Id, t: number) {
		// (from just before the jaws close: the wire is already between them, it stops the fingers)
		let on = false;
		for (const g of this.B.cable.grips) if (g.id === id && g.t <= t + (g.on ? 0.05 : 0)) on = g.on;
		const O = this.B.outLead;
		if (O && O.id === id && t >= O.tG - 0.05 && t < O.tR) on = true;
		return on ? 1 : 0;
	}
	toolSt(id: Id, t: number, q?: ArrayLike<number>): ToolSt {
		const tr = this.track(id);
		// the probe's plunger: compressed by how far the arm has pushed past the contact it touches
		let comp = 0;
		for (const c of tr.touches) {
			if (t < c.t0 || t > c.t1) continue;
			const k = tr.r.fk(q ?? tr.qAt(t), 'probe');
			const d = ((k.T.x - c.P.x) * Math.cos(c.phi) + (k.T.y - c.P.y) * Math.sin(c.phi)) / tr.r.sc;
			comp = Math.max(comp, Math.min(1.6, Math.max(0, d)));
		}
		return { open: tr.grip.at(t), comp, led: tr.led.at(t), spin: tr.spin.at(t), cw: this.B.G.T.cable / this.B.G.sc, roll: tr.roll.at(t), hold: this.holding(id, t) };
	}
	frameOf(id: Id, t: number, q: ArrayLike<number>): ArmFrame {
		const tr = this.track(id);
		return { q, tool: tr.toolAt(t), st: this.toolSt(id, t, q), lock: tr.lock.at(t) };
	}
	mount(layer: SVGSVGElement, ctx: { uid: string; ground: string }) {
		const G = this.B.G;
		const toolsOf = (tr: ArmTrack) => Array.from(new Set(tr.toolEv.map((e) => e.tool)));
		const rackTools = (id: Id) => this.racks[id].map((list) => Array.from(new Set(list.map((e) => e.tool).filter((x): x is ToolName => !!x))));
		const cell = new LiveCell(layer, {
			cx: G.cx,
			floor: G.floor,
			sc: G.sc,
			theme: ctx.ground === 'blue' ? 'blue' : 'plate',
			tools: { L: toolsOf(this.L), R: toolsOf(this.R) },
			rackTools: { L: rackTools('L'), R: rackTools('R') },
			init: { L: this.frameOf('L', 0, PARK), R: this.frameOf('R', 0, PARK) },
			x4: this.B.x4,
			solo: this.B.cfg.solo,
		});
		const U = unitRobots();
		// a solo cell's partner is not drawn and never moves (vignettes): its frame is made once
		const solo = this.B.cfg.solo;
		const still: Partial<Record<Id, ArmFrame>> = {};
		const frameOf = (id: Id, t: number, q: ArrayLike<number>) => (solo && solo !== id ? (still[id] ??= this.frameOf(id, 0, PARK)) : this.frameOf(id, t, q));
		const rack: { L: [ToolName | null, ToolName | null]; R: [ToolName | null, ToolName | null] } = { L: [null, null], R: [null, null] };
		return {
			frame: (t: number, view: unknown, ex?: { nudge?: number }) => {
				const v = view as RigView;
				let qR: ArrayLike<number> = v.R;
				// the invalid-submit nudge (an event, Contact only): the gripper's tool centre point dips toward the mouth
				if (ex?.nudge) {
					const k = U.R.fk(v.R, this.R.toolAt(t));
					qR = U.R.ik({ x: k.T.x, y: k.T.y + ex.nudge }, k.a3, this.R.toolAt(t), v.R as Q, v.R[3]).q;
				}
				for (const id of ['L', 'R'] as const) {
					rack[id][0] = this.rackAt(id, 0, t);
					rack[id][1] = this.rackAt(id, 1, t);
				}
				const ks = cell.frame(frameOf('L', t, v.L), frameOf('R', t, qR), rack, this.B.dev.x4.at(t));
				if (this.fx.length) cell.setFx(this.fxAt(t, ks));
			},
			remove: () => cell.remove(),
		};
	}
	/** arm-bound effects at t (units, in the cell's scaled group): parameters for the cell's persistent nodes */
	private fxAt(t: number, ks: { L: FK; R: FK }) {
		const out: Record<Id, ArmFx> = { L: {}, R: {} };
		for (const e of this.fx) {
			const dt = t - e.t;
			if (e.k === 'click' && dt >= 0 && dt < 0.22) {
				const k = ks[e.id],
					q = prog(dt, SPRINGS.ring);
				out[e.id].click = { cx: k.F.x, cy: k.F.y, r: 6 + 9 * q, op: 0.75 * (1 - q) };
			}
			if (e.k === 'scan' && dt >= 0 && t < e.t1! + 0.15) {
				const k = ks[e.id];
				const op = Math.min(1, dt / 0.1) * (1 - clamp01((t - e.t1!) / 0.15));
				const ax = k.a3,
					L = e.len ?? 92,
					w = 0.36;
				const p1 = { x: k.T.x + Math.cos(ax - w) * L, y: k.T.y + Math.sin(ax - w) * L },
					p2 = { x: k.T.x + Math.cos(ax + w) * L, y: k.T.y + Math.sin(ax + w) * L };
				out[e.id].cone = { d: `M${f(k.T.x)} ${f(k.T.y)}L${f(p1.x)} ${f(p1.y)}L${f(p2.x)} ${f(p2.y)}Z`, op };
				const u = clamp01(dt / Math.max(0.05, e.t1! - e.t));
				const pa = { x: p1.x + (p2.x - p1.x) * u, y: p1.y + (p2.y - p1.y) * u };
				out[e.id].sweep = { x1: k.T.x, y1: k.T.y, x2: pa.x, y2: pa.y, op: 0.8 * op };
			}
		}
		return out;
	}

	/** the highest any drawn arm reaches above the bench over [t0, t1] (stage px; elbow, wrist, flange, tool tip with their
	 * caps' radii: 8, 6.5, 7 and 3 units), sampled every 20 ms; and the -X4 terminal's top */
	topAbove(t0: number, t1: number) {
		const G = this.B.G;
		let up = 0;
		for (let t = Math.max(0, t0); t <= t1 + 1e-9; t += 0.02)
			for (const id of this.ids) {
				const tr = this.track(id);
				const k = tr.r.fk(tr.qAt(t), tr.toolAt(t));
				const s = G.sc;
				up = Math.max(up, G.floor - Math.min(k.E.y - 8 * s, k.W.y - 6.5 * s, k.F.y - 7 * s, k.T.y - 3 * s));
			}
		// the -X4 test terminal (+C4) stands in the robot layer just under the duct: it is part of the cell to the end
		if (this.B.x4) up = Math.max(up, -this.B.x4.top * G.sc);
		return up;
	}

	/* ---------------------------------------------------------------- QA (robot/qa.ts) */
	qa(tEnd: number) {
		return runQa(this.B as Parameters<typeof runQa>[0], tEnd);
	}
}

/** the build-time static cell: the parked pair at t = 0 (motion, first paint) and at the end (tested) */
export function staticCellStates(rig: Rig, tEnd: number) {
	return { start: rig.cellState(0), end: rig.cellState(tEnd) };
}
export { CELL_BOX };
