/**
 * The showpiece's renderer (SHOWPIECE-SPEC §3, §15): ONE description of the stage as a tree of nodes, used two ways:
 *
 *   live    persistent SVG nodes built once; per frame only attributes are written, and only those that changed (no markup
 *           per frame: the arms through draw.ts's ArmNodes, everything else through this tree's dynamic attributes).
 *   string  the same tree serialised at one frame: the build-time poster (no-JS, reduced motion, first paint).
 *
 * Client note 17: no zooms (no loupe, no camera moves on phones: one fixed framing everywhere) and no codes (no device tags,
 * no wire numbers: the wire's marker sleeves carry a wordless print).
 *
 * Every shape carries literal hex paint (paint.ts tables or the palette below; client note 9): no var(), no <use>, no mask,
 * gradient, filter or blend; transforms are SVG attributes; ids are unique per instance (`sp-…`).
 */
import { clamp01, f, fs } from '../core';
import { DEV, SCREW, SCREW_TIGHT, SOCKET_Y, TAB, TOGGLE, face, housing, jaws, portParts, restState, screwTop, tabPath, toggleLean, type DevState } from '../devices';
import { DV, PAL, RB, TAB_THEME, glowMarkup, paintAttrs, paintSvg } from '../paint';
import { ArmNodes, armMarkup, rackToolTf, toolMarkup, type ToolSt } from '../robot/draw';
import type { Pt, ToolName } from '../robot/kin';
import { CAGE_D0, CAGE_PUSH, DUCT, F7, G, PLATE, REL_TILT, SEAT, VB, X0, rack3 } from './scene';
import type { Id } from './program';
import { currentAt, type Compiled, type FS } from './state';
import { DUCT_W, SA, along, sleeveAt, w07Path, type Drop } from './wire';

const C = {
	plate: PAL.mist,
	plateRim: '#BAC4D0',
	plateHole: '#C9D1DC',
	rail: '#BAC4D0',
	railSlot: '#9AA6B5',
	duct: '#C9D1DC',
	ductBack: '#B9C3CF',
	ductRim: '#9AA6B5',
	floor: '#46699F',
	w07: PAL.blue,
	pre: '#7F8A99',
	cu: PAL.cu,
	cud: PAL.cuDeep,
	cul: PAL.cuLight,
	paper: PAL.paper,
	/** the plate dimmed toward the card's blue (00 CELL ON, RESET) */
	dim: PAL.blue,
	ink: PAL.ink,
	steel: PAL.steel,
	steelL: PAL.steelLight,
	mist: PAL.mist,
	blue2: PAL.blue2,
};
const NSS = { 'vector-effect': 'non-scaling-stroke' };
/** a polyline's path data (the same text as `'M' + pts.map(x y).join('L')`, built without the intermediate strings) */
function poly(pts: Pt[]) {
	if (!pts.length) return 'M0 0';
	let d = 'M' + fs(pts[0].x) + ' ' + fs(pts[0].y);
	for (let i = 1; i < pts.length; i++) d += 'L' + fs(pts[i].x) + ' ' + fs(pts[i].y);
	return d;
}

/* ------------------------------------------------------------------ the node tree */
type A = Record<string, string | number>;
/** the frame as the nodes read it: the state plus what several nodes share (path strings, inset geometry) */
export interface RF extends FS {
	dA: string;
	dB: string;
	cuA: string;
	cuB: string;
	slA: string;
	slB: string;
	w07: Pt[];
	cur: { d: string; head: Pt; on: boolean };
	/** the test current's glowing head this frame */
	head: Pt | null;
}
export interface N {
	tag: string;
	a?: A;
	/** dynamic attributes; null hides the node (and skips its subtree) */
	d?: (r: RF) => A | null;
	text?: (r: RF) => string;
	html?: string;
	kids?: N[];
	arm?: Id;
}
const el = (tag: string, a: A = {}, kids: N[] = [], d?: N['d']): N => ({ tag, a, kids, d });
const raw = (html: string, a: A = {}): N => ({ tag: 'g', a, html });

/* ------------------------------------------------------------------ the static set */
/**
 * No theatre, no frame (client note 16: a live machine embedded in the page, not a framed video): the scene stands on the
 * Contact card's own blue. The robots' floor either side of the plate (rounded ends), the work plate (the one bright object)
 * with its fixing holes, the DIN rail behind the devices.
 */
