/**
 * The Contact showpiece: the film, one deterministic program in the
 * site's own motion code: robot/kin.ts (analytic IK, speed and acceleration limits) and robot/arm.ts (ArmTrack: quintic ptp,
 * lin, linVia and via, the effector channels, contact windows, kicks). Every duration is what ArmTrack computes from the
 * limits; the choreography only decides WHEN a move starts, so that its hit lands on the 0.3 s grid (by waiting, never by
 * speeding a move). Units are the robot grid with the stage scale 1: the program is scale-free, compiled once (in Node for
 * the build-time QA and the poster, in the browser in idle slices), and drawn at any size by the SVG's own viewBox.
 *
 *   00 CELL ON   the plate lights (the form's mounting plate comes on with it); both arms wake and couple their first tools
 *   01 TRACE     L's camera follows the wire from end A up the drop, along the duct, down drop B (both ends found: Name),
 *                then finds end A curled away from the drawing's straight drop (Company)
 *   02 END A     L camera → gripper; the comb (loose jaws glide 6 u while 15 u of wire run through: the curl relaxes and
 *                stays relaxed); the firm grip (Email); insert into the breaker's screw clamp (What to automate); R's driver
 *                on the screw axis before it is needed: 2½ turns clockwise with torque easing, the clamp closes at 55 %, a
 *                settle (Volumes); the pull test (How today)
 *   03 END B     the open jaws follow the same wire to its other end; R driver → opener; L presents end B over the cage;
 *                R's blade goes down the 20° release slot and opens it; L inserts; R withdraws: the cage snaps shut (Message)
 *   04 ON        R opener → probe; L's fingertips carry the breaker's toggle to its dead point: it snaps ON (Consent)
 *   05 TEST      L gripper → probe; both needles on the circuit's two ends in the same frame; the test current runs the wire
 *                end to end (Send, mounted and switched on); both lift and fold home. READY: the robots parked
 *
 * Each part of the Contact form is built by the pulse its job sends (formParts below; the page draws it: form.ts). The joint
 * flex (rig.ts's model) is integrated at 120 Hz into a table.
 */
import { Chan, H } from '../core';
import { SCREW, SCREW_BITE, TOGGLE, screwTop } from '../devices';
import { ArmTrack } from '../robot/arm';
import { PARK, Robot, TOOLS, type Pt, type Q, type ToolName } from '../robot/kin';
import { FLEX } from '../robot/rig';
import type { ToolSt } from '../robot/draw';
import { CAGE_D0, CAGE_PUSH, CURL, DOWN, DUCT, F7, G, GRID, LD, REL_PHI, SEAT, TP, X0, hangEnd, qz, relAt } from './scene';

/** joint moves to and from the rack: direct (the site's toolChange) rather than folded (measured faster) */
const DIRECT = true;

/* ------------------------------------------------------------------ bookkeeping */
export type Tool = ToolName;
export type Id = 'L' | 'R';
export interface Hit {
	t: number;
	id: Id | 'C';
	k: string;
	label: string;
}
export interface Chapter {
	n: string;
	k: string;
	t0: number;
	t1: number;
}
export class Arm {
	tr: ArmTrack;
	id: Id;
	home: Record<string, number>;
	rack: { t: number; tool: Tool | null }[][];
	fx: { k: 'click' | 'scan'; t: number; t1?: number }[] = [];
	/** probe touches: the plunger compresses by how far the needle has gone past the contact */
	touches: { t0: number; t1: number; P: Pt }[] = [];
	constructor(id: Id, tool: Tool, rack: (Tool | null)[], home: Record<string, number>) {
		const rob = new Robot({ id, m: id === 'L' ? 1 : -1, sc: 1, bx: G.bx[id], floor: 0 });
		this.tr = new ArmTrack(rob, tool);
		// a bare flange: its changer's lock ring stands open
		if (tool === 'none') this.tr.lock = new Chan(0);
		this.id = id;
		this.home = home;
		this.rack = rack.map((t) => [{ t: -1e9, tool: t }]);
	}
	get tool() {
		return this.tr.tool as Tool;
	}
	rackAt(k: number, t: number) {
		let tool: Tool | null = null;
		for (const e of this.rack[k]) if (e.t <= t) tool = e.tool;
		return tool;
	}
	/** the tools this arm ever carries / ever rests in its racks (the renderer builds their nodes once) */
	tools() {
		return Array.from(new Set(this.tr.toolEv.map((e) => e.tool).filter((t) => t !== 'none')));
	}
}
/** W07's ends: what holds each end when (the wire model: free / combing / held / seated) */
export interface EndEv {
	/** A: the open jaws guide the wire up the drop until tOff, then back off (gone at tGone); the wire relaxes */
	tOff?: number;
	tGone?: number;
	tLoose: number;
	tFollow?: number;
	tGrip: number;
	sLoose: number;
	tSeat: number;
	tRel: number;
}
export interface Vf {
	t0: number;
	t1: number;
	kind: 'trace';
	marks: { t: number; k: string }[];
	look: { t: number; x: number; y: number }[];
}
export class Show {
	L: Arm;
	R: Arm;
	hits: Hit[] = [];
	chapters: Chapter[] = [];
	late: string[] = [];
	ends: { A: EndEv; B: EndEv } = {
		A: { tLoose: 1e9, tGrip: 1e9, sLoose: 0, tSeat: 1e9, tRel: 1e9 },
		B: { tLoose: 1e9, tGrip: 1e9, sLoose: 0, tSeat: 1e9, tRel: 1e9 },
	};
	/** device channels: −F7:2's screw spindle, its clamp (0 open … 1 on the copper), −F7's toggle (0 OFF … 1 ON), −X0:7's
	 * actuator (pushed 0…1) and cage jaws, the work plate's light */
	f7scr = new Chan(SCREW.rest);
	f7jaw = new Chan(0);
	f7tgl = new Chan(0);
	x0cage = new Chan(0);
	x0jaw = new Chan(0);
	plate = new Chan(0.86);
	vf: Vf[] = [];
	/** report row 07: each job writes its tick as it lands */
	ticks: { t: number; k: string }[] = [];
	tReady = 0;
	tHold = 0;
	tTouchL = 0;
	tTouchR = 0;
	/** both arms parked (the film's last move ends) */
	tPark = 0;
	tSwing = 0;
	/** the two probes' contact: the test current leaves probe A and runs the wire end to end (the Send part's job) */
	tEnergize = 0;
	changes: { id: Id; from: Tool; to: Tool; t0: number; click: number; t1: number }[] = [];
	/** 00: each arm couples its first tool from the full rack (the cell starts, and is RESET to, bare arms
	 * parked and every tool in its rack) */
	couples: { id: Id; to: Tool; t0: number; click: number; t1: number }[] = [];
	constructor() {
		// the homes: in the order each arm takes them, so every change crosses one slot (24 units)
		this.L = new Arm('L', 'none', ['camera', 'gripper', 'probe'], HOME.L);
		this.R = new Arm('R', 'none', ['driver', 'opener', 'probe'], HOME.R);
		this.L.tr.q = restQ(this.L.tr.r, 'L');
		this.R.tr.q = restQ(this.R.tr.r, 'R');
	}
	hit(t: number, id: Hit['id'], k: string, label: string) {
		this.hits.push({ t, id, k, label });
	}
	arm(id: Id) {
		return id === 'L' ? this.L : this.R;
	}
}

/** the needles stay down while the test current runs the circuit (s) */
export const TEST_HOLD = 1.2;
/** the test current's run along the wire, end A to end B (s) */
export const TEST_RUN = 0.55;

/* ------------------------------------------------------------------ skills (the site's, with a three-slot rack) */
const tcpOf = (t: Tool) => TOOLS[t].tcp;
const lenOf = (t: Tool) => TOOLS[t].len;

