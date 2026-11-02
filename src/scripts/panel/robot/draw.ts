/**
 * Drawing the robot pair. One geometry, three uses:
 *
 *   markup   SVG strings in UNITS, cell-centred (x = 0 at the device centre, y = 0 on the bench): the static parked pair
 *            generated at build time (no-JS, reduced motion, first paint, 404), and the initial DOM of the live renderer
 *   Live     persistent nodes inside one group scaled to the stage (translate(cx, bench) scale(s)); per frame it writes only
 *            transforms and a few attributes, and only when they change
 *   pieces   the same shapes as convex polygons (armPieces, rackPieces, x4Pieces): what the robot QA tests for collisions
 *
 * Projection. The arm is a planar chain in the screen plane; J1 (base yaw) turns that plane about the vertical axis, so
 * horizontal components shrink by c = m·cos J1, and every part shows its depth: the joint housings are cylinders across
 * the arm plane (an ellipse face swept by its depth: a stadium, never a squashed sliver), and a tool's lateral extent is
 * W·|cos ρ| + D·|sin ρ| for its in-plane half-width W and depth half-width D, with ρ = the tool roll plus the yaw's
 * departure from facing the viewer. The gripper's roll turns its jaws from closing in the screen plane (ρ = 0) to
 * closing across it (ρ = π/2, the transverse wire grasp: one finger in front of the wire, one behind, the wire passing
 * between them; a small oblique offset shows the far finger and the jaw opening).
 *
 * Joint angles are scale-free, so the renderer runs its own unit-size robots (same kinematics) on the joint vector the
 * simulation hands it. Every shape carries explicit hex paint attributes (paint.ts RB tables, per ground: plate | blue),
 * added where the markup leaves this module (static cells, the live cell, its effects): no paint comes from CSS.
 */
import { f } from '../core';
import { RB, glowMarkup, paintAttrs, paintSvg, type RbTheme } from '../paint';
import { DEG, GEO, PARK, Robot, type FK, type Pt, type ToolName } from './kin';
import { LOGO_BOX, LOGO_R, LOGO_W } from './logo';

export const RACK_X = 136;
/** rack slots (tool axis x), per arm: [inner, outer] */
export const SLOT = { L: [-124, -148], R: [124, 148] } as const;
export const BAR_TOP = -36;
/** the flange centre of a docked tool: its plate (2.5 thick) rests on the bar top */
export const DOCK_F = BAR_TOP - 4;
export const BASE_X = 84;
/** the static cell's box in units: x ±164, y −116 … +8 */
export const CELL_BOX = { x: -164, y: -116, w: 328, h: 124 };
/** the tool plate every tool carries (the tool side of the changer): axial thickness, radius */
export const PLATE = { t: 2.5, r: 7.5 };
/** a rack slot's half-width (the tool bodies pass through it, the plate rests on its edges) */
const SLOT_HW = 6.7;
/** joint housings: radius, inner ring, half-depth (cylinders across the arm plane) */
const CAPS = [
	{ r: GEO.r1, ri: 5, h: 7 },
	{ r: GEO.r2, ri: 4, h: 6 },
	{ r: GEO.r3, ri: 3, h: 5 },
];

/** tool geometry, tool frame: x along the axis from the flange face, half-widths in plane (w) and in depth (d) */
export const TG = {
	gripper: { body: { x0: 2.5, x1: 11, w: 6, d: 4.5 }, fing: { x0: 10, x1: 20 }, th: 1.2, cross: 2.5, stroke: 2.6, pad: { x0: 14.5, x1: 19.5 }, tcp: 16.5 },
	probe: { holder: { x0: 2.5, x1: 14, w0: 3.6, w1: 2 }, barrel: { x0: 14, x1: 19, w: 1.3 }, needle: { x0: 18.5, x1: 26, w: 0.55 }, tip: 27.5, led: 8 },
	camera: { body: { x0: 2.5, x1: 12, w: 6 }, lens: { x0: 12, x1: 14.5, w: 4.5 }, dot: { x: 7, y: 4.5 } },
	driver: { body: { x0: 2.5, x1: 14, w: 4 }, collar: { x0: 14, x1: 18, w: 2.6 }, bit: { x0: 18, x1: 28.5, w: 1 }, tip: { x0: 28.5, x1: 29.5, w: 0.45 } },
	opener: { body: { x0: 2.5, x1: 11, w: 3.2 }, fin: { x0: 4, x1: 10, w: 6.2 }, neck: { x0: 11, x1: 13, w: 1.7 }, blade: { x0: 13, x1: 23.4, w: 1.35 }, tip: { x0: 23.4, x1: 24.5, w: 0.4 } },
};
/** the oblique depth cue (tool frame offset per unit of depth): far parts shift toward the tip and away from the wire */
const OBL = { ax: 0.3, lat: -0.3 };

export interface ToolSt {
	open: number;
	comp: number;
	led: number;
	spin: number;
	/** the lead's width in units (the gripper closes on it) */
	cw: number;
	/** the tool roll (rad) */
	roll: number;
	/** the jaws hold a wire (0…1): its short piece between the fingers is drawn */
	hold: number;
}
const TOOL_KINDS: ToolName[] = ['gripper', 'probe', 'camera', 'driver', 'opener'];

/** projected half-width of a part with in-plane half-width w and depth half-width d at roll ρ */
const hw = (w: number, d: number, rho: number) => w * Math.abs(Math.cos(rho)) + d * Math.abs(Math.sin(rho));

/* ------------------------------------------------------------------ the gripper's dynamic geometry */
interface GripG {
	bodyH: number;
	/** finger centres (lateral), half-height, axial shift (depth cue) for the far (a) and near (b) finger */
	ya: number;
	yb: number;
	fh: number;
	xa: number;
	xb: number;
	/** pads (in-plane only), groove (across only) */
	padO: number;
	grO: number;
	gap: number;
}
function gripG(st: ToolSt): GripG {
	const G = TG.gripper,
		rho = st.roll;
	// fully closed the fingers meet (0.4 apart); a wire between them stops them at its width
	const g = Math.max(0.4 + (G.stroke + st.cw / 2) * st.open, st.hold > 0 ? st.cw / 2 : 0);
	const o = g + G.th;
	const cr = Math.cos(rho),
		sr = Math.abs(Math.sin(rho));
	// finger a: closing offset +o (depth +o·sin ρ: the far one), finger b: −o (near)
	const za = o * sr,
		zb = -o * sr;
	return {
		bodyH: hw(G.body.w, G.body.d, rho),
		ya: o * cr + za * OBL.lat,
		yb: -o * cr + zb * OBL.lat,
		fh: hw(G.th, G.cross, rho),
		xa: za * OBL.ax,
		xb: zb * OBL.ax,
		padO: Math.abs(cr),
		grO: sr,
		gap: g,
	};
}
const knurl = (sp: number, k: number) => {
	const ph = ((((sp / (2 * Math.PI)) * 3 + k / 3) % 1) + 1) % 1;
	return { y: -3.2 + 6.4 * ph, o: 0.15 + 0.55 * Math.sin(Math.PI * ph) };
};