function background() {
	const P = PLATE;
	let s = `<rect x="${VB.x + 1}" y="0" width="${P.x0 - VB.x}" height="3" rx="1.5" fill="${C.floor}" stroke="none"/><rect x="${P.x1 - 1}" y="0" width="${VB.x + VB.w - 1 - P.x1}" height="3" rx="1.5" fill="${C.floor}" stroke="none"/>`;
	s += `<rect x="${P.x0}" y="${P.y0}" width="${P.x1 - P.x0}" height="${P.y1 - P.y0}" rx="4" fill="${C.plate}" stroke="${C.plateRim}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
	for (const [x, y] of [
		[P.x0 + 6, P.y0 + 6],
		[P.x1 - 6, P.y0 + 6],
		[P.x0 + 6, P.y1 - 6],
		[P.x1 - 6, P.y1 - 6],
	])
		s += `<circle cx="${x}" cy="${y}" r="1.6" fill="${C.plateHole}" stroke="none"/>`;
	s += `<rect x="${P.x0 + 4}" y="10" width="${P.x1 - P.x0 - 8}" height="10" fill="${C.rail}" stroke="none"/>`;
	for (let x = P.x0 + 8; x < P.x1 - 8; x += 9) s += `<rect x="${x}" y="13.5" width="5" height="3" rx="1.2" fill="${C.railSlot}" stroke="none"/>`;
	return s;
}
/** the operator station −S1's mount (desktop: the station hangs under the bench at the left, its buttons are HTML over this
 * spot): a steel conduit from the floor into the station's top. Phones carry the station under the stage box instead */
export const STATION = { x0: -182, x1: -126, y0: 27, y1: 64 };
function stationMount() {
	const x = (STATION.x0 + STATION.x1) / 2;
	return `<rect x="${x - 1.6}" y="3" width="3.2" height="${STATION.y0 - 3 + 1}" fill="${C.steel}" stroke="none"/><rect x="${x - 3.2}" y="3" width="6.4" height="2.2" rx=".6" fill="${C.steelL}" stroke="none"/>`;
}
const yD = (DUCT.y0 + DUCT.y1) / 2;
/** −W0, the page's own cable: in from the stage's top-left edge (Carta on the card's blue, the site's rule for the cable on a
 * blue ground), blu cavo once it is on the plate, along the duct, down onto −X0 (its cores are pins 1–6). Its width is the
 * page cable's own (CSS sets it in px, non-scaling: it continues the lead that arrives down the lane) */
const W0_OUT = `M${VB.x} -112H${PLATE.x0 - 4}`;
export const W0_D = `M${PLATE.x0 - 4.5} -112Q${PLATE.x0} -112 ${PLATE.x0} -108V${yD - 5}Q${PLATE.x0} ${yD - 7} ${PLATE.x0 + 4} ${yD - 7}H${DUCT.slotW - 4}Q${DUCT.slotW} ${yD - 7} ${DUCT.slotW} ${yD - 3}V-2`;
function ductBack() {
	const { x0, x1, y0, y1 } = DUCT;
	return (
		`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${C.ductBack}" stroke="none"/>` +
		`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="${C.ductRim}" stroke-width="1.25" fill="none" vector-effect="non-scaling-stroke"/>` +
		`<line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="${C.ductRim}" stroke-width="1.25" fill="none" vector-effect="non-scaling-stroke"/>`
	);
}
function ductFront() {
	const { x0, x1, y0, y1 } = DUCT;
	let s = '';
	const slots = [DUCT.slotA, DUCT.slotB, DUCT.slotS, DUCT.slotW];
	for (let x = x0 + 2; x < x1 - 3; x += 6.5) {
		s += `<rect x="${f(x)}" y="${y0}" width="3.4" height="3" fill="${C.duct}" stroke="${C.ductRim}" stroke-width=".4"/>`;
		if (!slots.some((sx) => Math.abs(x + 1.7 - sx) < 4.2)) s += `<rect x="${f(x)}" y="${y1 - 3}" width="3.4" height="3" fill="${C.duct}" stroke="${C.ductRim}" stroke-width=".4"/>`;
	}
	return s;
}
function prewired() {
	// the supply into −F7:1 (line side, factory-wired: steel, not this job), −W0, W07's run inside the duct
	let s = `<path d="M${DUCT.x0 - 2} ${yD - 3}H${DUCT.slotS - 5}Q${DUCT.slotS} ${yD - 3} ${DUCT.slotS} ${yD + 2}V${SEAT.A.y}" fill="none" stroke="${C.pre}" stroke-width="2.4"/>`;
	s += `<path data-w0 d="${W0_OUT}" fill="none" stroke="${C.paper}" stroke-width="10" stroke-linecap="butt" vector-effect="non-scaling-stroke"/>`;
	s += `<path data-w0 d="${W0_D}" fill="none" stroke="${C.w07}" stroke-width="10" stroke-linejoin="round" stroke-linecap="butt" vector-effect="non-scaling-stroke"/>`;
	s += `<path d="${poly(DUCT_W)}" fill="none" stroke="${C.w07}" stroke-width="${G.wire}" stroke-linejoin="round"/>`;
	return s;
}

