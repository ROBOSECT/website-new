/**
 * The stylized devices with their terminals and micro-mechanics.
 * Shared by the build (Device.astro draws the static, tested state) and the browser.
 *
 * Geometry is the logo's grid: height 96 (the R's cap height), housing radius 12, and the head tab (12 tall, r 4) on top
 * with the device's terminals. The cell is an ELEVATION: the head tab's top face is the terminal face a robot works on,
 * so everything a tool touches is on it, with its axis in the screen plane and vertical, like a feed-through terminal
 * block seen from the side: the two wire mouths (8 wide, 7 deep, ±`mouth`) and, on the outer side of each, its port
 * (`port`): a screw in its pocket (seen from the side: the head sinks as it is driven, its slot shows twice per turn, a
 * highlight runs round it), a spring-cage release slot with its actuator, or a test socket (a bore with a contact at the
 * bottom). The tools come straight down the port's axis. The face below the bench is the device's front: status only
 * (LEDs, the relay's armature, the breaker's flag, the PLC screen); no tool ever reaches it. The breaker's toggle stands
 * on the tab, between the mouths, and swings in the screen plane. 1 unit × --s px.
 * Colours: the body takes the colour of the module it opens into (light | dark | blue); the head tab is a light terminal
 * strip on every device. Every shape carries explicit hex paint attributes (paint.ts): the
 * exported drawing functions return painted markup, nothing depends on CSS for its fill or stroke.
 */
import { clamp01, f } from './core';
import { DV, TAB_THEME, glowMarkup, paintAttrs, paintSvg, type DvTheme } from './paint';

export const TAB = { h: 12, r: 4, mw: 8, md: 7, led: 2.5 };

export type DevKind = 'X1' | 'K1' | 'X2' | 'A1' | 'A2' | 'Q1' | 'X0' | 'F1' | 'F7';
export type TpType = 'screw' | 'cage' | 'push' | 'pin' | 'none';
export type Ground = 'light' | 'dark' | 'blue';
export interface DevSpec {
	w: number;
	h: number;
	tag: string;
	module: Ground;
	tp: TpType;
	/** head tab width; mouth and port offsets from the device centre (units) */
	tabW: number;
	mouth: number;
	port: number;
	/** the status LED (offset from the centre, y): on the tab between the mouths, or on the face */
	led: [number, number];
	/** extra test sockets on the in side (offsets from the centre: A2's four inputs) */
	inputs?: number[];
	/** the breaker toggle on the tab (Q1): its pivot's offset from the centre toward the out-mouth */
	toggle?: number;
}
export const DEV: Record<DevKind, DevSpec> = {
	X1: { w: 48, h: 96, tag: '-X1', module: 'light', tp: 'screw', tabW: 46, mouth: 6.5, port: 18.5, led: [0, 18] },
	K1: { w: 48, h: 96, tag: '-K1', module: 'light', tp: 'push', tabW: 46, mouth: 6.5, port: 18.5, led: [0, 16] },
	X2: { w: 64, h: 96, tag: '-X2', module: 'dark', tp: 'cage', tabW: 52, mouth: 8, port: 20, led: [0, -5] },
	A1: { w: 96, h: 96, tag: '-A1', module: 'light', tp: 'push', tabW: 56, mouth: 10, port: 22, led: [0, -5] },
	A2: { w: 64, h: 96, tag: '-A2', module: 'light', tp: 'push', tabW: 62, mouth: 6.5, port: 18.5, led: [0, 18], inputs: [18.5, 22.1, 25.7, 29.3] },
	Q1: { w: 60, h: 96, tag: '-Q1', module: 'dark', tp: 'push', tabW: 60, mouth: 13, port: 25, led: [0, 82], toggle: 4 },
	X0: { w: 72, h: 40, tag: '-X0', module: 'blue', tp: 'pin', tabW: 52, mouth: 8, port: 20, led: [0, -5] },
	F1: { w: 32, h: 96, tag: '-F1', module: 'light', tp: 'none', tabW: 40, mouth: 12, port: 0, led: [0, -5] },
	/* the Contact showpiece's breaker: screw clamps, the toggle on the tab between the mouths, the
	   contact-position flag on its face. Mouths ±15, screws ±27 (the gripper that switches it reaches the knob clear of the wires) */
	F7: { w: 62, h: 60, tag: '-F7', module: 'dark', tp: 'screw', tabW: 62, mouth: 15, port: 27, led: [0, 50], toggle: 0 },
};
/** screw: thread pitch per turn (units) and the head's top at rest (loose) */
export const SCREW = { pitch: 0.5, top0: -11.2, hw: 3, hh: 2.4, maxSink: 1.4, rest: -Math.PI / 4 };
/** the screw's slot depth: where a driver's blade bottoms */
export const SCREW_BITE = 0.6;
/** a test socket's contact (the probe's needle bottoms here), the cage actuator's top at rest and its travel */
export const SOCKET_Y = -7.4;
export const CAGE = { top0: -11.4, push: 3 };
/** the breaker toggle: pivot on the tab top, lever length, knob radius, OFF/ON lean (rad, from vertical) */
export const TOGGLE = { len: 5.5, knob: 1.8, lean: 30 * (Math.PI / 180) };
/** the screw's head top for a spindle angle (it sinks one pitch per turn) */
export const screwTop = (a: number) => SCREW.top0 + Math.min(SCREW.maxSink, Math.max(0, ((a - SCREW.rest) / (2 * Math.PI)) * SCREW.pitch));
/** the tight angle: 2½ turns from rest */
export const SCREW_TIGHT = SCREW.rest + 5 * Math.PI;

