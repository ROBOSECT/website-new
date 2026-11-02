/**
 * The robots' skills: the vocabulary the seven programs are written in.
 *
 * The cell is an elevation: everything a tool works on is on the head tab's top face (or, in C4, the side of the -X4
 * test terminal), with its axis in the screen plane, so every approach and retreat for an insertion, a probe, a screw, a
 * cage or a docking is a straight line along that axis, and the arms stay in the work plane above the bench.
 *
 *   the gripper takes a wire ACROSS its jaws: the tool axis horizontal (pointing across the work, toward the other arm),
 *   rolled a quarter turn so the jaws close on the wire from in front and behind; the wire runs through the finger gap
 *   and on, free, above and below. Insertion is a vertical straight line of the gripping point; the jaws hold the wire
 *   9 units above its stripped end. The gripper arm is the one on the out side: it comes to the in-lead from the inner
 *   side, and slides on along its own axis to the out-mouth for the out-lead
 *   the other arm works the in-terminal's port, on the outer side of the mouth, straight down its axis (screwdriver,
 *   cage blade, probe)
 *
 * Device-side mechanics go through the Builder's channels so the terminal reacts exactly when the tool does. Contact
 * windows hold the joint flex off while a tool touches; contact events are checked by the QA against the drawn tool.
 */
import type { Builder } from '../program';
import type { ArmTrack } from './arm';
import { PARK, TOOLS, type Pt, type ToolName } from './kin';
import { DOCK_F, PLATE } from './draw';
import type { Id, Rig } from './rig';

const DOWN = Math.PI / 2;
/** the out-lead is taken just under its copper: jaw centre → insulation end (units) */
const OUT_GOFF = 3;

/** the gripper arm takes the hanging lead across its jaws: opens, rolls, comes in along its axis, closes */
export function pick(B: Builder, tr: ArmTrack, o: { start?: number; settle?: number; speed?: number; back?: number; at?: number; gOff?: number } = {}) {
	const G = B.G,
		sc = G.sc,
		a = B.cable.arrive!;
	const gOff = o.gOff ?? G.gIns;
	const gp = B.hangGrip(gOff);
	const phi = tr.across(),
		u = { x: Math.cos(phi), y: Math.sin(phi) };
	const back = (o.back ?? 14) * sc;
	tr.wait(o.start ?? 0.12);
	tr.ptp({ x: gp.x - u.x * back, y: gp.y }, phi, { speed: o.speed ?? 1, roll: Math.PI / 2 });
	// the hanging lead settles between the open jaws' path
	tr.wait(Math.max(tr.t, a.tHang + (o.settle ?? 0.14), o.at ?? 0));
	tr.lin(gp, phi, { v: 110 });
	B.gripCable(tr.id, tr.t + 0.03, gOff);
	tr.gripTo(0, 0.08);
	tr.event('grip', { P: gp });
	B.beat(tr.t, `${tr.id}: grip`);
	return tr;
}
/** carry the held lead (straight lines): its copper tip `gap` units above the tab at x */
export function carryAbove(B: Builder, tr: ArmTrack, x: number, gap = 10, o: { v?: number; gOff?: number } = {}) {
	const G = B.G;
	tr.lin({ x, y: G.mouthY - (o.gOff ?? G.gIns) - G.CU - gap * G.sc }, tr.across(), { v: o.v ?? 160 });
	return tr;
}
/** straight down the terminal axis until the insulation is flush with the tab: seat (the wire stops in the clamp) */
export function insert(B: Builder, tr: ArmTrack, o: { v?: number; gOff?: number } = {}) {
	const G = B.G;
	const P = { x: G.inX, y: G.mouthY - (o.gOff ?? G.gIns) };
	tr.lin(P, tr.across(), { v: o.v ?? 90 });
	B.seat(tr.t);
	tr.event('seat', { P });
	tr.kickDir({ x: 0, y: -1 }, 3);
	return tr;
}
/** open the jaws, let go of the lead, back off along the tool axis (the jaws slide off the wire), or straight up (the
 * open jaws slide up along it) */