/* ------------------------------------------------------------------ devices */
const F7K = 'F7' as const;
const TABP = DV[TAB_THEME];
const pa = (cls: string, a: A = {}) => ({ ...paintAttrs(TABP, cls), ...a });
/** −F7 (device units, translated to its place): the housing, the face with its flag, the tab, the two screw clamps
 * (−F7:1 pre-wired, tight; −F7:2 the one the film drives), the toggle, the copper and the jaws */
function f7Nodes(): N {
	const D = DEV.F7;
	const stTight: DevState = { ...restState('ltr'), scr: [SCREW_TIGHT, SCREW_TIGHT], act: 0 };
	// the static half of the port parts: −F7:1's screw (the second screw is drawn live below)
	const p1 = portParts(F7K, stTight).split('<rect class="shank"');
	const screw1 = p1.length > 2 ? '<rect class="shank"' + p1[1] : '';
	const m1 = D.w / 2 - D.mouth,
		m2 = D.w / 2 + D.mouth,
		s2 = D.w / 2 + D.port;
	const cuw = 1.8;
	const faceOff = face(F7K, { ...restState('ltr'), act: 0 });
	const faceOn = face(F7K, { ...restState('ltr'), act: 1 });
	return el('g', { transform: `translate(${F7.x0} 0)` }, [
		raw(housing(F7K)),
		{ tag: 'g', html: faceOff, d: (r) => (r.tgl > 0.9 ? null : {}) },
		{ tag: 'g', html: faceOn, d: (r) => (r.tgl > 0.9 ? {} : null) },
		raw(tabPath(F7K, 'ltr') + paintSvg(screw1, TABP)),
		// −F7:2's screw: shank, head (sinking one pitch per turn), slot (twice per turn), the highlight running round it
		{ tag: 'rect', a: pa('shank', { x: f(s2 - 1.2), width: 2.4 }), d: (r) => ({ y: f(screwTop(r.scr) + SCREW.hh), height: f(-3.5 - screwTop(r.scr) - SCREW.hh) }) },
		{ tag: 'rect', a: pa('scrh', { x: f(s2 - SCREW.hw), width: 2 * SCREW.hw, height: SCREW.hh, rx: 0.7 }), d: (r) => ({ y: f(screwTop(r.scr)) }) },
		{
			tag: 'rect',
			a: pa('slot', { height: 1.15 }),
			d: (r) => {
				const w = 0.3 + 1.3 * Math.abs(Math.cos(r.scr));
				return { x: f(s2 - w / 2), width: f(w), y: f(screwTop(r.scr) - 0.05) };
			},
		},
		{
			tag: 'line',
			a: pa('shine'),
			d: (r) => {
				if (Math.cos(r.scr) <= 0.05) return null;
				const top = screwTop(r.scr),
					hx = s2 + Math.sin(r.scr) * SCREW.hw * 0.82;
				return { x1: f(hx), x2: f(hx), y1: f(top + 0.45), y2: f(top + SCREW.hh - 0.45) };
			},
		},
		// the toggle: lever and knob (OFF leans to −F7:2, ON to −F7:1; the lever spring's overshoot)
		{
			tag: 'path',
			a: pa('tgl'),
			d: (r) => {
				const th = toggleLean('rtl', r.tgl),
					px = D.w / 2;
				const kx = px + Math.sin(th) * TOGGLE.len,
					ky = -TAB.h - Math.cos(th) * TOGGLE.len;
				const c = Math.cos(th) * 1.1,
					sn = Math.sin(th) * 1.1;
				return { d: `M${f(px - c)} ${f(-TAB.h - sn)}L${f(px + c)} ${f(-TAB.h + sn)}L${f(kx + c)} ${f(ky + sn)}L${f(kx - c)} ${f(ky - sn)}Z` };
			},
		},
		{
			tag: 'circle',
			a: pa('tgk', { r: TOGGLE.knob }),
			d: (r) => {
				const th = toggleLean('rtl', r.tgl);
				return { cx: f(D.w / 2 + Math.sin(th) * TOGGLE.len), cy: f(-TAB.h - Math.cos(th) * TOGGLE.len) };
			},
		},
		// copper in the mouths (−F7:1 pre-wired), then the jaws over it
		raw(paintSvg(`<rect class="cuin" x="${f(m1 - cuw / 2)}" y="${-TAB.h - 1}" width="${cuw}" height="${TAB.md + 1}"/>`, TABP) + jaws(m1, 1, cuw)),
		{ tag: 'rect', a: pa('cuin', { x: f(m2 - cuw / 2), y: -TAB.h - 1, width: cuw, height: TAB.md + 1 }), d: (r) => (r.A.seated ? {} : null) },
		...jawNodes(m2, cuw, (r) => r.jawA),
	]);
}
/** a mouth's two jaw slivers as live nodes (devices.ts jaws(): k 0 open … 1 on the copper) */
function jawNodes(x: number, cuw: number, k: (r: RF) => number): N[] {
	const t = TAB;
	const open = t.mw / 2 - 0.9,
		closed = cuw / 2 + 0.35;
	const y0 = -t.h + 1.2,
		h = t.md - 2.4;
	const g = (r: RF) => open + (closed - open) * k(r);
	return [
		{ tag: 'rect', a: { ...paintAttrs(TABP, 'jaw'), y: f(y0), width: 1.7, height: f(h), rx: 0.5 }, d: (r) => ({ x: f(x - g(r) - 1.7) }) },
		{ tag: 'rect', a: { ...paintAttrs(TABP, 'jaw'), y: f(y0), width: 1.7, height: f(h), rx: 0.5 }, d: (r) => ({ x: f(x + g(r)) }) },
	];
}
/** the main connector (device units, translated): the site's housing and face (its six pins lit: the six compartments
 * above), the centre pin, lit with a soft glow once the circuit has been tested; the showpiece's tab: the spring-cage mouth,
 * the 20° release slot with its actuator, the test socket */