/** device state: numbers only, so a frame is a pure function of program time */
export interface DevState {
	dir: 'ltr' | 'rtl';
	led: number;
	bloom: number;
	glow: number;
	act: number;
	lit: number;
	lamp: number;
	pin: number;
	scr: [number, number];
	scrW: [number, number];
	jaw: [number, number];
	tp: [number, number];
	/** cage actuators pushed 0…1 */
	cage: [number, number];
	/** the finale (X0): a bright chase around the seven pins after 7/7, 0 → 1 (0: none) */
	sweep?: number;
}
export const restState = (dir: 'ltr' | 'rtl'): DevState => ({
	dir,
	led: 0,
	bloom: 0.4,
	glow: 0,
	act: 0,
	lit: 0,
	lamp: 0,
	pin: 0,
	scr: [SCREW.rest, SCREW_TIGHT],
	scrW: [0, 0],
	jaw: [1, 1],
	tp: [0, 0],
	cage: [0, 0],
});
/** the tested, powered state (no-JS, reduced motion, after the morph) */
export const testedState = (kind: DevKind, dir: 'ltr' | 'rtl'): DevState => ({
	...restState(dir),
	led: kind === 'F1' ? 0 : 1,
	bloom: 1,
	glow: kind === 'F1' ? 0 : 0.35,
	act: kind === 'F1' ? 0 : 1,
	lit: kind === 'X0' ? 6 : kind === 'F1' ? 0 : 4,
	pin: kind === 'X0' ? 1 : 0,
	scr: [SCREW_TIGHT, SCREW_TIGHT],
	jaw: [0, 0],
});

const line = (x1: number, y1: number, x2: number, y2: number, cls = 'sl') => `<line class="${cls}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
/** a line shown while `on` (live: always drawn, its visibility toggled; see STABLE below) */
const lineV = (x1: number, y1: number, x2: number, y2: number, cls: string, on: boolean) =>
	STABLE ? `<line class="${cls}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" visibility="${on ? 'visible' : 'hidden'}"/>` : line(x1, y1, x2, y2, cls);
const rect = (x: number, y: number, w: number, h: number, r: number, cls: string, extra = '') =>
	`<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${r}"${extra}/>`;
const circ = (cx: number, cy: number, r: number, cls: string, extra = '') => `<circle class="${cls}" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"${extra}/>`;
/**
 * The live drawing's stable shape: the browser keeps a device's moving parts as persistent nodes and only
 * writes the values that change (svgpatch.ts). A part that comes and goes (an LED's lamp, a halo, the screw head's
 * highlight, a flag that changes colour) is then always drawn, hidden while it is off (opacity 0 or visibility hidden), so
 * no element appears or disappears from one frame to the next and nothing is re-parsed while a screw turns. The static
 * drawing (the build, no-JS, reduced motion) is unchanged: it draws only what is on.
 */