/** dry-run duration of fn from the arm's current pose (no side effects on the track) */
function dry(a: Arm, fn: () => void) {
	const tr = a.tr;
	const save = { segs: tr.segs.length, t: tr.t, q: tr.q.slice() as Q, log: tr.log.length, tool: tr.tool, toolEv: tr.toolEv.length, kicks: tr.kicks.length, contacts: tr.contacts.length, ev: tr.ev.length };
	const chans = [tr.grip, tr.roll, tr.lock, tr.spin, tr.comp, tr.led].map((c) => c.k.length);
	const rk = a.rack.map((r) => r.length),
		fx = a.fx.length;
	fn();
	const d = tr.t - save.t;
	tr.segs.length = save.segs;
	tr.t = save.t;
	tr.q = save.q;
	tr.log.length = save.log;
	tr.tool = save.tool;
	tr.toolEv.length = save.toolEv;
	tr.kicks.length = save.kicks;
	tr.contacts.length = save.contacts;
	tr.ev.length = save.ev;
	[tr.grip, tr.roll, tr.lock, tr.spin, tr.comp, tr.led].forEach((c, i) => (c.k.length = chans[i]));
	a.rack.forEach((r, i) => (r.length = rk[i]));
	a.fx.length = fx;
	return d;
}

/** between the work (J1 = 0) and the rack (J1 = π) */
function turnTo(a: Arm, P: Pt, phi: number, yaw: number, o: { roll?: number; speed?: number } = {}) {
	const tr = a.tr;
	const y0 = tr.q[3];
	if (DIRECT || Math.abs(y0 - yaw) < 0.1) return tr.ptp(P, phi, { yaw, roll: o.roll, speed: o.speed });
	const m = tr.r.m;
	const tuck = (yw: number) => ({ x: G.bx[a.id] + m * Math.cos(yw) * 8, y: -64 });
	return tr.via(
		[
			{ P: tuck(y0), phi: DOWN, yaw: y0 },
			{ P: tuck(yaw), phi: DOWN, yaw },
			{ P, phi, yaw },
		],
		{ blend: 0.4, roll: o.roll, speed: o.speed },
	);
}

/**
 * tool change at the rack behind the arm (the site's toolChange, three slots): turn to the rack, dock the tool in its own
 * empty slot (down, the last 6 units slowly), unlock (the lock ring turns, 0.08 s), the plate rests on the bar; the bare
 * flange crosses to the next tool; couple (settle, the lock ring snaps on its spring, a click ring, a small kick); lift
 * clear by the tool's length. `clickAt`: the couple lands on that time (by waiting). Returns the click time.
 */
function toolChange(S: Show, a: Arm, nt: Tool, o: { clickAt?: number } = {}) {
	const tr = a.tr;
	const slots = G.slots[a.id];
	const fDock = G.dockF;
	const at = (k: number, tool: Tool, y: number) => ({ x: slots[k], y: y + (tool === 'none' ? 0 : tcpOf(tool)) });
	const clear = (tool: Tool) => fDock - (lenOf(tool) + 10 + G.plateT);
	const tool = a.tool;
	const tStart = tr.t;
	const put = a.home[tool],
		take = a.home[nt];
	if (tool === 'gripper' && tr.grip.end() > 0.01) tr.grip.to(tr.t, 0, 0.1, 'smooth');
	if (Math.abs(tr.roll.end()) > 1e-3) tr.roll.to(tr.t, 0, 0.3, 'quint');
	turnTo(a, at(put, tool, clear(tool)), DOWN, Math.PI, { roll: 0 });
	const ta = tr.t;
	tr.linVia([{ P: at(put, tool, fDock - 6) }, { P: at(put, tool, fDock) }], { v: 230, blend: 0.25 });
	const td = tr.t;
	tr.event('dock', { flange: true });
	tr.hold(0.05);
	tr.lock.to(tr.t, 0, 0.08, 'smooth');
	tr.hold(0.08);
	a.rack[put].push({ t: tr.t, tool });
	if (tool === 'camera' || tool === 'probe') tr.led.to(tr.t, 0, 0, 'step');
	tr.setTool('none');
	tr.contact(Math.max(ta, td - 0.12), tr.t);
	const up = fDock - 6;
	const tb = tr.t;
	if (nt === 'gripper') tr.grip.to(tb, 0, 0, 'step');
	// the bare flange lifts off the docked plate first (it never rests on it while it waits), then crosses one slot
	tr.lin(at(put, 'none', up), DOWN, { v: 220 });
	const cross = () => tr.linVia([{ P: at(take, 'none', up) }, { P: at(take, 'none', fDock) }], { v: 220, blend: 0.3 });
	if (o.clickAt != null) {
		const d = dry(a, cross);
		tr.wait(o.clickAt - 0.05 - d);
	}
	cross();
	const tcp = tr.t;
	tr.hold(0.05);
	tr.event('couple', { flange: true });
	a.rack[take].push({ t: tr.t, tool: null });
	tr.setTool(nt);
	tr.lock.to(tr.t, 1, 0, 'spring:pop');
	tr.kickDir({ x: 0, y: -1 }, 2);
	a.fx.push({ k: 'click', t: tr.t + 0.02 });
	const tClick = tr.t;
	S.hit(tClick, a.id, 'click', `${a.id} couples ${nt}`);
	tr.hold(0.07);
	tr.contact(Math.max(tb + 0.25, tcp - 0.12), tr.t + 0.1);
	tr.linVia([{ P: at(take, nt, fDock - 5) }, { P: at(take, nt, clear(nt)) }], { v: 260, blend: 0.25 });
	if (nt === 'gripper') tr.grip.to(tr.t, 1, 0.1, 'smooth');
	S.changes.push({ id: a.id, from: tool, to: nt, t0: tStart, click: tClick, t1: tr.t });
	return tClick;
}
/** the click time of a tool change started now (dry run) */
function changeClick(S: Show, a: Arm, nt: Tool) {
	let c = 0;
	const h = S.hits.length;
	const ch = S.changes.length;
	dry(a, () => {
		c = toolChange(S, a, nt);
	});
	S.hits.length = h;
	S.changes.length = ch;
	return c;
}

/** where the cell rests (film t = 0, and the end of a RESET): each bare flange waiting over its first tool, 6 units above
 * the plate, the arm turned to its rack (J1 = π) */
export const FIRST: Record<Id, Tool> = { L: 'camera', R: 'driver' };
const HOME: Record<Id, Record<string, number>> = { L: { camera: 0, gripper: 1, probe: 2 }, R: { driver: 0, opener: 1, probe: 2 } };
export const hoverAt = (id: Id, k: number) => ({ x: G.slots[id][k], y: G.dockF - 6 });
export function restQ(rob: Robot, id: Id): Q {
	return rob.ik(hoverAt(id, HOME[id][FIRST[id]]), DOWN, 'none', [PARK[0], PARK[1], PARK[2], Math.PI], Math.PI).q;
}
/**
 * the first coupling (00): from the rest pose the bare flange comes down on its first tool's plate (slowly), couples
 * (settle, the lock ring snaps on its spring, a click ring, a small kick) and lifts it clear. `clickAt`: the couple lands on
 * that time (by waiting). Returns the click time
 */