function x0Nodes(): N {
	const DVB = DV.blue;
	const faceStatic = face('X0', { ...restState('ltr'), lit: 6, pin: 0, glow: 0, bloom: 1, led: 1 });
	const t0 = TAB,
		cx = (X0.tab0 + X0.tab1) / 2 - X0.x0,
		hw = (X0.tab1 - X0.tab0) / 2;
	const mx = X0.m7 - X0.x0,
		rx = X0.rel - X0.x0,
		tx = X0.t7 - X0.x0;
	let tab = `<path class="tab" d="M${cx - hw} 1 V${-t0.h + t0.r} A${t0.r} ${t0.r} 0 0 1 ${cx - hw + t0.r} ${-t0.h} H${cx + hw - t0.r} A${t0.r} ${t0.r} 0 0 1 ${cx + hw} ${-t0.h + t0.r} V1"/>`;
	tab += `<path class="cav" d="M${mx - t0.mw / 2} ${-t0.h - 0.75} V${-t0.h + t0.md - 2} A2 2 0 0 0 ${mx - t0.mw / 2 + 2} ${-t0.h + t0.md} H${mx + t0.mw / 2 - 2} A2 2 0 0 0 ${mx + t0.mw / 2} ${-t0.h + t0.md - 2} V${-t0.h - 0.75} Z"/>`;
	tab += `<path class="cav" d="M${f(tx - 1.1)} ${-t0.h - 0.75}V${SOCKET_Y + 0.6}H${f(tx + 1.1)}V${-t0.h - 0.75}Z"/><rect class="ctc" x="${tx - 1.1}" y="${SOCKET_Y}" width="2.2" height=".8"/>`;
	const deg = (REL_TILT * 180) / Math.PI;
	return el('g', { transform: `translate(${X0.x0} 0)` }, [
		raw(housing('X0') + faceStatic),
		// the centre pin: a copper glow and the lit pin once the circuit is tested
		{
			tag: 'g',
			d: (rf) => (rf.pin > 0.01 ? { opacity: f(rf.pin) } : null),
			kids: [
				...[1, 0.72, 0.47, 0.24].map((k, i): N => ({ tag: 'circle', a: { cx: 36, cy: 22, r: f(9 * k), fill: C.cul, 'fill-opacity': [0.1, 0.18, 0.32, 0.6][i], stroke: 'none' } })),
				{ tag: 'circle', a: { ...paintAttrs(DVB, 'li'), cx: 36, cy: 22, r: 2.6 } },
			],
		},
		raw(paintSvg(tab, TABP)),
		el('g', { transform: `translate(${rx} ${-t0.h}) rotate(${f(deg)})` }, [
			raw(paintSvg(`<path class="cav" d="M-1.8 -0.75V9.5H1.8V-0.75Z"/>`, TABP)),
			{ tag: 'rect', a: pa('act', { x: -1.25, width: 2.5, height: 2.4, rx: 0.4 }), d: (rf) => ({ y: f(CAGE_D0 + CAGE_PUSH * clamp01(rf.cage)) }) },
			{
				tag: 'path',
				a: pa('spr'),
				d: (rf) => {
					const y = CAGE_D0 + CAGE_PUSH * clamp01(rf.cage) + 2.4;
					return { d: `M0 ${f(y)}l-.9 .8l1.8 .8l-1.8 .8l1.8 .8l-.9 .8` };
				},
			},
		]),
		{ tag: 'rect', a: pa('cuin', { x: f(mx - 0.9), y: -t0.h - 1, width: 1.8, height: t0.md + 1 }), d: (rf) => (rf.B.seated ? {} : null) },
		...jawNodes(mx, 1.8, (rf) => rf.jawB * (1 - clamp01(rf.cage))),
	]);
}