/** a tool in its own frame: x along the tool axis from the flange face, y lateral (units) */
export function toolMarkup(tool: ToolName, st: ToolSt, wireCls = 'rb-wire') {
	const plate = `<rect class="rb-cp" x="0" y="${-PLATE.r}" width="${PLATE.t}" height="${2 * PLATE.r}" rx=".9"/>`;
	if (tool === 'gripper') {
		const G = TG.gripper,
			q = gripG(st);
		const fw = G.fing.x1 - G.fing.x0;
		return (
			plate +
			`<rect class="rb-tl" data-p="bd" x="${G.body.x0}" y="${f(-q.bodyH)}" width="${G.body.x1 - G.body.x0}" height="${f(2 * q.bodyH)}" rx="1.6"/>` +
			`<line class="rb-tln" data-p="bl" x1="7" y1="${f(-q.bodyH + 1.6)}" x2="7" y2="${f(q.bodyH - 1.6)}"/>` +
			`<rect class="rb-fg" data-p="fa" x="${f(G.fing.x0 + q.xa)}" y="${f(q.ya - q.fh)}" width="${fw}" height="${f(2 * q.fh)}" rx=".7"/>` +
			`<rect class="rb-pad" data-p="pa" x="${G.pad.x0}" y="${f(q.ya - G.th)}" width="${G.pad.x1 - G.pad.x0}" height=".6" opacity="${f(q.padO)}"/>` +
			`<rect class="${wireCls}" data-p="w" x="${f(G.tcp - st.cw / 2)}" y="${f(-G.cross - 1)}" width="${f(st.cw)}" height="${f(2 * G.cross + 2)}" opacity="${f(st.hold)}"/>` +
			`<rect class="rb-fg rb-fgn" data-p="fb" x="${f(G.fing.x0 + q.xb)}" y="${f(q.yb - q.fh)}" width="${fw}" height="${f(2 * q.fh)}" rx=".7"/>` +
			`<rect class="rb-pad" data-p="pb" x="${G.pad.x0}" y="${f(q.yb + G.th - 0.6)}" width="${G.pad.x1 - G.pad.x0}" height=".6" opacity="${f(q.padO)}"/>` +
			`<path class="rb-groove" data-p="gr" d="M${f(G.tcp + q.xb - 1.1)} ${f(q.yb - q.fh)}L${f(G.tcp + q.xb)} ${f(q.yb)}L${f(G.tcp + q.xb - 1.1)} ${f(q.yb + q.fh)}" opacity="${f(q.grO)}"/>`
		);
	}
	if (tool === 'probe') {
		const P = TG.probe,
			c = st.comp;
		return (
			plate +
			`<path class="rb-tl" d="M${P.holder.x0} ${-P.holder.w0}H${P.holder.x1 - 3}L${P.holder.x1} ${-P.holder.w1}V${P.holder.w1}L${P.holder.x1 - 3} ${P.holder.w0}H${P.holder.x0}Z"/>` +
			`<rect class="rb-fg" x="${P.barrel.x0}" y="${-P.barrel.w}" width="${P.barrel.x1 - P.barrel.x0}" height="${2 * P.barrel.w}"/>` +
			`<g data-p="pl" transform="translate(${f(-c)} 0)"><rect class="rb-fg" x="${P.needle.x0}" y="${-P.needle.w}" width="${P.needle.x1 - P.needle.x0}" height="${2 * P.needle.w}"/><path class="rb-fg" d="M${P.needle.x1} ${-P.needle.w}L${P.tip} 0L${P.needle.x1} ${P.needle.w}Z"/></g>` +
			`<circle class="rb-led" cx="${P.led}" cy="0" r="1.6"/>` +
			glowMarkup(P.led, 0, 4.5, ` data-p="lh" opacity="${f(st.led * 0.8)}"`) +
			`<circle class="rb-ledon" data-p="lo" cx="${P.led}" cy="0" r="1.6" opacity="${f(st.led)}"/>`
		);
	}
	if (tool === 'camera') {
		const C = TG.camera;
		const dy = -C.dot.y * Math.cos(st.roll);
		return (
			plate +
			`<rect class="rb-tl" x="${C.body.x0}" y="${-C.body.w}" width="${C.body.x1 - C.body.x0}" height="${2 * C.body.w}" rx="2.5"/>` +
			`<rect class="rb-lens" x="${C.lens.x0}" y="${-C.lens.w}" width="${C.lens.x1 - C.lens.x0}" height="${2 * C.lens.w}" rx="1"/>` +
			`<circle class="rb-dot" data-p="cd0" cx="${C.dot.x}" cy="${f(dy)}" r="1.1"/>` +
			`<circle class="rb-doton" data-p="cd" cx="${C.dot.x}" cy="${f(dy)}" r="1.1" opacity="${st.led > 0.5 ? 1 : 0}"/>`
		);
	}
	if (tool === 'driver') {
		const D = TG.driver;
		let s = plate + `<rect class="rb-tl" x="${D.body.x0}" y="${-D.body.w}" width="${D.body.x1 - D.body.x0}" height="${2 * D.body.w}" rx="1.6"/>`;
		for (let k = 0; k < 3; k++) {
			const q = knurl(st.spin, k);
			s += `<line class="rb-tln" data-p="k${k}" x1="5" y1="${f(q.y)}" x2="12" y2="${f(q.y)}" opacity="${f(q.o)}"/>`;
		}
		s += `<rect class="rb-fg" x="${D.collar.x0}" y="${-D.collar.w}" width="${D.collar.x1 - D.collar.x0}" height="${2 * D.collar.w}" rx=".8"/>`;
		s += `<rect class="rb-fg" x="${D.bit.x0}" y="${-D.bit.w}" width="${D.bit.x1 - D.bit.x0}" height="${2 * D.bit.w}"/>`;
		s += `<rect class="rb-flat" data-p="fl" x="${D.bit.x0 + 0.5}" y="-.35" width="${D.bit.x1 - D.bit.x0 - 1}" height=".7" opacity="${f(0.15 + 0.6 * Math.abs(Math.cos(st.spin)))}"/>`;
		s += `<path class="rb-fg" d="M${D.tip.x0} ${-D.bit.w}L${D.tip.x1} ${-D.tip.w}V${D.tip.w}L${D.tip.x0} ${D.bit.w}Z"/>`;
		return s;
	}
	if (tool === 'opener') {
		// the lever blade: a slim body with a lever fin on one side (it levers on the release slot's edge), a neck, a flat blade
		const O = TG.opener;
		return (
			plate +
			`<path class="rb-tl" d="M${O.fin.x0} ${O.body.w}L${O.fin.x0 + 1.5} ${O.fin.w}H${O.fin.x1 - 1}L${O.fin.x1} ${O.body.w}Z"/>` +
			`<rect class="rb-tl" x="${O.body.x0}" y="${-O.body.w}" width="${O.body.x1 - O.body.x0}" height="${2 * O.body.w}" rx="1.6"/>` +
			`<line class="rb-tln" x1="${O.fin.x0 + 1.6}" y1="${O.body.w + 1.4}" x2="${O.fin.x1 - 1.2}" y2="${O.body.w + 1.4}"/>` +
			`<rect class="rb-fg" x="${O.neck.x0}" y="${-O.neck.w}" width="${O.neck.x1 - O.neck.x0}" height="${2 * O.neck.w}" rx=".5"/>` +
			`<rect class="rb-fg" x="${O.blade.x0}" y="${-O.blade.w}" width="${O.blade.x1 - O.blade.x0}" height="${2 * O.blade.w}"/>` +
			`<rect class="rb-flat" x="${O.blade.x0 + 0.6}" y="-.3" width="${O.blade.x1 - O.blade.x0 - 1.2}" height=".6" opacity=".55"/>` +
			`<path class="rb-fg" d="M${O.tip.x0} ${-O.blade.w}L${O.tip.x1} ${-O.tip.w}V${O.tip.w}L${O.tip.x0} ${O.blade.w}Z"/>`
		);
	}
	return '';
}

