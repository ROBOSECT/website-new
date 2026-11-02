/**
 * Explicit paint for every drawn shape (client note 9: nothing may ever fall back to the default black fill).
 *
 * The robots and devices are generated as SVG markup with semantic classes (rb-*, dv shapes). Their paint used to come
 * from CSS rules resolving custom properties (`.rb .rb-lk { fill: var(--rb-link) }`): wherever a rule or a var() did not
 * resolve (an engine quirk, a stylesheet scoped away, a <use> shadow tree, a wrapper page), the shape fell back to the
 * initial fill, black. Now every shape carries literal presentation attributes (hex fill, stroke, stroke-width,
 * vector-effect), generated here from one table of brand tokens; CSS sets no paint on these shapes at all (a CSS fill would
 * override the attribute, and a failing var() there would turn it black again).
 *
 * `paintSvg(markup, table)` adds the attributes a shape's class calls for, keeping any attribute the markup already sets.
 * Pure string work: used at build time (static cells, 404) and at runtime on the markup the renderer writes.
 */

/** the brand palette (global.css tokens, as literals) */
export const PAL = {
	ink: '#0D1B2E',
	ink2: '#172A44',
	blue: '#173C78',
	blue2: '#24508F',
	blueRing: '#2E5A9E',
	blueEdge: '#46699F',
	cu: '#C9632C',
	cuDeep: '#A04A1B',
	cuLight: '#EC8A52',
	paper: '#F4F1EC',
	paperFace: '#E9E5DE',
	white: '#FFFFFF',
	mist: '#E2E6EB',
	steel: '#5A6676',
	steelLight: '#9AA6B5',
	slate: '#46546A',
	rim: '#BAC4D0',
	bench: '#B9C3CF',
	jaw: '#C9D1DC',
	near: '#7F8A99',
	capSide: '#2B5797',
	night: '#02070E',
} as const;

type Attrs = [string, string][];
type Table = Record<string, Attrs>;

const NSS: Attrs = [['vector-effect', 'non-scaling-stroke']];
/** fill only */
const F = (fill: string, extra: Attrs = []): Attrs => [['fill', fill], ['stroke', 'none'], ...extra];
/** a stroked shape: fill (or none), stroke, width */
const S = (fill: string, stroke: string, sw: number | string, extra: Attrs = []): Attrs => [['fill', fill], ['stroke', stroke], ['stroke-width', String(sw)], ...extra];

/* ------------------------------------------------------------------ the robots (draw.ts), per ground */
export type RbTheme = 'plate' | 'blue';
interface RbTok {
	link: string;
	rim: string;
	ring: string;
	cap: string;
	capin: string;
	tool: string;
	line: string;
	dark: string;
	ped: string;
	on: string;
	off: string;
	foot: string;
	caps: string;
	near: string;
	wire: string;
}
const RB_TOK: Record<RbTheme, RbTok> = {
	plate: {
		link: PAL.paper,
		rim: PAL.steelLight,
		ring: PAL.steel,
		cap: PAL.blue,
		capin: PAL.blueRing,
		tool: PAL.white,
		line: PAL.steel,
		dark: PAL.ink,
		ped: PAL.paper,
		on: PAL.cu,
		off: PAL.steelLight,
		foot: PAL.bench,
		caps: PAL.capSide,
		near: PAL.near,
		wire: PAL.blue,
	},
	blue: {
		link: PAL.paper,
		rim: PAL.steelLight,
		ring: PAL.ink,
		cap: PAL.ink,
		capin: PAL.slate,
		tool: PAL.mist,
		line: PAL.jaw,
		dark: PAL.ink,
		ped: PAL.mist,
		on: PAL.cuLight,
		off: PAL.steelLight,
		foot: PAL.blueEdge,
		caps: PAL.slate,
		near: PAL.near,
		wire: PAL.paper,
	},
};
/** the outline width of links, pedestals and the -X4 body (CSS widens it to 1.5 px on desktop: a width, never a paint) */
const RB_SW = 1.25;
function rbTable(T: RbTok): Table {
	return {
		'rb-lk': S(T.link, T.rim, RB_SW, NSS),
		'rb-pd': S(T.ped, T.rim, RB_SW, NSS),
		'rb-bd': S('none', T.ring, 1.6),
		'rb-cap': F(T.cap),
		'rb-caps': F(T.caps),
		'rb-capi': S('none', T.capin, 1.4),
		'rb-fg': F(T.line),
		'rb-fgn': F(T.near),
		'rb-groove': S('none', T.dark, 1, [['stroke-linejoin', 'round'], ...NSS]),
		'rb-wire': F(T.wire),
		'rb-x4': S(T.link, T.rim, RB_SW, NSS),
		'rb-x4l': S('none', T.ring, 1.2),
		'rb-x4s': F(T.dark),
		'rb-ft': F(T.foot),
		'rb-rk': F(T.foot),
		'rb-rkn': F(T.off),
		'rb-fl': F(T.line),
		'rb-nt': F(T.link),
		'rb-flat': F(T.link),
		'rb-cp': F(T.ring),
		'rb-pad': F(T.dark),
		'rb-lens': F(T.dark),
		'rb-tl': S(T.tool, T.line, 1.25, NSS),
		'rb-tln': S('none', T.line, 1.25, NSS),
		'rb-led': S('none', T.off, 1.25, NSS),
		'rb-ledon': F(T.on),
		'rb-dot': F(T.off),
		'rb-doton': F(T.cap),
		'rb-click': S('none', T.line, 1.25, NSS),
		'rb-cone': S(PAL.blue, PAL.blue, 1, [['fill-opacity', '.1'], ['stroke-opacity', '.55'], ...NSS]),
		'rb-sweep': S('none', T.cap, 1.25, NSS),
		// the glow's discs (glowMarkup): copper, their own opacities
		glow: F(PAL.cuLight),
	};
}
export const RB: Record<RbTheme, Table> = { plate: rbTable(RB_TOK.plate), blue: rbTable(RB_TOK.blue) };