let STABLE = false;
function stable<T>(fn: () => T): T {
	STABLE = true;
	try {
		return fn();
	} finally {
		STABLE = false;
	}
}
const VIS = (v: string) => ` visibility="${v}"`;
/** an LED: its lens and ring (off), the copper lamp over it (on, by opacity) */
const led = (cx: number, cy: number, r: number, on: number, dashed = false) =>
	(dashed ? '' : circ(cx, cy, r - 0.5, 'lens')) + circ(cx, cy, r, 'lo' + (dashed ? ' dash' : '')) + (on > 0 || STABLE ? circ(cx, cy, r, 'li', ` opacity="${f(on > 0 ? clamp01(on) : 0)}"`) : '');
/** the LED bloom: a copper glow without a paint server (paint.ts glowMarkup) */
const halo = (cx: number, cy: number, r: number, op: number) => (op > 0.001 || STABLE ? glowMarkup(f(cx), f(cy), r, ` opacity="${f(op > 0.001 ? op : 0)}"`) : '');

/* faces: the front, below the bench (status only). They split into two doors in the morph. */
const FACES: Record<DevKind, (st: DevState) => string> = {
	X1(st) {
		let s = line(23, 30, 23, 86, 'sl soft') + line(25, 30, 25, 86, 'sl soft');
		// the marker carriers of the two terminals
		for (const cx of [12, 36]) s += rect(cx - 6, 70, 12, 7, 1.5, 'sl');
		const j = clamp01((st.act - 0.15) / 0.7);
		if (j > 0 || STABLE) {
			const x0 = st.dir === 'rtl' ? 36 : 12,
				x1 = x0 + (st.dir === 'rtl' ? -24 : 24) * j;
			const v = STABLE ? VIS(j > 0 ? 'visible' : 'hidden') : '';
			const x2 = x0 + (st.dir === 'rtl' ? -24 : 24);
			s += `<line class="cu" x1="${x0}" y1="46" x2="${f(x1)}" y2="46"${v}/>` + circ(x0, 46, 2.5, 'cuf', v) + (STABLE ? circ(x2, 46, 2.5, 'cuf', VIS(j > 0.98 ? 'visible' : 'hidden')) : j > 0.98 ? circ(x2, 46, 2.5, 'cuf') : '');
		}
		return s;
	},
	K1(st) {
		const ang = (-30 * (1 - st.act) * Math.PI) / 180;
		let s = rect(8, 26, 32, 32, 6, 'win') + circ(16, 46, 2.5, 'dot');
		s += STABLE ? circ(32, 46, 2.5, 'cuf', VIS(st.act > 0.92 ? 'visible' : 'hidden')) + circ(32, 46, 2.5, 'dot', VIS(st.act > 0.92 ? 'hidden' : 'visible')) : st.act > 0.92 ? circ(32, 46, 2.5, 'cuf') : circ(32, 46, 2.5, 'dot');
		s += `<line class="blade" x1="16" y1="46" x2="${f(16 + 16 * Math.cos(ang))}" y2="${f(46 + 16 * Math.sin(ang))}"/>`;
		s += rect(16, 68, 16, 12, 2, 'sl');
		return s;
	},
	X2(st) {
		let s = '';
		for (const x of [16, 32, 48]) s += line(x, 22, x, 86, 'sl soft');
		s += rect(5, 22, 54, 8, 4, 'sl');
		for (let i = 0; i < 4; i++) s += circ(8 + 16 * i, 26, 1.75, 'dot');
		for (let i = 0; i < 4; i++) {
			const on = clamp01(st.lit - i);
			s += halo(8 + 16 * i, 56, 9 * (0.6 + 0.4 * on), on * 0.45 * st.glow) + led(8 + 16 * i, 56, 3.5, on);
		}
		return s;
	},
	A1(st) {
		let s = '';
		for (let i = 0; i < 3; i++) {
			s += rect(12, 26 + 10 * i, 14, 4, 2, 'bar');
			const on = i === 0 ? clamp01(st.act * 1.2) : 0;
			const o = Math.max(on, st.lamp * 0.35);
			if (o > 0 || STABLE) s += rect(12, 26 + 10 * i, 14, 4, 2, 'barl', ` opacity="${f(o)}"`);
		}
		s += rect(36, 22, 48, 32, 5, 'screen');
		const wave = 'M42 44 L48 44 L48 32 L56 32 L56 44 L64 44 L64 32 L72 32 L72 44 L78 44';
		const len = 6 + 12 + 8 + 12 + 8 + 12 + 8 + 12 + 6;
		s += `<path class="wave" d="${wave}"/>`;
		const w = clamp01((st.act - 0.1) / 0.8);
		if (w > 0 || STABLE) s += `<path class="wavecu" d="${wave}" stroke-dasharray="${f(len * w)} ${len}"${STABLE ? VIS(w > 0 ? 'visible' : 'hidden') : ''}/>`;
		return s;
	},
	A2(st) {
		let s = '';
		// one status LED per input (.0 … .3, lit by the probe's taps on the input sockets), the inputs not wired yet dashed
		for (let r = 0; r < 4; r++) {
			const on = clamp01(st.lit - r);
			s += halo(24, 34 + 14 * r, 8 * (0.6 + 0.4 * on), on * 0.4 * st.glow) + led(24, 34 + 14 * r, 3.5, on);
			s += led(40, 34 + 14 * r, 3.5, 0, true);
		}
		return s;
	},
	Q1(st) {
		// the front: the contact-position window, its flag copper when ON
		let s = rect(20, 26, 20, 40, 4, 'win') + rect(25, 32, 10, 28, 2, 'sl');
		s += STABLE ? rect(26.5, 33.5, 7, 25, 1, 'cuf', VIS(st.act > 0.9 ? 'visible' : 'hidden')) + rect(26.5, 47, 7, 11.5, 1, 'dot', VIS(st.act > 0.9 ? 'hidden' : 'visible')) : st.act > 0.9 ? rect(26.5, 33.5, 7, 25, 1, 'cuf') : rect(26.5, 47, 7, 11.5, 1, 'dot');
		return s;
	},
	/* main connector (Contact): six ring pins = the six tested compartments, centre pin = the visitor's request */
	X0(st) {
		let s = circ(36, 22, 13, 'sl');
		for (let k = 0; k < 6; k++) {
			const a = ((-90 + 60 * k) * Math.PI) / 180;
			s += led(36 + 8 * Math.cos(a), 22 + 8 * Math.sin(a), 2.1, clamp01(st.lit - k));
		}
		// the finale's chase: after 7/7 a bloom runs once round the ring, pin by pin, and lands on the
		// centre pin, the visitor's connection
		const sw = st.sweep ?? 0;
		if ((sw > 0 && sw < 1) || STABLE) {
			const head = sw * 7.2 - 0.6;
			for (let k = 0; k < 6; k++) {
				const b = sw > 0 && sw < 1 ? Math.exp(-(((head - k) / 0.75) ** 2)) : 0;
				if (b > 0.02 || STABLE) {
					const a = ((-90 + 60 * k) * Math.PI) / 180;
					s += halo(36 + 8 * Math.cos(a), 22 + 8 * Math.sin(a), 6 + 4 * b, b > 0.02 ? Math.min(1, 1.1 * b) : 0);
				}
			}
		}
		const land = sw > 0 ? Math.exp(-(((sw - 0.92) / 0.12) ** 2)) : 0;
		s += halo(36, 22, 9 * (st.bloom || 1) + 9 * land, Math.min(1, st.pin * 0.55 + 0.45 * land)) + led(36, 22, 2.6, st.pin);
		return s;
	},
	/* the showpiece's breaker: the contact-position window, its flag slate (O) or copper (I, ON) */
	F7(st) {
		let s = rect(19, 12, 24, 30, 4, 'win') + rect(24, 17, 14, 20, 2, 'sl');
		s += STABLE ? rect(25.5, 18.5, 11, 17, 1, 'cuf', VIS(st.act > 0.9 ? 'visible' : 'hidden')) + rect(25.5, 28, 11, 7.5, 1, 'dot', VIS(st.act > 0.9 ? 'hidden' : 'visible')) : st.act > 0.9 ? rect(25.5, 18.5, 11, 17, 1, 'cuf') : rect(25.5, 28, 11, 7.5, 1, 'dot');
		return s;
	},
	/* fuse terminal (404): the window with a broken cartridge element */
	F1() {
		return rect(8, 18, 16, 60, 4, 'win') + line(16, 26, 16, 44) + line(16, 52, 16, 70) + line(12.5, 45.5, 19.5, 50.5, 'sl soft');
	},
};