function takeTool(S: Show, a: Arm, nt: Tool, o: { clickAt?: number } = {}) {
	const tr = a.tr;
	const slots = G.slots[a.id];
	const fDock = G.dockF;
	const at = (k: number, tool: Tool, y: number) => ({ x: slots[k], y: y + (tool === 'none' ? 0 : tcpOf(tool)) });
	const clear = (tool: Tool) => fDock - (lenOf(tool) + 10 + G.plateT);
	const take = a.home[nt];
	if (nt === 'gripper') tr.grip.to(tr.t, 0, 0, 'step');
	const go = () => tr.lin(at(take, 'none', fDock), DOWN, { v: 70 });
	if (o.clickAt != null) tr.wait(o.clickAt - 0.05 - dry(a, go));
	const tStart = tr.t;
	go();
	const tcp = tr.t;
	tr.hold(0.05);
	tr.event('couple', { flange: true });
	a.rack[take].push({ t: tr.t, tool: null });
	tr.setTool(nt);
	tr.lock.to(tr.t, 1, 0, 'spring:pop');
	tr.kickDir({ x: 0, y: -1 }, 2);
	a.fx.push({ k: 'click', t: tr.t + 0.02 });
	const tClick = tr.t;
	S.hit(tClick, a.id, 'click', `${a.id} couples ${nt}`);
	tr.hold(0.07);
	tr.contact(tcp - 0.12, tr.t + 0.1);
	tr.linVia([{ P: at(take, nt, fDock - 5) }, { P: at(take, nt, clear(nt)) }], { v: 260, blend: 0.25 });
	if (nt === 'gripper') tr.grip.to(tr.t, 1, 0.1, 'smooth');
	S.couples.push({ id: a.id, to: nt, t0: tStart, click: tClick, t1: tr.t });
	return tClick;
}

/** the click time of a first coupling started now (dry run) */
function coupleClick(S: Show, a: Arm, nt: Tool) {
	let c = 0;
	const h = S.hits.length,
		cp = S.couples.length;
	dry(a, () => {
		c = takeTool(S, a, nt);
	});
	S.hits.length = h;
	S.couples.length = cp;
	return c;
}

/**
 * a move that crosses a hanging wire in the screen's projection: the arm passes IN FRONT of it (as a real arm moves round a
 * wire in 3D): blended joint-space via points with the base turned by `yaw` (the tool ≥ 8 u nearer the viewer than the
 * wire's plane, QA), back to J1 = 0 at the end. At 0.3 rad the arm is foreshortened by 4 %: it reads as passing in front
 */
function viaFront(a: Arm, pts: { P: Pt; phi: number }[], end: { P: Pt; phi: number }, o: { yaw?: number; roll?: number; blend?: number } = {}) {
	const y = o.yaw ?? 0.3;
	return a.tr.via([...pts.map((p) => ({ ...p, yaw: y })), { ...end, yaw: 0 }], { blend: o.blend ?? 0.35, roll: o.roll });
}
/** the parked pose a little higher than the site's PARK: the long tools hang clear of the device tabs */
export function parkHigh(rob: Robot, tool: Tool) {
	const k = rob.fk(PARK, tool);
	return rob.ik({ x: k.T.x, y: Math.min(k.T.y, -24 + (tool === 'camera' || tool === 'gripper' ? 6 : 0)) }, DOWN, tool, PARK, 0).q;
}

/** probe touch: down its axis, the last 4 units slowly, the needle bottoms, 1.2 overtravel into the plunger, LED +60 ms */
function touch(a: Arm, tp: Pt, o: { at: number; until?: number }) {
	const tr = a.tr;
	const stroke = dry(a, () => {
		tr.lin({ x: tp.x, y: tp.y - 4 }, DOWN, { v: 160 });
		tr.lin(tp, DOWN, { v: 40 });
	});
	tr.wait(o.at - stroke);
	tr.lin({ x: tp.x, y: tp.y - 4 }, DOWN, { v: 160 });
	tr.lin(tp, DOWN, { v: 40 });
	const tc = tr.t;
	tr.event('touch', { P: tp });
	a.touches.push({ t0: tc, t1: o.until ?? Infinity, P: tp });
	tr.lin({ x: tp.x, y: tp.y + 1.2 }, DOWN, { T: 0.06 });
	tr.led.to(tc + 0.06, 1, 0.05, 'smooth');
	tr.kickDir({ x: 0, y: 1 }, 2, tc);
	tr.contact(tc, o.until ?? 1e9);
	return tc;
}