export function release(B: Builder, tr: ArmTrack, o: { back?: number; v?: number; up?: boolean } = {}) {
	tr.gripTo(1, 0.08);
	B.letGo(tr.id, tr.t - 0.04);
	if (o.up) tr.rel(0, -(o.back ?? 14), { v: o.v ?? 150 });
	else tr.axis(-(o.back ?? 14), { v: o.v ?? 150 });
	return tr;
}
/**
 * screwdriver: straight down the screw's axis into its slot, run it down clockwise (fast, slowing as torque builds; the
 * head sinks one pitch per turn and the bit follows it), torque settle, the clamp closes on the conductor; back off up
 * the axis (the first 2 units slowly). Returns the time it is tight.
 */
export function screw(B: Builder, tr: ArmTrack, which: 'in' | 'out', o: { at?: number; turns?: number; dur?: number; speed?: number } = {}) {
	const sc = B.G.sc;
	const P = B.portPoint(which, 'screw', tr.t);
	approach(tr, { x: P.x, y: P.y - 14 * sc }, DOWN, { speed: o.speed, arrive: o.at != null ? o.at - 0.2 : undefined });
	if (o.at != null) tr.wait(o.at - 0.2);
	tr.lin(P, DOWN, { v: 100 });
	const te = tr.t;
	tr.event('screw engaged', { P });
	B.beat(te, `${tr.id}: screw engaged`);
	tr.hold(0.05);
	const t0 = tr.t,
		turns = o.turns ?? 2.5,
		dur = o.dur ?? 0.62,
		A = turns * 2 * Math.PI;
	tr.spin.to(t0, A, dur, 'torque').to(t0 + dur, A + 0.07, 0, 'spring:pop');
	B.screw(which, t0, turns, dur);
	// the bit follows the head down
	const P1 = B.portPoint(which, 'screw', t0 + dur + 0.3);
	tr.lin(P1, DOWN, { T: dur });
	tr.kickDir({ x: 0, y: 1 }, 2, t0 + dur);
	tr.hold(0.08);
	const tight = tr.t;
	tr.contact(te, tight);
	B.focus.push({ t0: te - 0.08, t1: tight + 0.35, which });
	tr.rel(0, -2, { v: 40 });
	tr.rel(0, -22, { v: 200 });
	return tight;
}
export interface CageHold {
	open: number;
	te: number;
	which: 'in' | 'out';
}
/** spring cage: the blade straight down the release slot onto the actuator, then 3 units on: the cage opens */
export function openCage(B: Builder, tr: ArmTrack, which: 'in' | 'out', o: { at?: number; speed?: number } = {}): CageHold {
	const sc = B.G.sc;
	const P = B.portPoint(which, 'cage');
	approach(tr, { x: P.x, y: P.y - 14 * sc }, DOWN, { speed: o.speed, arrive: o.at != null ? o.at - 0.2 : undefined });
	if (o.at != null) tr.wait(o.at - 0.2);
	tr.lin(P, DOWN, { v: 100 });
	const te = tr.t;
	tr.event('cage engaged', { P });
	tr.lin({ x: P.x, y: P.y + 3 * sc }, DOWN, { T: 0.12 });
	return { open: tr.t, te, which };
}
/** withdraw the blade: the actuator springs back, the cage snaps shut on the conductor (one bounce, a steel ring) */
export function closeCage(B: Builder, tr: ArmTrack, c: CageHold) {
	const sc = B.G.sc;
	const t0 = tr.t;
	tr.rel(0, -3, { T: 0.1 });
	B.cage(c.which, c.open - 0.12, t0 + 0.04);
	tr.contact(c.te, tr.t);
	B.focus.push({ t0: c.te - 0.08, t1: tr.t + 0.3, which: c.which });
	tr.rel(0, -18, { v: 200 });
	void sc;
	return tr;
}
/**
 * a tool's way to its pre-contact pose: from wherever it is (parked, or turned back from the rack), up over its target and
 * straight down onto it, in blended straight lines (a joint move would swing the wrist across the work and the leads)
 */
