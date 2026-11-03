/**
 * The six compartment programs: the vignettes, one per home section, each telling what its section says.
 *
 * +C1…+C6 are short, scroll-scrubbed scenes: ONE arm (the other is not drawn, cfg.solo), or the two-arm prototype (+C4).
 * What the robot works on is a set of bench props (props.ts): a switchboard's terminal strips on their mounting plate with
 * the wiring duct, the report, the EPLAN connection list, a harness on a fork, a cable coil. The page's lead still feeds
 * itself out of the duct into the device (the duct is the feeder: ≤ 600 units/s), the device powers up and opens into the
 * section's content, and the out-lead runs on to the next compartment (B.selfOut): one cable through the whole page.
 * Copper only where something real happens: a verified connection, a tick on the report. No words or codes on screen.
 * Every position comes from the layout (B.G) or is in cell units from the device centre, so one script runs at every scale.
 *
 *   +C1 -X1  L probe    THE PROBLEM     a switchboard that is a variant: its terminals are not where the drawing says
 *                                       (dashed); the probe lands on the taught point (✕), hesitates from terminal to
 *                                       terminal, tests one: it glows and fades. The report beside it stays blank
 *   +C2 -K1  R camera   HOW IT WORKS    the camera sees the real switchboard; the EPLAN connection list comes out of its
 *           → probe                     feeder; the arm takes its probe and tests the terminals in the list's order: each
 *                                       verified terminal lights copper, its row on the list gets its tick
 *   +C3 -X2  L probe    WHAT YOU GET    the last two terminals of a switchboard are tested (all verified now) and the report
 *                                       comes out of the printer, every row ticked, onto the reports already made
 *   +C4 -A1  L + R      THE PROTOTYPE   two arms with probes over one switchboard: the two needles on the two ends of the
 *                                       same wire, in the same frame, twice; each verified wire lights its run copper
 *   +C5 -A2  R gripper  ALSO FOR YOU    a harness: the gripper takes its connector, routes it over the fork and clips it to
 *                                       its mate; along the arm, the robot's own dress pack
 *   +C6 -Q1  L gripper  TEAM            calm: the gripper lifts a loose cable coil, sets it down neat, and parks
 *   (+C7 Contact: the robots make the R of the logo out of a straight cable, scripts/panel/showpiece)
 */
import { Builder, type CellCfg } from './program';
import { Rig } from './robot/rig';
import { approach, dualProbe, park, prePose } from './robot/skills';
import type { ArmTrack } from './robot/arm';
import { Board, Coil, Dress, Harness, Printer, Sheet, TERM, TermStrip, WristCam } from './props';
import type { Pt } from './robot/kin';

const DOWN = Math.PI / 2;

/** cell units (from the device centre on the bench) → stage px */
const U = (B: Builder, x: number, y: number): Pt => ({ x: B.G.cx + x * B.G.sc, y: B.G.floor + y * B.G.sc });
/** the probe's hover height over a socket's contact (units): the needle's tip clear of every terminal top */
const HOV = 7;

/**
 * a probe tests terminal i of a strip: from its hover point straight down into the socket (the needle bottoms on the
 * contact, the plunger takes 1 unit of overtravel), a short dwell, back up to the hover point. The tip is inside the
 * terminal's bore only within the contact window. Returns the contact time.
 */
