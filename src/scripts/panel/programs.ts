/**
 * The seven compartment programs.
 *
 * +C1…+C6 are SIX VIGNETTES: short, light, scroll-scrubbed jobs, ONE tool on ONE arm (the other arm is not drawn, cfg.solo),
 * or the quick two-arm continuity test (+C4). The lead feeds itself out of the duct into the device wherever no arm handles
 * it (the duct is the feeder: ≤ 600 units/s, a short stop into the mouth), and after the power-up the out-lead runs on by
 * itself to the next compartment (B.selfOut): one cable through the whole page. Every tool appears once, the camera twice
 * on two different vision jobs, drawn in place on the work (B.vf, stage.ts visionAt). No zoom, no inset, no
 * word or code on screen: what each job says about ROBOSECT is told by what the robot does. No tool change, no
 * two-hand hold (but +C4's probes), no spark: those are the Contact showpiece's. Every position comes from the layout (B.G),
 * so one script runs at every stage scale. Times are seconds of program time; the scroll maps them (scroll.ts), both ways.
 * The device tags below (-X1, -K1…) are the code's names for the devices; none is printed.
 *
 *   +C1 -X1 screw    L screwdriver  THE TAUGHT POINT   the bit lands where the program was taught (✕), feels its way into
 *                                                      the real screw's pocket, finds the slot, 2½ turns, torque settle
 *   +C2 -K1 push-in  R camera       SEE · MATCH · PLAN · GO   01 perceive, 02 the EPLAN drawing snaps onto the real tab,
 *                                                      03 the planned path, 04 the lead runs it into A1 (tracked)
 *   +C3 -X2 cage     L opener       ONE CABLE, FOUR APPLICATIONS   the lever blade opens the cage, the lead feeds in, the
 *                                                      cage snaps shut, the bridge lights 1 → 4
 *   +C4 -A1 push-in  L + R probes   THE PROTOTYPE      the lead feeds itself through -X4 into -A1; two needles, the two
 *                                                      ends of one conductor, one frame: PASS
 *   +C5 -A2 push-in  R camera       READ IT, MATCH IT, SEE IT   the camera reads the lead's wire marker, matches it with the
 *                                                      connection list, then sees input I0.0 light at the power-up
 *   +C6 -Q1 push-in  L gripper      WIRE IT, SWITCH IT ON   pick across the jaws, insert (push-in), then the fingertips
 *                                                      push the toggle past its dead point: ON
 *   (+C7 Contact: the showpiece, a time-based job by the two robots beside the form, scripts/panel/showpiece)
 */
import { Builder, type CellCfg } from './program';
import { SCREW, SCREW_BITE, screwTop } from './devices';
import { CONNECTIONS } from '../../data/panel';
import { Rig } from './robot/rig';
import { approach, carryAbove, dualProbe, insert, park, pick, prePose, probe, release, strokeT } from './robot/skills';
import type { ArmTrack } from './robot/arm';

const DOWN = Math.PI / 2;

/** program time the lead takes from its arrival start to a self-seat (a throwaway builder: no side effects) */
function arrivalDur(B: Builder, o: Parameters<Builder['arrive']>[0]) {
	const tmp = new Builder(B.G.T, B.cfg);
	const a = tmp.arrive({ ...o, at: 0 });
	return a.tHang + (o.selfSeat ? 0.08 : 0);
}
/** program time from the arrival start until the tip leaves the duct slot (it travels the H duct before that) */
function exitDur(B: Builder, o: Parameters<Builder['arrive']>[0]) {
	const tmp = new Builder(B.G.T, B.cfg);
	return tmp.arrive({ ...o, at: 0 }).tExit;
}

/** the run-down once the bit sits in the slot: clockwise, fast then slowing as torque builds, the head sinks one pitch per
 * turn and the bit follows it, the clamp closes at 55 %, a torque settle (pop) and a kick; returns the time it is tight */
