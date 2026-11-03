/**
 * One compartment's cell: layout and the program timeline (layout, Builder,
 * compile, guardMorph). A program is authored once per layout into a Builder: the lead's arrival, the
 * robot program, the seat, the test current, power-up and the morph. Every channel is a pure
 * function of program time; the Sim (sim.ts) steps the physical parts (rope, joint flex) at 120 Hz.
 *
 * The robots plug in through `B.rig` (RobotRig below, implemented by robot/rig.ts): the program creates
 * the rig, authors the arms' tracks and the cable grips (programs.ts), and the Sim / StageView call the rig's
 * hooks (joint-flex simulation, the grip pose that pins the lead, the renderer, QA).
 */
import { Chan, Route, carrot, lcg, type Pt } from './core';
import { CAGE, DEV, SCREW, SCREW_BITE, SCREW_TIGHT, SOCKET_Y, TAB, TOGGLE, screwTop, togglePivot, type DevKind } from './devices';
import { SLOT, type X4 } from './robot/draw';
import type { Prop } from './props';

/* ------------------------------------------------------------------ tokens */
export interface RopeCfg {
	n: number;
	g: number;
	damp: number;
	iters: number;
	bend: number;
}
export const ROPE: Record<'desktop' | 'phone', RopeCfg> = {
	desktop: { n: 22, g: 1700, damp: 0.985, iters: 10, bend: 0.5 },
	phone: { n: 18, g: 1400, damp: 0.985, iters: 10, bend: 0.5 },
};

/** per-stage layout tokens (px). CSS mirrors these in global.css (keep in sync) */
export interface Tok {
	/** stage width (the cabinet width) and height */
	W: number;
	H: number;
	lane: number;
	duct: number;
	cable: number;
	jr: number;
	band: number;
	sc: number;
	vmax: number;
	acc: number;
	cu: number;
	cuw: number;
	gap: number;
	rMod: number;
	/** stage-local y of the H duct's top */
	y0: number;
	/** px of scroll per program second (before the r clamp); arrival start above the duct */
	k: number;
	startOff: number;
	/** slowed travel: pen line (× vh), nav height, shortest ramp-down and the ramp-up (× vh), r clamp,
	 * end position of the cell (its H duct `endGap`·vh below the nav when the program ends) */
	pen: number;
	nav: number;
	rampD: number;
	rampU: number;
	rMin: number;
	rMax: number;
	endGap: number;
	bp: 'phone' | 'tablet' | 'desktop';
	/** optional cell centre (the Contact cell sits in the card, not at the page centre) */
	cx?: number;
}

export type Bp = Tok['bp'];
export const bpOf = (w: number): Bp => (w < 700 ? 'phone' : w < 1100 ? 'tablet' : 'desktop');

/** slowed travel: the pen line, ramps (× vh), r ∈ [rMin, rMax], the cell's end position */
/** vignettes: gentler, shorter slow zones (r ≥ 0.45), a short ramp-up, the cell ends mid-screen (END_FRAC) */
const SLOW = { pen: 0.7, rampD: 0.16, rampU: 0.25, rMin: 0.45, rMax: 0.9, endGap: 0.04 };

/** tokens for a viewport width (stage width W = cabinet width) */
export function tokens(W: number, bp: Bp = bpOf(W)): Tok {
	if (bp === 'phone')
		return { W, H: 0, lane: 9, duct: 10, jr: 5, cable: 5, band: 112 * 0.88, sc: 0.88, vmax: 1500, acc: 9000, cu: 6.75, cuw: 2.15, gap: 2, rMod: 12, y0: 0, k: 330, startOff: 110, ...SLOW, nav: 52, bp };
	if (bp === 'tablet') {
		const cable = 7;
		return { W, H: 0, lane: 56 - 5.054 * cable, duct: 16, jr: 8, cable, band: 112 * 1.8, sc: 1.8, vmax: 2000, acc: 11000, cu: 9.5, cuw: 3.0, gap: 4, rMod: 16, y0: 0, k: 380, startOff: 140, ...SLOW, nav: 64, bp };
	}
	const cable = 10;
	const m = Math.max(96, (W - 1264) / 2);
	return { W, H: 0, lane: m - 5.054 * cable, duct: 24, jr: 12, cable, band: 112 * 2.4, sc: 2.4, vmax: 2400, acc: 12000, cu: 13.5, cuw: 4.3, gap: 8, rMod: 20, y0: 0, k: 420, startOff: 140, ...SLOW, nav: 64, bp };
}