/** the live update of a tool's dynamic parts (set(part, attribute, value) skips unchanged values) */
type Setter = (p: string, a: string, v: string) => void;
const KN = ['k0', 'k1', 'k2'];
function toolAttrs(tool: ToolName, st: ToolSt, set: Setter) {
	if (tool === 'gripper') {
		const G = TG.gripper,
			q = gripG(st);
		set('bd', 'y', f(-q.bodyH) + '');
		set('bd', 'height', f(2 * q.bodyH) + '');
		set('bl', 'y1', f(-q.bodyH + 1.6) + '');
		set('bl', 'y2', f(q.bodyH - 1.6) + '');
		set('fa', 'x', f(G.fing.x0 + q.xa) + '');
		set('fa', 'y', f(q.ya - q.fh) + '');
		set('fa', 'height', f(2 * q.fh) + '');
		set('fb', 'x', f(G.fing.x0 + q.xb) + '');
		set('fb', 'y', f(q.yb - q.fh) + '');
		set('fb', 'height', f(2 * q.fh) + '');
		set('pa', 'y', f(q.ya - G.th) + '');
		set('pb', 'y', f(q.yb + G.th - 0.6) + '');
		set('pa', 'opacity', f(q.padO) + '');
		set('pb', 'opacity', f(q.padO) + '');
		set('gr', 'd', `M${f(G.tcp + q.xb - 1.1)} ${f(q.yb - q.fh)}L${f(G.tcp + q.xb)} ${f(q.yb)}L${f(G.tcp + q.xb - 1.1)} ${f(q.yb + q.fh)}`);
		set('gr', 'opacity', f(q.grO) + '');
		set('w', 'x', f(G.tcp - st.cw / 2) + '');
		set('w', 'width', f(st.cw) + '');
		set('w', 'opacity', f(st.hold) + '');
	} else if (tool === 'probe') {
		set('pl', 'transform', `translate(${f(-st.comp)} 0)`);
		set('lh', 'opacity', f(st.led * 0.8) + '');
		set('lo', 'opacity', f(st.led) + '');
	} else if (tool === 'camera') {
		const dy = f(-TG.camera.dot.y * Math.cos(st.roll)) + '';
		set('cd0', 'cy', dy);
		set('cd', 'cy', dy);
		set('cd', 'opacity', st.led > 0.5 ? '1' : '0');
	} else if (tool === 'driver') {
		for (let k = 0; k < 3; k++) {
			const q = knurl(st.spin, k),
				y = f(q.y) + '';
			set(KN[k], 'y1', y);
			set(KN[k], 'y2', y);
			set(KN[k], 'opacity', f(q.o) + '');
		}
		set('fl', 'opacity', f(0.15 + 0.6 * Math.abs(Math.cos(st.spin))) + '');
	}
}

/* ------------------------------------------------------------------ the rack, the base, the -X4 test terminal */
/** the rack: foot, post, and the bar with two slots the tool bodies hang through (their plates rest on its edges) */
export function rackMarkup(x: number) {
	const b0 = x - 24,
		b1 = x + 24;
	const s = [x - 12, x + 12];
	const piece = (a: number, b: number) => `<rect class="rb-rk" x="${f(a)}" y="${BAR_TOP}" width="${f(b - a)}" height="4" rx="1"/>`;
	return (
		`<rect class="rb-rk" x="${x - 16}" y="-4" width="32" height="4" rx="1.5"/>` +
		`<rect class="rb-rk" x="${x - 2}" y="${BAR_TOP}" width="4" height="${-BAR_TOP - 4}"/>` +
		piece(b0, s[0] - SLOT_HW) +
		piece(s[0] + SLOT_HW, s[1] - SLOT_HW) +
		piece(s[1] + SLOT_HW, b1) +
		// the slot edges the plates rest on
		`<rect class="rb-rkn" x="${f(s[0] - SLOT_HW - 1.6)}" y="${BAR_TOP}" width="1.6" height="1.2"/><rect class="rb-rkn" x="${f(s[0] + SLOT_HW)}" y="${BAR_TOP}" width="1.6" height="1.2"/>` +
		`<rect class="rb-rkn" x="${f(s[1] - SLOT_HW - 1.6)}" y="${BAR_TOP}" width="1.6" height="1.2"/><rect class="rb-rkn" x="${f(s[1] + SLOT_HW)}" y="${BAR_TOP}" width="1.6" height="1.2"/>`
	);
}
/**
 * a tool resting in a rack slot: hanging axis down, its plate on the bar. The left arm reaches its rack turned by π, which
 * mirrors its tool frame: its rack draws the tools mirrored, so a tool looks the same on the flange and in the rack
 */
export const rackToolTf = (x: number, id: 'L' | 'R') => `translate(${f(x)} ${BAR_TOP - PLATE.t}) rotate(90)${id === 'L' ? ' scale(1 -1)' : ''}`;

/** the -X4 feed-through test terminal under the H duct (C4): body, the lead's clamp bar, the side test socket */
export interface X4 {
	/** units, cell-centred: centre x, top y, height, half-width; socket side (−1 left face, +1 right face) and its y */
	x: number;
	top: number;
	h: number;
	w: number;
	side: -1 | 1;
	sy: number;
}
export const X4_SOCKET_DEPTH = 3.5;
export function x4Markup(x: X4) {
	const sx = x.x + x.side * x.w;
	return (
		`<rect class="rb-x4" x="${f(x.x - x.w)}" y="${f(x.top)}" width="${f(2 * x.w)}" height="${f(x.h)}" rx="1.6"/>` +
		`<line class="rb-x4l" x1="${f(x.x - x.w + 1.4)}" y1="${f(x.top + 4)}" x2="${f(x.x + x.w - 1.4)}" y2="${f(x.top + 4)}"/>` +
		`<rect class="rb-x4s" x="${f(x.side > 0 ? sx - X4_SOCKET_DEPTH : sx)}" y="${f(x.sy - 1)}" width="${X4_SOCKET_DEPTH}" height="2"/>` +
		glowMarkup(f(sx - x.side * X4_SOCKET_DEPTH), f(x.sy), 3.2, ' data-x4f opacity="0"')
	);
}

function baseMarkup(bx: number) {
	const g = GEO;
	const pTop = -g.h0,
		pBot = -g.footH;
	return (
		`<rect class="rb-ft" x="${f(bx - g.footW / 2)}" y="${-g.footH}" width="${g.footW}" height="${g.footH}" rx="1.5"/>` +
		`<rect class="rb-pd" x="${f(bx - g.pedW / 2)}" y="${pTop}" width="${g.pedW}" height="${pBot - pTop}"/>` +
		`<line class="rb-bd" x1="${f(bx - g.pedW / 2 + 0.6)}" y1="${pBot - 5}" x2="${f(bx + g.pedW / 2 - 0.6)}" y2="${pBot - 5}"/>`
	);
}

/* ------------------------------------------------------------------ the posed arm */
interface LinkTf {
	tf: string;
	w: string;
	b2: string;
}
const RAD = 1 / DEG;
/** the link from p to q (projected): group transform, tube length attribute, far band offset */
function linkTf(p: Pt, q: Pt, w: number, farBand: number): LinkTf {
	const L = Math.hypot(q.x - p.x, q.y - p.y);
	const a = Math.atan2(q.y - p.y, q.x - p.x) * RAD;
	return { tf: `translate(${f(p.x)} ${f(p.y)}) rotate(${f(a)})`, w: f(L + w) + '', b2: `translate(${f(L - farBand)} 0)` };
}
/** a joint housing seen at the yaw: side (stadium) and face ellipses */
interface CapG {
	x: number;
	y: number;
	sx: number;
	sw: number;
	rx: number;
	fx: number;
	frx: number;
	irx: number;
}
function capG(p: Pt, k: FK, i: number, m: number): CapG {
	const C = CAPS[i],
		ac = Math.abs(k.c),
		as = Math.abs(k.s);
	const half = C.r * ac + C.h * as;
	return { x: p.x, y: p.y, sx: -half, sw: 2 * half, rx: Math.max(0.01, C.r * ac), fx: C.h * k.s * m, frx: Math.max(0.01, C.r * ac), irx: Math.max(0.01, C.ri * ac) };
}
/** the tool frame: origin at the flange centre; the axis foreshortened by the yaw, the lateral axis kept at full length
 * (its parts' widths carry the projection) */