/* ------------------------------------------------------------------ the choreography */
/** the film, authored in steps (one per chapter): the browser compiles it in idle slices */
export function* buildSteps(): Generator<void, Show> {
	const S = new Show();
	const { L, R } = S;
	const ch = (n: string, k: string, t0: number, t1: number) => S.chapters.push({ n, k, t0, t1 });

	/* ---------------- 00 · the cell lights; W07's two ends hang where they were laid, one damped swing; both arms wake and
	   couple their first tools (L the camera, R two grid steps later the screwdriver: overlap, never in unison) */
	S.plate.to(0.15, 1, 0.45, 'out');
	S.tSwing = 0.2;
	L.tr.wait(0.3);
	const cL = qz(coupleClick(S, L, 'camera'));
	takeTool(S, L, 'camera', { clickAt: cL });
	L.tr.led.to(L.tr.t, 1, 0.1, 'smooth');
	takeTool(S, R, 'driver', { clickAt: qz(Math.max(coupleClick(S, R, 'driver'), cL + 0.6)) });
	// R takes the screwdriver home (its first job is at end A)
	R.tr.ptpQ(parkHigh(R.tr.r, 'driver'));

	/* ---------------- 01 TRACE · L's camera follows W07 from one end to the other (vision job 1) */
	const cam = { x: -46, y: -64 };
	const aim = (p: Pt) => Math.atan2(p.y - cam.y, p.x - cam.x);
	const lookA = { x: DUCT.slotA - 5, y: -23 },
		lookD = { x: (DUCT.slotA + DUCT.slotB) / 2, y: -96 },
		lookB = { x: DUCT.slotB, y: -17 };
	const t1 = L.tr.t;
	L.tr.ptp(cam, aim(lookA), {});
	const vf0 = qz(L.tr.t + 0.05);
	L.tr.wait(vf0);
	L.fx.push({ k: 'scan', t: vf0, t1: 0 });
	// the trace: the look point runs up drop A, along the duct, down drop B (the lens turns about itself)
	const trace = { t0: vf0 + 0.2, t1: 0 };
	L.tr.hold(0.2);
	L.tr.lin(cam, aim(lookD), { T: 0.62 });
	L.tr.lin(cam, aim(lookB), { T: 0.62 });
	trace.t1 = L.tr.t;
	const tEnds = qz(trace.t1 + 0.1);
	S.hit(tEnds, 'L', 'lock', 'END A · END B · one wire');
	L.tr.wait(tEnds + 0.15);
	L.tr.lin(cam, aim(lookA), { T: 0.42 });
	const tDelta = qz(L.tr.t + 0.05);
	S.hit(tDelta, 'L', 'delta', 'END A curled · Δ 22 mm → comb');
	L.tr.wait(tDelta + 0.3);
	const vf1 = L.tr.t;
	L.fx[L.fx.length - 1].t1 = vf1;
	S.vf.push({
		t0: vf0,
		t1: vf1 + 0.15,
		kind: 'trace',
		marks: [
			{ t: vf0 + 0.1, k: 'endA' },
			{ t: trace.t0, k: 'trace' },
			{ t: tEnds, k: 'ends' },
			{ t: tEnds + 0.3, k: 'row' },
			{ t: tDelta, k: 'delta' },
		],
		look: [
			{ t: vf0, ...lookA },
			{ t: trace.t0, ...lookA },
			{ t: trace.t0 + 0.62, ...lookD },
			{ t: trace.t1, ...lookB },
			{ t: tEnds + 0.15, ...lookB },
			{ t: tEnds + 0.57, ...lookA },
		],
	});
	S.ticks.push({ t: tDelta, k: 'trace' });
	ch('01', 'trace', t1, vf1 + 0.15);
	yield;

	/* ---------------- 02 END A → −F7:2 · comb, grip, insert; R's driver on the screw axis; 2½ turns; pull test */
	toolChange(S, L, 'gripper', { clickAt: qz(changeClick(S, L, 'gripper')) });
	const across = 0; // L's tool axis: horizontal, toward R (the transverse wire grasp)
	const sLoose = LD.A - G.GIA - 15;
	const pLoose = { x: DUCT.slotA, y: DUCT.y1 + sLoose };
	const pFirm = { x: DUCT.slotA, y: pLoose.y + 6 };
	L.tr.via(
		[
			{ P: { x: -52, y: -76 }, phi: 0.2, yaw: 0 },
			{ P: { x: pLoose.x - 14, y: pLoose.y }, phi: across, yaw: 0 },
		],
		{ blend: 0.4, roll: Math.PI / 2 },
	);
	L.tr.hold(0.06);
	const inMv = () => L.tr.lin(pLoose, across, { v: 110 });
	const tLoose = qz(L.tr.t + dry(L, inMv) + 0.08);
	L.tr.wait(tLoose - 0.08 - dry(L, inMv));
	inMv();
	L.tr.grip.to(L.tr.t, 0.42, 0.08, 'smooth');
	L.tr.hold(0.08);
	S.ends.A.tLoose = L.tr.t;
	S.ends.A.sLoose = sLoose;
	S.hit(L.tr.t, 'L', 'comb', 'comb: loose jaws on drop A');
	L.tr.lin(pFirm, across, { v: 10 });
	const tFirm = qz(L.tr.t + 0.08);
	L.tr.wait(tFirm - 0.08);
	L.tr.gripTo(0, 0.08);
	S.ends.A.tGrip = L.tr.t;
	L.tr.event('grip', { P: pFirm });
	S.hit(L.tr.t, 'L', 'grip', 'firm grip, 9 above the end');
	// R unparks with the screwdriver while L carries, and waits over −F7:2's screw axis (anticipation)
	const scr = { x: F7.s2, y: screwTop(SCREW.rest) + SCREW_BITE };
	R.tr.wait(tFirm - 0.2);
	viaFront(R, [{ P: { x: 26, y: -48 }, phi: DOWN }, { P: { x: 4, y: -46 }, phi: DOWN }], { P: { x: scr.x + 3, y: scr.y - 30 }, phi: DOWN });
	R.tr.lin({ x: scr.x, y: scr.y - 20 }, DOWN, { v: 120 });
	// carry: up 4 (the tail clears), across on a raised arc, 4 over the mouth, a 1-unit correction, the last 4 slowly
	const gA = { x: SEAT.A.x, y: SEAT.A.y - G.GIA };
	L.tr.linVia([{ P: { x: pFirm.x + 1.5, y: pFirm.y - 4 } }, { P: { x: gA.x + 1, y: gA.y - 4 } }], { v: 110, blend: 0.4 });
	L.tr.hold(0.1);
	L.tr.lin({ x: gA.x, y: gA.y - 4 }, across, { T: 0.14 });
	const insMv = () => L.tr.lin(gA, across, { v: 26 });
	const tSeatA = qz(Math.max(L.tr.t + dry(L, insMv), R.tr.t + 0.1));
	L.tr.wait(tSeatA - dry(L, insMv));
	insMv();
	S.ends.A.tSeat = L.tr.t;
	L.tr.event('seat', { P: gA });
	L.tr.kickDir({ x: 0, y: -1 }, 3);
	L.tr.contact(L.tr.t, L.tr.t + 4);
	S.hit(L.tr.t, 'L', 'seat', 'end A in −F7:2 · held');
	// R: down the screw axis into the slot; a search turn; 2½ turns clockwise (torque easing); settle; back off slowly
	R.tr.wait(tSeatA + 0.08);
	R.tr.lin({ x: scr.x, y: scr.y - 4 }, DOWN, { v: 160 });
	R.tr.lin(scr, DOWN, { v: 36 });
	const tEng = R.tr.t;
	R.tr.event('screw engaged', { P: scr });
	R.tr.spin.to(tEng, 0.26, 0.12, 'smooth');
	R.tr.hold(0.16);
	const t0s = qz(R.tr.t),
		dur = 1.2,
		Aturn = 2.5 * 2 * Math.PI;
	R.tr.wait(t0s);
	R.tr.spin.to(t0s, 0.26 + Aturn, dur, 'torque').to(t0s + dur, 0.26 + Aturn + 0.07, 0, 'spring:pop');
	S.f7scr.to(t0s, SCREW.rest + Aturn, dur, 'torque').to(t0s + dur, SCREW.rest + Aturn + 0.07, 0, 'spring:pop');
	S.f7jaw.to(t0s + 0.55 * dur, 1, 0.12, 'spring:jaw');
	R.tr.lin({ x: scr.x, y: scr.y + 1.25 }, DOWN, { T: dur });
	R.tr.kickDir({ x: 0, y: 1 }, 2, t0s + dur);
	const tTight = t0s + dur;
	S.hit(tTight, 'R', 'torque', 'torque settle · 0.5 N·m [SIM]');
	R.tr.hold(0.1);
	R.tr.contact(tEng, R.tr.t);
	R.tr.lin({ x: scr.x, y: scr.y - 1 }, DOWN, { v: 20 });
	R.tr.lin({ x: scr.x, y: scr.y - 22 }, DOWN, { v: 200 });
	// L: the pull test (a 1.5-unit tug, held 0.3 s: the lead holds), then the jaws open around the wire
	const tPull = qz(tTight + 0.45);
	L.tr.wait(tPull - 0.15);
	L.tr.rel(0, -1.5, { T: 0.15 });
	L.tr.hold(0.3);
	L.tr.rel(0, 1.5, { T: 0.12 });
	S.hit(tPull + 0.3, 'L', 'pull', 'pull test ✓');
	S.ticks.push({ t: tPull + 0.3, k: 'endA' });
	L.tr.grip.to(L.tr.t, 0.55, 0.08, 'smooth');
	S.ends.A.tRel = L.tr.t - 0.04;
	L.tr.hold(0.08);
	ch('02', 'endA', vf1 + 0.15, L.tr.t);
	yield;

	/* ---------------- 03 END B → −X0:7 · the hand follows the wire to its other end; the cage, two hands */
	viaFront(R, [{ P: { x: scr.x + 4, y: -46 }, phi: DOWN }, { P: { x: 26, y: -48 }, phi: DOWN }], { P: { x: 40, y: -48 }, phi: DOWN });
	toolChange(S, R, 'opener', { clickAt: qz(changeClick(S, R, 'opener')) });
	const t3 = L.tr.t;
	const topY = DUCT.y1 + 12;
	const gB0 = hangEnd({ x: DUCT.slotB, y: DUCT.y1 }, LD.B, CURL.B.Lc, CURL.B.ang, CURL.B.sign, LD.B - G.GIB);
	L.tr.lin({ x: SEAT.A.x, y: topY }, across, { v: 120 });
	S.ends.A.tOff = L.tr.t;
	L.tr.axis(-7, { v: 120 });
	S.ends.A.tGone = L.tr.t;
	{
		// turn toward the viewer where it stands, cross in front of drop A, come back into the wires' plane before drop B
		const p0 = L.tr.pose().P;
		viaFront(L, [{ P: { x: p0.x, y: p0.y }, phi: across }, { P: { x: DUCT.slotB - 6, y: topY + 2 }, phi: across }], { P: { x: DUCT.slotB - 3, y: topY }, phi: across }, { yaw: 0.3 });
	}
	L.tr.lin({ x: DUCT.slotB, y: topY }, across, { v: 120 });
	S.ends.B.tFollow = L.tr.t;
	L.tr.lin({ x: DUCT.slotB, y: gB0.y }, across, { v: 120 });
	const tGB = qz(L.tr.t + 0.08);
	L.tr.wait(tGB - 0.08);
	L.tr.gripTo(0, 0.08);
	S.ends.B.tLoose = S.ends.B.tGrip = L.tr.t;
	L.tr.event('grip', { P: gB0 });
	S.hit(L.tr.t, 'L', 'grip', 'end B across the jaws');
	// carry on a raised arc (mid point 8 up) and present the copper 2.5 units over mouth 7
	const gB = { x: SEAT.B.x, y: SEAT.B.y - G.GIB };
	const pre = { x: gB.x, y: gB.y - 2.5 };
	L.tr.linVia([{ P: { x: (gB0.x + pre.x) / 2, y: Math.min(gB0.y, pre.y) - 8 } }, { P: { x: pre.x, y: pre.y - 4 } }, { P: pre }], { v: 140, blend: 0.45 });
	const tPresent = L.tr.t;
	// R: down the slot (fast, the last 6 slowly), on the actuator, then 3 units on against the spring (decelerating)
	R.tr.ptp(relAt(-14), REL_PHI, {});
	const rIn = () => {
		R.tr.lin(relAt(-6), REL_PHI, { v: 200 });
		R.tr.lin(relAt(CAGE_D0), REL_PHI, { v: 45 });
	};
	R.tr.wait(Math.max(R.tr.t, tPresent - dry(R, rIn) + 0.15));
	rIn();
	const tEngC = R.tr.t;
	R.tr.event('cage engaged', { P: relAt(CAGE_D0) });
	R.tr.hold(0.06);
	const tOpen0 = qz(R.tr.t + 0.26) - 0.26;
	R.tr.wait(tOpen0);
	R.tr.lin(relAt(CAGE_D0 + CAGE_PUSH), REL_PHI, { T: 0.26 });
	S.x0cage.to(tOpen0, 1, 0.26, 'out');
	const tOpen = tOpen0 + 0.26;
	S.hit(tOpen, 'R', 'open', 'cage open');
	// L inserts: the last 2.5 slowly; seat on the grid
	const insB = () => L.tr.lin(gB, across, { v: 26 });
	const tSeatB = qz(Math.max(L.tr.t, tOpen + 0.05) + dry(L, insB));
	L.tr.wait(tSeatB - dry(L, insB));
	insB();
	S.ends.B.tSeat = L.tr.t;
	L.tr.event('seat', { P: gB });
	L.tr.kickDir({ x: 0, y: -1 }, 3);
	L.tr.contact(L.tr.t, L.tr.t + 1);
	S.hit(L.tr.t, 'L', 'seat', 'end B in the open cage');
	// R withdraws two grid steps later: the actuator springs back, the cage snaps shut with one bounce
	const tSnap = tSeatB + 0.6;
	R.tr.wait(tSnap - 0.1);
	R.tr.lin(relAt(CAGE_D0), REL_PHI, { T: 0.1 });
	S.x0cage.to(tSnap - 0.1, 0, 0, 'spring:cage');
	S.x0jaw.to(tSnap - 0.04, 1, 0, 'spring:cage');
	S.hit(tSnap, 'R', 'snap', 'cage snaps shut');
	R.tr.contact(tEngC, R.tr.t);
	R.tr.lin(relAt(-2), REL_PHI, { v: 30 });
	R.tr.lin(relAt(-24), REL_PHI, { v: 200 });
	S.ticks.push({ t: tSnap, k: 'endB' });
	L.tr.wait(tSnap + 0.15);
	L.tr.gripTo(1, 0.08);
	S.ends.B.tRel = L.tr.t - 0.04;
	L.tr.axis(-10, { v: 150 });
	L.tr.rel(0, -10, { v: 180 });
	ch('03', 'endB', t3, tSnap + 0.3);
	yield;

	/* ---------------- 04 −F7 ON · both ends landed: L's closed fingertips carry the toggle to its dead point; it snaps ON
	   by itself while the hand already lifts (the test path will run through its contacts) */
	toolChange(S, R, 'probe', { clickAt: qz(changeClick(S, R, 'probe')) });
	const lev = TOGGLE.len,
		lean = TOGGLE.lean;
	// OFF leans toward −F7:1 (the supply side), ON toward −F7:2: the fingertips push from the supply side, where the gripper
	// keeps clear of both wires (drop A's slack bows toward the toggle)
	const knob = (u: number) => {
		const th = -lean * (1 - 2 * u);
		return { x: F7.piv + Math.sin(th) * lev, y: G.tabTop - Math.cos(th) * lev };
	};
	const k0 = knob(0),
		kD = knob(0.5);
	// the fingertips (closed, rolled across: ±2.9 u in projection) touch the knob's −F7:2 side
	const tip = (k: Pt) => ({ x: k.x - TOGGLE.knob - 3.3, y: k.y - 0.6 });
	const t4 = tSnap + 0.3;
	L.tr.grip.to(L.tr.t, 0, 0.1, 'smooth');
	viaFront(L, [{ P: { x: 12, y: -44 }, phi: 0.5 }, { P: { x: -8, y: -42 }, phi: 1.1 }, { P: { x: tip(k0).x + 2, y: tip(k0).y - 18 }, phi: DOWN }], { P: { x: tip(k0).x, y: tip(k0).y - 12 }, phi: DOWN }, { roll: Math.PI / 2, yaw: 0.3 });
	L.tr.lin(tip(k0), DOWN, { v: 120 });
	const tKnob = L.tr.t;
	L.tr.hold(0.08);
	const tPush0 = qz(L.tr.t + 0.42) - 0.42;
	L.tr.wait(tPush0);
	L.tr.lin(tip(kD), DOWN, { T: 0.42 });
	L.tr.event('knob push', { P: tip(kD) });
	// the fingertips on the knob: the contact window (no flex; the QA lets the fingers touch the toggle)
	L.tr.contact(tKnob - 0.04, tPush0 + 0.42 + 0.06);
	S.f7tgl.to(tPush0, 0.5, 0.42, 'out').to(tPush0 + 0.42, 1, 0, 'spring:lever');
	const tOn = tPush0 + 0.42;
	S.hit(tOn, 'L', 'on', '−F7 ON');
	S.ticks.push({ t: tOn, k: 'on' });
	L.tr.lin({ x: tip(kD).x - 1, y: tip(kD).y - 2.5 }, DOWN, { T: 0.12 });
	L.tr.lin({ x: tip(kD).x - 1, y: tip(kD).y - 16 }, DOWN, { v: 220 });
	ch('04', 'on', t4, tOn + 0.6);
	yield;

	/* ---------------- 05 TEST · L gripper → probe (R took its probe during the toggle); both needles go down on the circuit's
	   two ends in the same frame (A on −F7:1's screw head, B into the test socket T7): the test current runs the wire end to
	   end; a breath; both needles lift and both arms fold home with their probes (the robots park) */
	const t5 = L.tr.t;
	toolChange(S, L, 'probe', { clickAt: qz(changeClick(S, L, 'probe')) });
	R.tr.ptp({ x: X0.t7 + 6, y: -40 }, DOWN, {});
	L.tr.ptp({ x: TP.f71.x, y: TP.f71.y - 10 }, DOWN, {});
	R.tr.ptp({ x: TP.t7.x, y: G.tabTop - 16 }, DOWN, {});
	const strokeOf = (a: Arm, P: Pt) => dry(a, () => (a.tr.lin({ x: P.x, y: P.y - 4 }, DOWN, { v: 160 }), a.tr.lin(P, DOWN, { v: 40 })));
	const tTut = qz(Math.max(L.tr.t + strokeOf(L, TP.f71), R.tr.t + strokeOf(R, TP.t7)));
	// the needles stay down while the test current runs the circuit, then lift together (on the grid)
	const tLift = qz(tTut + TEST_HOLD);
	S.tTouchL = touch(L, TP.f71, { at: tTut, until: tLift + 0.1 });
	S.tTouchR = touch(R, TP.t7, { at: tTut, until: tLift + 0.1 });
	S.hit(S.tTouchL, 'L', 'touch', 'probe A on −F7:1');
	S.hit(S.tTouchR, 'R', 'touch', 'probe B in T7 (same frame)');
	// the test current leaves probe A 60 ms after both needles bottom (with their LEDs)
	S.tEnergize = S.tTouchL + 0.06;
	for (const a of [L, R]) {
		const P = a === L ? TP.f71 : TP.t7;
		a.tr.wait(tLift);
		a.tr.lin({ x: P.x, y: P.y - 14 }, DOWN, { T: 0.5 });
		a.tr.led.to(tLift + 0.1, 0, 0.12, 'smooth');
		a.tr.ptpQ(parkHigh(a.tr.r, 'probe'), { T: 0.8 });
	}
	S.tPark = Math.max(L.tr.t, R.tr.t);
	S.tReady = qz(S.tPark + 0.15);
	S.tHold = S.tReady + 0.4;
	S.ticks.push({ t: S.tReady, k: 'ready' });
	ch('05', 'test', t5, S.tReady);
	// chapter 00 is the cell coming on (before the first job)
	S.chapters.unshift({ n: '00', k: 'cell', t0: 0, t1: S.chapters[0].t0 });
	L.tr.wait(S.tHold);
	R.tr.wait(S.tHold);
	return S;
}
export function build(): Show {
	const g = buildSteps();
	let r = g.next();
	while (!r.done) r = g.next();
	return r.value;
}