/** the paint table of a device's body (its module's ground) and of its head tab (the light terminal strip) */
export const bodyTheme = (kind: DevKind): DvTheme => DEV[kind].module;
const bodyPaint = (kind: DevKind) => DV[DEV[kind].module];
const tabPaint = DV[TAB_THEME];

/** the face (front, status only): the part that splits into the two doors */
export function face(kind: DevKind, st: DevState): string {
	return paintSvg(FACES[kind](st), bodyPaint(kind));
}
/** the live drawing's raw markup and its painter (svgpatch.ts keeps the nodes: the same shapes as the painted functions) */
export const faceRaw = (kind: DevKind, st: DevState) => stable(() => FACES[kind](st));
export const facePainter = (kind: DevKind) => (raw: string) => paintSvg(raw, bodyPaint(kind));
export const portPartsLive = (kind: DevKind, st: DevState) => stable(() => portPartsRaw(kind, st));
export const tabPainter = (raw: string) => paintSvg(raw, tabPaint);
export const tabLedPainter = (kind: DevKind) => (raw: string) => paintSvg(raw, DEV[kind].led[1] < 0 ? tabPaint : bodyPaint(kind));

/** the housing: the body's outline and, on the ink bodies, the moulding's highlight along its top edge */
export function housing(kind: DevKind): string {
	const D = DEV[kind];
	let s = rect(0.75, 0.75, D.w - 1.5, D.h - 1.5, 12, 'housing');
	if (D.module !== 'light') {
		const i = 2.6,
			r = 12 - i;
		s += `<path class="hl" d="M${i} ${f(i + r + 6)}V${f(i + r)}A${r} ${r} 0 0 1 ${f(i + r)} ${i}H${f(D.w - i - r)}A${r} ${r} 0 0 1 ${f(D.w - i)} ${f(i + r)}V${f(i + r + 6)}"/>`;
	}
	return paintSvg(s, bodyPaint(kind));
}
/** the housing's attributes for a node built with createElementNS */
export const housingAttrs = (kind: DevKind) => paintAttrs(bodyPaint(kind), 'housing');