/* ------------------------------------------------------------------ layout */
export interface Geo {
	T: Tok;
	sc: number;
	cx: number;
	y0: number;
	ductCy: number;
	ductBot: number;
	floor: number;
	devW: number;
	devH: number;
	devX: number;
	dirS: 1 | -1;
	inX: number;
	outX: number;
	mouthY: number;
	/** a test socket's contact depth (stage y): where a probe's needle bottoms */
	tpY: number;
	/** the ports on the outer side of each mouth (stage x), A2's input sockets, the toggle's pivot */
	pIn: number;
	pOut: number;
	inputs: number[];
	pivot: Pt;
	laneL: number;
	laneR: number;
	entryX: number;
	exitX: number;
	chan: number;
	/** robot base x, racks, rack slots, rack bar top */
	bx: { L: number; R: number };
	rack: { L: number; R: number };
	slot: { L: [number, number]; R: [number, number] };
	barTop: number;
	CU: number;
	/** jaw centre → insulation end, units × sc */
	gIns: number;
	modX: number;
	modW: number;
	modTop: number;
}

export function layout(T: Tok, cfg: CellCfg): Geo {
	const sc = T.sc,
		ov = cfg.layout ? cfg.layout(T) : {};
	const cx = ov.cx ?? T.cx ?? T.W / 2;
	const y0 = ov.y0 ?? T.y0,
		ductCy = y0 + T.duct / 2,
		floor = y0 + T.duct + T.band;
	const DV = DEV[cfg.dev];
	const devW = DV.w * sc,
		devH = DV.h * sc;
	const dirS = cfg.dir === 'ltr' ? 1 : -1;
	const mouth = DV.mouth * sc,
		port = DV.port * sc,
		mouthY = floor - TAB.h * sc;
	const laneL = ov.laneL ?? T.lane,
		laneR = T.W - T.lane;
	const G: Geo = {
		T,
		sc,
		cx,
		y0,
		ductCy,
		ductBot: ductCy + T.jr,
		floor,
		devW,
		devH,
		devX: cx - devW / 2,
		dirS,
		inX: cx - dirS * mouth,
		outX: cx + dirS * mouth,
		mouthY,
		tpY: floor + SOCKET_Y * sc,
		pIn: cx - dirS * port,
		pOut: cx + dirS * port,
		inputs: (DV.inputs ?? []).map((o) => cx - dirS * o * sc),
		pivot: { x: cx + (togglePivot(cfg.dev, cfg.dir) - DV.w / 2) * sc, y: mouthY },
		laneL,
		laneR,
		entryX: dirS > 0 ? laneL : laneR,
		exitX: dirS > 0 ? laneR : laneL,
		chan: (T.duct - T.cable) / 2 - 1,
		bx: { L: cx - 84 * sc, R: cx + 84 * sc },
		rack: { L: cx - 136 * sc, R: cx + 136 * sc },
		slot: { L: [cx + SLOT.L[0] * sc, cx + SLOT.L[1] * sc], R: [cx + SLOT.R[0] * sc, cx + SLOT.R[1] * sc] },
		barTop: floor - 36 * sc,
		// the stripped end never longer than the mouth is deep (6.75 units: the 1440 design), whatever the px tokens
		CU: Math.min(T.cu, 6.75 * sc),
		gIns: 9 * sc,
		modX: T.lane + T.duct / 2 + T.gap,
		modW: 0,
		modTop: floor,
	};
	G.modW = laneR - T.duct / 2 - T.gap - G.modX;
	return G;
}

/* ------------------------------------------------------------------ the robot rig hook */
/** jaw-centre pose of a gripper holding the lead: point and tool-axis angle (screen space, y down) */
export interface GripPose {
	x: number;
	y: number;
	phi: number;
}
/**
 * What a robot pair must provide (implemented by robot/rig.ts: kinematics, tools, programs). All methods
 * are pure functions of the sim state / program time.
 */