export function toolFrame(k: FK, m: number) {
	const ca = Math.cos(k.la3),
		sa = Math.sin(k.la3),
		sg = Math.abs(k.c) > 1e-6 ? Math.sign(k.c) : m;
	return { ax: k.c * ca, ay: sa, lx: -sg * sa, ly: ca, ox: k.F.x, oy: k.F.y };
}
/** the yaw's departure from facing the viewer (the roll it adds to a vertical tool), in (−π/2, π/2] */
export const yawRoll = (yaw: number, la3: number) => {
	const d = yaw - Math.PI * Math.round(yaw / Math.PI);
	const sa = Math.sin(la3);
	return d * sa * sa;
};
const toolTfStr = (k: FK, m: number) => {
	const T = toolFrame(k, m);
	return `matrix(${T.ax.toFixed(4)} ${T.ay.toFixed(4)} ${T.lx.toFixed(4)} ${T.ly.toFixed(4)} ${f(T.ox)} ${f(T.oy)})`;
};
const notchY = (lock: number) => f(-3 + 6 * (lock - 0.5)) + '';

/**
 * The ROBOSECT logo printed on every arm, on the forearm between the elbow's housing and the wrist band:
 * the link that faces the viewer and runs across the scene (toward the work, or toward the rack), so the print reads upright
 * whatever the arm does: it is printed on both sides of the link, and the side we see is the one facing us (the base yaw's
 * sign says which: when the arm turns past edge-on the forearm's projected length is ~0, so the change never shows).
 * Measured over the showpiece film: upright 100 % of the time on the forearm; on the upper arm (it stands near vertical and
 * leans both ways) it read upside down 10–27 % of the time. A print: it turns with the link and foreshortens with it.
 * Two prints, one shown: the wordmark where the arm is drawn large enough to read it (≥ 1.7 px per unit: desktops, tall
 * tablets, the showpiece's desktop stage), the small-cut R mark with its ferrule elsewhere (CSS picks, `.rb-lgw` / `.rb-lgr`:
 * a display rule, never a paint). The logo kit's artwork unchanged (robot/logo.ts), literal paint, no ids, no <use>.
 */
/** the print's size in arm units: the wordmark's width, the R mark's cap height (the logo's cap is 96) */
const LOGO = { w: 32, r: 7 };
const logoPaths = (P: [string, string][]) => P.map(([fill, d]) => `<path fill="${fill}" stroke="none" d="${d}"/>`).join('');
const LOGO_MARKUP = (() => {
	const W = LOGO_BOX.w,
		R = LOGO_BOX.r,
		kw = LOGO.w / W.w,
		kr = LOGO.r / 96;
	return (
		`<g class="rb-lgw" transform="scale(${kw.toFixed(5)}) translate(${-(W.x + W.w / 2)} ${-(W.y + W.h / 2)})">${logoPaths(LOGO_W)}</g>` +
		`<g class="rb-lgr" transform="scale(${kr.toFixed(5)}) translate(${-(R.x + R.w / 2)} ${-(R.y + R.h / 2)})">${logoPaths(LOGO_R)}</g>`
	);
})();
/** the print's place on the forearm: centred between the elbow's housing (r2) and the wrist band (L − r3 − 4), foreshortened
 * with the link's projected length; the side facing the viewer (k.c < 0: the arm's plane turned over) reads the other way */
function logoTf(p: Pt, q: Pt, c: number) {
	const L = Math.hypot(q.x - p.x, q.y - p.y);
	const sx = Math.max(0.02, Math.min(1, L / GEO.L2));
	const flip = c < 0;
	return `translate(${f((L + GEO.r2 - GEO.r3 - 4) / 2)} 0) scale(${(flip ? -sx : sx).toFixed(3)} ${flip ? -1 : 1})`;
}

interface ArmPose {
	lg: string;
	l1: LinkTf;
	l2: LinkTf;
	l3: LinkTf;
	tool: string;
	caps: CapG[];
}
function armPose(k: FK, m: number): ArmPose {
	const g = GEO;
	return {
		lg: logoTf(k.E, k.W, k.c),
		l1: linkTf(k.S, k.E, g.w1, g.r2 + 4),
		l2: linkTf(k.E, k.W, g.w2, g.r3 + 4),
		// the wrist link is a plain tube: its ends hide under the wrist cap and the flange
		l3: linkTf(k.W, k.F, -0.9, 0),
		tool: toolTfStr(k, m),
		caps: [capG(k.S, k, 0, m), capG(k.E, k, 1, m), capG(k.W, k, 2, m)],
	};
}
const capMarkup = (n: string, c: CapG, i: number) =>
	`<g data-p="${n}" transform="translate(${f(c.x)} ${f(c.y)})"><rect class="rb-caps" data-p="${n}s" x="${f(c.sx)}" y="${-CAPS[i].r}" width="${f(c.sw)}" height="${2 * CAPS[i].r}" rx="${f(c.rx)}" ry="${CAPS[i].r}"/>` +
	`<ellipse class="rb-cap" data-p="${n}f" cx="${f(c.fx)}" cy="0" rx="${f(c.frx)}" ry="${CAPS[i].r}"/><ellipse class="rb-capi" data-p="${n}i" cx="${f(c.fx)}" cy="0" rx="${f(c.irx)}" ry="${CAPS[i].ri}"/></g>`;

/** one arm, posed (units). `tools` lists every tool this arm will ever carry (the live renderer toggles them) */
export function armMarkup(rob: Robot, q: ArrayLike<number>, tool: ToolName, st: ToolSt, lock: number, tools: ToolName[] = [tool], wireCls = 'rb-wire') {
	const g = GEO,
		k = rob.fk(q, tool),
		P = armPose(k, rob.m);
	let s = baseMarkup(rob.bx);
	const link = (n: string, L: LinkTf, w: number, nearBand: number, far: boolean) =>
		`<g data-p="${n}" transform="${L.tf}"><rect class="rb-lk" data-p="${n}r" x="${-w / 2}" y="${-w / 2}" width="${L.w}" height="${w}" rx="${w / 2}"/>` +
		(nearBand ? `<line class="rb-bd" x1="${nearBand}" y1="${-(w / 2 - 0.6)}" x2="${nearBand}" y2="${w / 2 - 0.6}"/>` : '') +
		(far ? `<g data-p="${n}b" transform="${L.b2}"><line class="rb-bd" x1="0" y1="${-(w / 2 - 0.6)}" x2="0" y2="${w / 2 - 0.6}"/></g>` : '') +
		(n === 'l2' ? `<g class="rb-logo" data-p="lg" transform="${P.lg}">${LOGO_MARKUP}</g>` : '') +
		`</g>`;
	s += link('l1', P.l1, g.w1, g.r1 + 4, true);
	s += link('l2', P.l2, g.w2, 0, true);
	s += link('l3', P.l3, g.w3, 0, false).replace(`x="${-g.w3 / 2}"`, 'x="0"').replace(`rx="${g.w3 / 2}"`, 'rx="0"');
	// flange + lock ring + tools
	s += `<g data-p="tf" transform="${P.tool}"><rect class="rb-fl" x="-1.5" y="${-g.flangeW / 2}" width="${g.flangeT}" height="${g.flangeW}" rx=".8"/><rect class="rb-nt" data-p="nt" x="-.6" y="${notchY(lock)}" width="1.2" height="2"/>`;
	s += `<g transform="translate(${g.flangeT / 2} 0)">`;
	for (const t of tools) if (t !== 'none') s += `<g data-tool="${t}"${t === tool ? '' : ' display="none"'}>${toolMarkup(t, st, wireCls)}</g>`;
	s += `</g></g>`;
	s += capMarkup('c1', P.caps[0], 0) + capMarkup('c2', P.caps[1], 1) + capMarkup('c3', P.caps[2], 2);
	return s;
}