/** mouth and port x positions in device units for a direction: [in, out] */
export const mouths = (kind: DevKind, dir: 'ltr' | 'rtl'): [number, number] => {
	const D = DEV[kind],
		cx = D.w / 2;
	return dir === 'rtl' ? [cx + D.mouth, cx - D.mouth] : [cx - D.mouth, cx + D.mouth];
};
export const ports = (kind: DevKind, dir: 'ltr' | 'rtl'): [number, number] => {
	const D = DEV[kind],
		cx = D.w / 2;
	return dir === 'rtl' ? [cx + D.port, cx - D.port] : [cx - D.port, cx + D.port];
};
/** A2's input sockets (device units), on the in side */
export const inputs = (kind: DevKind, dir: 'ltr' | 'rtl'): number[] => {
	const D = DEV[kind],
		cx = D.w / 2,
		s = dir === 'rtl' ? 1 : -1;
	return (D.inputs ?? []).map((o) => cx + s * o);
};
/** the toggle's lean for act (0 OFF … 1 ON, may overshoot): OFF leans to the out side, ON to the in side */
export const toggleLean = (dir: 'ltr' | 'rtl', act: number) => {
	const so = dir === 'ltr' ? 1 : -1;
	return TOGGLE.lean * so * (1 - 2 * act);
};
/** the toggle's pivot x (device units, on the tab top) */
export const togglePivot = (kind: DevKind, dir: 'ltr' | 'rtl') => DEV[kind].w / 2 + (dir === 'ltr' ? 1 : -1) * (DEV[kind].toggle ?? 0);