/* ------------------------------------------------------------------ the joint flex (rig.ts's model), as a table */
const COUPLE = [1, 1, 0.6, 0.5];
export interface FlexTable {
	n: number;
	t0: number;
	/** per step: L q0..q3, R q0..q3 (the drawn joints) */
	q: Float64Array;
}
/** integrate the flex of the given tracks from t0 over [t0, t1] at 120 Hz: rig.ts's ë = −ω²e − 2ζωė − κ·q̈_cmd, kicks,
 * held off in contact windows, never more than FLEX.max units at the tool */
export function* flexSteps(tracks: [ArmTrack, ArmTrack], t0: number, t1: number, chunk = 240): Generator<void, FlexTable> {
	const n = Math.ceil((t1 - t0) / H) + 1;
	const out = new Float64Array(n * 8);
	const w2 = FLEX.w * FLEX.w,
		c = 2 * FLEX.z * FLEX.w;
	const st = tracks.map((tr) => ({ tr, e: [0, 0, 0, 0], v: [0, 0, 0, 0], qm: null as Q | null, qmm: null as Q | null, ki: tr.kicks.findIndex((k) => k.t > t0) }));
	for (const s of st) if (s.ki < 0) s.ki = s.tr.kicks.length;
	for (let i = 0; i < n; i++) {
		const t = t0 + i * H;
		st.forEach((F, a) => {
			const tr = F.tr;
			const qc = tr.qAt(t);
			if (F.qm) {
				for (let k = 0; k < 4; k++) {
					const acc = F.qmm ? (qc[k] - 2 * F.qm[k] + F.qmm[k]) / (H * H) : 0;
					const ac = -w2 * F.e[k] - c * F.v[k] - FLEX.k * COUPLE[k] * acc;
					F.v[k] += ac * H;
					F.e[k] += F.v[k] * H;
				}
			}
			while (F.ki < tr.kicks.length && tr.kicks[F.ki].t <= t) {
				const kv = tr.kicks[F.ki++].v;
				for (let k = 0; k < 3; k++) F.v[k] += kv[k];
			}
			F.qmm = F.qm;
			F.qm = qc;
			const hold = 1 - tr.inContact(t);
			const d = [F.e[0] * hold, F.e[1] * hold, F.e[2] * hold, F.e[3] * hold];
			if (hold > 0) {
				const tool = tr.toolAt(t);
				const kc = tr.r.fk(qc, tool),
					kd = tr.r.fk([qc[0] + d[0], qc[1] + d[1], qc[2] + d[2], qc[3] + d[3]], tool);
				const off = Math.hypot(kd.T.x - kc.T.x, kd.T.y - kc.T.y);
				if (off > FLEX.max) for (let k = 0; k < 4; k++) d[k] *= FLEX.max / off;
			}
			for (let k = 0; k < 4; k++) out[i * 8 + a * 4 + k] = qc[k] + d[k];
		});
		if (i % chunk === chunk - 1) yield;
	}
	return { n, t0, q: out };
}
export function flexAt(F: FlexTable, id: Id, t: number, out: number[] = [0, 0, 0, 0]) {
	const x = Math.max(0, Math.min(F.n - 1, (t - F.t0) / H));
	const i = Math.min(F.n - 2, Math.floor(x)),
		u = x - i;
	const o = id === 'L' ? 0 : 4;
	for (let k = 0; k < 4; k++) {
		const a = F.q[i * 8 + o + k],
			b = F.q[(i + 1) * 8 + o + k];
		out[k] = a + (b - a) * u;
	}
	return out;
}