/* ------------------------------------------------------------------ the devices (devices.ts), per module ground */
export type DvTheme = 'light' | 'dark' | 'blue';
interface DvTok {
	fill: string;
	rim: string;
	face: string;
	line: string;
	soft: string;
	softOp: string;
	cavity: string;
	screen: string;
	screenLine: string;
	ledOff: string;
	ledOn: string;
	cuin: string;
}
const DV_TOK: Record<DvTheme, DvTok> = {
	light: {
		fill: PAL.paper,
		rim: PAL.rim,
		face: PAL.paperFace,
		line: PAL.steel,
		soft: PAL.steelLight,
		softOp: '1',
		cavity: PAL.ink,
		screen: PAL.ink,
		screenLine: PAL.steel,
		ledOff: PAL.steelLight,
		ledOn: PAL.cu,
		cuin: PAL.cu,
	},
	/* the ink devices (note 9.2): a raised ink-2 body with a steel rim (the moulding catches the light on its top edge:
	   devices.ts draws that highlight), carta-steel details at full contrast, LED rings that read as lamps when off */
	dark: {
		fill: PAL.ink2,
		rim: PAL.steel,
		face: PAL.ink,
		line: PAL.jaw,
		soft: PAL.steelLight,
		softOp: '.5',
		cavity: PAL.night,
		screen: PAL.night,
		screenLine: PAL.slate,
		ledOff: PAL.steelLight,
		ledOn: PAL.cuLight,
		cuin: PAL.cuLight,
	},
	blue: {
		fill: PAL.ink2,
		rim: PAL.blueEdge,
		face: PAL.ink,
		line: PAL.jaw,
		soft: PAL.steelLight,
		softOp: '.5',
		cavity: PAL.night,
		screen: PAL.night,
		screenLine: PAL.slate,
		ledOff: PAL.steelLight,
		ledOn: PAL.cuLight,
		cuin: PAL.cuLight,
	},
};
function dvTable(T: DvTok): Table {
	return {
		housing: S(T.fill, T.rim, 1.5, NSS),
		tab: S(T.fill, T.rim, 1.5, NSS),
		cav: F(T.cavity, NSS),
		sl: S('none', T.line, 1.5, NSS),
		'sl soft': S('none', T.soft, 1.5, [['stroke-opacity', T.softOp], ...NSS]),
		'sl inv': S('none', T.fill, 1.5, NSS),
		hl: S('none', PAL.steelLight, 1, [['stroke-opacity', '.6'], ['stroke-linecap', 'round'], ...NSS]),
		shade: S('none', PAL.night, 1, [['stroke-opacity', '.7'], ['stroke-linecap', 'round'], ...NSS]),
		win: S(T.face, T.line, 1.5, NSS),
		dot: F(T.line, NSS),
		blade: S('none', T.line, 2, [['stroke-linecap', 'round'], ...NSS]),
		lever: F(T.line, NSS),
		bar: S('none', T.soft, 1.5, NSS),
		barl: S(T.ledOn, T.ledOn, 1.5, NSS),
		screen: F(T.screen, NSS),
		wave: S('none', T.screenLine, 1.5, [['stroke-linejoin', 'round'], ...NSS]),
		wavecu: S('none', PAL.cuLight, 1.5, [['stroke-linejoin', 'round'], ...NSS]),
		lo: S('none', T.ledOff, 1.25, NSS),
		'lo dash': S('none', T.ledOff, 1.25, [['stroke-dasharray', '2 2'], ...NSS]),
		/* an LED that is off: its dark lens inside the ring (dark grounds: it reads as a lamp, not as a hole) */
		lens: F(T.face, NSS),
		li: F(T.ledOn, NSS),
		cu: S('none', T.ledOn, 3, NSS),
		cuf: F(T.ledOn, NSS),
		cuin: F(T.cuin, NSS),
		scrh: S(T.face, T.line, 1.5, NSS),
		slot: F(T.cavity, NSS),
		jaw: F(PAL.jaw, NSS),
		spin: S('none', T.line, 1.25, [['stroke-linecap', 'round'], ...NSS]),
		flash: S('none', PAL.cuLight, 1.5, NSS),
		shank: F(PAL.steelLight, NSS),
		shine: S('none', PAL.white, 1, [['stroke-linecap', 'round'], ...NSS]),
		act: S(PAL.jaw, T.line, 0.75, NSS),
		spr: S('none', PAL.steelLight, 1, NSS),
		ctc: F(PAL.steelLight, NSS),
		tgb: F(T.line, NSS),
		tgl: F(T.line, NSS),
		tgk: S(PAL.jaw, T.line, 1.25, NSS),
		glow: F(PAL.cuLight),
	};
}
export const DV: Record<DvTheme, Table> = { light: dvTable(DV_TOK.light), dark: dvTable(DV_TOK.dark), blue: dvTable(DV_TOK.blue) };
/** the head tab and its terminals: a light insulating terminal strip on every device (note 9.2: on the ink devices the mouths,
 * screws and cage actuators read as parts, not as dark holes; the robots work on it) */