/** the head tab: outline, the two mouth cavities, the ports' pockets (static) */
export function tabPath(kind: DevKind, dir: 'ltr' | 'rtl' = 'ltr') {
	return paintSvg(tabPathRaw(kind, dir), tabPaint);
}
function tabPathRaw(kind: DevKind, dir: 'ltr' | 'rtl') {
	const D = DEV[kind],
		cx = D.w / 2,
		t = TAB,
		hw = D.tabW / 2;
	let s = `<path class="tab" d="M${cx - hw} 1 V${-t.h + t.r} A${t.r} ${t.r} 0 0 1 ${cx - hw + t.r} ${-t.h} H${cx + hw - t.r} A${t.r} ${t.r} 0 0 1 ${cx + hw} ${-t.h + t.r} V1"/>`;
	for (const x of [cx - D.mouth, cx + D.mouth])
		s += `<path class="cav" d="M${x - t.mw / 2} ${-t.h - 0.75} V${-t.h + t.md - 2} A2 2 0 0 0 ${x - t.mw / 2 + 2} ${-t.h + t.md} H${x + t.mw / 2 - 2} A2 2 0 0 0 ${x + t.mw / 2} ${-t.h + t.md - 2} V${-t.h - 0.75} Z"/>`;
	if (D.tp === 'none') return s;
	const px = [cx - D.port, cx + D.port];
	for (const x of px) {
		if (D.tp === 'screw') s += `<path class="cav" d="M${f(x - 3.6)} ${-t.h - 0.75}V-3.5H${f(x + 3.6)}V${-t.h - 0.75}Z"/>`;
		else if (D.tp === 'cage') s += `<path class="cav" d="M${f(x - 1.8)} ${-t.h - 0.75}V-2.5H${f(x + 1.8)}V${-t.h - 0.75}Z"/>`;
		else s += socketPath(x);
	}
	for (const x of inputs(kind, dir)) s += socketPath(x);
	if (D.toggle != null) {
		const px = togglePivot(kind, dir);
		s += `<path class="tgb" d="M${px - 3.6} ${-t.h + 0.2}A3.6 2.6 0 0 1 ${px + 3.6} ${-t.h + 0.2}Z"/>`;
	}
	return s;
}
const socketPath = (x: number) => `<path class="cav" d="M${f(x - 1.1)} ${-TAB.h - 0.75}V${SOCKET_Y + 0.6}H${f(x + 1.1)}V${-TAB.h - 0.75}Z"/>` + rect(x - 1.1, SOCKET_Y, 2.2, 0.8, 0, 'ctc');

/**
 * the ports' moving parts (drawn over the tab): the screw heads (sinking as they are driven; the slot shows twice per
 * turn; a highlight runs round the head), the cage actuators, the socket flashes, the toggle
 */
export function portParts(kind: DevKind, st: DevState) {
	return paintSvg(portPartsRaw(kind, st), tabPaint);
}
function portPartsRaw(kind: DevKind, st: DevState) {
	const D = DEV[kind];
	const [pIn, pOut] = ports(kind, st.dir);
	let s = '';
	if (D.tp === 'screw') {
		[pIn, pOut].forEach((x, i) => {
			const a = st.scr[i],
				top = screwTop(a);
			s += rect(x - 1.2, top + SCREW.hh, 2.4, -3.5 - top - SCREW.hh, 0, 'shank');
			s += rect(x - SCREW.hw, top, 2 * SCREW.hw, SCREW.hh, 0.7, 'scrh');
			const c = Math.cos(a),
				w = 0.3 + 1.3 * Math.abs(c);
			s += rect(x - w / 2, top - 0.05, w, 1.15, 0, 'slot');
			// a highlight on the turning head: it runs across the front half
			const hx = Math.sin(a) * SCREW.hw * 0.82;
			if (c > 0.05 || STABLE) s += lineV(x + hx, top + 0.45, x + hx, top + SCREW.hh - 0.45, 'shine', c > 0.05);
			if (st.scrW[i] > 0.04 || STABLE) {
				const on = st.scrW[i] > 0.04;
				s += lineV(x - SCREW.hw - 1.2, top + 1.2, x - SCREW.hw - 1.2 - 1.6 * Math.min(1, st.scrW[i]), top + 1.2, 'spin', on) + lineV(x + SCREW.hw + 1.2, top + 1.2, x + SCREW.hw + 1.2 + 1.6 * Math.min(1, st.scrW[i]), top + 1.2, 'spin', on);
			}
		});
	} else if (D.tp === 'cage') {
		[pIn, pOut].forEach((x, i) => {
			const y = CAGE.top0 + CAGE.push * clamp01(st.cage[i]);
			s += rect(x - 1.25, y, 2.5, 2.4, 0.4, 'act') + `<path class="spr" d="M${f(x)} ${f(y + 2.4)}l-.9 .8l1.8 .8l-1.8 .8l1.8 .8l-.9 .8"/>`;
		});
	}
	for (const [i, x] of [pIn, pOut].entries()) if ((st.tp[i] > 0.01 || STABLE) && D.tp !== 'screw' && D.tp !== 'cage') s += circ(x, -TAB.h, 2.4, 'flash', ` opacity="${f(st.tp[i] > 0.01 ? st.tp[i] : 0)}"`);
	if (D.toggle != null) {
		const th = toggleLean(st.dir, st.act),
			px = togglePivot(kind, st.dir);
		const kx = px + Math.sin(th) * TOGGLE.len,
			ky = -TAB.h - Math.cos(th) * TOGGLE.len;
		const c = Math.cos(th) * 1.1,
			sn = Math.sin(th) * 1.1;
		s += `<path class="tgl" d="M${f(px - c)} ${f(-TAB.h - sn)}L${f(px + c)} ${f(-TAB.h + sn)}L${f(kx + c)} ${f(ky + sn)}L${f(kx - c)} ${f(ky - sn)}Z"/>` + circ(kx, ky, TOGGLE.knob, 'tgk');
	}
	return s;
}