/* ------------------------------------------------------------------ W07 */
function dropNodes(which: 'A' | 'B'): N[] {
	const D = (r: RF) => (which === 'A' ? r.A : r.B);
	return [
		{ tag: 'path', a: { fill: 'none', stroke: C.w07, 'stroke-width': G.wire, 'stroke-linejoin': 'round', 'stroke-linecap': 'butt' }, d: (r) => ({ d: which === 'A' ? r.dA : r.dB }) },
		{ tag: 'path', a: { fill: 'none', stroke: C.cu, 'stroke-width': 1.8, 'stroke-linecap': 'butt' }, d: (r) => (D(r).seated ? null : { d: which === 'A' ? r.cuA : r.cuB }) },
		// the wire-marker sleeve: carta, steel rim, a wordless print (client note 17: no wire numbers), turning with the wire
		{
			tag: 'g',
			d: (r) => ({ transform: which === 'A' ? r.slA : r.slB }),
			kids: [
				{ tag: 'rect', a: { x: -2.9, y: -5.4, width: 5.8, height: 10.8, rx: 0.9, fill: C.paper, stroke: C.steelL, 'stroke-width': 0.5 } },
				{ tag: 'path', a: { d: 'M-0.7 -3.2V3.2M0.9 -2.4V1.6', fill: 'none', stroke: C.steel, 'stroke-width': 0.7, 'stroke-linecap': 'round' } },
			],
		},
	];
}

/* ------------------------------------------------------------------ racks, arms */
const RACKED: ToolSt = { open: 0, comp: 0, led: 0, spin: 0, cw: 3.2, roll: 0, hold: 0 };
function rackNodes(C2: Compiled, id: Id): N[] {
	const r = rack3(id);
	const RBT = RB.blue;
	let s = `<rect class="rb-rk" x="${f(r.foot[0])}" y="-4" width="${f(r.foot[1] - r.foot[0])}" height="4" rx="1.5"/>`;
	s += `<rect class="rb-rk" x="${f(r.post - 2)}" y="${G.barTop}" width="4" height="${-G.barTop - 4}"/>`;
	for (const [a, b] of r.bars) s += `<rect class="rb-rk" x="${f(a)}" y="${G.barTop}" width="${f(b - a)}" height="4" rx="1"/>`;
	for (const x of r.xs) s += `<rect class="rb-rkn" x="${f(x - 6.7 - 1.6)}" y="${G.barTop}" width="1.6" height="1.2"/><rect class="rb-rkn" x="${f(x + 6.7)}" y="${G.barTop}" width="1.6" height="1.2"/>`;
	const out: N[] = [raw(paintSvg(s, RBT))];
	const arm = C2.S.arm(id);
	G.slots[id].forEach((x, k) => {
		const tools = Array.from(new Set(arm.rack[k].map((e) => e.tool).filter((t): t is ToolName => !!t)));
		for (const tool of tools) out.push({ tag: 'g', a: { transform: rackToolTf(x, id) }, html: paintSvg(toolMarkup(tool, RACKED), RBT), d: (rf) => (rf.racks[id][k] === tool ? {} : null) });
	});
	return out;
}