function tap(B: Builder, tr: ArmTrack, st: TermStrip, i: number, o: { name?: string; dwell?: number; lit?: boolean; seed?: number } = {}) {
	const sc = B.G.sc;
	const tp = st.socket(i),
		hov = { x: tp.x, y: tp.y - HOV * sc };
	tr.lin(hov, DOWN, { v: 220 });
	const t0 = tr.t;
	tr.lin(tp, DOWN, { v: 130 });
	const tc = tr.t;
	tr.event('touch', { P: tp });
	const touch = { t0: tc, t1: Infinity, P: tp, phi: DOWN };
	tr.touches.push(touch);
	tr.lin({ x: tp.x, y: tp.y + 1 * sc }, DOWN, { T: 0.06 });
	tr.led.to(tc, 1, 0.04, 'smooth');
	tr.kickDir({ x: 0, y: 1 }, 2, tc);
	B.fx.push({ k: 'touch', t: tc, x: tp.x, y: tp.y, seed: o.seed ?? (B.cfg.seed || 1) + i });
	tr.hold(o.dwell ?? 0.08);
	tr.led.to(tr.t + 0.08, 0, 0.2, 'smooth');
	tr.lin({ x: tp.x, y: tp.y - 2 * sc }, DOWN, { v: 50 });
	touch.t1 = tr.t;
	tr.lin(hov, DOWN, { v: 220 });
	tr.contact(t0, tr.t);
	if (o.lit !== false) st.light(i, tc);
	if (o.name) B.beat(tc, o.name);
	return tc;
}
/** a probe moves to hover over terminal i (no touch) */
function hover(B: Builder, tr: ArmTrack, st: TermStrip, i: number, x?: number, v = 160) {
	const tp = st.socket(i);
	tr.lin({ x: x != null ? U(B, x, 0).x : tp.x, y: tp.y - HOV * B.G.sc }, DOWN, { v });
}