/* ------------------------------------------------------------------ the form's parts */
/** the Contact form's parts, top to bottom, as the page names them ([data-part] in Contact.astro) */
export const PARTS = ['name', 'company', 'email', 'phone', 'boards', 'volumes', 'eplan', 'process', 'consent', 'send'] as const;
export type PartId = (typeof PARTS)[number];
/** where a part's pulse leaves the work: up drop A or drop B from its end (or a point that far from it) into the duct */
export type PartSrc = { k: 'A' | 'B'; fromEnd: number };
export interface Part {
	id: PartId;
	/** the film time the job lands (the pulse leaves the work then) */
	t: number;
	src: PartSrc;
	/** the job that lands it (a label) */
	job: string;
}
/**
 * Each job's hit builds one part: the camera's two findings, the hand taking the curled end
 * (the comb), the insert into the screw clamp, the screw's torque settle, the pull test, the hand finding end B, the cage
 * snapping shut on it (the checkbox snaps in), the two-probe test (Send, once the test current has run the wire end to end).
 * The breaker ON builds no part: it powers what is built (form.ts: the surge through the laid harness, every terminal blinks)
 */
export function formParts(S: Show): Part[] {
	const hit = (k: string, n = 0) => S.hits.filter((h) => h.k === k)[n]?.t;
	const need = (v: number | undefined, k: string) => {
		if (v == null) throw new Error(`showpiece: no ${k} hit`);
		return v;
	};
	return [
		{ id: 'name', t: need(hit('lock'), 'lock'), src: { k: 'B', fromEnd: 0 }, job: 'trace' },
		{ id: 'company', t: need(hit('delta'), 'delta'), src: { k: 'A', fromEnd: 0 }, job: 'delta' },
		{ id: 'email', t: need(hit('comb'), 'comb'), src: { k: 'A', fromEnd: G.GIA + 15 }, job: 'comb' },
		{ id: 'phone', t: need(hit('grip', 0), 'grip'), src: { k: 'A', fromEnd: G.GIA }, job: 'gripA' },
		{ id: 'boards', t: need(hit('seat', 0), 'seat'), src: { k: 'A', fromEnd: 0 }, job: 'seat' },
		{ id: 'volumes', t: need(hit('torque'), 'torque'), src: { k: 'A', fromEnd: 0 }, job: 'torque' },
		{ id: 'eplan', t: need(hit('pull'), 'pull'), src: { k: 'A', fromEnd: 0 }, job: 'pull' },
		{ id: 'process', t: need(hit('grip', 1), 'grip'), src: { k: 'B', fromEnd: G.GIB }, job: 'gripB' },
		{ id: 'consent', t: need(hit('snap'), 'snap'), src: { k: 'B', fromEnd: 0 }, job: 'snap' },
		{ id: 'send', t: S.tEnergize + TEST_RUN, src: { k: 'B', fromEnd: 0 }, job: 'test' },
	];
}