export interface RobotRig {
	/** program time when both arms are parked (part of tEnd) */
	end(): number;
	/** true if any arm or tool is below the bench line at t (the morph waits: the module never opens under an arm) */
	below(t: number): boolean;
	/** sim: allocate state, one 120 Hz step, snapshot / restore (for the seek cache) */
	simInit(): unknown;
	simStep(state: unknown, t: number): void;
	snap(state: unknown): unknown;
	restore(snap: unknown): unknown;
	/** a light copy for rendering, and the interpolation between two consecutive 120 Hz views */
	view(state: unknown): unknown;
	lerp(a: unknown, b: unknown, al: number): unknown;
	/** where gripper `id` holds a lead (flexed TCP and tool axis), for the rope pins: the wire runs through the jaws across
	 * the tool axis */
	pose(state: unknown, id: string, t: number): GripPose;
	/** renderer: draw into the cell's robot layer (stage-local px); frame is called once per changed frame,
	 * ex.nudge (units) is the invalid-submit event (Contact) */
	mount?(layer: SVGSVGElement, ctx: { uid: string; ground: string }): { frame(t: number, view: unknown, ex?: { nudge?: number }): void; remove?(): void };
	/** QA: peer clearance, joint limits, IK clamps */
	qa?(tEnd: number): unknown;
	/** the highest any drawn arm reaches above the bench over [t0, t1] (stage px, joint caps included): the zone plan keeps it
	 * under the nav at the program's end (scroll.ts benchMarks) */
	topAbove?(t0: number, t1: number): number;
}

/* ------------------------------------------------------------------ program config */
export interface CellCfg {
	/** compartment number 1..7 */
	n: number;
	tag: string;
	dev: DevKind;
	dir: 'ltr' | 'rtl';
	/** ground of the cell itself: the plate, or the blue Contact card */
	ground: 'plate' | 'blue';
	seed: number;
	/** the finale (Contact): no morph; READY is scrubbed, the submit is an event */
	finale?: boolean;
	/** dramaturgy: the page's hold ratio r this compartment aims for (the scroll its program
	 * gets: lower r = more scroll), at most `n` wheel notches (100 px) for the whole program on tall screens, and the beats
	 * that are this compartment's hero shot (their scroll weight × 1.25). Vignettes: r 0.46–0.50, n 8 (short screens plan at 0.35) */
	pace?: { r: number; n: number; hero?: string[]; w?: Record<string, number> };
	/** desktop only: the cell's offset from the stage centre, × the viewport width (CSS --cell-dx: the cells zig-zag
	 * toward the side their lead comes in from) */
	dx?: number;
	layout?(T: Tok): { cx?: number; y0?: number; laneL?: number };
	/** vignettes: the one arm that works (the other is not drawn); absent = both arms (C4's test) */
	solo?: 'L' | 'R';
	/** a one-arm cell: how far its props reach on the device's far side (units from the device centre; solo.ts centres the
	 * cell from the rack's outer edge to here) */
	far?: number;
	program(B: Builder): void;
}
/** a camera job (vignettes; drawn in place, stage.ts visionAt: no inset, no words),
 * with the vision job's overlays. Times are program time; `at` is the look point (stage px) over time (piecewise linear) */
export interface Vf {
	id: 'L' | 'R';
	kind: 'register' | 'read';
	t0: number;
	t1: number;
	/** the window: half-height in units; centre keyframes */
	r: number;
	at: { t: number; x: number; y: number; r?: number }[];
	/** the job's key times (overlays): register: lock, snap, plan, exec, seat; read: lock, ocr, match, pan, check */
	k: Record<string, number>;
	/** the job's data (the robots' model: the marker's address, the drawing's row); never printed */
	txt: Record<string, string>;
	/** a point the job checks (stage px): +C5's input I0.0 LED */
	tgt?: { x: number; y: number };
}

export interface Fx {
	k: string;
	t: number;
	t1?: number;
	d?: number;
	x?: number;
	y?: number;
	seed?: number;
	small?: boolean;
	back?: boolean;
	id?: string;
	r?: number;
	label?: string;
	len?: number;
	pts?: Pt[];
}
export interface Arrival {
	route: Route;
	t0: number;
	sStart: number;
	sA: number;
	sEnd: number;
	Tc: number;
	dropX: number;
	A: Pt;
	Lhang: number;
	swing: number;
	selfSeat: boolean;
	tExit: number;
	tHang: number;
	/** the carrot's top speed and acceleration (px/s, px/s²): the duct as a feeder (vignettes): ≤ FEED.v units/s, stopping
	 * over its last FEED.stop units into the mouth; the Contact lead keeps the stage's own */
	vmax: number;
	acc: number;
}
/** the feeder rule (vignettes): the lead leaves the duct slot along its axis at a constant speed of at most
 * 600 units/s (≤ 10 units per 1/60 s of program time: it never appears in a new place between two frames) and decelerates
 * over its last 8 units into the mouth */