export const PROGRAMS: Record<number, CellCfg> = {
	/* +C1 · The problem · -X1 · L→R · L probe
	   Testing by hand, every switchboard a variant, no record. The switchboard's terminals are crowded and not where the
	   drawing puts them: the dashed outlines (the drawing) stay, the real terminals slide off them as the scene opens. The
	   probe goes to the taught point: it lands on a terminal's top, not in its socket (a protective stop, the steel ✕). It
	   lifts and hesitates over one terminal, then another, then tests one: the socket glows and fades back, nothing is
	   kept. Beside the switchboard the report stands blank (dashed: never written). */
	1: {
		n: 1,
		tag: '+C1',
		dev: 'X1',
		dir: 'ltr',
		ground: 'plate',
		seed: 11,
		solo: 'L',
		far: 56,
		pace: { r: 0.46, n: 8, hero: ['miss', 'hesitate', 'tap'] },
		program(B) {
			const sc = B.G.sc;
			const rig = new Rig(B, { tools: { L: 'probe', R: 'gripper' }, racks: { L: ['gripper', null], R: [null, 'probe'] } });
			const { L } = rig;
			// the drawing's terminals (a regular pitch) and the real ones (a variant: crowded, shifted)
			const ghost = [-55, -50, -45, -40, -35, -30];
			const real = [-54.2, -49.4, -43.2, -38.6, -33.9, -29.2];
			const st = new TermStrip(B, real, { ghost, slide: { t0: 0.15, t1: 0.6, from: ghost } });
			const board = new Board({ plates: [[-59, -25.4]], top: -34, strips: [st] });
			const report = new Sheet({ x: 41, w: 20, h: 28, rows: 5, kind: 'report', blank: true });
			B.props.push(board, st, report);
			// the taught point: the drawing's third terminal (it lands on the real terminal's top, 1.8 units off its socket)
			const taught = U(B, ghost[2], -TERM.h);
			L.wait(0.08);
			approach(L, { x: taught.x, y: taught.y - 8 * sc }, DOWN);
			const tl0 = L.t;
			L.lin(taught, DOWN, { v: 80, prof: 'stop' });
			const tMiss = L.t;
			L.event('miss', { P: taught });
			L.kickDir({ x: 0, y: 1 }, 1.5);
			B.beat(tMiss, 'miss');
			B.fx.push({ k: 'miss', t: tMiss, x: taught.x, y: taught.y - 6 * sc, d: 0.65 });
			L.hold(0.14);
			L.lin({ x: taught.x, y: taught.y - 4 * sc }, DOWN, { v: 40 });
			L.contact(tl0, L.t);
			// it hesitates: over one terminal, then another (crowded, none where it was taught)
			const th0 = L.t;
			hover(B, L, st, 1, undefined, 120);
			L.hold(0.12);
			hover(B, L, st, 3, undefined, 120);
			L.hold(0.1);
			hover(B, L, st, 2, undefined, 120);
			L.hold(0.08);
			B.beat(L.t, 'hesitate');
			B.pace('hesitate', th0, L.t, 1.3);
			// it tests one: the socket glows and fades back (nothing is recorded)
			const tc = tap(B, L, st, 2, { name: 'tap .1', lit: false, dwell: 0.12 });
			st.blink(2, tc, tc + 0.25);
			B.focus.push({ t0: tMiss - 0.3, t1: tc + 0.3, which: 'in' });
			// the lead feeds itself into -X1 meanwhile; power when the probe is up
			const a = B.arrive({ at: Math.max(0, tc - 1.0), selfSeat: true });
			const tSeat = a.tHang + 0.08;
			L.rel(0, -14, { v: 200 });
			const tPw = Math.max(L.t, tSeat + 0.2);
			B.pulse(tPw - 0.16, 0.22);
			B.power(tPw);
			B.selfOut(B.powerT - 0.02);
			park(L, L.t + 0.02);
		},
	},

	/* +C2 · How it works · -K1 · R→L · R probe with its wrist camera
	   Sees the real switchboard · starts from the EPLAN connection list · leaves the report. The arm comes over the
	   switchboard and its wrist camera looks: the cone sweeps across the terminals (brackets on them); the connection list
	   comes out of its feeder on the other side of the device. Then the probe tests the terminals in the list's order (not
	   left to right): each verified terminal lights copper and its row on the list gets a copper tick. */
	2: {
		n: 2,
		tag: '+C2',
		dev: 'K1',
		dir: 'rtl',
		ground: 'plate',
		seed: 23,
		solo: 'R',
		far: 58,
		pace: { r: 0.46, n: 8, hero: ['scan', 'tap'] },
		program(B) {
			const sc = B.G.sc;
			const rig = new Rig(B, { tools: { L: 'gripper', R: 'probe' }, racks: { L: [null, 'probe'], R: ['camera', null] } });
			const { R } = rig;
			const xs = [30, 35, 40, 45, 50];
			const st = new TermStrip(B, xs);
			const board = new Board({ plates: [[25.4, 54.6]], top: -34, strips: [st] });
			const cam = new WristCam(B, R);
			// the connection list: four rows, in the order the probe will test them
			const order = [3, 0, 4, 1];
			const feeder = new Printer({ x: -43, w: 22, h: 6, on: [0.3, 1.0] });
			const list = new Sheet({ x: -43, w: 18, h: 26, y0: -6, rows: 4, kind: 'list', rise: [0.3, 1.0], tick: order.map(() => Infinity), cur: [] });
			B.props.push(board, st, feeder, list, cam);
			// SEES: over the switchboard, the wrist camera's cone sweeps across the terminals
			const look = U(B, 47, -40);
			R.wait(0.06);
			approach(R, look, DOWN);
			const ts = R.t;
			cam.scan(ts, ts + 0.5, { x: 26, y: -9 }, { x: 54, y: -9 });
			R.hold(0.56);
			B.fx.push({ k: 'brackets', t: ts + 0.1, t1: ts + 0.75, x: U(B, 40, 0).x, y: U(B, 0, -7).y, r: 15 * sc });
			B.beat(ts, '01 perceive');
			B.focus.push({ t0: ts - 0.1, t1: ts + 0.6, which: 'in' });
			// TESTS in the list's order: each terminal lit, its row ticked
			order.forEach((i, row) => {
				const tc = tap(B, R, st, i, { name: `tap .${row + 1}` });
				list.o.tick![row] = tc + 0.04;
				list.o.cur!.push([row, tc - 0.3, tc + 0.12]);
			});
			const tDone = R.t;
			B.pace('tap', list.o.cur![0][1], tDone, 1.4);
			// the lead feeds itself into -K1 while the probe works; power once the probe is up
			const a = B.arrive({ at: Math.max(0, tDone - 1.2), selfSeat: true });
			const tSeat = a.tHang + 0.08;
			R.rel(0, -14, { v: 200 });
			const tPw = Math.max(R.t, tSeat + 0.2);
			B.pulse(tPw - 0.16, 0.22);
			B.power(tPw);
			B.selfOut(B.powerT - 0.02);
			park(R, R.t + 0.02);
		},
	},

	/* +C3 · What you get · -X2 · L→R · L probe
	   Fewer hours, every connection verified, a report for the customer. The switchboard is nearly done: three of its five
	   terminals are already verified (copper). The probe tests the last two; all five are lit. The printer beside it prints
	   the report, every row ticked, in front of the reports of the switchboards before it. */
	3: {
		n: 3,
		tag: '+C3',
		dev: 'X2',
		dir: 'ltr',
		ground: 'plate',
		seed: 37,
		solo: 'L',
		far: 58,
		pace: { r: 0.5, n: 8, hero: ['tap', 'print'] },
		program(B) {
			const sc = B.G.sc;
			const rig = new Rig(B, { tools: { L: 'probe', R: 'gripper' }, racks: { L: ['opener', null], R: [null, 'probe'] } });
			const { L } = rig;
			const xs = [-52, -47, -42, -37, -32];
			const st = new TermStrip(B, xs, { litAt: [-1, -1, -1, Infinity, Infinity] });
			const board = new Board({ plates: [[-56, -27.4]], top: -34, strips: [st] });
			const printer = new Printer({ x: 44, w: 24, h: 9 });
			const report = new Sheet({ x: 44, w: 18, h: 28, y0: -9, rows: 5, kind: 'report', rise: [9, 9], tick: [9, 9, 9, 9, 9], stack: 2 });
			B.props.push(board, st, printer, report);
			L.wait(0.06);
			const p3 = st.socket(3);
			approach(L, { x: p3.x, y: p3.y - HOV * sc }, DOWN);
			const t1 = tap(B, L, st, 3, { name: 'tap .1' });
			const t2 = tap(B, L, st, 4, { name: 'tap .2' });
			B.focus.push({ t0: t1 - 0.4, t1: t2 + 0.3, which: 'in' });
			L.rel(0, -14, { v: 200 });
			// the report prints: it rises out of the slot, each row ticked as it comes out
			const r0 = t2 + 0.18,
				r1 = r0 + 0.85;
			report.o.rise = [r0, r1];
			printer.o.on = [r0 - 0.05, r1];
			report.o.tick = [0, 1, 2, 3, 4].map((k) => r0 + 0.2 + k * 0.12);
			B.beat(r1, 'printed');
			B.pace('print', r0, r1 + 0.1, 1.5);
			const a = B.arrive({ at: Math.max(0, t2 - 0.6), selfSeat: true });
			const tSeat = a.tHang + 0.08;
			const tPw = Math.max(r1 + 0.05, tSeat + 0.2);
			B.pulse(tPw - 0.16, 0.22);
			B.power(tPw);
			B.selfOut(B.powerT + 0.3);
			park(L, L.t + 0.02);
		},
	},

	/* +C4 · The prototype · -A1 · R→L · L + R probes
	   The real prototype in miniature: two collaborative arms with probes over one switchboard. Its two mounting plates
	   stand either side of the device, one wiring duct across them. The two needles go down on the two ends of the same
	   wire, in the same frame: the wire is verified, its two terminals and its run through the duct light copper. Twice. */
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
			const lx = [-49, -44, -39, -34],
				rx = [34, 39, 44, 49];
			const sl = new TermStrip(B, lx),
				sr = new TermStrip(B, rx);
			// (the duct is broken where the lead comes down in front of it)
			const lead = (G.inX - G.cx) / sc;
			const gw = G.T.cable / sc / 2 + 1.5;
			const board = new Board({ plates: [[-53, -29.4], [29.4, 53]], top: -38, strips: [sl, sr], span: [-53, 53], gaps: [[lead - gw, lead + gw]] });
			B.props.push(board, sl, sr);
			const a = B.arrive({ at: 0.05, selfSeat: true });
			const tSeat = a.tHang + 0.08;
			// two wires: (left 1 ↔ right 3), (left 3 ↔ right 1): the needles on the two ends of each, in the same frame
			const pairs: [number, number][] = [
				[0, 2],
				[2, 0],
			];
			let after = tSeat * 0.4;
			let tLast = 0;
			pairs.forEach(([i, j], k) => {
				// (each arm first straight over its socket, high: its joint move to the pre-contact pose never sweeps low)
				for (const [tr, tp] of [
					[L, sl.socket(i)],
					[R, sr.socket(j)],
				] as const) {
					tr.wait(after);
					approach(tr, prePose(B, tp, DOWN).pre, DOWN);
				}
				const d = dualProbe(B, { tr: L, tp: sl.socket(i), phi: DOWN, which: 'x4' }, { tr: R, tp: sr.socket(j), phi: DOWN, which: 'x4' }, { after, dwell: 0.16 });
				B.beat(d.tc, 'dual probe contact');
				// (the needles are in the sockets' bores for the last units of their strokes: contact from there)
				L.contact(d.tc - 0.08, d.tc);
				R.contact(d.tc - 0.08, d.tc);
				sl.light(i, d.tc);
				sr.light(j, d.tc);
				board.link(lx[i], rx[j], d.tc);
				B.focus.push({ t0: d.tc - 0.36, t1: d.tc + 0.42, which: 'in' });
				d.ra.done();
				d.rb.done();
				// (the needles leave the bores on the way up: the contact holds until they are out)
				L.contact(d.tc, L.t);
				R.contact(d.tc, R.t);
				after = Math.max(L.t, R.t);
				tLast = d.tc;
				void k;
			});
			const tPw = Math.max(tLast + 0.3, tSeat + 0.2);
			B.pulse(tPw - 0.14, 0.22);
			B.power(tPw);
			park(R, R.t + 0.02);
			park(L, L.t + 0.02);
			B.selfOut(B.powerT + 0.1);
		},
	},

	/* +C5 · Also for you · -A2 · L→R · R gripper
	   Harnesses and robot cells. A harness lies loose on the bench, clamped at one end: the gripper takes its connector,
	   lifts it, routes the cable over the fork and clips the connector onto its mate. Along the arm runs the robot's own
	   dress pack, clamped to its links, hanging loose between them: the cell is planned with every cable in it. */
	5: {
		n: 5,
		tag: '+C5',
		dev: 'A2',
		dir: 'ltr',
		ground: 'plate',
		seed: 53,
		solo: 'R',
		far: 60,
		pace: { r: 0.5, n: 8, hero: ['pick', 'route'] },
		program(B) {
			const rig = new Rig(B, { tools: { L: 'probe', R: 'gripper' }, racks: { L: ['gripper', null], R: [null, 'camera'] } });
			const { R } = rig;
			const h = new Harness(B, R, { clamp: { x: 61, y: 0 }, rest: { x: 46.2, y: -2 }, fork: { x: 54.5, top: -20 }, mate: { x: 38.3, y: -6 } });
			B.props.push(new Dress(B, R), h);
			// take the connector from above (jaws in the screen plane, around its housing)
			const cAt = U(B, 46.2, -4.4),
				lift = U(B, 46.2, -36),
				over = U(B, 42, -38),
				above = U(B, 38.3, -22),
				clip = U(B, 38.3, -9);
			R.wait(0.08);
			R.gripTo(0.4, 0.08);
			// (straight up out of its parked pose first: the fork stands beside it)
			R.lin({ x: R.pose().P.x, y: U(B, 0, -40).y }, DOWN, { v: 200 });
			R.lin({ x: cAt.x, y: U(B, 0, -40).y }, DOWN, { v: 200 });
			R.lin(cAt, DOWN, { v: 110 });
			R.grip.to(R.t, 0.45, 0.08, 'smooth');
			R.hold(0.08);
			h.k.grip = R.t - 0.04;
			const tG = R.t;
			B.beat(tG, 'R: grip');
			// up, over the fork (the cable comes up off the bench and drapes over it), down onto the mate
			R.lin(lift, DOWN, { v: 170 });
			R.lin(over, DOWN, { v: 170 });
			h.k.over = R.t - 0.05;
			R.lin(above, DOWN, { v: 170 });
			R.lin(clip, DOWN, { v: 120 });
			R.hold(0.06);
			R.kickDir({ x: 0, y: 1 }, 1.5);
			R.contact(tG - 0.2, R.t);
			const tClip = R.t;
			R.contact(tClip - 0.4, tClip + 0.12);
			R.gripTo(0.6, 0.08);
			h.k.drop = R.t - 0.04;
			B.beat(tClip, 'clipped');
			B.pace('route', tG, tClip + 0.1, 1.3);
			B.fx.push({ k: 'ring', t: tClip, x: clip.x, y: U(B, 0, -6).y, small: true });
			B.focus.push({ t0: tG - 0.4, t1: tClip + 0.3, which: 'in' });
			R.rel(0, -16, { v: 200 });
			const a = B.arrive({ at: Math.max(0, tClip - 1.3), selfSeat: true });
			const tSeat = a.tHang + 0.08;
			const tPw = Math.max(R.t, tSeat + 0.2);
			B.pulse(tPw - 0.16, 0.22);
			B.power(tPw);
			B.selfOut(B.powerT + 0.28);
			park(R, R.t + 0.02);
		},
	},

	/* +C6 · Team · -Q1 · R→L · L gripper
	   Something calm, human-sized: a cable coil lies loose on the bench. The gripper lifts it by its top loop, the loops
	   fall together as it hangs, and it sets it down again neat, tied. The arm parks; the breaker is switched on. */
	6: {
		n: 6,
		tag: '+C6',
		dev: 'Q1',
		dir: 'rtl',
		ground: 'plate',
		seed: 67,
		solo: 'L',
		pace: { r: 0.5, n: 8, hero: ['pick', 'coil'] },
		program(B) {
			const sc = B.G.sc;
			const rig = new Rig(B, { tools: { L: 'gripper', R: 'driver' }, racks: { L: [null, 'opener'], R: [null, 'probe'] } });
			const { L } = rig;
			const r = 8;
			const coil = new Coil(B, L, { at: { x: -46.5, y: 0 }, place: { x: -45, y: 0 }, r });
			B.props.push(coil);
			const topY = -2 * r * 0.55;
			const gAt = U(B, -46.5, topY - 1.2),
				up = U(B, -46, topY - 14),
				down = U(B, -45, topY - 1.2);
			L.wait(0.1);
			L.gripTo(1, 0.08);
			approach(L, { x: gAt.x, y: gAt.y - 10 * sc }, DOWN);
			L.lin(gAt, DOWN, { v: 100 });
			L.grip.to(L.t, 0.3, 0.08, 'smooth');
			L.hold(0.08);
			const tG = L.t;
			coil.k.grip = tG - 0.04;
			B.beat(tG, 'L: grip');
			// lifted, the loops fall together under the jaws (a gentle sway), set down neat
			L.lin(up, DOWN, { v: 90 });
			L.lin({ x: up.x + 2 * sc, y: up.y }, DOWN, { T: 0.16 });
			L.lin({ x: up.x - 1.5 * sc, y: up.y }, DOWN, { T: 0.16 });
			L.lin(up, DOWN, { T: 0.12 });
			L.lin(down, DOWN, { v: 70 });
			L.hold(0.06);
			const tD = L.t;
			L.contact(tG - 0.15, tD + 0.1);
			L.gripTo(1, 0.08);
			coil.k.down = tD;
			B.beat(tD, 'coil');
			B.pace('coil', tG, tD + 0.1, 1.2);
			B.focus.push({ t0: tG - 0.4, t1: tD + 0.3, which: 'in' });
			L.rel(0, -14, { v: 160 });
			const a = B.arrive({ at: Math.max(0, tD - 1.2), selfSeat: true });
			const tSeat = a.tHang + 0.08;
			park(L, L.t + 0.02);
			// the breaker switched on once the arm is home (the lever snaps past its dead point)
			const tOn = Math.max(L.t + 0.05, tSeat + 0.2);
			B.dev.act.to(tOn - 0.1, 0.62, 0.1, 'quint').to(tOn, 1, 0, 'spring:lever');
			B.beat(tOn, 'lever ON');
			B.pulse(tOn - 0.3, 0.24);
			B.power(tOn + 0.04);
			B.selfOut(B.powerT + 0.05);
			void sc;
		},
	},
	// (+C7 Contact is not a scroll program: it runs on its own clock, scripts/panel/showpiece)
};