export function approach(tr: ArmTrack, pre: Pt, phi: number, o: { speed?: number; arrive?: number } = {}) {
	const sc = tr.r.sc;
	const p = tr.pose();
	const hi = { x: pre.x, y: Math.min(pre.y - 18 * sc, p.P.y - 4 * sc) };
	const pts = [{ P: hi, phi }, { P: pre, phi }];
	if (o.arrive != null) tr.wait(o.arrive - dryRun(tr, () => tr.linVia(pts, { v: 210 })));
	const t0 = tr.t;
	tr.linVia(pts, { v: 210 });
	if (Math.abs(tr.roll.end()) > 1e-6) tr.roll.to(t0, 0, tr.t - t0, 'quint');
	return tr;
}
/** the duration of some moves from the arm's current pose (no side effects) */
export function dryRun(tr: ArmTrack, f: () => void) {
	const save = { segs: tr.segs.length, t: tr.t, q: tr.q.slice() as typeof tr.q, log: tr.log.length };
	f();
	const d = tr.t - save.t;
	tr.segs.length = save.segs;
	tr.t = save.t;
	tr.q = save.q;
	tr.log.length = save.log;
	return d;
}
/** the pre-contact pose 14 units back along the axis φ from a contact point */
export function prePose(B: Builder, tp: Pt, phi = DOWN, back = 14) {
	const sc = B.G.sc;
	return { phi, pre: { x: tp.x - Math.cos(phi) * back * sc, y: tp.y - Math.sin(phi) * back * sc } };
}
/**
 * probe touch: in along the tool axis, the needle bottoms on the contact (LED, sparks, the socket flashes), plunger
 * overtravel; retreat slowly for 2 units, then fast
 */
export function probe(
	B: Builder,
	tr: ArmTrack,
	tp: Pt,
	o: { phi?: number; noApproach?: boolean; at?: number; which?: 'in' | 'out' | 'x4' | 'none'; dwell?: number; speed?: number; v?: number } = {},
) {
	const sc = B.G.sc;
	const phi = o.phi ?? DOWN,
		u = { x: Math.cos(phi), y: Math.sin(phi) };
	if (!o.noApproach) approach(tr, { x: tp.x - u.x * 14 * sc, y: tp.y - u.y * 14 * sc }, phi, { speed: o.speed });
	if (o.at != null) tr.wait(o.at);
	tr.lin(tp, phi, { v: o.v ?? 100 });
	const tc = tr.t;
	tr.event('touch', { P: tp });
	// the needle bottoms; the arm overtravels 1.2 and the plunger takes it (the rig compresses it by the overtravel)
	const touch = { t0: tc, t1: Infinity, P: tp, phi };
	tr.touches.push(touch);
	tr.lin({ x: tp.x + u.x * 1.2 * sc, y: tp.y + u.y * 1.2 * sc }, phi, { T: 0.07 });
	tr.led.to(tc, 1, 0.05, 'smooth');
	tr.kickDir(u, 2, tc);
	B.fx.push({ k: 'touch', t: tc, x: tp.x, y: tp.y, seed: (B.cfg.seed || 1) * 3 + (tr.id === 'L' ? 1 : 2) });
	const ch = o.which === 'out' ? B.dev.tpOut : o.which === 'x4' ? B.dev.x4 : o.which === 'none' ? null : B.dev.tpIn;
	if (ch) ch.to(tc, 1, 0.04, 'smooth').to(tc + 0.05, 0, 0.5, 'out');
	tr.hold(o.dwell ?? 0.12);
	return {
		tc,
		phi,
		/** retreat along the axis (2 units slowly, then fast), plunger out, LED fades */
		done: () => {
			const t0 = tr.t;
			tr.led.to(t0 + 0.15, 0, 0.3, 'smooth');
			tr.lin({ x: tp.x - u.x * 2 * sc, y: tp.y - u.y * 2 * sc }, phi, { v: 40 });
			touch.t1 = tr.t;
			tr.contact(tc, tr.t);
			tr.lin({ x: tp.x - u.x * 22 * sc, y: tp.y - u.y * 22 * sc }, phi, { v: 200 });
			return tr;
		},
	};
}
/** two probes touching in the same frame: the two ends of one conductor (a continuity test) */
export function dualProbe(
	B: Builder,
	a: { tr: ArmTrack; tp: Pt; phi: number; which: 'in' | 'out' | 'x4'; speed?: number },
	b: { tr: ArmTrack; tp: Pt; phi: number; which: 'in' | 'out' | 'x4'; speed?: number },
	o: { after?: number; pause?: number; dwell?: number } = {},
) {
	const pa = prePose(B, a.tp, a.phi),
		pb = prePose(B, b.tp, b.phi);
	// both arms reach their pre-contact poses, then touch in the same frame
	const ea = a.tr.t + a.tr.ptpDur(pa.pre, pa.phi, { speed: a.speed, roll: 0 }),
		eb = b.tr.t + b.tr.ptpDur(pb.pre, pb.phi, { speed: b.speed, roll: 0 });
	const at = Math.max(ea, eb, o.after ?? 0);
	a.tr.ptp(pa.pre, pa.phi, { speed: a.speed ?? 1, arrive: at, roll: 0 });
	b.tr.ptp(pb.pre, pb.phi, { speed: b.speed ?? 1, arrive: at, roll: 0 });
	// the in-strokes take the same time: start each so both bottom together
	const da = strokeT(a.tr, a.tp, a.phi),
		db = strokeT(b.tr, b.tp, b.phi);
	const touch = at + (o.pause ?? 0.08) + Math.max(da, db);
	const ra = probe(B, a.tr, a.tp, { phi: a.phi, noApproach: true, at: touch - da, which: a.which, dwell: o.dwell });
	const rb = probe(B, b.tr, b.tp, { phi: b.phi, noApproach: true, at: touch - db, which: b.which, dwell: o.dwell });
	return { tc: Math.max(ra.tc, rb.tc), ra, rb };
}
/** the duration of a probe's in-stroke from the arm's current pose (no side effects) */
export function strokeT(tr: ArmTrack, tp: Pt, phi: number) {
	return dryRun(tr, () => tr.lin(tp, phi, { v: 100 }));
}
/**
 * tool change at the rack behind the arm: the base turns (J1 = π) with the tool lifted clear of the rack; the arm docks
 * its tool in the empty slot (down, settle, unlock, release: the plate rests on the bar), lifts the bare flange, crosses
 * to the next tool, couples it (settle, the lock ring snaps on its spring, click, a small kick), lifts it clear by its
 * own length (+ 4) before any sideways move. The next transfer turns the base back.
 */