/* ------------------------------------------------------------------ the scene */
function scene(C2: Compiled, o: { arms: boolean; current: boolean; mount: boolean }): N[] {
	const kids: N[] = [
		raw(background() + (o.mount ? stationMount() : '')),
		// the plate's light (00 CELL ON: it comes up from 0.86; a RESET dims it again)
		{ tag: 'rect', a: { x: PLATE.x0, y: PLATE.y0, width: PLATE.x1 - PLATE.x0, height: PLATE.y1 - PLATE.y0, rx: 4, fill: C.dim, stroke: 'none' }, d: (r) => (r.plate < 0.999 ? { opacity: f(1 - r.plate) } : null) },
		raw(ductBack() + prewired()),
	];
	kids.push(raw(ductFront()));
	kids.push(f7Nodes(), x0Nodes(), ...dropNodes('A'), ...dropNodes('B'));
	if (o.current) {
		// the test current along the wire (the two probes' contact), then it narrows back into the conductor (pure copper
		// thinning inside the insulation's blue: never a copper-over-blue cross-fade)
		kids.push({ tag: 'path', a: { fill: 'none', stroke: C.cul, 'stroke-width': G.wire + 0.2, 'stroke-linejoin': 'round' }, d: (r) => (r.cur.on && r.currentFade < 1 ? { d: r.cur.d, 'stroke-width': f((G.wire + 0.2) * (1 - r.currentFade)) } : null) });
		// its head: a carta core in a copper glow
		kids.push({
			tag: 'g',
			d: (r) => (r.head ? { transform: `translate(${f(r.head.x)} ${f(r.head.y)})` } : null),
			html: glowMarkup(0, 0, 8, '') + `<circle cx="0" cy="0" r="1.5" fill="${C.paper}" stroke="none"/>`,
		});
	}
	if (o.arms) {
		const arms: N[] = [...rackNodes(C2, 'L'), ...rackNodes(C2, 'R')];
		// the camera's scan cone (what it looks at)
		arms.push({
			tag: 'path',
			a: { fill: C.w07, 'fill-opacity': 0.09, stroke: C.w07, 'stroke-opacity': 0.5, 'stroke-width': 1, 'stroke-dasharray': '3 2', ...NSS },
			d: (r) => {
				if (!r.cone) return null;
				const { T, P } = r.cone;
				const dx = P.x - T.x,
					dy = P.y - T.y,
					dd = Math.hypot(dx, dy) || 1;
				const nx = -dy / dd,
					ny = dx / dd,
					w = dd * 0.22;
				return { d: `M${f(T.x)} ${f(T.y)}L${f(P.x + nx * w)} ${f(P.y + ny * w)}L${f(P.x - nx * w)} ${f(P.y - ny * w)}Z`, opacity: f(r.cone.op) };
			},
		});
		arms.push({ tag: 'g', arm: 'L' }, { tag: 'g', arm: 'R' });
		kids.push(...arms);
	}
	return kids;
}

/* ------------------------------------------------------------------ what the camera sees, drawn on the scene (wordless) */
/**
 * Client notes 16 and 17: no HUD text, no inset feed, no zoom. The camera's job is drawn where it happens, on the work itself,
 * while its cone points there: the TRACE runs a dashed line along the wire from end A to end B (a copper head), a bracket
 * snaps on each end (two ends, one wire), then the drawing's straight drop appears dashed beside the real end A, curled away
 * from it (the plan changes, the comb follows). Blue on the light plate; copper only for the head.
 */
function visionNodes(): N[] {
	const mk = (r: RF, kk: string) => r.vf!.marks.find((m) => m.k === kk)?.t ?? 1e9;
	const on = (r: RF) => !!r.vf && r.vfOp > 0.005;
	// the trace at u: computed once per frame for the line and its head (the frame budget)
	const tm: { w: Pt[] | null; u: number; a: ReturnType<typeof along> | null; d: string } = { w: null, u: NaN, a: null, d: '' };
	const trace = (r: RF, u: number) => {
		if (tm.w !== r.w07 || tm.u !== u) {
			tm.w = r.w07;
			tm.u = u;
			tm.a = along(r.w07, u);
			tm.d = '';
		}
		return tm;
	};
	const bracket = (c: Pt, w: number, h: number) => {
		const q = Math.min(3, w * 0.45);
		return `M${f(c.x - w)} ${f(c.y - h + q)}V${f(c.y - h)}H${f(c.x - w + q)}M${f(c.x + w - q)} ${f(c.y - h)}H${f(c.x + w)}V${f(c.y - h + q)}M${f(c.x + w)} ${f(c.y + h - q)}V${f(c.y + h)}H${f(c.x + w - q)}M${f(c.x - w + q)} ${f(c.y + h)}H${f(c.x - w)}V${f(c.y + h - q)}`;
	};
	const pop = (r: RF, t0: number) => 1 + 0.18 * Math.exp(-12 * Math.max(0, r.t - t0));
	return [
		{
			tag: 'g',
			d: (r) => (on(r) ? { opacity: f(r.vfOp) } : null),
			kids: [
				// the dashed line along the wire, its copper head
				{
					tag: 'path',
					a: { fill: 'none', stroke: C.paper, 'stroke-width': 1.5, 'stroke-dasharray': '2 2.4', 'stroke-linecap': 'round', ...NSS },
					d: (r) => {
						const u = clamp01((r.t - mk(r, 'trace')) / 1.3);
						if (u <= 0) return null;
						const T = trace(r, u);
						if (!T.d) T.d = poly(T.a!.pts);
						return { d: T.d };
					},
				},
				{
					tag: 'circle',
					a: { r: 1.6, fill: C.cul, stroke: C.paper, 'stroke-width': 0.6 },
					d: (r) => {
						const u = clamp01((r.t - mk(r, 'trace')) / 1.3);
						if (u <= 0 || u >= 1) return null;
						const h = trace(r, u).a!.head;
						return { cx: f(h.x), cy: f(h.y) };
					},
				},
				// the brackets: end A (first), end B (two ends, one wire)
				{
					tag: 'path',
					a: { fill: 'none', stroke: C.blue2, 'stroke-width': 1.5, ...NSS },
					d: (r) => {
						if (r.t < mk(r, 'endA')) return null;
						const sz = 6.5 * pop(r, mk(r, 'endA'));
						return { d: bracket(r.A.end, sz, sz) };
					},
				},
				{
					tag: 'path',
					a: { fill: 'none', stroke: C.blue2, 'stroke-width': 1.5, ...NSS },
					d: (r) => {
						if (r.t < mk(r, 'ends')) return null;
						const sz = 6.5 * pop(r, mk(r, 'ends'));
						return { d: bracket(r.B.end, sz, sz) };
					},
				},
				// the drawing's straight drop onto the mouth (dashed steel, its target ring), the real end curled away from it
				{
					tag: 'path',
					a: { fill: 'none', stroke: C.steel, 'stroke-width': 1.2, 'stroke-dasharray': '3 2', ...NSS },
					d: (r) => {
						if (r.t < mk(r, 'delta')) return null;
						const y1 = SEAT.A.y - 3.2;
						return { d: `M${f(SA.x)} ${f(SA.y + 4)}V${f(y1)}m-1.8 0a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0` };
					},
				},
				{
					tag: 'path',
					a: { fill: 'none', stroke: C.blue2, 'stroke-width': 1.2, ...NSS },
					d: (r) => {
						if (r.t < mk(r, 'delta')) return null;
						const g = { x: SA.x, y: SEAT.A.y - 3.2 },
							e = r.A.end;
						const k = clamp01((r.t - mk(r, 'delta')) / 0.25);
						return { d: `M${f(g.x)} ${f(g.y)}L${f(g.x + (e.x - g.x) * k)} ${f(g.y + (e.y - g.y) * k)}` };
					},
				},
			],
		},
	];
}