function runDown(B: Builder, tr: ArmTrack, which: 'in' | 'out', o: { turns: number; dur: number; spin0: number }) {
	const t0 = tr.t,
		A = o.spin0 + o.turns * 2 * Math.PI;
	tr.spin.to(t0, A, o.dur, 'torque').to(t0 + o.dur, A + 0.07, 0, 'spring:pop');
	B.screw(which, t0, o.turns, o.dur);
	const P1 = B.portPoint(which, 'screw', t0 + o.dur + 0.3);
	tr.lin(P1, DOWN, { T: o.dur });
	tr.kickDir({ x: 0, y: 1 }, 2, t0 + o.dur);
	tr.hold(0.08);
	return tr.t;
}

/** the connection-list rows the two camera jobs read (data/panel.ts: one illustrative 24 V DC list) */
const C2 = CONNECTIONS[1],
	C3 = CONNECTIONS[2],
	C5 = CONNECTIONS[4];

/** the first program time from `t0` at which arm `tr`'s tool (wrist to tip) is at least `d` px to the side of the vertical
 * line x: a lead rising out of a mouth on that line then never runs through the tool (without it +C6's out-lead would
 * rise through the gripper as it lifts off the toggle) */
function clearOf(tr: ArmTrack, x: number, t0: number, d: number) {
	for (let t = t0; t < t0 + 2; t += 1 / 120) {
		const k = tr.r.fk(tr.qAt(t), tr.toolAt(t));
		if (Math.min(Math.abs(k.T.x - x), Math.abs(k.W.x - x)) >= d && Math.sign(k.T.x - x) === Math.sign(k.W.x - x)) return t;
	}
	return t0;
}

/** where the camera's lens (tool centre point) sits to look at `at` from `dist` units along the axis φ */
const lookFrom = (at: { x: number; y: number }, dist: number, phi: number, sc: number) => ({ x: at.x - Math.cos(phi) * dist * sc, y: at.y - Math.sin(phi) * dist * sc });