/** the tab's status LED with its halo */
export function tabLed(kind: DevKind, st: DevState) {
	// on the tab (y < 0) it is the terminal strip's LED, on the face the body's
	return tabLedPainter(kind)(tabLedRaw(kind, st));
}
export const tabLedLive = (kind: DevKind, st: DevState) => stable(() => tabLedRaw(kind, st));
function tabLedRaw(kind: DevKind, st: DevState) {
	const D = DEV[kind],
		x = D.w / 2 + D.led[0],
		y = D.led[1];
	return halo(x, y, 9 * (st.bloom || 1), st.led * 0.55 * st.glow) + led(x, y, TAB.led, st.led);
}
/** the two jaw slivers inside a mouth, drawn OVER the copper. k: 0 open (at the walls) … 1 clamped */
export function jaws(x: number, k: number, cuw: number) {
	return paintSvg(jawsRaw(x, k, cuw), tabPaint);
}
export function jawsRaw(x: number, k: number, cuw: number) {
	const t = TAB;
	const open = t.mw / 2 - 0.9,
		closed = cuw / 2 + 0.35;
	const g = open + (closed - open) * k;
	const y0 = -t.h + 1.2,
		h = t.md - 2.4;
	return `<rect class="jaw" x="${f(x - g - 1.7)}" y="${f(y0)}" width="1.7" height="${f(h)}" rx=".5"/><rect class="jaw" x="${f(x + g)}" y="${f(y0)}" width="1.7" height="${f(h)}" rx=".5"/>`;
}

/**
 * Static drawing of a device for the build: housing + face + tab + ports (+ copper in the mouths when tested).
 * `open`: only the tab remains (the device has become its module); used by the cell's static markup.
 */
export function staticDevice(kind: DevKind, dir: 'ltr' | 'rtl', o: { tested: boolean; open: boolean; cuw?: number; leads?: [boolean, boolean] }) {
	const D = DEV[kind];
	const st = o.tested ? testedState(kind, dir) : restState(dir);
	const [inX, outX] = mouths(kind, dir);
	let s = '';
	if (!o.open) s += housing(kind) + `<g class="face">${face(kind, st)}</g>`;
	// a face LED (y > 0) goes with the face: the open device keeps only the tab's own LED
	s += tabPath(kind, dir) + portParts(kind, st) + (o.open && D.led[1] > 0 ? '' : tabLed(kind, st));
	if (o.tested) {
		const cuw = o.cuw ?? 4.3;
		const leads = o.leads ?? [true, true];
		// copper inside the cavities, then the jaws clamped on it
		if (leads[0]) s += paintSvg(rect(inX - cuw / 2, -TAB.h - 1, cuw, TAB.md + 1, 0, 'cuin'), tabPaint);
		if (leads[1]) s += paintSvg(rect(outX - cuw / 2, -TAB.h - 1, cuw, TAB.md + 1, 0, 'cuin'), tabPaint);
		s += jaws(inX, leads[0] ? 1 : 0, cuw) + jaws(outX, leads[1] ? 1 : 0, cuw);
	}
	return s;
}