/* ------------------------------------------------------------------ the stage */
export interface StageOpt {
	mode: 'desk' | 'phone';
	uid: string;
	/** the station's mount (the live desktop stage: the station's buttons are HTML over it; the no-JS poster has none) */
	mount?: boolean;
}
/** the root: the scene (one fixed viewBox on every screen: no camera moves, client note 17), the effects, what the camera
 * sees */
export function stageTree(C2: Compiled, o: StageOpt): N[] {
	const fx: N[] = [
		// the tool-coupling click rings
		...[0, 1].map((i): N => ({ tag: 'circle', a: { fill: 'none', stroke: C.paper, 'stroke-width': 1.2, ...NSS }, d: (r) => (r.clicks[i] ? { cx: f(r.clicks[i].x), cy: f(r.clicks[i].y), r: f(r.clicks[i].r), 'stroke-opacity': f(r.clicks[i].op) } : null) })),
		...visionNodes(),
	];
	const main = scene(C2, { arms: true, current: true, mount: o.mode === 'desk' && o.mount !== false });
	return [...main, ...fx];
}

/* ------------------------------------------------------------------ the frame's shared values */
/** W07's whole route for the trace: the same array while the two drops are the same (one entry: the frame before) */
const NO_PTS: Pt[] = [];
const w07Memo: { A: Drop | null; B: Drop | null; p: Pt[] } = { A: null, B: null, p: NO_PTS };
function w07Of(A: Drop, B: Drop) {
	if (w07Memo.A !== A || w07Memo.B !== B) {
		w07Memo.A = A;
		w07Memo.B = B;
		w07Memo.p = w07Path(A, B);
	}
	return w07Memo.p;
}
const dropStr = new WeakMap<Drop, { d: string; cu: string; sl: string }>();
export function derive(C2: Compiled, s: FS): RF {
	const r = s as RF;
	const cu = (d: Drop) => {
		const c = { x: d.end.x + Math.cos(d.dir) * G.CU, y: d.end.y + Math.sin(d.dir) * G.CU };
		return `M${f(d.end.x)} ${f(d.end.y)}L${f(c.x)} ${f(c.y)}`;
	};
	const sl = (d: Drop) => {
		const m = sleeveAt(d.pts, 22);
		return `translate(${f(m.x)} ${f(m.y)}) rotate(${f(m.deg - 90)})`;
	};
	// (a drop at rest is the same object frame after frame: its strings are made once)
	const strs = (d: Drop) => {
		let v = dropStr.get(d);
		if (!v) dropStr.set(d, (v = { d: poly(d.pts), cu: cu(d), sl: sl(d) }));
		return v;
	};
	const a = strs(s.A),
		b = strs(s.B);
	r.dA = a.d;
	r.dB = b.d;
	r.cuA = a.cu;
	r.cuB = b.cu;
	r.slA = a.sl;
	r.slB = b.sl;
	r.w07 = s.vf ? w07Of(s.A, s.B) : NO_PTS;
	r.head = null;
	if (s.current > 0) {
		const c = currentAt(C2, s.current);
		r.cur = { d: poly(c.pts), head: c.head, on: true };
		if (s.current < 1) r.head = c.head;
	} else r.cur = { d: '', head: { x: 0, y: 0 }, on: false };
	return r;
}