export const PROGRAMS: Record<number, CellCfg> = {
	/* +C1 · The problem · -X1 screw terminal block · L→R · L screwdriver
	   "Fixed coordinates and taught points break at the first variant." The taught point is drawn from the start (a dashed
	   ghost screw, 4.6 units off the real one); the screwdriver comes down on it: the bit lands on the bare tab (a protective
	   stop, a steel ✕). It feels its way: slides in contact toward the real screw, drops into its pocket onto the head, turns a
	   few degrees until the blade falls into the slot (click). Now the lead feeds itself into the open box clamp; 2½ turns
	   clockwise, slowing as torque builds, the head sinks, the clamp closes on the copper, a settle. Up, the test current,
	   -X1 powers up and opens. */
	1: {
		n: 1,
		tag: '+C1',
		dev: 'X1',
		dir: 'ltr',
		ground: 'plate',
		seed: 11,
		solo: 'L',
		pace: { r: 0.46, n: 8, hero: ['miss', 'feel', 'screw'] },
		program(B) {
			const G = B.G,
				sc = G.sc,
				s = G.dirS;
			const rig = new Rig(B, { tools: { L: 'driver', R: 'gripper' }, racks: { L: [null, 'opener'], R: [null, 'probe'] } });
			const { L } = rig;
			const top = G.mouthY,
				surf = top - 0.1 * sc;
			// (the taught point 6 units off the real screw, as far as the bare tab between the screw and the mouth
			// allows, so the miss reads at 1×)
			const ghostX = G.pIn + s * 6 * sc;
			// the taught point: the bit lands on bare plastic, 6 units off the real screw (this panel is a variant)
			// (the taught point is drawn from the start, where the program believes the screw is, so the visitor sees
			// the arm go to the drawing's screw, find nothing there, and feel its way to the real one)
			L.wait(0.06);
			B.fx.push({ k: 'ghostScrew', t: 0.04, t1: L.t + 0.75, x: ghostX, y: top });
			L.ptp({ x: ghostX, y: surf - 12 * sc }, DOWN);
			B.fx[B.fx.length - 1].t1 = L.t + 0.75;
			L.lin({ x: ghostX, y: surf }, DOWN, { v: 90, prof: 'stop' });
			const tMiss = L.t;
			L.event('miss', { P: { x: ghostX, y: surf } });
			B.beat(tMiss, 'miss');
			B.fx.push({ k: 'miss', t: tMiss, x: ghostX, y: top - 5 * sc, d: 0.6 });
			L.hold(0.12);
			// it feels its way: in contact, toward the screw; past the pocket's edge the blade drops onto the head
			const t0f = L.t;
			L.lin({ x: G.pIn + s * 2.3 * sc, y: surf }, DOWN, { v: 32 });
			const headY = G.floor + SCREW.top0 * sc;
			L.lin({ x: G.pIn + s * 2.3 * sc, y: headY - 0.05 * sc }, DOWN, { T: 0.06 });
			L.kickDir({ x: 0, y: 1 }, 1.5);
			L.event('on the head');
			B.beat(L.t, 'feel');
			// over the head to the centre, the blade turning to find the slot; it falls in (0.6): click
			L.spin.to(L.t, 0.55, 0.16, 'smooth');
			L.lin({ x: G.pIn, y: headY - 0.05 * sc }, DOWN, { T: 0.16 });
			const P = { x: G.pIn, y: G.floor + (screwTop(SCREW.rest) + SCREW_BITE) * sc };
			L.lin(P, DOWN, { T: 0.05 });
			L.kickDir({ x: 0, y: 1 }, 2);
			L.event('screw engaged', { P });
			B.fx.push({ k: 'ring', t: L.t, x: P.x, y: top, small: true });
			B.beat(L.t, 'L: screw engaged');
			const te = L.t;
			B.pace('feel', t0f - 0.05, te + 0.05, 1.5);
			// the bit waits in the slot; the lead feeds itself into the open clamp (along the duct, out of the slot, down)
			const a = B.arrive({ at: Math.max(0, te + 0.03 - exitDur(B, { selfSeat: true })), selfSeat: true });
			const tIn = a.tHang + 0.08;
			L.wait(tIn + 0.1);
			L.contact(tMiss - 0.02, L.t);
			const tr0 = L.t;
			const tight = runDown(B, L, 'in', { turns: 2.5, dur: 0.6, spin0: 0.55 });
			L.contact(tr0, tight);
			B.focus.push({ t0: tMiss - 0.3, t1: tight + 0.3, which: 'in' });
			// up the axis (the first 2 units slowly), the test current, power
			L.rel(0, -2, { v: 40 });
			L.rel(0, -22, { v: 200 });
			B.pulse(tight + 0.04, 0.2);
			B.power(tight + 0.2);
			B.selfOut(B.powerT - 0.02);
			park(L, L.t + 0.02);
		},
	},

	/* +C2 · How it works · -K1 relay (push-in) · R→L · R camera
	   The four steps, on one lens. PERCEIVE: the camera unfolds over -K1 and sweeps (its cone on the tab, brackets on the
	   terminal). INTEGRATE: the drawing of the head tab (dashed) sits 1.6 mm off the real one and snaps onto it. PLAN: the
	   lead's path from the duct slot into the terminal draws itself. EXECUTE: the lead (waiting at the duct corner until now)
	   runs the plan and seats; the brackets follow its tip. */
	2: {
		n: 2,
		tag: '+C2',
		dev: 'K1',
		dir: 'rtl',
		ground: 'plate',
		seed: 23,
		solo: 'R',
		pace: { r: 0.46, n: 8, hero: ['scan', 'register', 'plan'] },
		program(B) {
			const G = B.G,
				sc = G.sc;
			const rig = new Rig(B, { tools: { L: 'gripper', R: 'camera' }, racks: { L: [null, 'probe'], R: [null, 'probe'] } });
			const { R } = rig;
			const mouth = { x: G.inX, y: G.mouthY };
			const tabC = { x: G.cx, y: G.mouthY + 1 * sc };
			// the view: over the tab, right of the lead's drop line, the lens 42 units from the mouth
			const phi0 = R.down(0.46),
				phi1 = R.down(0.62);
			const P0 = lookFrom({ x: G.cx, y: G.mouthY }, 44, phi0, sc);
			R.wait(0.08);
			R.ptp(P0, phi0);
			const ts = R.t;
			R.led.to(ts, 1, 0.05, 'smooth');
			// 01 perceive: the sweep (the lens turns about itself)
			R.lin(P0, phi1, { T: 0.36 });
			rig.fx.push({ k: 'scan', id: 'R', t: ts, t1: R.t, len: 50 });
			B.beat(ts, '01 perceive');
			const tLock = ts + 0.24,
				tSnap = tLock + 0.3,
				tPlan = tSnap + 0.34;
			B.beat(tSnap, '02 integrate');
			B.beat(tPlan, '03 plan');
			// 03 plan: the lead's path, from the duct slot down into A1 (drawn in the cell too)
			const slot = { x: G.inX, y: G.ductBot };
			B.fx.push({ k: 'plan', t: tPlan, t1: tPlan + 0.75, d: 0.28, pts: [slot, { x: G.inX, y: G.mouthY + 4 * sc }] });
			// 04 execute: the lead runs the plan (it waited at the duct corner)
			const at = Math.max(0, tPlan + 0.3 - exitDur(B, { selfSeat: true }));
			const a = B.arrive({ at, selfSeat: true });
			const tSeat = a.tHang + 0.08;
			const tExec = a.tExit;
			B.beat(tExec, '04 execute');
			// the camera follows the tip down (a slight tilt), holds on the seat
			R.wait(tExec);
			const phi2 = R.down(0.52);
			R.lin(P0, phi2, { T: Math.max(0.2, tSeat - R.t - 0.05) });
			R.wait(tSeat + 0.22);
			const t1 = R.t;
			B.vf.push({
				id: 'R',
				kind: 'register',
				t0: ts + 0.04,
				t1,
				r: 13,
				at: [
					{ t: ts, x: tabC.x, y: G.mouthY + 3 * sc },
					{ t: tPlan, x: tabC.x, y: G.mouthY + 3 * sc },
					{ t: tExec, x: (tabC.x + mouth.x) / 2, y: G.mouthY - 3 * sc },
					{ t: tSeat, x: (tabC.x + mouth.x) / 2, y: G.mouthY + 1 * sc },
				],
				k: { lock: tLock, snap: tSnap, plan: tPlan, exec: tExec, seat: tSeat },
				// A1 (the coil, where this lead goes) and 13 (the contact the next lead leaves from: -K1:13 → -X2:1)
				txt: { cam: 'CAM R', tag: '-K1', term: C2.to.split(':')[1], term2: C3.from.split(':')[1], eplan: `${C2.from} → ${C2.to}`, d: 'Δ 1.6 mm', d0: 'Δ 0.0 mm' },
			});
			R.led.to(t1, 0, 0.12, 'smooth');
			park(R, t1);
			B.pulse(tSeat + 0.1, 0.22);
			B.power(tSeat + 0.3);
			B.selfOut(B.powerT - 0.02);
		},
	},

	/* +C3 · Applications · -X2 distribution block (spring cage) · L→R · ink module · L opener
	   One cable, four applications. The lever blade comes straight down the release slot onto the cage's actuator, pushes it
	   3 units and levers 8° on the slot's edge: the cage opens. The lead feeds itself into the open cage. The blade comes
	   back: the actuator springs up, the cage snaps shut on the copper with one bounce. The current runs along the bridge:
	   the four outputs light 1 → 4, the four applications the module opens on. */
	3: {
		n: 3,
		tag: '+C3',
		dev: 'X2',
		dir: 'ltr',
		ground: 'plate',
		seed: 37,
		solo: 'L',
		pace: { r: 0.5, n: 8, hero: ['cage'] },
		program(B) {
			const G = B.G,
				sc = G.sc;
			const rig = new Rig(B, { tools: { L: 'opener', R: 'gripper' }, racks: { L: ['driver', null], R: [null, 'probe'] } });
			const { L } = rig;
			const P = B.portPoint('in', 'cage');
			L.wait(0.04);
			L.ptp({ x: P.x, y: P.y - 12 * sc }, DOWN);
			L.lin(P, DOWN, { v: 100 });
			const te = L.t;
			L.event('cage engaged', { P });
			// push 3 units and lever: the handle swings out toward the arm's own side, the blade's tip stays in the slot
			L.lin({ x: P.x, y: P.y + 3 * sc }, L.down(0.12), { T: 0.14 });
			const tOpen = L.t;
			// the lead feeds itself in once the cage is open
			const dur = arrivalDur(B, { selfSeat: true });
			const tSeatWanted = tOpen + 0.1;
			const at = Math.max(0, tSeatWanted - dur);
			const a = B.arrive({ at, selfSeat: true });
			const tSeat = a.tHang + 0.08;
			L.wait(tSeat + 0.1);
			// the blade comes back: the actuator springs up, the cage snaps shut (one bounce, a steel ring)
			const t0 = L.t;
			L.lin(P, DOWN, { T: 0.1 });
			B.cage('in', tOpen - 0.12, t0 + 0.04);
			L.contact(te, L.t);
			B.focus.push({ t0: te - 0.1, t1: L.t + 0.28, which: 'in' });
			L.rel(0, -18, { v: 200 });
			B.pulse(L.t - 0.08, 0.24);
			B.power(L.t + 0.08);
			B.selfOut(B.powerT + 0.3);
			park(L, L.t + 0.02);
		},
	},

	/* +C4 · Technology · -A1 PLC CPU (push-in) · R→L · L + R probes
	   The prototype, in miniature: a continuity test with two collaborative arms. The lead feeds itself down from the duct
	   through the -X4 test terminal into -A1's input (the push-in spring clicks). L's needle in -X4's side socket, R's in
	   -A1's input socket: the two ends of the same conductor, bottoming in the same frame; the conductor lights inside its
	   insulation from needle to needle. PASS: lamp test, RUN, the scan. */
	4: {
		n: 4,
		tag: '+C4',
		dev: 'A1',
		dir: 'rtl',
		ground: 'plate',
		seed: 41,
		pace: { r: 0.5, n: 8, hero: ['probe'] },
		program(B) {
			const G = B.G,
				sc = G.sc;
			const rig = new Rig(B, { tools: { L: 'probe', R: 'probe' }, racks: { L: [null, 'gripper'], R: ['camera', null] } });
			const { L, R } = rig;
			const ux = (G.inX - G.cx) / sc,
				top = -(G.floor - G.ductBot) / sc + 1;
			B.x4 = { x: ux, top, h: 18, w: 4.5, side: -1, sy: top + 11 };
			const a = B.arrive({ at: 0.05, selfSeat: true });
			const tSeat = a.tHang + 0.08;
			const x4 = B.x4;
			const x4P = { x: G.cx + (x4.x - x4.w + 3.5) * sc, y: G.floor + x4.sy * sc };
			L.wait(0.05);
			R.wait(0.1);
			const tIn = B.portPoint('in', 'socket');
			R.ptp(prePose(B, tIn, DOWN).pre, DOWN);
			const d = dualProbe(B, { tr: L, tp: x4P, phi: 0, which: 'x4' }, { tr: R, tp: tIn, phi: DOWN, which: 'in' }, { after: tSeat + 0.08, dwell: 0.2 });
			B.beat(d.tc, 'dual probe contact');
			B.fx.push({ k: 'continuity', t: d.tc, t1: d.tc + 0.45 });
			B.focus.push({ t0: d.tc - 0.36, t1: d.tc + 0.42, which: 'in' });
			B.pulse(d.tc - 0.14, 0.22);
			B.power(d.tc + 0.06);
			d.ra.done();
			d.rb.done();
			park(R, R.t + 0.02);
			// L backs off -X4's socket (just under the duct) and drops its probe level with the bench before it folds home: its
			// park never sweeps the top of the cell as the page speeds up again (as a real wheel showed at 1366 × 768)
			L.lin({ x: L.pose().P.x - 6 * sc, y: G.floor - 46 * sc }, 0, { v: 200 });
			park(L, L.t + 0.02);
			B.selfOut(B.powerT + 0.1);
		},
	},

	/* +C5 · Facts · -A2 digital input module (push-in) · L→R · R camera (vision job 2: read · match · confirm)
	   Facts, not claims: what is published is what was checked. The lead feeds itself into I0.0, carrying its wire marker.
	   READ: the camera locks on the marker (a wordless print) and brackets it; MATCH: the address is found in the robots'
	   connection list. CONFIRM: the lens tilts to the first input's status LED on the module's face and waits on it; at the
	   power-up the four inputs light top to bottom (the four facts) and the camera sees the first one come on: the signal
	   arrived. */
	5: {
		n: 5,
		tag: '+C5',
		dev: 'A2',
		dir: 'ltr',
		ground: 'plate',
		seed: 53,
		solo: 'R',
		pace: { r: 0.5, n: 8, hero: ['read', 'confirm'] },
		program(B) {
			const G = B.G,
				sc = G.sc;
			const rig = new Rig(B, { tools: { L: 'probe', R: 'camera' }, racks: { L: ['gripper', null], R: [null, 'probe'] } });
			const { R } = rig;
			const a = B.arrive({ at: 0, selfSeat: true });
			const tSeat = a.tHang + 0.08;
			// the wire marker rides the lead 15 units above its insulation end (the stage draws it); input I0.0's LED on the face
			const mk = { x: G.inX, y: G.mouthY - 15 * sc };
			const led0 = { x: G.devX + 24 * sc, y: G.floor + 34 * sc };
			const phiA = R.down(0.98);
			const PA = lookFrom(mk, 34, phiA, sc);
			R.wait(Math.max(0.1, tSeat - 0.55));
			R.ptp(PA, phiA);
			const tR = Math.max(R.t, tSeat + 0.04);
			R.wait(tR);
			R.led.to(tR, 1, 0.05, 'smooth');
			rig.fx.push({ k: 'scan', id: 'R', t: tR, t1: tR + 0.3, len: 40 });
			B.beat(tR + 0.08, 'read');
			const tOcr = tR + 0.14,
				tMatch = tOcr + 0.3;
			R.wait(tMatch + 0.1);
			// CONFIRM: the lens turns about itself toward I0.0's LED; the bracket waits there for the signal
			const tPan = R.t;
			const phiB = Math.atan2(led0.y - PA.y, led0.x - PA.x);
			R.lin(PA, phiB, { T: 0.24 });
			const tCheck = R.t;
			B.beat(tCheck, 'confirm');
			rig.fx.push({ k: 'scan', id: 'R', t: tCheck - 0.04, t1: tCheck + 0.22, len: 46 });
			// the test current, the power-up: the four inputs light .0 → .3; I0.0 is fully on 0.12 s after the power
			const tPw = tCheck + 0.32;
			B.pulse(tPw - 0.16, 0.22);
			B.power(tPw);
			const tOn = tPw + 0.12;
			B.beat(tOn, 'I0.0 ON');
			const t1 = tOn + 0.2;
			B.vf.push({
				id: 'R',
				kind: 'read',
				t0: tR,
				t1,
				r: 12,
				// READ close on the marker; CONFIRM pulls back to frame the input LEDs' column with I0.0 at its centre
				at: [
					{ t: tR, x: mk.x, y: mk.y },
					{ t: tPan, x: mk.x, y: mk.y },
					{ t: tPan + 0.24, x: led0.x, y: led0.y + 6 * sc, r: 22 },
				],
				k: { lock: tR + 0.06, ocr: tOcr, match: tMatch, pan: tPan, check: tCheck, on: tOn },
				txt: { cam: 'CAM R', mark: C5.to, ocr: `${C5.from} → ${C5.to}`, input: 'I0.0' },
				tgt: led0,
			});
			R.led.to(t1, 0, 0.12, 'smooth');
			park(R, t1);
			B.selfOut(B.powerT + 0.28);
		},
	},

	/* +C6 · Team · -Q1 circuit breaker (push-in) · R→L · ink module · L gripper
	   From the lab to the factory floor: wire it, switch it on. The lead drops and swings; the gripper takes it across its
	   jaws (16 units up, clear of the toggle), carries it over the mouth and pushes it in (the push-in spring clicks), lets go
	   and lifts off the wire. It comes down beside the toggle and pushes the knob past its dead point with its closed
	   fingertips; the lever snaps ON by itself (overshoot) as the arm leaves up and away, across the out-mouth's line before
	   the out-lead rises on it; the flag turns copper. */
	6: {
		n: 6,
		tag: '+C6',
		dev: 'Q1',
		dir: 'rtl',
		ground: 'plate',
		seed: 67,
		solo: 'L',
		pace: { r: 0.5, n: 8, hero: ['insert', 'lever'] },
		program(B) {
			const G = B.G,
				sc = G.sc;
			const rig = new Rig(B, { tools: { L: 'gripper', R: 'driver' }, racks: { L: [null, 'opener'], R: [null, 'probe'] } });
			const { L } = rig;
			const gOff = 16 * sc;
			B.arrive({ swing: -60 * sc, gap: 10 });
			pick(B, L, { start: 0, settle: 0.06, gOff });
			carryAbove(B, L, G.inX, 6, { gOff });
			insert(B, L, { v: 120, gOff });
			const tSeat = L.t;
			L.hold(0.08);
			L.contact(tSeat, L.t);
			release(B, L, { up: true, back: 12 });
			// the toggle: the gripper turns down beside it and pushes the knob across the dead point with its closed fingers
			const k0 = B.knob(0),
				kd = B.knob(0.62);
			const side = Math.sign(k0.x - kd.x) || 1;
			const half = (2.5 + 0.5 + 1.8 + 0.6) * sc;
			const ty = G.mouthY - (2.5 + 3.5 + 1.5) * sc;
			L.gripTo(0.1, 0.08);
			L.ptp({ x: k0.x + side * half, y: ty - 14 * sc }, DOWN, { roll: Math.PI / 2 });
			L.lin({ x: k0.x + side * half, y: ty }, DOWN, { v: 120 });
			const tp0 = L.t;
			L.lin({ x: kd.x + side * half, y: ty }, DOWN, { v: 60 });
			L.event('toggle', { P: { x: kd.x + side * half, y: ty } });
			B.dev.act.to(tp0, 0.62, L.t - tp0, 'quint');
			B.beat(L.t, 'lever ON');
			const tOn = L.t;
			B.focus.push({ t0: tp0 - 0.2, t1: tOn + 0.3, which: 'in', at: { x: G.pivot.x, y: G.pivot.y - 4 * sc, r: 9 } });
			L.contact(tp0, tOn);
			B.dev.act.to(tOn, 1, 0, 'spring:lever');
			// (the hand leaves the knob up and away from it, across the out-mouth's line, toward home: the line is clear before
			// the out-lead rises on it; lifting straight up over the out-mouth, the lead would rise through the jaws)
			const away = Math.sign(G.outX - L.pose().P.x) || -1;
			L.lin({ x: G.outX + away * (6 * sc + G.T.cable / 2 + 4), y: G.floor - 40 * sc }, DOWN, { v: 200 });
			B.pulse(tOn - 0.3, 0.24);
			B.power(tOn + 0.04);
			park(L, L.t + 0.02);
			// the out-lead runs on once the gripper, folding home across the out-mouth's line, is clear of it
			B.selfOut(Math.max(B.powerT + 0.02, clearOf(L, G.outX, B.powerT, 5 * sc + G.T.cable / 2 + 3)));
		},
	},
	// (+C7 Contact is not a scroll program any more: the showpiece runs on its own clock, scripts/panel/showpiece)
};