export const FEED = { v: 580, stop: 8 };
export interface Grip {
	id: string;
	t: number;
	on: boolean;
	gOff?: number;
}
/** the out-lead, routed by a robot: the conductor comes up out of the out-mouth into the open jaws waiting over it
 * (t0 → tG, to E px above the tab), the jaws close, the arm carries it up and feeds its tip into the H duct's slot; at tR
 * it lets go and the duct takes it (the carrot from there on, B.out) */
export interface OutLead {
	id: string;
	t0: number;
	tG: number;
	tR: number;
	E: number;
	gOff: number;
}

/* ------------------------------------------------------------------ the builder (program DSL) */
export class Builder {
	G: Geo;
	cfg: CellCfg;
	rnd: () => number;
	rig: RobotRig | null = null;
	dev = {
		led: new Chan(0),
		pin: new Chan(0),
		bloom: new Chan(0.4),
		glow: new Chan(0),
		act: new Chan(0),
		lit: new Chan(0),
		lamp: new Chan(0),
		scrIn: new Chan(SCREW.rest),
		scrOut: new Chan(SCREW_TIGHT),
		cageIn: new Chan(0),
		cageOut: new Chan(0),
		jawIn: new Chan(1),
		jawOut: new Chan(1),
		lever: new Chan(0),
		tpIn: new Chan(0),
		tpOut: new Chan(0),
		/** the -X4 test socket's flash (C4) */
		x4: new Chan(0),
		/** the finale's chase round -X0's pins (C7) */
		sweep: new Chan(0),
	};
	fx: Fx[] = [];
	/** the bench props the scene's robot works on (props.ts): drawn live and in the static cell, kept clear by the QA */
	props: Prop[] = [];
	cable: { grips: Grip[]; arrive: Arrival | null; seatT: number | null } = { grips: [], arrive: null, seatT: null };
	/** the out-lead's laid route: the carrot from tR (tip s0 past the out-mouth) to D, the bench level in the exit lane */
	out: { t: number; D: number; s0: number } | null = null;
	outLead: OutLead | null = null;
	/** the -X4 test terminal under the H duct (C4), cell units */
	x4: X4 | null = null;
	/** the job's detail moments (a screw or a cage worked, the probes on, the lever thrown): from t0 on the device is a beat
	 * that must be whole on screen (scroll.ts firstDeviceT). Nothing is zoomed: only their
	 * timing is used */
	focus: { t0: number; t1: number; which: 'in' | 'out'; at?: { x: number; y: number; r: number } }[] = [];
	beats: { t: number; name: string }[] = [];
	/** the camera's vision jobs (the +C2 and +C5 vignettes): drawn in place on the work (stage.ts visionAt), no inset, no words */
	vf: Vf[] = [];
	spans: { name: string; t0: number; t1: number }[] = [];
	/** narrative scroll weights authored by a program: extra spans for scroll.ts paceSpans */
	paces: { name: string; t0: number; t1: number; w: number }[] = [];
	morphT = -1;
	powerT = -1;
	/** finale (Contact): READY time, submit-relative timeline start and the end of the event */
	ready = -1;
	submitT = -1;
	finaleEnd = -1;

	constructor(T: Tok, cfg: CellCfg) {
		this.G = layout(T, cfg);
		this.cfg = cfg;
		this.rnd = lcg(cfg.seed || 1);
		// jaws: 0 = open (at the walls) … 1 = closed. A screw clamp starts open; spring terminals rest closed
		this.dev.jawIn.v0 = DEV[cfg.dev].tp === 'screw' ? 0 : 1;
	}
	beat(t: number, name: string) {
		this.beats.push({ t, name });
	}
	span(name: string, t0: number, t1: number) {
		this.spans.push({ name, t0, t1 });
	}
	/** a narrative span: program time [t0, t1] gets scroll weight w (scroll.ts Warp) */
	pace(name: string, t0: number, t1: number, w: number) {
		if (t1 > t0) this.paces.push({ name, t0, t1, w });
	}
	/** seeded jitter in [−a, a] */
	j(a: number) {
		return (this.rnd() * 2 - 1) * a;
	}