export const TAB_THEME: DvTheme = 'light';

/* ------------------------------------------------------------------ the painter */
const SHAPE = /<(rect|circle|ellipse|path|line|polyline|polygon|text)\b([^>]*?)(\/?)>/g;
const CLS = /\bclass="([^"]*)"/;
/** per table: class string → [' name=', ' name="value"'] pairs (a class list resolves to its full string, else its last
 * class that has an entry: 'sl soft' → 'sl soft', 'rb-fg rb-fgn' → 'rb-fgn') */
const cache = new WeakMap<Table, Map<string, [string, string][]>>();
function resolve(table: Table, cls: string): [string, string][] {
	let m = cache.get(table);
	if (!m) cache.set(table, (m = new Map()));
	const hit = m.get(cls);
	if (hit) return hit;
	let a: Attrs | undefined = table[cls];
	if (!a) {
		const parts = cls.split(/\s+/).filter(Boolean);
		for (let i = parts.length - 1; i >= 0 && !a; i--) a = table[parts[i]];
	}
	const r: [string, string][] = (a ?? []).map(([k, v]) => [` ${k}=`, ` ${k}="${v}"`]);
	m.set(cls, r);
	return r;
}
/** recent results per table: the renderer asks again for markup it painted a frame ago (a terminal that has not moved, the
 * same effect frame), so a repeat costs a lookup instead of a regex pass */
const memo = new WeakMap<Table, Map<string, string>>();
/** add the paint attributes each shape's class calls for (attributes the markup already sets win) */
export function paintSvg(markup: string, table: Table): string {
	let m = memo.get(table);
	if (!m) memo.set(table, (m = new Map()));
	const hit = m.get(markup);
	if (hit !== undefined) return hit;
	const out = paintRaw(markup, table);
	if (m.size > 48) m.delete(m.keys().next().value as string);
	m.set(markup, out);
	return out;
}
function paintRaw(markup: string, table: Table): string {
	return markup.replace(SHAPE, (all, tag: string, attrs: string, close: string) => {
		const c = CLS.exec(attrs);
		if (!c) return all;
		const add = resolve(table, c[1]);
		if (!add.length) return all;
		let extra = '';
		for (const [probe, full] of add) if (!attrs.includes(probe)) extra += full;
		return `<${tag}${attrs}${extra}${close}>`;
	});
}
/** the same attributes as an object (for nodes built with createElementNS) */
export function paintAttrs(table: Table, cls: string): Record<string, string> {
	const out: Record<string, string> = { class: cls };
	const a = table[cls] ?? cls.split(/\s+/).reverse().map((k) => table[k]).find(Boolean) ?? [];
	for (const [k, v] of a) out[k] = v;
	return out;
}

/**
 * A soft copper glow (LED bloom, probe touch, socket flash) without a paint server: four concentric discs whose
 * stacked opacities follow the old radial gradient (0.95 at the centre, 0.42 at 45 %, 0 at the rim). No url(#id), so
 * nothing to resolve, nothing to duplicate across instances, nothing a hidden <svg> can switch off.
 */
export const GLOW = [
	[1, 0.12],
	[0.72, 0.2],
	[0.47, 0.36],
	[0.24, 0.66],
] as const;
export function glowMarkup(cx: string | number, cy: string | number, r: number, attrs = '') {
	let s = `<g${attrs}>`;
	for (const [k, a] of GLOW) s += `<circle class="glow" cx="${cx}" cy="${cy}" r="${+(r * k).toFixed(2)}" fill="${PAL.cuLight}" fill-opacity="${a}" stroke="none"/>`;
	return s + '</g>';
}