/* ------------------------------------------------------------------ string mode (the poster) */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export function toString(nodes: N[], r: RF, arms: (id: Id) => string): string {
	let out = '';
	for (const n of nodes) {
		if (n.arm) {
			out += `<g>${arms(n.arm)}</g>`;
			continue;
		}
		let a: A = { ...(n.a ?? {}) };
		if (n.d) {
			const d = n.d(r);
			if (!d) continue;
			a = { ...a, ...d };
		}
		const attrs = Object.entries(a)
			.map(([k, v]) => ` ${k}="${esc(String(v))}"`)
			.join('');
		const inner = (n.html ?? '') + (n.text ? esc(n.text(r)) : '') + (n.kids ? toString(n.kids, r, arms) : '');
		out += `<${n.tag}${attrs}>${inner}</${n.tag}>`;
	}
	return out;
}

/* ------------------------------------------------------------------ live mode */
const SVGNS = 'http://www.w3.org/2000/svg';
interface Item {
	el: Element;
	n: N;
	end: number;
	last: Record<string, string>;
	/** the values as the node's function gave them (engine pass: an unchanged number is not turned into a string again) */
	raw: Record<string, string | number>;
	on: boolean;
	txt: string | null;
	arm?: ArmNodes;
}
export class Live {
	items: Item[] = [];
	constructor(
		parent: Element,
		nodes: N[],
		private armFrame: (id: Id, r: RF) => { q: ArrayLike<number>; tool: ToolName; st: ToolSt; lock: number },
		private armInit: (id: Id) => string,
		private robs: Record<Id, import('../robot/kin').Robot>,
	) {
		this.build(parent, nodes);
	}
	private build(parent: Element, nodes: N[]) {
		for (const n of nodes) {
			const e = document.createElementNS(SVGNS, n.tag);
			for (const k in n.a ?? {}) e.setAttribute(k, String(n.a![k]));
			parent.appendChild(e);
			const it: Item = { el: e, n, end: 0, last: {}, raw: {}, on: true, txt: null };
			this.items.push(it);
			if (n.arm) {
				e.innerHTML = this.armInit(n.arm);
				it.arm = new ArmNodes(e, this.robs[n.arm]);
			} else if (n.html) e.innerHTML = n.html;
			if (n.kids) this.build(e, n.kids);
			it.end = this.items.length;
		}
	}
	frame(r: RF) {
		const I = this.items;
		let i = 0;
		while (i < I.length) {
			const it = I[i];
			const n = it.n;
			if (it.arm) {
				it.arm.frame(this.armFrame(n.arm!, r));
				i++;
				continue;
			}
			if (n.d) {
				const a = n.d(r);
				if (!a) {
					if (it.on) {
						it.on = false;
						it.el.setAttribute('display', 'none');
					}
					i = it.end;
					continue;
				}
				if (!it.on) {
					it.on = true;
					it.el.removeAttribute('display');
				}
				const raw = it.raw;
				for (const k in a) {
					const x = a[k];
					if (raw[k] === x) continue;
					raw[k] = x;
					const v = String(x);
					if (it.last[k] !== v) {
						it.last[k] = v;
						it.el.setAttribute(k, v);
					}
				}
			}
			if (n.text) {
				const s = n.text(r);
				if (s !== it.txt) {
					it.txt = s;
					it.el.textContent = s;
				}
			}
			i++;
		}
	}
}

/** the arm as markup at a frame (the poster) and its frame for the live nodes */
export function armsOf(C2: Compiled) {
	const S = C2.S;
	const tools = { L: Array.from(new Set<ToolName>(['camera', 'gripper', 'probe'])), R: Array.from(new Set<ToolName>(['driver', 'opener', 'probe'])) };
	const robs = { L: S.L.tr.r, R: S.R.tr.r };
	return {
		robs,
		frame: (id: Id, r: RF) => {
			const a = id === 'L' ? r.L : r.R;
			return { q: a.q, tool: a.tool, st: a.st, lock: a.lock };
		},
		init: (id: Id) => paintSvg(armMarkup(robs[id], S.arm(id).tr.qAt(0), S.arm(id).tr.toolAt(0), { open: 1, comp: 0, led: 0, spin: 0, cw: G.wire, roll: 0, hold: 0 }, 1, tools[id]), RB.blue),
		markup: (id: Id, r: RF) => {
			const a = id === 'L' ? r.L : r.R;
			return paintSvg(armMarkup(robs[id], a.q, a.tool, a.st, a.lock, [a.tool]), RB.blue);
		},
	};
}
export { SCREW_TIGHT };