/* ------------------------------------------------------------------ RESET: the cell back to rest */
/** the cell's state where a RESET starts (commanded joints, effectors, devices, W07's ends, the racks) */
export interface ResetSrc {
	/** the film time the devices, racks and wire come from */
	t: number;
	q: Record<Id, Q>;
	tool: Record<Id, Tool>;
	grip: Record<Id, number>;
	roll: Record<Id, number>;
	led: Record<Id, number>;
	/** a probe needle touching (its plunger relaxes as it lifts) */
	touch: Record<Id, Pt | null>;
	dev: { scr: number; jawA: number; tgl: number; cage: number; jawB: number; plate: number };
	seated: { A: boolean; B: boolean };
	held: { A: boolean; B: boolean };
	rack: Record<Id, (Tool | null)[]>;
	/** the circuit was tested: the connector's centre pin is lit */
	pin: number;
}
export interface ResetBranch {
	L: ArmTrack;
	R: ArmTrack;
	/** the racks from τ 0: each slot's tool and when a tool lands in it */
	rack: Record<Id, { k: number; t: number; tool: Tool | null }[]>;
	scr: Chan;
	jawA: Chan;
	tgl: Chan;
	cage: Chan;
	jawB: Chan;
	plate: Chan;
	/** when each end of W07 is let go and springs back to its curled hang (τ) */
	rel: { A: number; B: number };
	/** end B held across L's jaws (not seated): the hand carries it back under its slot before letting go (τ < rel.B) */
	carryB: boolean;
	touches: Record<Id, { t0: number; P: Pt }[]>;
	tEnd: number;
	flex: FlexTable | null;
	src: ResetSrc;
}
/** the cell at film time t (a rest the clock has stopped on) */
export function filmSrc(S: Show, t: number): ResetSrc {
	const one = <T>(f: (a: Arm) => T): Record<Id, T> => ({ L: f(S.L), R: f(S.R) });
	const e = S.ends;
	return {
		t,
		q: one((a) => a.tr.qAt(t)),
		tool: one((a) => a.tr.toolAt(t) as Tool),
		grip: one((a) => a.tr.grip.at(t)),
		roll: one((a) => a.tr.roll.at(t)),
		led: one((a) => a.tr.led.at(t)),
		touch: one((a) => a.touches.find((c) => t >= c.t0 && t < c.t1)?.P ?? null),
		dev: { scr: S.f7scr.at(t), jawA: S.f7jaw.at(t), tgl: S.f7tgl.at(t), cage: S.x0cage.at(t), jawB: S.x0jaw.at(t), plate: S.plate.at(t) },
		seated: { A: t >= e.A.tSeat, B: t >= e.B.tSeat },
		held: { A: t >= e.A.tLoose && t < e.A.tRel, B: t >= e.B.tGrip && t < e.B.tRel },
		rack: one((a) => [0, 1, 2].map((k) => a.rackAt(k, t))),
		pin: t >= S.tEnergize + TEST_RUN && S.tEnergize > 0 ? 1 : 0,
	};
}
/**
 * The RESET (a real control that resets the environment, visibly and physically, then the job runs again):
 * the breaker trips OFF (its spring), the work light dims; −F7:2's screw backs out and the cage opens: W07's ends spring
 * free and swing back to their curled hang; each gripper lets go of what it holds; each arm lifts its tool up its own axis
 * clear of the work, turns to its rack, docks the tool in its own slot (the site's tool change, first half) and waits, bare,
 * over its first tool: the film's first frame. Event clock τ from the press (≈ 2–3 s).
 */