/** unit-size robots (cell-centred) for drawing */
export const unitRobots = () => ({
	L: new Robot({ id: 'L', m: 1, sc: 1, bx: -BASE_X, floor: 0 }),
	R: new Robot({ id: 'R', m: -1, sc: 1, bx: BASE_X, floor: 0 }),
});

/** what a static (parked) cell shows: per arm its tool, per rack slot its tool (or none), the -X4 terminal (C4) */
export interface CellState {
	tool: { L: ToolName; R: ToolName };
	rack: { L: [ToolName | null, ToolName | null]; R: [ToolName | null, ToolName | null] };
	x4?: X4 | null;
	/** vignettes: only this arm and its rack are drawn (the other's place on the bench holds the close-up) */
	solo?: 'L' | 'R' | null;
}
const REST: ToolSt = { open: 1, comp: 0, led: 0, spin: 0, cw: 4.5, roll: 0, hold: 0 };
/** a tool resting in its rack (a gripper with its jaws closed) */
const RACKED: ToolSt = { ...REST, open: 0 };

/** the parked pair with racks (racks: false = arms only), as static markup (units, cell-centred), painted for its ground */
export function parkedMarkup(st: CellState, cw = 4.5, racks = true, theme: RbTheme = 'plate') {
	return paintSvg(parkedRaw(st, cw, racks), RB[theme]);
}
function parkedRaw(st: CellState, cw: number, racks: boolean) {
	const R = unitRobots();
	let s = '';
	if (st.x4) s += x4Markup(st.x4);
	const drawn = (id: 'L' | 'R') => !st.solo || st.solo === id;
	if (racks)
		for (const id of ['L', 'R'] as const) {
			if (!drawn(id)) continue;
			s += rackMarkup(id === 'L' ? -RACK_X : RACK_X);
			for (let k = 0; k < 2; k++) {
				const t = st.rack[id][k];
				if (t) s += `<g transform="${rackToolTf(SLOT[id][k], id)}">${toolMarkup(t, RACKED)}</g>`;
			}
		}
	for (const id of ['L', 'R'] as const) if (drawn(id)) s += `<g class="rb-arm">${armMarkup(R[id], PARK, st.tool[id], { ...REST, open: 1, cw }, 1)}</g>`;
	return s;
}

/**
 * the static cell for the page's markup: the parked pair as it stands at t = 0 (motion mode, first paint, until the live
 * renderer takes over) and at the end of the program (no-JS, reduced motion: the tested panel)
 */
export function staticCell(start: CellState, end: CellState, theme: RbTheme = 'plate') {
	const a = parkedMarkup(start, 4.5, true, theme),
		b = parkedMarkup(end, 4.5, true, theme);
	return a === b ? a : `<g class="rb-start">${a}</g><g class="rb-end">${b}</g>`;
}

/* ------------------------------------------------------------------ the same shapes as convex polygons (robot QA) */
export type Poly = Pt[];
export interface Piece {
	n: string;
	p: Poly;
	/** what the piece is: link | cap | base | flange | plate | body | tip (the part that touches) | finger */
	kind: string;
}
const rectP = (x0: number, y0: number, x1: number, y1: number): Poly => [
	{ x: x0, y: y0 },
	{ x: x1, y: y0 },
	{ x: x1, y: y1 },
	{ x: x0, y: y1 },
];
function capsuleP(p: Pt, q: Pt, r: number, seg = 6): Poly {
	const a = Math.atan2(q.y - p.y, q.x - p.x);
	const out: Poly = [];
	for (let i = 0; i <= seg; i++) {
		const t = a - Math.PI / 2 + (Math.PI * i) / seg;
		out.push({ x: q.x + r * Math.cos(t), y: q.y + r * Math.sin(t) });
	}
	for (let i = 0; i <= seg; i++) {
		const t = a + Math.PI / 2 + (Math.PI * i) / seg;
		out.push({ x: p.x + r * Math.cos(t), y: p.y + r * Math.sin(t) });
	}
	return out;
}
function stadiumP(c: Pt, half: number, rx: number, ry: number, seg = 6): Poly {
	// a rounded rect of half-width `half`, height 2ry, corner ellipses rx × ry
	const out: Poly = [];
	const cx0 = c.x - half + rx,
		cx1 = c.x + half - rx;
	for (let i = 0; i <= seg; i++) {
		const t = -Math.PI / 2 + (Math.PI * i) / seg;
		out.push({ x: cx1 + rx * Math.cos(t), y: c.y + ry * Math.sin(t) });
	}
	for (let i = 0; i <= seg; i++) {
		const t = Math.PI / 2 + (Math.PI * i) / seg;
		out.push({ x: cx0 + rx * Math.cos(t), y: c.y + ry * Math.sin(t) });
	}
	return out;
}
/** the drawn arm as named convex pieces (units, cell-centred), at the tool state it is drawn with */
export function armPieces(rob: Robot, q: ArrayLike<number>, tool: ToolName, st0: ToolSt): { k: FK; pcs: Piece[] } {
	const g = GEO,
		k = rob.fk(q, tool);
	const st = { ...st0, roll: st0.roll + yawRoll(q[3] || 0, k.la3) };
	const pcs: Piece[] = [];
	pcs.push({ n: 'foot', kind: 'base', p: rectP(rob.bx - g.footW / 2, -g.footH, rob.bx + g.footW / 2, 0) });
	pcs.push({ n: 'ped', kind: 'base', p: rectP(rob.bx - g.pedW / 2, -g.h0, rob.bx + g.pedW / 2, -g.footH) });
	pcs.push({ n: 'upper', kind: 'link', p: capsuleP(k.S, k.E, g.w1 / 2) });
	pcs.push({ n: 'fore', kind: 'link', p: capsuleP(k.E, k.W, g.w2 / 2) });
	const P = [k.S, k.E, k.W];
	for (let i = 0; i < 3; i++) {
		const c = capG(P[i], k, i, rob.m);
		pcs.push({ n: ['capS', 'capE', 'capW'][i], kind: 'cap', p: stadiumP(P[i], c.sw / 2, Math.max(c.rx, 0.3), CAPS[i].r) });
	}
	{
		const dx = k.F.x - k.W.x,
			dy = k.F.y - k.W.y,
			L = Math.hypot(dx, dy) || 1e-9,
			nx = (-dy / L) * 5,
			ny = (dx / L) * 5;
		pcs.push({ n: 'wrist', kind: 'link', p: [{ x: k.W.x + nx, y: k.W.y + ny }, { x: k.F.x + nx, y: k.F.y + ny }, { x: k.F.x - nx, y: k.F.y - ny }, { x: k.W.x - nx, y: k.W.y - ny }] });
	}
	const T = toolFrame(k, rob.m);
	const at = (X: number, Y: number): Pt => ({ x: T.ox + T.ax * X + T.lx * Y, y: T.oy + T.ay * X + T.ly * Y });
	const box = (x0: number, x1: number, y0: number, y1: number, off = 1.5): Poly => [at(x0 + off, y0), at(x1 + off, y0), at(x1 + off, y1), at(x0 + off, y1)];
	pcs.push({ n: 'flange', kind: 'flange', p: box(-1.5, 1.5, -g.flangeW / 2, g.flangeW / 2, 0) });
	if (tool !== 'none') pcs.push({ n: 'plate', kind: 'plate', p: box(0, PLATE.t, -PLATE.r, PLATE.r) });
	const rho = st.roll;
	if (tool === 'gripper') {
		const G = TG.gripper,
			qq = gripG(st);
		pcs.push({ n: 'g-body', kind: 'body', p: box(G.body.x0, G.body.x1, -qq.bodyH, qq.bodyH) });
		pcs.push({ n: 'g-fa', kind: 'finger', p: box(G.fing.x0 + qq.xa, G.fing.x1 + qq.xa, qq.ya - qq.fh, qq.ya + qq.fh) });
		pcs.push({ n: 'g-fb', kind: 'finger', p: box(G.fing.x0 + qq.xb, G.fing.x1 + qq.xb, qq.yb - qq.fh, qq.yb + qq.fh) });
	} else if (tool === 'probe') {
		const Pp = TG.probe,
			c = st.comp;
		pcs.push({ n: 'p-holder', kind: 'body', p: box(Pp.holder.x0, Pp.holder.x1, -Pp.holder.w0, Pp.holder.w0) });
		pcs.push({ n: 'p-barrel', kind: 'body', p: box(Pp.barrel.x0, Pp.barrel.x1, -Pp.barrel.w, Pp.barrel.w) });
		pcs.push({ n: 'p-needle', kind: 'tip', p: box(Pp.needle.x0 - c, Pp.tip - c, -Pp.needle.w, Pp.needle.w) });
	} else if (tool === 'camera') {
		const C = TG.camera;
		const w = hw(C.body.w, C.body.w, rho);
		pcs.push({ n: 'c-body', kind: 'body', p: box(C.body.x0, C.body.x1, -w, w) });
		pcs.push({ n: 'c-lens', kind: 'body', p: box(C.lens.x0, C.lens.x1, -C.lens.w, C.lens.w) });
	} else if (tool === 'driver') {
		const D = TG.driver;
		pcs.push({ n: 'd-body', kind: 'body', p: box(D.body.x0, D.body.x1, -D.body.w, D.body.w) });
		pcs.push({ n: 'd-collar', kind: 'body', p: box(D.collar.x0, D.collar.x1, -D.collar.w, D.collar.w) });
		pcs.push({ n: 'd-bit', kind: 'tip', p: box(D.bit.x0, D.tip.x1, -D.bit.w, D.bit.w) });
	} else if (tool === 'opener') {
		const O = TG.opener;
		pcs.push({ n: 'o-body', kind: 'body', p: box(O.body.x0, O.body.x1, -O.body.w, O.body.w) });
		pcs.push({ n: 'o-fin', kind: 'body', p: box(O.fin.x0, O.fin.x1, O.body.w - 0.2, O.fin.w) });
		pcs.push({ n: 'o-neck', kind: 'body', p: box(O.neck.x0, O.neck.x1, -O.neck.w, O.neck.w) });
		pcs.push({ n: 'o-blade', kind: 'tip', p: box(O.blade.x0, O.tip.x1, -O.blade.w, O.blade.w) });
	}
	return { k, pcs };
}
/** a rack's pieces (units): foot, post, the bar pieces */
export function rackPieces(x: number): Piece[] {
	const s = [x - 12, x + 12];
	return [
		{ n: 'rack-foot', kind: 'rack', p: rectP(x - 16, -4, x + 16, 0) },
		{ n: 'rack-post', kind: 'rack', p: rectP(x - 2, BAR_TOP, x + 2, -4) },
		{ n: 'rack-bar0', kind: 'rack', p: rectP(x - 24, BAR_TOP, s[0] - SLOT_HW, BAR_TOP + 4) },
		{ n: 'rack-bar1', kind: 'rack', p: rectP(s[0] + SLOT_HW, BAR_TOP, s[1] - SLOT_HW, BAR_TOP + 4) },
		{ n: 'rack-bar2', kind: 'rack', p: rectP(s[1] + SLOT_HW, BAR_TOP, x + 24, BAR_TOP + 4) },
	];
}
/** a docked tool's pieces in its rack slot (the tool hangs axis down, plate on the bar) */
export function dockedPieces(x: number, tool: ToolName): Piece[] {
	if (tool === 'none') return [];
	const len = { gripper: 20, probe: 27.5, camera: 14.5, driver: 29.5, opener: 24.5, none: 0 }[tool];
	const w = { gripper: TG.gripper.body.w, probe: TG.probe.holder.w0, camera: TG.camera.body.w, driver: TG.driver.body.w, opener: TG.opener.fin.w, none: 0 }[tool];
	return [
		{ n: `rack-${tool}-plate`, kind: 'rack', p: rectP(x - PLATE.r, BAR_TOP - PLATE.t, x + PLATE.r, BAR_TOP) },
		{ n: `rack-${tool}`, kind: 'rack', p: rectP(x - w, BAR_TOP, x + w, BAR_TOP - PLATE.t + len) },
	];
}
export function x4Pieces(x: X4): Piece[] {
	return [{ n: 'x4', kind: 'x4', p: rectP(x.x - x.w, x.top, x.x + x.w, x.top + x.h) }];
}