	/** the lead arrives along the H duct, leaves it through a slot at dropX and hangs (or seats itself) */
	arrive(o: { at?: number; dropX?: number; gap?: number; swing?: number; selfSeat?: boolean }): Arrival {
		const G = this.G,
			T = G.T;
		const t0 = o.at ?? 0;
		// the lead drops from the duct slot straight over the in-mouth: the wire runs vertically up from the jaws holding it
		// and from the seated terminal, clear of the tools working the ports beside it
		const dropX = o.dropX ?? G.inX;
		const startY = G.y0 - T.startOff;
		const route = new Route(
			[
				{ x: G.entryX, y: startY - 400 },
				{ x: G.entryX, y: G.ductCy },
				{ x: dropX, y: G.ductCy },
				{ x: dropX, y: G.floor + 400 },
			],
			[0, T.jr, T.jr, 0],
			[G.chan, G.chan, Infinity],
		);
		const sStart = route.sAtY(startY);
		const sA = route.sAtY(G.ductBot + 0.01, route.len * 0.5);
		const insEnd = o.selfSeat ? G.mouthY : G.mouthY - G.CU - (o.gap ?? 18) * G.sc;
		const sEnd = sA + (insEnd - G.ductBot) + G.CU;
		const vmax = this.cfg.finale ? T.vmax : Math.min(T.vmax, FEED.v * G.sc),
			acc = this.cfg.finale ? T.acc : (vmax * vmax) / (2 * FEED.stop * G.sc);
		const [, Tc] = carrot(0, sEnd - sStart, vmax, acc);
		const a: Arrival = {
			route,
			t0,
			sStart,
			sA,
			sEnd,
			Tc,
			dropX,
			A: { x: dropX, y: G.ductBot },
			Lhang: insEnd - G.ductBot,
			swing: o.swing ?? 0,
			selfSeat: !!o.selfSeat,
			tExit: 0,
			tHang: 0,
			vmax,
			acc,
		};
		a.tExit = t0 + this.carrotInv(a, sA + G.CU);
		a.tHang = t0 + Tc;
		this.cable.arrive = a;
		this.beat(t0, 'arrive');
		// the sim's copper front chases the carrot on a spring: it lands ≈ 80 ms after the carrot stops
		const tLand = a.tHang + (o.selfSeat ? 0.08 : 0);
		this.beat(tLand, o.selfSeat ? 'self-seat' : 'hang');
		if (o.selfSeat) {
			this.cable.seatT = tLand;
			this.seatFx(tLand);
		}
		return a;
	}
	/** the analytic carrot: copper front along the arrival route at program time t (the sim chases it with a spring) */
	front(t: number) {
		const a = this.cable.arrive!;
		return a.sStart + carrot(Math.max(0, t - a.t0), a.sEnd - a.sStart, a.vmax, a.acc)[0];
	}
	private carrotInv(a: Arrival, s: number) {
		let lo = 0,
			hi = a.Tc;
		for (let k = 0; k < 40; k++) {
			const m = (lo + hi) / 2;
			if (a.sStart + carrot(m, a.sEnd - a.sStart, a.vmax, a.acc)[0] < s) lo = m;
			else hi = m;
		}
		return hi;
	}
	/** where the hanging lead's grip point rests (jaw centre) */
	hangGrip(gOff = this.G.gIns): Pt {
		const a = this.cable.arrive!,
			G = this.G;
		return { x: a.dropX, y: G.ductBot + a.Lhang - gOff };
	}
	/** jaws of gripper `id` close on the lead at t (gOff = jaw centre → insulation end) */
	gripCable(id: string, t: number, gOff?: number) {
		this.cable.grips.push({ id, t, on: true, gOff: gOff ?? this.G.gIns });
	}
	letGo(id: string, t: number) {
		this.cable.grips.push({ id, t, on: false });
	}
	seatFx(t: number) {
		const G = this.G;
		this.fx.push({ k: 'ring', t, x: G.inX, y: G.mouthY });
		// one spark in the whole site, the visitor's: the vignettes' self-seats keep the ring and the glow
		if (this.cfg.finale) this.fx.push({ k: 'sparks', t, x: G.inX, y: G.mouthY, seed: (this.cfg.seed || 1) + 7 });
	}
	seat(t: number) {
		this.cable.seatT = t;
		this.seatFx(t);
		this.beat(t, 'seat');
		// the in-terminal reacts: the push-in spring flexes open as the conductor passes and snaps back
		const tp = DEV[this.cfg.dev].tp;
		if (tp === 'push' || tp === 'pin') this.dev.jawIn.to(t - 0.05, 0.25, 0.05, 'smooth').to(t, 1, 0, 'spring:cage');
	}
	/** the test current: a pulse down the in-lead into the terminal */
	pulse(t: number, dur = 0.22, back = false) {
		this.fx.push({ k: 'pulse', t, d: dur, back });
	}
	/** screw run-down on terminal `which`: clockwise on screen, slowing as torque builds, torque settle, clamp closes */
	screw(which: 'in' | 'out', t: number, turns: number, dur: number) {
		const ch = which === 'in' ? this.dev.scrIn : this.dev.scrOut;
		const a0 = ch.end();
		ch.to(t, a0 + turns * 2 * Math.PI, dur, 'torque').to(t + dur, a0 + turns * 2 * Math.PI + 0.07, 0, 'spring:pop');
		const jaw = which === 'in' ? this.dev.jawIn : this.dev.jawOut;
		jaw.to(t + dur * 0.55, 1, 0, 'spring:jaw');
		this.beat(t + dur, `${which}: torque reached`);
	}
	/** spring cage: the blade pushes the actuator down (jaws to the walls), then it springs back and the cage snaps shut
	 * on the conductor with one bounce */
	cage(which: 'in' | 'out', tOpen: number, tClose: number) {
		const jaw = which === 'in' ? this.dev.jawIn : this.dev.jawOut;
		const act = which === 'in' ? this.dev.cageIn : this.dev.cageOut;
		jaw.to(tOpen, 0, 0.1, 'smooth').to(tClose, 1, 0, 'spring:cage');
		act.to(tOpen, 1, 0.1, 'smooth').to(tClose, 0, 0, 'spring:cage');
		this.fx.push({ k: 'ring', t: tClose, x: which === 'in' ? this.G.inX : this.G.outX, y: this.G.mouthY, small: true });
		this.beat(tOpen, `${which}: cage open`);
		this.beat(tClose, `${which}: cage shut`);
	}
	/** a port's contact point (stage px) for the tool that works it, at program time t (a screw sinks as it is driven) */
	portPoint(which: 'in' | 'out', kind: 'screw' | 'cage' | 'socket', t = 0): Pt {
		const G = this.G,
			sc = G.sc,
			x = which === 'in' ? G.pIn : G.pOut;
		if (kind === 'screw') {
			const a = (which === 'in' ? this.dev.scrIn : this.dev.scrOut).at(t);
			return { x, y: G.floor + (screwTop(a) + SCREW_BITE) * sc };
		}
		if (kind === 'cage') return { x, y: G.floor + CAGE.top0 * sc };
		return { x, y: G.tpY };
	}
	/** the breaker toggle's knob (stage px) at act (0 OFF … 1 ON) */
	knob(act: number): Pt {
		const G = this.G,
			sc = G.sc;
		const so = this.cfg.dir === 'ltr' ? 1 : -1;
		const th = TOGGLE.lean * so * (1 - 2 * act);
		return { x: G.pivot.x + Math.sin(th) * TOGGLE.len * sc, y: G.pivot.y - Math.cos(th) * TOGGLE.len * sc };
	}
	/** power-up → morph (the arms park after it; the out-lead is routed by a robot, routeOut) */
	power(t: number) {
		const d = this.dev,
			kind = this.cfg.dev;
		this.powerT = t;
		this.beat(t, 'power');
		d.led.to(t, 1, 0.06, 'smooth');
		d.bloom.to(t, 1, 0, 'spring:halo');
		d.glow.to(t, 1, 0.08, 'smooth').to(t + 0.16, 0.6, 0.5, 'out');
		if (kind === 'X2') d.lit.to(t + 0.04, 4, 0.3, 'lin');
		else if (kind === 'A2') d.lit.to(t + 0.04, 4, 0.3, 'lin');
		else if (kind === 'X0') d.pin.to(t, 1, 0.06, 'smooth');
		else if (kind === 'A1') {
			d.lamp.to(t, 1, 0.03, 'lin').to(t + 0.12, 0, 0.05, 'lin');
			d.act.to(t + 0.24, 1, 0, 'spring:actuate');
		} else if (kind === 'Q1') {
			// the breaker was switched ON by the robot (its act channel is authored by the program)
		} else d.act.to(t + 0.04, 1, 0, 'spring:actuate');
		if (this.cfg.finale) return;
		// the power-up plays out whole before the doors open (else C3's four lights are cut at the first one): the lights,
		// the relay's bounce, the PLC's lamp test and RUN, then a short hold
		this.morphT = t + (POWER_HOLD[kind] ?? 0.35);
		this.beat(this.morphT, 'morph');
	}
	/** vignettes: the out-lead runs on by itself (no arm routes it): from t the device presents the conductor and the duct
	 * takes it up, along and down the exit lane (the carrot from the out-mouth) */
	selfOut(t: number) {
		const G = this.G;
		const r = this.outRoute();
		const sM = r.sAtY(G.mouthY);
		this.out = { t, D: r.sAtY(G.floor, r.len * 0.5) - sM, s0: 0 };
		this.beat(t, 'out: runs on');
	}
	/** the out-lead's laid route: out of the out-mouth, up into the H duct, along, down the exit lane to the bench level */
	outRoute() {
		const G = this.G,
			T = G.T;
		return new Route(
			[
				{ x: G.outX, y: G.mouthY + G.CU + 6 * G.sc },
				{ x: G.outX, y: G.ductCy },
				{ x: G.exitX, y: G.ductCy },
				{ x: G.exitX, y: G.floor + 400 },
			],
			[0, T.jr, T.jr, 0],
			[Infinity, G.chan, G.chan],
		);
	}
	/**
	 * the out-lead, routed by arm `id`: from t0 the conductor rises out of the out-mouth into the jaws waiting hJ
	 * above the tab (at tG its insulation ends gOff above the jaw centre, the copper above that: the jaws close); the arm
	 * carries it up and feeds the tip into the duct slot (tipY); at tR it lets go and the duct takes it on (the carrot, from
	 * where the tip is)
	 */
	routeOut(o: { id: string; t0: number; tG: number; tR: number; tipY: number; hJ: number; gOff: number }) {
		const G = this.G;
		this.outLead = { id: o.id, t0: o.t0, tG: o.tG, tR: o.tR, E: o.hJ + o.gOff + G.CU, gOff: o.gOff };
		const r = this.outRoute();
		const sM = r.sAtY(G.mouthY);
		this.out = { t: o.tR, D: r.sAtY(G.floor, r.len * 0.5) - sM, s0: r.sAtY(o.tipY) - sM };
		this.beat(o.tG, 'out: gripped');
		this.beat(o.tR, 'out: into the duct');
	}
}