export function resetBranch(S: Show, src: ResetSrc): ResetBranch {
	const tTrip = 0.05;
	const dv = src.dev;
	const scr = new Chan(dv.scr),
		jawA = new Chan(dv.jawA),
		tgl = new Chan(dv.tgl),
		cage = new Chan(dv.cage),
		jawB = new Chan(dv.jawB),
		plate = new Chan(dv.plate);
	if (dv.tgl > 0.02) tgl.to(tTrip, 0, 0, 'spring:lever');
	plate.to(tTrip, 0.86, 0.35, 'out');
	const rel = { A: 0, B: 0 };
	if (src.seated.A) {
		// the clamp lets go: the screw backs out (its head rises), the jaws open, the end springs out
		scr.to(0.12, SCREW.rest, 0.42, 'smooth');
		jawA.to(0.16, 0, 0.14, 'smooth');
		rel.A = 0.3;
	} else if (src.held.A) rel.A = 0.1;
	if (src.seated.B) {
		// the cage's actuator is pushed (its spring opens), the end springs out, the cage closes empty
		cage.to(0.1, 1, 0.14, 'out');
		jawB.to(0.32, 0, 0, 'step');
		cage.to(0.55, 0, 0, 'spring:cage');
		rel.B = 0.3;
	} else if (src.held.B) rel.B = 0.1;
	const carryB = src.held.B && !src.seated.B && src.tool.L === 'gripper';
	if (dv.jawA > 0 && !src.seated.A) jawA.to(0.16, 0, 0.14, 'smooth');
	if (dv.scr > SCREW.rest + 1e-3 && !src.seated.A) scr.to(0.12, SCREW.rest, 0.42, 'smooth');
	if (dv.cage > 0 && !src.seated.B) cage.to(0.1, 0, 0.12, 'smooth');
	const rack: ResetBranch['rack'] = { L: [], R: [] };
	const touches: ResetBranch['touches'] = { L: [], R: [] };
	const mk = (id: Id) => {
		const a = S.arm(id);
		const tool = src.tool[id];
		const tr = new ArmTrack(a.tr.r, tool);
		tr.q = src.q[id].slice() as Q;
		tr.grip = new Chan(src.grip[id]);
		tr.roll = new Chan(src.roll[id]);
		tr.led = new Chan(src.led[id]);
		tr.lock = new Chan(tool === 'none' ? 0 : 1);
		src.rack[id].forEach((t, k) => rack[id].push({ k, t: -1e9, tool: t }));
		const tp = src.touch[id];
		if (tp) touches[id].push({ t0: -1, P: tp });
		// the circuit is dead: the LEDs go out with the breaker
		if (src.led[id] > 0.01) tr.led.to(tTrip, 0, 0.08, 'smooth');
		// 1 · the jaws let go (an open gripper lets the wire it guides go as it lifts); a hand holding end B in the air first
		// carries it back on a raised arc to where it hangs (where it took it), then lets go: it drops into its hang
		if (id === 'L' && carryB) {
			const gB0 = hangEnd({ x: DUCT.slotB, y: DUCT.y1 }, LD.B, CURL.B.Lc, CURL.B.ang, CURL.B.sign, LD.B - G.GIB);
			const P0 = tr.r.fk(tr.q, tool).T;
			tr.hold(0.08);
			// (the carry's own arc, backwards: up off mouth 7 first, over, down to where it took the end)
			const pre = { x: SEAT.B.x, y: SEAT.B.y - G.GIB - 2.5 };
			const up = { x: P0.x, y: Math.min(P0.y, pre.y) - 4 };
			tr.linVia([{ P: up }, { P: { x: (up.x + gB0.x) / 2, y: Math.min(up.y, gB0.y) - 8 } }, { P: gB0 }], { v: 130, blend: 0.45 });
			tr.grip.to(tr.t, 1, 0.12, 'smooth');
			tr.hold(0.14);
			rel.B = tr.t - 0.1;
		} else if (tool === 'gripper' && src.grip[id] < 0.97) {
			tr.grip.to(0, 1, 0.12, 'smooth');
			tr.hold(0.14);
		} else tr.hold(0.08);
		const slots = G.slots[id];
		const fDock = G.dockF;
		const first = HOME[id][FIRST[id]];
		if (tool !== 'none') {
			// 2 · clear of the work: a tool pointing down goes up its own axis (out of a mouth, the slot, a socket); a gripper
			// across a wire or a camera goes straight up (the wire slides between the open fingers). A Cartesian line where the
			// pose is the IK's own branch, a short joint move where it is not (a rest inside a joint move)
			const k = tr.r.fk(tr.q, tool);
			// (the short tools higher: their turn to the rack passes over the rack's inner bar; the long ones lower: their
			// wrist passes under the duct)
			const yR = tool === 'gripper' || tool === 'camera' ? -52 : -34;
			const canon = (P: Pt, ph: number) => {
				const sol = tr.r.ik(P, ph, tool, tr.q, tr.q[3]);
				return sol.ok && [0, 1, 2].every((j) => Math.abs(sol.q[j] - tr.q[j]) < 1e-3);
			};
			const go = (P: Pt, ph: number) => {
				if (canon(tr.r.fk(tr.q, tool).T, ph)) tr.lin(P, ph, { v: 150 });
				else tr.ptp(P, ph, { yaw: tr.q[3] });
			};
			const sa = Math.sin(k.a3);
			if (k.T.y > yR + 0.5) {
				if (sa > 0.6) go({ x: k.T.x - (Math.cos(k.a3) * (k.T.y - yR)) / sa, y: yR }, k.a3);
				else go({ x: k.T.x, y: yR }, k.a3);
			}
			// a gripper rolled across a wire it let go waits, jaws open across it, until the end has swung clear of them
			if (tool === 'gripper' && Math.abs(Math.sin(src.roll[id])) > 0.9 && (src.held.A || src.held.B)) tr.wait(Math.max(rel.A, carryB ? 0 : rel.B) + 0.75);
			// 3 · the tool home, in its own slot (toolChange's first half)
			const put = HOME[id][tool];
			const at = (kk: number, tl: Tool, y: number) => ({ x: slots[kk], y: y + (tl === 'none' ? 0 : tcpOf(tl)) });
			const clear = (tl: Tool) => fDock - (lenOf(tl) + 10 + G.plateT);
			// the arm turns toward the viewer where it stands (it passes IN FRONT of the wires, as viaFront) and swings round
			// to its rack; a gripper closes and rolls back square on the way (its jaws stay across while it leaves a wire)
			const here = tr.r.fk(tr.q, tool);
			const tv = tr.t;
			// (an arm already turned to its rack, or with no wire between it and its rack, goes straight over its slot)
			const between = here.T.x > DUCT.slotA - 10 && here.T.x < DUCT.slotB + 10;
			if (Math.cos(tr.q[3]) < 0 || !between) tr.ptp(at(put, tool, clear(tool)), DOWN, { yaw: Math.PI });
			else
				tr.via(
					[
						{ P: here.T, phi: here.a3, yaw: 0.35 },
						{ P: at(put, tool, clear(tool)), phi: DOWN, yaw: Math.PI },
					],
					{ blend: 0.3 },
				);
			const dv = tr.t - tv;
			if (Math.abs(tr.roll.end()) > 1e-3) tr.roll.to(tv + dv * 0.4, 0, dv * 0.45, 'quint');
			if (tool === 'gripper') tr.grip.to(tv + dv * 0.4, 0, 0.12, 'smooth');
			const ta = tr.t;
			tr.linVia([{ P: at(put, tool, fDock - 6) }, { P: at(put, tool, fDock) }], { v: 230, blend: 0.25 });
			const td = tr.t;
			tr.event('dock', { flange: true });
			tr.hold(0.05);
			tr.lock.to(tr.t, 0, 0.08, 'smooth');
			tr.hold(0.08);
			rack[id].push({ k: put, t: tr.t, tool });
			if (tool === 'camera' || tool === 'probe') tr.led.to(tr.t, 0, 0, 'step');
			tr.setTool('none');
			tr.contact(Math.max(ta, td - 0.12), tr.t);
			// 4 · lift off the plate, over to the first tool: the rest pose
			tr.lin(at(put, 'none', fDock - 6), DOWN, { v: 220 });
			if (put !== first) tr.lin(hoverAt(id, first), DOWN, { v: 220 });
		} else tr.ptpQ(restQ(tr.r, id));
		return tr;
	};
	const L = mk('L'),
		R = mk('R');
	const tEnd = Math.max(L.t, R.t, 1.6);
	L.wait(tEnd);
	R.wait(tEnd);
	return { L, R, rack, scr, jawA, tgl, cage, jawB, plate, rel, carryB, touches, tEnd, flex: null, src };
}
/** the reset's joint flex (the same model as the film's) */
export function resetFlex(B: ResetBranch) {
	const g = flexSteps([B.L, B.R], 0, B.tEnd + 0.2, 1e9);
	let r = g.next();
	while (!r.done) r = g.next();
	B.flex = r.value;
	return B.flex;
}
export function resetToolSt(B: ResetBranch, id: Id, tau: number, q: ArrayLike<number>): ToolSt {
	const tr = id === 'L' ? B.L : B.R;
	return { open: tr.grip.at(tau), comp: tr.toolAt(tau) === 'probe' ? plunger(tr, B.touches[id], tau, q) : 0, led: tr.led.at(tau), spin: tr.spin.at(tau), cw: G.wire, roll: tr.roll.at(tau), hold: 0 };
}
export const rackOf = (B: ResetBranch, id: Id, k: number, tau: number) => {
	let tool: Tool | null = null;
	for (const e of B.rack[id]) if (e.k === k && e.t <= tau) tool = e.tool;
	return tool;
};
/** the film times a RESET may start from (candidates: rests `gap` s apart, outside the tool changes and the couplings) */
export function resetCandidates(S: Show, all = rests(S), gap = 0.25) {
	const busy = [...S.changes, ...S.couples].map((c) => [c.t0 - 0.05, c.t1 + 0.05]);
	const out: number[] = [];
	const t0 = Math.max(...S.couples.map((c) => c.t1));
	// (an arm part-way through a turn of its base is fine: the reset's first move is a joint move from there, and only the
	// candidates whose whole reset passes the robot QA are offered)
	for (const t of all) {
		if (t < t0 || t > S.tReady - 0.3) continue;
		// (inside a tool change only where the arm is clear of its rack's plates: its lock ring set)
		if (busy.some(([a, b]) => t >= a && t <= b) && [S.L, S.R].some((a) => a.tr.lock.at(t) < 0.999 || a.tr.inContact(t) > 0)) continue;
		if (out.length && t - out[out.length - 1] < gap - 1e-6) continue;
		out.push(t);
	}
	return out;
}

/* ------------------------------------------------------------------ tool state for drawing (the rig's rules) */
export function holding(S: Show, t: number) {
	return (t >= S.ends.A.tLoose && t < S.ends.A.tRel) || (t >= S.ends.B.tGrip && t < S.ends.B.tRel);
}
const plunger = (tr: ArmTrack, touches: { t0: number; P: Pt }[], t: number, q: ArrayLike<number>) => {
	let comp = 0;
	for (const c of touches) {
		if (t < c.t0) continue;
		const k = tr.r.fk(q, 'probe');
		comp = Math.max(comp, Math.min(1.6, Math.max(0, k.T.y - c.P.y)));
	}
	return comp;
};
export function toolSt(S: Show, id: Id, t: number, q: ArrayLike<number>): ToolSt {
	const a = S.arm(id),
		tr = a.tr;
	return {
		open: tr.grip.at(t),
		comp: tr.toolAt(t) === 'probe' ? plunger(tr, a.touches, t, q) : 0,
		led: tr.led.at(t),
		spin: tr.spin.at(t),
		cw: G.wire,
		roll: tr.roll.at(t),
		hold: id === 'L' && holding(S, t) ? 1 : 0,
	};
}
/* ------------------------------------------------------------------ rests (pause lands on one) */
/** times where no micro-mechanism channel changes within ±0.12 s and no hit lies within ±0.15 s (a 0.05 s grid) */
export function rests(S: Show) {
	const chans = [S.f7scr, S.f7jaw, S.f7tgl, S.x0cage, S.x0jaw, S.L.tr.grip, S.L.tr.lock, S.L.tr.spin, S.R.tr.grip, S.R.tr.lock, S.R.tr.spin];
	const out: number[] = [];
	for (let t = 0; t <= S.tHold + 1e-9; t += 0.05) {
		let ok = !S.hits.some((h) => Math.abs(h.t - t) <= 0.15);
		for (const c of chans) {
			if (!ok) break;
			const v = c.at(t);
			for (let d = -0.12; d <= 0.12 + 1e-9; d += 0.03) if (Math.abs(c.at(t + d) - v) > 1e-3) ok = false;
		}
		// the probes' plungers: a touch window
		if (ok && S.tTouchL > 0 && Math.abs(t - S.tTouchL) < 0.2) ok = false;
		if (ok) out.push(+t.toFixed(3));
	}
	return out;
}
export const GRID_S = GRID;