/* ------------------------------------------------------------------ the live renderer */
export interface ArmFrame {
	q: ArrayLike<number>;
	tool: ToolName;
	st: ToolSt;
	lock: number;
}
export interface RackFrame {
	L: [ToolName | null, ToolName | null];
	R: [ToolName | null, ToolName | null];
}

/* ------------------------------------------------------------------ live writes through the SVG DOM */
/**
 * The frame budget: the arm's transforms and lengths are written through the SVG DOM (SVGTransform.setTranslate /
 * setRotate / setScale / setMatrix, SVGLength.value) instead of attribute strings: no number → string conversion and no
 * string parse per write (≈ 2.7× cheaper per transform, 4.5× per length in Chromium at 4× CPU). The values are rounded
 * exactly as the markup rounds them (f(), toFixed), so the drawing is the same; the static markup (armMarkup) still carries
 * them as attributes. Standard SVG 1.1 DOM (WebKit, Gecko, Blink); nothing is written while a value is unchanged.
 */
let FACTORY: SVGSVGElement | null = null;
const factory = () => (FACTORY ??= document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement);
const MAT = { m: null as SVGMatrix | null };
class TfNode {
	private items: SVGTransform[] | null = null;
	private v: number[] = [NaN, NaN, NaN, NaN, NaN, NaN];
	constructor(readonly e: SVGGraphicsElement) {}
	private list(n: number) {
		if (this.items && this.items.length === n) return this.items;
		const L = this.e.transform.baseVal;
		L.clear();
		const out: SVGTransform[] = [];
		for (let i = 0; i < n; i++) {
			L.appendItem(factory().createSVGTransform());
			out.push(L.getItem(i));
		}
		return (this.items = out);
	}
	private same(a: number, b: number, c = 0, d = 0, e = 0, g = 0) {
		const v = this.v;
		if (v[0] === a && v[1] === b && v[2] === c && v[3] === d && v[4] === e && v[5] === g) return true;
		v[0] = a;
		v[1] = b;
		v[2] = c;
		v[3] = d;
		v[4] = e;
		v[5] = g;
		return false;
	}
	/** translate(x y) */
	t(x: number, y: number) {
		if (this.same(x, y)) return;
		this.list(1)[0].setTranslate(x, y);
	}
	/** translate(x y) rotate(a) */
	tr(x: number, y: number, a: number) {
		if (this.same(x, y, a)) return;
		const it = this.list(2);
		it[0].setTranslate(x, y);
		it[1].setRotate(a, 0, 0);
	}
	/** translate(x 0) scale(sx sy) */
	ts(x: number, sx: number, sy: number) {
		if (this.same(x, sx, sy)) return;
		const it = this.list(2);
		it[0].setTranslate(x, 0);
		it[1].setScale(sx, sy);
	}
	/** matrix(a b c d e f) */
	m(a: number, b: number, c: number, d: number, e: number, g: number) {
		if (this.same(a, b, c, d, e, g)) return;
		const M = (MAT.m ??= factory().createSVGMatrix());
		M.a = a;
		M.b = b;
		M.c = c;
		M.d = d;
		M.e = e;
		M.f = g;
		this.list(1)[0].setMatrix(M);
	}
}
/** an SVGAnimatedLength attribute (x, width, rx, cx…) written as a number */
class LenNode {
	private v = NaN;
	constructor(private L: SVGLength | null) {}
	set(x: number) {
		if (x === this.v || !this.L) return;
		this.v = x;
		this.L.value = x;
	}
}
const len = (e: Element | undefined, a: 'x' | 'width' | 'rx' | 'cx') => new LenNode(e ? ((e as unknown as Record<string, SVGAnimatedLength>)[a]?.baseVal ?? null) : null);