export function toolChange(B: Builder, rig: Rig, id: Id, put: number, take: number, o: { speed?: number; turnBack?: boolean } = {}) {
	const tr = rig.track(id),
		G = B.G,
		sc = G.sc;
	const slots = G.slot[id];
	const fDock = G.floor + DOCK_F * sc;
	/** the TCP target that puts the flange centre at y over slot k with tool `tool` hanging down */
	const at = (k: number, tool: ToolName, y: number) => ({ x: slots[k], y: y + TOOLS[tool].tcp * sc });
	/** the flange height that keeps a tool's lowest point 10 units over the bar (and the tools resting in it) */
	const clear = (tool: ToolName) => fDock - (TOOLS[tool].len + 10 + PLATE.t) * sc;
	const tool = tr.tool;
	const list = rig.racks[id][take];
	const nt = list[list.length - 1].tool!;
	// a gripper travels and rests with its jaws closed (its fingers inside its body: through the rack's slot)
	if (tool === 'gripper' && tr.grip.end() > 0.01) tr.grip.to(tr.t, 0, 0.1, 'smooth');
	// over the empty slot, the tool clear of the rack, the base turned to it
	tr.ptp(at(put, tool, clear(tool)), DOWN, { speed: o.speed ?? 1, yaw: Math.PI, roll: 0 });
	// down into the slot: fast, the last 6 units slowly (blended)
	const ta = tr.t;
	tr.linVia([{ P: at(put, tool, fDock - 6 * sc) }, { P: at(put, tool, fDock) }], { v: 230, blend: 0.25 });
	const td = tr.t;
	tr.event('dock', { flange: true });
	tr.hold(0.06);
	tr.lock.to(tr.t, 0, 0.08, 'smooth');
	tr.hold(0.1);
	rig.racks[id][put].push({ t: tr.t, tool });
	tr.setTool('none');
	// the docking (the plate settling onto the bar) is a contact from the last units of the descent
	tr.contact(Math.max(ta, td - 0.12), tr.t);
	// the bare flange: up off the plate, across, down onto the next tool's plate (one blended move)
	const up = fDock - 6 * sc;
	const tb = tr.t;
	if (nt === 'gripper') tr.grip.to(tb, 0, 0, 'step');
	tr.linVia([{ P: at(put, 'none', up) }, { P: at(take, 'none', up) }, { P: at(take, 'none', fDock) }], { v: 200, blend: 0.3 });
	const tcp = tr.t;
	tr.hold(0.06);
	tr.event('couple', { flange: true });
	rig.racks[id][take].push({ t: tr.t, tool: null });
	tr.setTool(nt);
	tr.lock.to(tr.t, 1, 0, 'spring:pop');
	tr.kickDir({ x: 0, y: -1 }, 2);
	rig.fx.push({ k: 'click', t: tr.t + 0.03, id });
	tr.hold(0.08);
	tr.contact(Math.max(tb + 0.25, tcp - 0.12), tr.t + 0.1);
	// lifted clear by its own length (slowly off the bar, then fast)
	tr.linVia([{ P: at(take, nt, fDock - 5 * sc) }, { P: at(take, nt, clear(nt)) }], { v: 260, blend: 0.25 });
	B.beat(tr.t, `${id}: tool → ${nt}`);
	// the base turns back, the new tool held high over the arm's own base (or the next move turns it back itself)
	const m = tr.m();
	if (o.turnBack !== false) tr.ptp({ x: G.bx[id] + m * 30 * sc, y: G.floor - (80 - TOOLS[nt].tcp) * sc }, DOWN, { yaw: 0 });
	if (nt === 'gripper') tr.grip.to(tr.t, 1, 0.1, 'smooth');
	return tr;
}
/** fold to the parked pose (not before t), the tool rolled back square; from low over the tab, up first */
export function park(tr: ArmTrack, t: number, o: { speed?: number } = {}) {
	tr.wait(Math.max(t, tr.t));
	const p = tr.pose();
	const floor = tr.r.floor,
		sc = tr.r.sc;
	if (p.P.y > floor - 34 * sc) tr.lin({ x: p.P.x, y: floor - 40 * sc }, p.phi, { v: 200 });
	tr.ptpQ(PARK, { speed: o.speed ?? 1, roll: 0 });
	return tr;
}
/**
 * the out-lead: the gripper arm waits with open jaws over the out-mouth (from its own, outer side? no: it slides
 * along its axis from the in-lead to the out-mouth), the conductor rises into them, the jaws close, the arm carries it up
 * in a slight arc (the free span is a rope: it bows) and feeds the tip into the duct slot, lets go, backs off
 */