/** program time from power to the morph per device: its power-up whole, then a beat of stillness */
export const POWER_HOLD: Partial<Record<DevKind, number>> = { X1: 0.3, K1: 0.28, X2: 0.38, A1: 0.36, A2: 0.34, Q1: 0.26 };
/** the morph's program-time length (stage.ts): doors open and hold, the shell grows out of the device into the module, the
 * content comes in place (staged, so no frame of it shows text cut by a moving edge) */
export const MORPH_DUR = 0.6;

/* ------------------------------------------------------------------ compile */
export interface Compiled extends Builder {
	tEnd: number;
}

/** author a program at a layout; resolve the morph guard; tEnd */
export function compile(T: Tok, cfg: CellCfg): Compiled {
	const B = new Builder(T, cfg) as Compiled;
	cfg.program(B);
	guardMorph(B);
	B.beats.sort((a, b) => a.t - b.t);
	const T2 = B.G.T;
	const outEnd = B.out ? B.out.t + carrot(0, Math.max(0, B.out.D - B.out.s0), T2.vmax, T2.acc)[1] + 0.25 : 0;
	B.tEnd = cfg.finale ? B.submitT : Math.max(B.rig ? B.rig.end() : 0, B.morphT > 0 ? B.morphT + MORPH_DUR + 0.04 : 0, outEnd);
	return B;
}

/** the module never opens under a robot: the morph (and the out-lead) wait until both arms are above the bench */
function guardMorph(B: Builder) {
	if (!(B.morphT > 0) || !B.rig) return;
	const rig = B.rig;
	let t = B.morphT;
	for (let k = 0; k < 400 && rig.below(t); k++) t += 0.01;
	if (t > B.morphT + 1e-6) {
		const dt = t + 0.04 - B.morphT;
		B.beats = B.beats.map((b) => (b.name === 'morph' ? { t: b.t + dt, name: 'morph (waited for the arms)' } : b));
		B.morphT += dt;
	}
}