/** persistent nodes for one arm (the live cell; the showpiece's renderer too) */
export class ArmNodes {
	rob: Robot;
	el: Record<string, Element> = {};
	tools: Partial<Record<ToolName, { g: Element; parts: Record<string, Element> }>> = {};
	last: Record<string, string> = {};
	tool: ToolName | null = null;
	/** the posed parts, written through the SVG DOM */
	private L: { tf: TfNode; w: LenNode; b: TfNode | null }[];
	private lg: TfNode;
	private tf: TfNode;
	private caps: { tf: TfNode; sx: LenNode; sw: LenNode; srx: LenNode; fx: LenNode; frx: LenNode; ix: LenNode; irx: LenNode }[];
	constructor(g: Element, rob: Robot) {
		this.rob = rob;
		for (const e of Array.from(g.querySelectorAll('[data-p]'))) if (!e.closest('[data-tool]')) this.el[e.getAttribute('data-p')!] = e;
		for (const tg of Array.from(g.querySelectorAll('[data-tool]'))) {
			const parts: Record<string, Element> = {};
			for (const e of Array.from(tg.querySelectorAll('[data-p]'))) parts[e.getAttribute('data-p')!] = e;
			this.tools[tg.getAttribute('data-tool') as ToolName] = { g: tg, parts };
		}
		const E = this.el;
		const T = (n: string) => new TfNode(E[n] as SVGGraphicsElement);
		this.L = (['l1', 'l2', 'l3'] as const).map((n) => ({ tf: T(n), w: len(E[n + 'r'], 'width'), b: n !== 'l3' && E[n + 'b'] ? T(n + 'b') : null }));
		this.lg = T('lg');
		this.tf = T('tf');
		this.caps = [1, 2, 3].map((i) => {
			const n = 'c' + i;
			return { tf: T(n), sx: len(E[n + 's'], 'x'), sw: len(E[n + 's'], 'width'), srx: len(E[n + 's'], 'rx'), fx: len(E[n + 'f'], 'cx'), frx: len(E[n + 'f'], 'rx'), ix: len(E[n + 'i'], 'cx'), irx: len(E[n + 'i'], 'rx') };
		});
	}
	private cur: Record<string, Element> = {};
	private curTool: ToolName = 'none';
	private setPart = (p: string, a: string, v: string) => this.set(this.cur[p], a, v, this.curTool + p + a);
	private set(e: Element | undefined, a: string, v: string, key: string) {
		if (!e || this.last[key] === v) return;
		this.last[key] = v;
		e.setAttribute(a, v);
	}
	private lq = [NaN, NaN, NaN, NaN];
	private lk: FK | null = null;
	private ls: (string | number)[] = [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
	/** the tool state its parts were last written from */
	private tq: (string | number)[] = [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
	frame(F: ArmFrame) {
		// an arm that has not moved (parked, holding, waiting) costs a few comparisons (and one that moved less than
		// ≈ 0.05 px at the tool since it was last drawn: the tail of a settling scroll)
		const q = F.q,
			lq = this.lq,
			s = F.st,
			ls = this.ls;
		const k0 = Math.round(F.lock * 1000),
			k1 = Math.round(s.open * 1000),
			k2 = Math.round(s.comp * 1000),
			k3 = Math.round(s.led * 1000),
			k4 = Math.round(s.spin * 1000),
			k5 = Math.round(s.roll * 1000),
			k6 = Math.round(s.hold * 100);
		const same = !!this.lk && ls[0] === F.tool && ls[1] === k0 && ls[2] === k1 && ls[3] === k2 && ls[4] === k3 && ls[5] === k4 && ls[6] === k5 && ls[7] === k6;
		if (same && Math.abs(q[0] - lq[0]) < 2e-4 && Math.abs(q[1] - lq[1]) < 2e-4 && Math.abs(q[2] - lq[2]) < 2e-4 && Math.abs(q[3] - lq[3]) < 2e-4) return this.lk!;
		for (let i = 0; i < 4; i++) lq[i] = q[i];
		ls[0] = F.tool;
		ls[1] = k0;
		ls[2] = k1;
		ls[3] = k2;
		ls[4] = k3;
		ls[5] = k4;
		ls[6] = k5;
		ls[7] = k6;
		const k = this.rob.fk(q, F.tool),
			g = GEO,
			E = this.el;
		this.lk = k;
		// the links (linkTf): translate(p) rotate(a), the tube's length, the far band
		const link = (i: number, p: Pt, qq: Pt, w: number, farBand: number) => {
			const Ln = Math.hypot(qq.x - p.x, qq.y - p.y);
			const N = this.L[i];
			N.tf.tr(f(p.x), f(p.y), f(Math.atan2(qq.y - p.y, qq.x - p.x) * RAD));
			N.w.set(f(Ln + w));
			N.b?.t(f(Ln - farBand), 0);
			return Ln;
		};
		const L2 = link(1, k.E, k.W, g.w2, g.r3 + 4);
		link(0, k.S, k.E, g.w1, g.r2 + 4);
		link(2, k.W, k.F, -0.9, 0);
		// the print on the forearm (logoTf)
		{
			const sx = Math.max(0.02, Math.min(1, L2 / GEO.L2));
			const flip = k.c < 0;
			this.lg.ts(f((L2 + GEO.r2 - GEO.r3 - 4) / 2), +(flip ? -sx : sx).toFixed(3), flip ? -1 : 1);
		}
		// the tool frame (toolTfStr)
		{
			const T = toolFrame(k, this.rob.m);
			this.tf.m(+T.ax.toFixed(4), +T.ay.toFixed(4), +T.lx.toFixed(4), +T.ly.toFixed(4), f(T.ox), f(T.oy));
		}
		// the joint housings (capG)
		const P = [k.S, k.E, k.W];
		for (let i = 0; i < 3; i++) {
			const c = capG(P[i], k, i, this.rob.m),
				N = this.caps[i];
			N.tf.t(f(c.x), f(c.y));
			N.sx.set(f(c.sx));
			N.sw.set(f(c.sw));
			N.srx.set(f(c.rx));
			const fx = f(c.fx);
			N.fx.set(fx);
			N.frx.set(f(c.frx));
			N.ix.set(fx);
			N.irx.set(f(c.irx));
		}
		this.set(E.nt, 'y', notchY(F.lock), 'nt');
		if (F.tool !== this.tool) {
			for (const t of TOOL_KINDS) {
				const T = this.tools[t];
				if (T) {
					if (t === F.tool) T.g.removeAttribute('display');
					else T.g.setAttribute('display', 'none');
				}
			}
			this.tool = F.tool;
		}
		const T = this.tools[F.tool];
		if (T) {
			// (the tool's parts change with its own state and its roll as seen at this yaw: not with every move of the arm)
			const roll = F.st.roll + yawRoll(q[3], k.la3);
			const tq = this.tq;
			if (tq[0] !== F.tool || tq[1] !== s.open || tq[2] !== s.comp || tq[3] !== s.led || tq[4] !== s.spin || tq[5] !== s.cw || tq[6] !== s.hold || tq[7] !== roll) {
				tq[0] = F.tool;
				tq[1] = s.open;
				tq[2] = s.comp;
				tq[3] = s.led;
				tq[4] = s.spin;
				tq[5] = s.cw;
				tq[6] = s.hold;
				tq[7] = roll;
				this.cur = T.parts;
				this.curTool = F.tool;
				toolAttrs(F.tool, { ...F.st, roll }, this.setPart);
			}
		}
		return k;
	}
}

const NS = 'http://www.w3.org/2000/svg';
/** the arm-bound effects of one frame (rig.ts): the tool-coupling ring, the camera's scan cone and its sweep line */
export interface ArmFx {
	click?: { cx: number; cy: number; r: number; op: number } | null;
	cone?: { d: string; op: number } | null;
	sweep?: { x1: number; y1: number; x2: number; y2: number; op: number } | null;
}
export class LiveCell {
	root: SVGGElement;
	/** the drawn arms (a solo cell, vignettes: one; its partner is not drawn at all) */
	arms: { L: ArmNodes | null; R: ArmNodes | null };
	rackG: { L: Partial<Record<ToolName, Element>>[]; R: Partial<Record<ToolName, Element>>[] };
	/** the arm-bound effects: persistent nodes per drawn arm, written by attribute (no markup per frame) */
	fxN: Record<'L' | 'R', { click: SVGCircleElement; cone: SVGPathElement; sweep: SVGLineElement } | null> = { L: null, R: null };
	x4f: Element | null;
	last: Record<string, string> = {};
	theme: RbTheme;
	solo: 'L' | 'R' | null = null;
	constructor(
		layer: SVGSVGElement,
		o: {
			cx: number;
			floor: number;
			sc: number;
			theme: 'plate' | 'blue';
			tools: { L: ToolName[]; R: ToolName[] };
			rackTools: { L: ToolName[][]; R: ToolName[][] };
			init: { L: ArmFrame; R: ArmFrame };
			x4?: X4 | null;
			/** vignettes: only this arm (and its rack) is drawn */
			solo?: 'L' | 'R';
		},
	) {
		const R = unitRobots();
		const slots = { L: layer.querySelector('[data-robot-slot="L"]'), R: layer.querySelector('[data-robot-slot="R"]') };
		this.theme = o.theme;
		this.root = document.createElementNS(NS, 'g');
		this.root.setAttribute('class', `rb rb--${o.theme}`);
		this.root.setAttribute('transform', `translate(${f(o.cx)} ${f(o.floor)}) scale(${o.sc})`);
		// the -X4 terminal and the racks first (behind the arms), then the arms, then the arm-bound effects
		let s = o.x4 ? x4Markup(o.x4) : '';
		this.solo = o.solo ?? null;
		const drawn = (id: 'L' | 'R') => !o.solo || o.solo === id;
		for (const id of ['L', 'R'] as const) {
			if (!drawn(id)) continue;
			s += rackMarkup(id === 'L' ? -RACK_X : RACK_X);
			for (let k = 0; k < 2; k++)
				for (const t of o.rackTools[id][k]) s += `<g data-rack="${id}${k}" data-rt="${t}" display="none" transform="${rackToolTf(SLOT[id][k], id)}">${toolMarkup(t, REST)}</g>`;
		}
		for (const id of ['L', 'R'] as const) {
			if (!drawn(id)) continue;
			const F = o.init[id];
			s += `<g class="rb-arm" data-arm="${id}">${armMarkup(R[id], F.q, F.tool, F.st, F.lock, o.tools[id])}</g>`;
		}
		s += `<g data-fx></g>`;
		this.root.innerHTML = paintSvg(s, RB[o.theme]);
		// keep the layer's two slots (the stage-1 hook) as the parents: L and R arms in their own slot
		(slots.L ?? layer).appendChild(this.root);
		void slots.R;
		const ga = (id: 'L' | 'R') => (drawn(id) ? new ArmNodes(this.root.querySelector(`[data-arm="${id}"]`)!, R[id]) : null);
		this.arms = { L: ga('L'), R: ga('R') };
		const rk = (id: 'L' | 'R') =>
			[0, 1].map((k) => {
				const m: Partial<Record<ToolName, Element>> = {};
				for (const e of Array.from(this.root.querySelectorAll(`[data-rack="${id}${k}"]`))) m[e.getAttribute('data-rt') as ToolName] = e;
				return m;
			});
		this.rackG = { L: rk('L'), R: rk('R') };
		const fx = this.root.querySelector('[data-fx]')!;
		const T = RB[o.theme];
		const mk = <K extends 'circle' | 'path' | 'line'>(tag: K, cls: string) => {
			const e = document.createElementNS(NS, tag) as SVGElementTagNameMap[K];
			for (const [k, v] of Object.entries(paintAttrs(T, cls))) e.setAttribute(k, v);
			e.setAttribute('display', 'none');
			fx.appendChild(e);
			return e;
		};
		for (const id of ['L', 'R'] as const) if (drawn(id)) this.fxN[id] = { cone: mk('path', 'rb-cone'), sweep: mk('line', 'rb-sweep'), click: mk('circle', 'rb-click') };
		this.x4f = this.root.querySelector('[data-x4f]');
	}
	private U = unitRobots();
	frame(L: ArmFrame, R: ArmFrame, rack: RackFrame, x4flash = 0) {
		// a solo cell (vignettes) draws one arm: the other one has no nodes (its pose is still known, for the effects)
		const U = this.U;
		const kL = this.arms.L ? this.arms.L.frame(L) : U.L.fk(L.q, L.tool),
			kR = this.arms.R ? this.arms.R.frame(R) : U.R.fk(R.q, R.tool);
		for (const id of ['L', 'R'] as const) {
			if (this.solo && this.solo !== id) continue;
			for (let k = 0; k < 2; k++) {
				const want = rack[id][k] ?? '';
				const key = `rk${id}${k}`;
				if (this.last[key] === want) continue;
				this.last[key] = want;
				const m = this.rackG[id][k];
				for (const t in m) {
					const e = m[t as ToolName]!;
					if (t === want) e.removeAttribute('display');
					else e.setAttribute('display', 'none');
				}
			}
		}
		if (this.x4f) {
			const v = f(x4flash) + '';
			if (this.last.x4 !== v) {
				this.last.x4 = v;
				this.x4f.setAttribute('opacity', v);
			}
		}
		return { L: kL, R: kR };
	}
	/** the arm-bound effects of this frame: attribute writes on persistent nodes, only where something changed */
	setFx(fx: Record<'L' | 'R', ArmFx>) {
		for (const id of ['L', 'R'] as const) {
			const N = this.fxN[id];
			if (!N) continue;
			const e = fx[id] ?? {};
			this.put(`c${id}`, N.click, e.click ? { cx: f(e.click.cx), cy: f(e.click.cy), r: f(e.click.r), opacity: f(e.click.op) } : null);
			this.put(`k${id}`, N.cone, e.cone ? { d: e.cone.d, opacity: f(e.cone.op) } : null);
			this.put(`s${id}`, N.sweep, e.sweep ? { x1: f(e.sweep.x1), y1: f(e.sweep.y1), x2: f(e.sweep.x2), y2: f(e.sweep.y2), opacity: f(e.sweep.op) } : null);
		}
	}
	private put(key: string, el: Element, a: Record<string, string | number> | null) {
		const on = a ? 'on' : '';
		if (this.last[key] !== on) {
			this.last[key] = on;
			if (a) el.removeAttribute('display');
			else el.setAttribute('display', 'none');
		}
		if (!a) return;
		for (const k in a) {
			const v = String(a[k]),
				kk = key + k;
			if (this.last[kk] === v) continue;
			this.last[kk] = v;
			el.setAttribute(k, v);
		}
	}
	remove() {
		this.root.remove();
	}
}