export function routeOut(B: Builder, tr: ArmTrack, o: { from: number; power: number; present?: number }) {
	const G = B.G,
		sc = G.sc;
	const phi = tr.across(),
		u = { x: Math.cos(phi), y: Math.sin(phi) };
	const hJ = 9 * sc;
	const J = { x: G.outX, y: G.mouthY - hJ };
	tr.wait(Math.max(tr.t, o.from));
	// to the out-mouth, jaws open, rolled across: over it, then straight down (it is empty: nothing is in the way)
	tr.ptp({ x: J.x, y: J.y - 14 * sc }, phi, { roll: Math.PI / 2 });
	tr.lin(J, phi, { v: 140 });
	if (tr.grip.end() < 0.99) tr.gripTo(1, 0.08);
	// the jaws wait over the out-mouth; the device presents the conductor once it is powered
	const t0 = Math.max(tr.t + (o.present ?? 0.04), o.power + 0.06);
	const tG = t0 + 0.18;
	tr.wait(tG);
	tr.grip.to(tG, 0, 0.07, 'smooth');
	tr.hold(0.08);
	tr.event('out grip', { P: J });
	// up into the duct: the tip just inside the slot (the jaws gOff + CU below it), a slight outward bow on the way
	const gOff = OUT_GOFF * sc;
	const tipY = G.ductBot + 0.5 * sc;
	const Jtop = { x: G.outX, y: tipY + G.CU + gOff };
	const side = -u.x; // toward this arm's own side
	tr.linVia(
		[
			{ P: { x: G.outX + side * 6 * sc, y: (J.y + Jtop.y) / 2 } },
			{ P: Jtop },
		],
		{ v: 300 },
	);
	const tR = tr.t + 0.02;
	B.routeOut({ id: tr.id, t0, tG, tR, tipY, hJ, gOff });
	tr.gripTo(1, 0.08);
	tr.axis(-12, { v: 150 });
	return tr;
}
