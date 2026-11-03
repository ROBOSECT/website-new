/**
 * One compartment on the page: DOM reads (rebuild), the compiled program, its scroll track (the slowed
 * travel), and the renderer. Persistent nodes only: per frame it writes transforms,
 * opacities, clip-path insets and the `d` of the lead's paths; the device face is re-drawn only when its
 * state changes (screw angle, LEDs, relay blade…), effects only while one is active.
 */
import { H, PROF, Route, carrot, clamp01, crPath, f, fs, kick, lap, lap0, prog, smooth, SPRINGS, lcg, type Laid } from './core';
import { DEV, facePainter, faceRaw, housing, jawsRaw, mouths, portPartsLive, restState, tabLedLive, tabLedPainter, tabPainter, tabPath, type DevState } from './devices';
import { Patch } from './svgpatch';
import { Relax } from './relax';
import { GLOW, PAL } from './paint';
import { compile, MORPH_DUR, tokens, type CellCfg, type Compiled, type Geo } from './program';
import { Track, type Glide } from './scroll';
import type { Sample } from './sim';
import { propsMarkup, type ArmView } from './props';

const NS = 'http://www.w3.org/2000/svg';
/** StageView.qd's slots, 9 per part */
const Q = { door: 0, jaws: 9, face: 18, ports: 27, led: 36, edge: 45, recoil: 54 };
/** the blueprint's contrast: a factor on its drawn opacity */
const BP_CONTRAST = 0.6;
const COL = { ins: '#173C78', insDark: '#F4F1EC', cu: '#C9632C', cul: '#EC8A52', det: '#173C78', detDark: '#9AA6B5', tool: '#5A6676', toolDark: '#9AA6B5' };

/** document y of an element's layout box: the offsetTop chain (transforms, the glide's included, do not count) */
export function docTop(e: HTMLElement) {
	let y = 0;
	for (let n: HTMLElement | null = e; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
	return y;
}

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) => {
	const e = document.createElementNS(NS, tag) as SVGElementTagNameMap[K];
	for (const k in attrs) e.setAttribute(k, String(attrs[k]));
	if (parent) parent.appendChild(e);
	return e;
};

/** persistent SVG nodes keyed by name, written by attribute only when a value changes (the camera's in-place marks, the field of
 * view): a frame `put`s what it shows between begin() and end(); what it did not put is hidden, never rebuilt (no markup
 * per frame) */
class Pool {
	g: SVGGElement;
	private m = new Map<string, { el: SVGElement; a: Record<string, string>; on: boolean; seen: number; txt: string | null }>();
	/** the nodes shown (end() walks these, not every node the pool ever made) */
	private shown = new Set<{ el: SVGElement; on: boolean; seen: number }>();
	private frame = 0;
	constructor(g: SVGGElement) {
		this.g = g;
	}
	get count() {
		return this.shown.size;
	}
	begin() {
		this.frame++;
	}
	/** parent: the key of a group put earlier in this frame (the node is created inside it) */
	put(key: string, tag: keyof SVGElementTagNameMap, a: Record<string, string | number>, txt?: string, parent?: string) {
		let n = this.m.get(key);
		if (!n) {
			n = { el: el(tag, { 'data-k': key }, (parent && this.m.get(parent)?.el) || this.g) as SVGElement, a: {}, on: true, seen: 0, txt: null };
			this.m.set(key, n);
			this.shown.add(n);
		} else if (!n.on) {
			n.on = true;
			n.el.removeAttribute('display');
			this.shown.add(n);
		}
		n.seen = this.frame;
		for (const k in a) {
			const v = String(a[k]);
			if (n.a[k] !== v) {
				n.a[k] = v;
				n.el.setAttribute(k, v);
			}
		}
		if (txt != null && n.txt !== txt) {
			n.txt = txt;
			n.el.textContent = txt;
		}
	}
	end() {
		for (const n of this.shown)
			if (n.seen !== this.frame) {
				n.on = false;
				n.el.setAttribute('display', 'none');
				this.shown.delete(n);
			}
	}
}

interface Block {
	el: HTMLElement;
	y: number;
	/** its height (module px): it comes in only once the opening shell holds all of it that is on screen */
	h: number;
	nested: boolean;
	start: number;
	/** what is drawn: opacity and lift (NaN: not drawn yet) */
	o: number;
	ty: number;
}

export interface FrameCtx {
	/** stage-local y where the entry leg starts: the stage's top, less a margin the track's clip hides */
	top: number;
	/** stage-local y of the travelling tip (the pen), or −1e9 */
	pen: number;
	/** stage-local y of the viewport bottom in this frame (native scroll) */
	visBot: number;
	/** stage-local y of the top of the visible area (under the nav) in this frame; the cell (device, robots, effects) is
	 * not drawn while it is wholly above it or below the bottom (the module and the lead still are) */
	visTop?: number;
	/** the morph's display time (program time): t, or a little ahead of it while a morph the visitor stopped in finishes on
	 * its own (index.ts) */
	mt?: number;
}

export class StageView {
	n: number;
	cfg: CellCfg;
	sec: HTMLElement;
	pin: HTMLElement | null;
	stage: HTMLElement;
	head: HTMLElement | null;
	mod: HTMLElement | null;
	rim: HTMLElement | null;
	shell: HTMLElement | null;
	body: HTMLElement | null;
	bp: HTMLElement | null;
	devSvg: SVGSVGElement;
	devStatic: string;
	wires: SVGSVGElement;
	over: SVGSVGElement;
	robots: SVGSVGElement;
	card: HTMLElement | null;
	cell: HTMLElement | null;
	free: boolean;
	dark: boolean;

	B!: Compiled;
	G!: Geo;
	/** the bench props' group (props.ts) */
	private propsP: Patch | null = null;
	tr!: Track;
	stageH = 0;
	Mh = 0;
	modX = 0;
	modW = 0;
	floor = 0;
	visBot = 0;
	blocks: Block[] = [];
	/** current program time, sticky offset, phase (read by the controller and the QA API) */
	t = 0;
	off = 0;
	S: Sample | null = null;
	/** '' forces the next frame to draw; kq: what the last frame drew from (index.ts) */
	key = '';
	kq = [NaN, NaN, NaN, NaN, NaN];
	vis = false;
	/** the cell has been drawn whole since its nodes were built (index.ts primes it in idle time otherwise) */
	drawn = false;
	phase = 'before';
	/** `c<n>:<phase>` (the root's data-panel-phase while this stage is the one on screen) */
	phaseKey = '';

	private n_: {
		housing?: SVGGElement;
		doors?: SVGGElement;
		doorL?: SVGGElement;
		doorR?: SVGGElement;
		face?: SVGGElement;
		/** the right door's own copy of the face (no <use>: a <use> shadow tree is where engines differ on styling) */
		faceR?: SVGGElement;
		led?: SVGGElement;
		ports?: SVGGElement;
		ins?: SVGPathElement[];
		cu?: SVGPathElement[];
		pg?: SVGPathElement[];
		pc?: SVGPathElement[];
		oIns?: SVGPathElement[];
		oCu?: SVGPathElement[];
		jaws?: SVGGElement;
		edge?: SVGLineElement[];
		fx?: SVGGElement;
	} = {};
	/** the markup-drawn parts as persistent nodes (svgpatch.ts): face (and the right door's copy), ports, LED, jaws, effects */
	private P: { face: Patch; faceR: Patch; ports: Patch; led: Patch; jaws: Patch } | null = null;
	private last: Record<string, string> = {};
	/** what each part was last drawn from, quantised below what shows (numbers compared, no key string built
	 * per frame); NaN: not drawn yet */
	private qv = new Float64Array(72).fill(NaN);
	/** whether the values from slot on differ from what was drawn (and remember them); a part owns 9 slots (Q.*) */
	private qd(slot: number, a: number, b = 0, c = 0, d = 0, e = 0, g = 0, h = 0, i = 0, j = 0) {
		const q = this.qv;
		if (q[slot] === a && q[slot + 1] === b && q[slot + 2] === c && q[slot + 3] === d && q[slot + 4] === e && q[slot + 5] === g && q[slot + 6] === h && q[slot + 7] === i && q[slot + 8] === j) return false;
		q[slot] = a;
		q[slot + 1] = b;
		q[slot + 2] = c;
		q[slot + 3] = d;
		q[slot + 4] = e;
		q[slot + 5] = g;
		q[slot + 6] = h;
		q[slot + 7] = i;
		q[slot + 8] = j;
		return true;
	}
	private lastT = -1;
	/** the cell was not drawn at lastT (off screen) */
	private cellStale = false;
	private blockWin: [number, number] = [Infinity, -Infinity];
	/** the clip as last drawn (Ri, Bi, Li, radius, open) */
	private clipQ = [NaN, NaN, NaN, NaN, NaN];
	private lastTm = -1;
	/** QA: time spent drawing the robots and the lead (ms, accumulated; timed only with ?panel-prof=1) */
	rigMs = 0;
	cableMs = 0;
	/** the device's mouths (device units), [in, out] */
	private mouthsXd: [number, number] | null = null;
	private outR: { r: Route; s0: number; sFloor: number; sDown: number } | null = null;
	private leadHead: { top: number; d: string } | null = null;
	private laidFlat: Float64Array | null = null;
	private laidRef: Laid | null = null;
	private laidD = '';
	private rigView: { frame(t: number, view: unknown): void; remove?(): void } | null = null;
	/** vignettes: the camera's job drawn where it happens, on the work itself (no loupe, no viewfinder) */
	private visPool: Pool | null = null;
	/** the effects (seat ring, probe touch, brackets, the taught point, the plan, the miss, the continuity test): persistent
	 * nodes written by attribute (no markup per frame); created at build in the program's order, so they stack
	 * as the markup did */
	private fxPool: Pool | null = null;
	private mkr: SVGGElement[] = [];

	constructor(sec: HTMLElement, cfg: CellCfg) {
		this.n = cfg.n;
		this.cfg = cfg;
		this.sec = sec;
		this.pin = sec.querySelector<HTMLElement>('.pin');
		this.stage = sec.querySelector<HTMLElement>('.stage')!;
		this.head = sec.querySelector<HTMLElement>('.stage-head');
		this.mod = sec.querySelector<HTMLElement>('[data-mod]');
		this.rim = sec.querySelector<HTMLElement>('.mod__rim');
		this.shell = sec.querySelector<HTMLElement>('.mod__shell');
		this.body = sec.querySelector<HTMLElement>('[data-body]');
		this.bp = sec.querySelector<HTMLElement>('[data-bp]');
		this.devSvg = sec.querySelector<SVGSVGElement>('[data-cell-dev]')!;
		this.devStatic = this.devSvg.innerHTML;
		this.wires = sec.querySelector<SVGSVGElement>('[data-layer="wires"]')!;
		this.over = sec.querySelector<SVGSVGElement>('[data-layer="over"]')!;
		this.robots = sec.querySelector<SVGSVGElement>('[data-robot-layer]')!;
		this.card = sec.querySelector<HTMLElement>('[data-card]');
		this.cell = sec.querySelector<HTMLElement>('[data-x0cell]');
		this.free = !this.pin;
		this.dark = cfg.ground === 'blue';
	}

	/** the entry leg is drawn from this far above the stage's top (hidden by the track's clip), so the seam with
	 * the previous stage's exit leg never shows a gap */
	static LEAD_EXT = 120;
	/** px the shell's bottom edge keeps below the viewport bottom while the morph opens */
	private edgePad = 64;
	private vh = 0;
	/** program time when the out-lead's carrot reaches the bench level in the exit duct */
	private outDone = Infinity;

	/** the compiled program's inputs (tokens) at the last rebuild: the same inputs give the same program, so its
	 * snapshot cache survives a re-layout that does not change the cell (a font swap below, a status change, a resize
	 * of the height only) */
	private tokKey = '';
	/** the track's run (the extra scroll), whose height the controller may override for this viewport */
	run: HTMLElement | null = null;

	/* ------------------------------------------------------------------ rebuild: DOM reads only (writes: applyRun, ensureBuilt) */
	/** the controller clears every run override first (one write pass), so the CSS runs can be read in one layout */
	clearRun() {
		this.run ??= this.pin?.querySelector<HTMLElement>('.pin__run') ?? null;
		if (this.run && this.run.style.height) this.run.style.height = '';
	}
	/** the run this viewport needs where the CSS run does not fit (after every stage has measured: one write pass) */
	applyRun() {
		const h = this.run && this.tr.runOverride != null ? `${this.tr.runOverride.toFixed(2)}px` : '';
		if (this.run && this.run.style.height !== h) this.run.style.height = h;
	}
	/** what the persistent nodes depend on: the program (tokens), the stage height, the Contact card */
	private buildKey = '';
	private builtKey = '';
	private cardRect: { x: number; y: number; w: number; h: number } | null = null;
	get built() {
		return this.builtKey === this.buildKey && !!this.n_.ins;
	}
	/** the persistent nodes (lead, device, effects, robots): built when the stage first comes near the screen or in idle
	 * time, and again only when what they depend on changed */
	ensureBuilt() {
		if (this.built) return false;
		this.build();
		// the blueprint's drawing too (its first write is a large markup: built with the nodes, in idle time when it can)
		this.writeBlueprint();
		this.builtKey = this.buildKey;
		this.drawn = false;
		this.key = '';
		this.last = {};
		this.qv.fill(NaN);
		this.clipQ.fill(NaN);
		this.lastT = -1;
		this.outR = null;
		this.laidRef = null;
		this.leadHead = null;
		this.inMemo.t = this.outMemo.t = NaN;
		this.relaxDrop();
		return true;
	}

	rebuild(ctx: { penY: number; vh: number; nav: number; lane: number; linear: boolean }) {
		const st = this.stage;
		const W = st.clientWidth;
		const T = tokens(W);
		T.lane = ctx.lane; // measured from the side duct (CSS uses 100vw, the stage excludes the scrollbar)
		// the stage scale is CSS's (--s): one source of truth, and a compartment may override it (Contact)
		// (a one-arm compartment's --s is the page's × its step's multiplier, a calc() CSS resolves: read its parts)
		const cs = getComputedStyle(this.sec);
		const sRaw = cs.getPropertyValue('--s');
		const kSolo = parseFloat(cs.getPropertyValue('--k-solo'));
		const sCss = /calc/.test(sRaw) ? parseFloat(cs.getPropertyValue('--s-g')) * (Number.isFinite(kSolo) ? kSolo : 1) : parseFloat(sRaw);
		if (sCss > 0.3 && sCss < 4) {
			T.sc = sCss;
			T.band = 112 * sCss;
			// short viewports run the cell at the phone scale: the lead at the phone's width too (the robots' jaws, the
			// mouths and the tools beside them are drawn for it)
			if (T.bp !== 'phone' && sCss < 0.95) Object.assign(T, { cable: 5, cu: 6.75, cuw: 2.15 });
		}
		const sr = st.getBoundingClientRect();
		let y0: number;
		if (this.cell) {
			const cr = this.cell.getBoundingClientRect();
			y0 = cr.top - sr.top;
			T.cx = cr.left - sr.left + 160 * T.sc;
			T.band = 112 * T.sc;
		} else {
			const band = this.sec.querySelector<HTMLElement>('.band')!;
			T.band = band.offsetHeight;
			// the cell's centre where CSS put it (desktop cells are offset from the centre)
			const dr = this.devSvg.getBoundingClientRect();
			if (dr.width > 0) {
				const cx = dr.left - sr.left + dr.width / 2;
				if (Math.abs(cx - W / 2) > 0.5) T.cx = Math.round(cx * 100) / 100;
			}
			// a one-arm cell centred on the page (--cell-du units × the scale): from CSS's own numbers, whatever
			// transform the device carries mid-morph
			const du = parseFloat(cs.getPropertyValue('--cell-du'));
			if (Number.isFinite(du) && du !== 0) T.cx = Math.round((W / 2 + du * T.sc) * 100) / 100;
			this.floor = this.head!.offsetTop + this.head!.offsetHeight;
			y0 = this.floor - T.band - T.duct;
		}
		if (this.card) {
			const r = this.card.getBoundingClientRect();
			this.cardRect = { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
		}
		T.y0 = y0;
		this.stageH = st.offsetHeight;
		const key = JSON.stringify(T);
		T.H = this.stageH;
		if (!this.B || key !== this.tokKey) {
			this.B = compile(T, this.cfg);
			this.tokKey = key;
		}
		this.G = this.B.G;
		this.floor = this.G.floor;
		// the module and its content blocks: offsetTop chains (the morph's transforms do not count, nothing to reset)
		const prev = new Map(this.blocks.map((b) => [b.el, b]));
		this.blocks = [];
		if (this.mod) {
			this.Mh = this.mod.offsetHeight;
			this.modX = this.mod.offsetLeft;
			this.modW = this.mod.offsetWidth;
			const mt = docTop(this.mod);
			this.blocks = Array.from(this.mod.querySelectorAll<HTMLElement>('[data-b]')).map((e) => ({ el: e, y: docTop(e) - mt, h: e.offsetHeight, nested: !!e.parentElement?.closest('[data-b]'), start: -1, o: prev.get(e)?.o ?? NaN, ty: prev.get(e)?.ty ?? NaN }));
			this.measureBlueprint();
		}
		// the track (the same program keeps its warp and snapshot cache)
		const tr = new Track(this.B, this.tr);
		const startY = this.G.y0 - T.startOff;
		this.vh = ctx.vh;
		// the shell's edge stays this far under the viewport bottom: 64 px plus the stage's lead on a fast scroll
		// (native Y ahead of Ŷ by v·τ moves a slowed stage up by up to ≈ 0.2·vh more than t says)
		this.edgePad = 64 + 0.2 * ctx.vh;
		if (this.pin) {
			// the CSS run (build time, per breakpoint and height step; the controller cleared any override); where it does not
			// fit this viewport the track plans its own (runOverride, written by applyRun)
			const P = Math.max(0, this.pin.offsetHeight - this.stageH);
			tr.plan({ P, vh: ctx.vh, penY: ctx.penY, nav: ctx.nav, startY, floor: this.floor, y0: this.G.y0, band: T.band, linear: ctx.linear });
		}
		this.visBot = ctx.vh;
		this.outDone = this.B.out ? this.B.out.t + carrot(0, this.B.out.D - this.B.out.s0, T.vmax, T.acc)[1] : Infinity;
		tr.latched = this.tr ? this.tr.latched : false;
		this.tr = tr;
		this.startY = startY;
		const cr = this.cardRect;
		this.buildKey = `${key}|${this.stageH}|${cr ? `${cr.x.toFixed(1)},${cr.y.toFixed(1)},${cr.w.toFixed(1)},${cr.h.toFixed(1)}` : ''}`;
		// the next frame redraws (the zones may have moved); the nodes stay if nothing they depend on changed
		this.key = '';
		this.lastT = -1;
		delete this.last.blocks;
		delete this.last.clip;
		this.clipQ.fill(NaN);
		if (!this.built) this.outR = null;
		this.leadHead = null;
		// (the geometry may have moved: the leads are built again from it)
		this.inMemo.t = this.outMemo.t = NaN;
		this.laidRef = null;
		this.relaxDrop();
	}
	startY = 0;

	/** place the program on the page (layout positions: offsetTop chains, which the glide's transforms do not change), in order */
	place(glide: Glide, ctx: { penY: number; vh: number; maxY: number; nav: number }) {
		const top = docTop(this.pin ?? this.stage);
		if (this.pin) this.tr.place(top, glide);
		// Contact: never slowed; READY plays as the card scrolls in, until the cell's bench reaches 0.62·vh; on short
		// viewports earlier (lower), so the cell is still below the nav when READY completes at a brisk scroll (the
		// program trails the page by ≈ 0.15 s of scroll), and never before the device is fully on screen
		else {
			const above = this.floor - this.G.y0;
			const vis = ctx.vh - this.G.devH - 12;
			// short viewports: as soon as -X0 is fully on screen (lowest), the program's lag then still leaves the cell below the nav
			// (the lag allowance: 210 px, the program's trail behind a brisk wheel at 1× (≈ 200 px measured); with 150 px, at
			// 1024 × 600 READY latched with the cell 13 px under the nav one wheel phase in two. 210 changes only heights where
			// 0.62·vh was the smaller term: 1024 × 600 +47 px, 1280 × 720 +31, 1366 × 768 +1)
			const benchAt = ctx.vh < 520 ? vis : Math.min(vis, Math.max(0.62 * ctx.vh, ctx.nav + above + Math.min(0.35 * ctx.vh, 210)));
			this.tr.placeFree({ pinTop: top, startY: this.startY, penY: ctx.penY, floor: this.floor, vh: ctx.vh, benchAt, maxY: ctx.maxY }, glide);
		}
		this.computeStarts();
	}

	/** document y of the stage top for the native scroll position */
	stageTop(Y: number) {
		return this.tr.pinTop + (this.pin ? this.tr.offset(Y) : 0);
	}
	/** stage-local y of the viewport bottom when the program is at t on a steady scroll (Ŷ = Y) */
	visBotAt(t: number) {
		const Y = this.tr.yAt(t);
		return Y + this.vh - this.tr.stageTop(Y);
	}

	/* ------------------------------------------------------------------ persistent nodes */
	private build() {
		const G = this.G,
			T = G.T,
			n = this.n,
			sc = G.sc;
		const W = T.W,
			Hh = this.stageH;
		// the layers' boxes cover the cell only (stage px kept by the viewBox); what they draw outside it
		// (the legs down the lanes) paints through overflow: visible. No layer box ever lies over the text.
		const bTop = Math.floor(G.y0 - 40),
			bH = Math.ceil(G.floor + G.devH + 90 - bTop);
		for (const s of [this.wires, this.over, this.robots]) {
			s.setAttribute('width', String(W));
			s.setAttribute('height', String(bH));
			s.setAttribute('viewBox', `0 ${bTop} ${W} ${bH}`);
			s.style.top = bTop + 'px';
		}
		// ---- device (in its own CSS-positioned svg, device units)
		const D = DEV[this.cfg.dev];
		const ds = this.devSvg;
		ds.innerHTML = '';
		const defs = el('defs', {}, ds);
		el('rect', { x: -6, y: -2, width: D.w / 2 + 6, height: D.h + 14 }, el('clipPath', { id: `dl${n}` }, defs));
		el('rect', { x: D.w / 2, y: -2, width: D.w / 2 + 6, height: D.h + 14 }, el('clipPath', { id: `dr${n}` }, defs));
		const housingG = el('g', {}, ds);
		housingG.innerHTML = housing(this.cfg.dev);
		const doors = el('g', {}, ds);
		const doorL = el('g', { 'clip-path': `url(#dl${n})` }, doors);
		const faceG = el('g', {}, doorL);
		const doorR = el('g', { 'clip-path': `url(#dr${n})` }, doors);
		const faceR = el('g', {}, doorR);
		const tab = el('g', {}, ds);
		tab.innerHTML = tabPath(this.cfg.dev, this.cfg.dir);
		const ports = el('g', {}, ds);
		const led = el('g', {}, ds);
		// ---- the lead (stage px), clipped by the head tab and the device body; visible in the cavities
		const wv = this.wires;
		wv.innerHTML = '';
		const wd = el('defs', {}, wv);
		const tabW = 40 * sc,
			mw = 8 * sc,
			md = 7 * sc;
		const tabL = G.cx - tabW / 2,
			devL = G.devX,
			devR = G.devX + G.devW;
		const yTop = this.free ? 0 : -1e5;
		const cav = (x: number) => `M${f(x - mw / 2)} ${f(G.mouthY - 1)}h${f(mw)}v${f(md + 1)}h${f(-mw)}Z`;
		el('path', {
			'clip-rule': 'evenodd',
			d: `M-200 ${yTop}H${W + 200}V${Hh + 1e5}H-200Z M${f(tabL)} ${f(G.mouthY)}h${f(tabW)}v${f(G.floor - G.mouthY + 0.5)}H${f(devR)}V${f(G.floor + G.devH)}H${f(devL)}V${f(G.floor + 0.5)}H${f(tabL)}Z ${cav(G.inX)} ${cav(G.outX)}`,
		}, el('clipPath', { id: `tc${n}` }, wd));
		// the Contact card: Carta insulation inside the card, blu cavo outside
		const groups: { g: SVGGElement; ins: string }[] = [];
		if (this.card && this.cardRect) {
			const cr = this.cardRect;
			const r = `M${f(cr.x)} ${f(cr.y)}h${f(cr.w)}v${f(cr.h)}h${f(-cr.w)}Z`;
			el('path', { 'clip-rule': 'evenodd', d: `M-200 ${yTop}H${W + 200}V${Hh + 1e5}H-200Z ${r}` }, el('clipPath', { id: `co${n}` }, wd));
			el('path', { d: r }, el('clipPath', { id: `ci${n}` }, wd));
			const g0 = el('g', { 'clip-path': `url(#tc${n})` }, wv);
			groups.push({ g: el('g', { 'clip-path': `url(#co${n})` }, g0), ins: COL.ins });
			groups.push({ g: el('g', { 'clip-path': `url(#ci${n})` }, g0), ins: COL.insDark });
		} else groups.push({ g: el('g', { 'clip-path': `url(#tc${n})` }, wv), ins: COL.ins });
		const cuC = COL.cu;
		const mk = (g: SVGGElement, stroke: string, w: number, extra: Record<string, string | number> = {}) =>
			el('path', { fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'butt', 'stroke-linejoin': 'round', ...extra }, g);
		const N = this.n_;
		N.ins = [];
		N.cu = [];
		N.pg = [];
		N.pc = [];
		N.oIns = [];
		N.oCu = [];
		for (const { g, ins } of groups) {
			N.ins.push(mk(g, ins, T.cable));
			N.oIns.push(mk(g, ins, T.cable));
			N.cu.push(mk(g, cuC, T.cuw));
			N.oCu.push(mk(g, cuC, T.cuw));
			N.pg.push(mk(g, COL.cul, f(T.cable * 0.9), { 'stroke-opacity': 0.28, 'stroke-dasharray': '0 100000' }));
			N.pc.push(mk(g, COL.cul, T.cuw, { 'stroke-dasharray': '0 100000' }));
		}
		// jaws, over the copper (device units)
		N.jaws = el('g', { class: `dv dv--${D.module}`, transform: `translate(${f(G.devX)} ${f(G.floor)}) scale(${sc})` }, wv);
		// the +C5 vignette: the wire marker printed with the lead's address, riding the lead 15 units above its insulation end
		this.mkr = [];
		const mkTxt = this.B.vf.find((v) => v.kind === 'read')?.txt.mark;
		if (mkTxt) this.mkr.push(this.markerNode(wv, mkTxt));
		// ---- effects and the edge charge
		const ov = this.over;
		ov.innerHTML = '';
		N.edge = [0, 1].map(() => el('line', { stroke: COL.cu, 'stroke-width': sc < 1 ? 1.5 : 2, opacity: 0 }, ov));
		N.fx = el('g', {}, ov);
		Object.assign(N, { housing: housingG, doors, doorL, doorR, face: faceG, faceR, led, ports });
		const dev = this.cfg.dev;
		this.P = { face: new Patch(faceG, facePainter(dev)), faceR: new Patch(faceR, facePainter(dev)), ports: new Patch(ports, tabPainter), led: new Patch(led, tabLedPainter(dev)), jaws: new Patch(N.jaws, tabPainter) };
		// ---- the bench props (props.ts): in the robot layer, under the arms (cell units, one group, written through a Patch)
		this.robots.querySelector(':scope > [data-props]')?.remove();
		this.propsP = null;
		if (this.B.props.length) {
			const pg = el('g', { 'data-props': '', transform: `translate(${f(G.cx)} ${f(G.floor)}) scale(${sc})` });
			this.robots.insertBefore(pg, this.robots.firstChild);
			this.propsP = new Patch(pg, (s) => s);
		}
		// ---- robots: mounted on their own (ensureRig: in idle time, or in the frame the cell first shows); until then the
		// static parked pair stands in, as it does before the panel boots
		this.rigView?.remove?.();
		this.rigView = null;
		delete this.sec.dataset.rig;
		// the camera's job, in place: persistent nodes written by attribute (Pool)
		this.visPool = this.B.vf.length ? new Pool(el('g', { class: 'vis' }, ov)) : null;
		// the effects' nodes, every one an effect will use, in the program's order (each effect sampled over its window)
		const FP = (this.fxPool = new Pool(N.fx));
		FP.begin();
		this.B.fx.forEach((e, i) => {
			const t1 = (e.t1 ?? e.t) + 0.6;
			for (let k = 0; k <= 24; k++) this.fxEvent(FP, i, e, e.t + ((t1 - e.t) * k) / 24);
		});
		// (a set of brackets without an end stays: its window never closes)
		this.fxSpans = this.B.fx.map((e) => [e.t, e.k === 'brackets' && e.t1 == null ? Infinity : (e.t1 ?? e.t) + 0.6]);
		FP.end();
		FP.begin();
		FP.end();
		this.lastFx = NaN;
		void mk;
	}

	/** the robots' live nodes are mounted (a mount is its own short task, not part of the stage's build) */
	get rigMounted() {
		return !!this.rigView || !this.B.rig?.mount;
	}
	/** the rig draws into the robot layer (persistent nodes); the static parked pair steps aside */
	ensureRig() {
		if (this.rigMounted || !this.built) return false;
		this.rigView = this.B.rig!.mount!(this.robots, { uid: `r${this.n}`, ground: this.cfg.ground });
		this.sec.dataset.rig = 'live';
		// (its next frame draws whole: the arms from their first pose to the program's)
		this.lastT = -1;
		this.drawn = false;
		this.key = '';
		return true;
	}

	/* ------------------------------------------------------------------ the leads settling after the wheel stops (relax.ts) */
	private rx: { in: Relax | null; out: Relax | null } = { in: null, out: null };
	/** QA: the settling's state per lead (null: none) */
	relaxState() {
		const o = (R: Relax | null) => (R ? { t0: R.t0, running: R.running, w: R.w, version: R.version } : null);
		return { in: o(this.rx.in), out: o(this.rx.out) };
	}
	/** forget any settling (a re-layout, the stage off screen) */
	relaxDrop() {
		if (!this.rx.in && !this.rx.out) return false;
		this.rx.in = this.rx.out = null;
		return true;
	}
	/**
	 * One frame of the settling, for the controller (index.ts) while the stage is on screen: it starts once the scroll has
	 * settled (idle) at program time t, runs in real time (dt), and fades back into the simulated leads when t moves on.
	 * Returns true while it changes what is drawn (the stage redraws its leads, the ticker keeps running).
	 */
	relaxTick(t: number, idle: boolean, dt: number) {
		let changed = false;
		for (const k of ['in', 'out'] as const) {
			const R = this.rx[k];
			if (R) {
				if (t === R.t0) changed = R.step(dt) || changed;
				else if (dt <= 0 || Math.abs(t - R.t0) > 0.25) {
					this.rx[k] = null;
					changed = true;
				} else {
					if (!R.fade(dt)) this.rx[k] = null;
					changed = true;
				}
			} else if (idle && dt > 0 && t > 0 && t < this.tr.tEnd) {
				const R2 = this.relaxStart(k, t);
				if (R2) {
					this.rx[k] = R2;
					changed = R2.step(dt) || changed;
				}
			}
		}
		return changed;
	}
	/** a settling for the in-lead or the out-lead at t, if it is a free rope there (not fed, not laid, not out yet) */
	private relaxStart(k: 'in' | 'out', t: number) {
		const ca = this.tr.cache;
		const S = ca.sample(t);
		const pts = k === 'in' ? (S.ropeOn && !S.laid ? S.pts : null) : S.opts;
		if (!pts) return null;
		// the pins it was stepped with on the step after t (the simulation's own: jaws, duct exit, mouth, the feed's tension)
		const n = Math.floor(t / H + 1e-7);
		ca.seek(n * H);
		const sim = ca.sim;
		sim.step();
		const pins = k === 'in' ? sim.ropePins : sim.oropePins;
		const R = k === 'in' ? sim.rope : sim.orope;
		if (!pins || R.n * 2 !== pts.length) return null;
		return new Relax(t, pts, R.n, R.L, R.x, pins, sim.rc);
	}

	/* ------------------------------------------------------------------ vignettes: the wire marker, the camera's job in place */
	/** a wire-marker sleeve (units, centred, long axis along x) with a wordless print (no wire numbers on
	 * screen; the camera reads it, the visitor sees a printed sleeve) */
	private markerNode(parent: Element, txt: string) {
		const G = this.G;
		const g = el('g', { display: 'none' }, parent);
		const w = G.T.cable / G.sc + 1.4,
			L = 3.2 + txt.length * 1.5;
		el('rect', { x: f(-L / 2), y: f(-w / 2), width: f(L), height: f(w), rx: 0.8, fill: '#F4F1EC', stroke: '#9AA6B5', 'stroke-width': 0.35 }, g);
		// the print: short ink strokes, like characters too small to read
		let d = '';
		const n = Math.max(3, Math.min(6, txt.length - 1));
		for (let i = 0; i < n; i++) {
			const x = -L / 2 + 1.8 + ((L - 3.6) * (i + 0.5)) / n;
			const h = i % 3 === 1 ? 0.55 : 0.85;
			d += `M${f(x)} ${f(-h * (w / 2 - 0.5))}V${f(h * (w / 2 - 0.5))}`;
		}
		el('path', { d, fill: 'none', stroke: '#5A6676', 'stroke-width': 0.45, 'stroke-linecap': 'round' }, g);
		return g;
	}
	/** the marker's place: 15 units above the lead's insulation end, along the lead (the arrival route, then seated) */
	private markerPose(t: number, S: Sample) {
		const B = this.B,
			G = this.G,
			a = B.cable.arrive;
		if (!a || !this.mkr.length) return null;
		const off = 15 * G.sc;
		if (B.cable.seatT != null && t >= B.cable.seatT) return { x: G.inX, y: G.mouthY - off, a: -90 };
		if (t <= a.t0) return null;
		const s = S.front - G.CU - off;
		if (s < a.sStart + 10) return null;
		const p = a.route.at(s);
		return { x: p.x, y: p.y, a: (Math.atan2(p.ty, p.tx) * 180) / Math.PI + 180 };
	}
	private markerAt(t: number, S: Sample) {
		if (!this.mkr.length) return;
		const m = this.markerPose(t, S);
		const v = m ? `translate(${f(m.x)} ${f(m.y)}) rotate(${f(m.a)}) scale(${this.G.sc})` : 'none';
		if (this.last.mkr === v) return;
		this.last.mkr = v;
		for (const g of this.mkr) {
			if (m) {
				g.setAttribute('transform', v);
				g.removeAttribute('display');
			} else g.setAttribute('display', 'none');
		}
	}
	/**
	 * The camera's job where it happens (the camera still works twice, but never in a zoomed inset and
	 * never with words): while its scan cone points there, brackets lock on the target in place and the result shows on the
	 * work itself. +C2 (register): brackets on the two mouths, the drawing's dashed outline of the tab snapping onto the real
	 * one, the planned path into the mouth, the tip tracked in copper, the bracket copper when the lead is seated. +C5 (read):
	 * a bracket on the wire marker (copper once matched), then one on the module's input LED (copper when it lights).
	 * Literal paint, persistent nodes (Pool).
	 */
	private visionAt(t: number, S: Sample) {
		const P = this.visPool;
		if (!P) return;
		const B = this.B,
			G = this.G,
			sc = G.sc;
		let a = 0,
			ev = -1;
		B.vf.forEach((e, i) => {
			const v = smooth((t - e.t0) / 0.12) * (1 - smooth((t - e.t1 + 0.12) / 0.12));
			if (v > a) {
				a = v;
				ev = i;
			}
		});
		P.begin();
		if (a > 0.004) {
			const e = B.vf[ev],
				K = e.k;
			const det = '#24508F',
				ok = '#C9632C';
			const op = f(a) + '';
			const brk = (key: string, cx: number, cy: number, hw: number, hh: number, q: number, col: string) => {
				const c = Math.min(hw, hh) * 0.6,
					sz = 1.3 - 0.3 * q,
					w = hw * sz,
					h = hh * sz;
				P.put(key, 'path', {
					d: `M${f(cx - w)} ${f(cy - h + c)}V${f(cy - h)}H${f(cx - w + c)}M${f(cx + w - c)} ${f(cy - h)}H${f(cx + w)}V${f(cy - h + c)}M${f(cx + w)} ${f(cy + h - c)}V${f(cy + h)}H${f(cx + w - c)}M${f(cx - w + c)} ${f(cy + h)}H${f(cx - w)}V${f(cy + h - c)}`,
					fill: 'none',
					stroke: col,
					'stroke-width': sc < 1 ? 1.25 : 1.75,
					'stroke-linecap': 'square',
					opacity: op,
				});
			};
			if (e.kind === 'register') {
				const hw = 5.6 * sc,
					hh = 5.2 * sc;
				const yM = G.mouthY + 3.5 * sc;
				if (t >= K.lock) {
					const q = prog(t - K.lock, SPRINGS.actuate);
					brk('bIn', G.inX, yM, hw, hh, q, t >= K.seat ? ok : det);
					brk('bOut', G.outX, yM, hw, hh, q, '#5A6676');
				}
				// the drawing (dashed): the tab's top face across the two mouths, where the EPLAN drawing puts it, held clearly off
				// the real tab (most of a mouth's pitch aside, a little high and turned 5°) until the camera's match,
				// then it snaps onto the real one with one damped settle
				if (t >= K.lock + 0.08 && t < K.seat + 0.4) {
					const dt = t - K.snap;
					const q = t < K.snap ? 0 : 1 - Math.exp(-dt / 0.08) * Math.cos(dt * 22);
					const ox = 5.5 * sc * (1 - q),
						oy = -2.6 * sc * (1 - q),
						rot = -5 * (1 - q);
					const xa = Math.min(G.inX, G.outX) - 9 * sc,
						xb = Math.max(G.inX, G.outX) + 9 * sc;
					const tr = `rotate(${f(rot)} ${f(G.cx + ox)} ${f(G.mouthY + oy)})`;
					const dop = f(a * (q >= 0.98 ? 0.5 : 0.95)) + '';
					const sw = sc < 1.2 ? 1.25 : 1.6;
					P.put('eTab', 'path', { d: `M${f(xa + ox)} ${f(G.mouthY + oy + 6 * sc)}V${f(G.mouthY + oy)}H${f(xb + ox)}V${f(G.mouthY + oy + 6 * sc)}`, fill: 'none', stroke: det, 'stroke-width': sw, 'stroke-dasharray': '4 3', opacity: dop, transform: tr });
					[G.inX, G.outX].forEach((mx, i) => {
						P.put('eM' + i, 'rect', { x: f(mx - 4 * sc + ox), y: f(G.mouthY + oy), width: f(8 * sc), height: f(7 * sc), fill: 'none', stroke: det, 'stroke-width': sw - 0.25, 'stroke-dasharray': '3 2', opacity: dop, transform: tr });
					});
				}
				// the planned path into the mouth (dashed), its target ring; it gives way to the real lead once seated
				if (t >= K.plan && t < K.seat) {
					const pr = smooth((t - K.plan) / 0.24);
					const y0 = G.mouthY - 46 * sc,
						y1 = G.mouthY + 5 * sc;
					P.put('plan', 'path', { d: `M${f(G.inX)} ${f(y0)}V${f(y0 + (y1 - y0) * pr)}`, fill: 'none', stroke: det, 'stroke-width': 1.5, 'stroke-dasharray': '5 4', opacity: op });
					if (pr >= 1) P.put('ring', 'circle', { cx: f(G.inX), cy: f(y1), r: f(3.2 * sc), fill: 'none', stroke: det, 'stroke-width': 1.25, opacity: op });
				}
				// the copper tip, tracked down the plan
				const ar = B.cable.arrive;
				if (ar && t >= K.exec && t < K.seat + 0.02) {
					const p = ar.route.at(S.front);
					brk('trk', p.x, p.y - G.CU / 2, 3.2 * sc, 4 * sc, 1, ok);
				}
			} else {
				// READ: the marker bracketed (copper once matched); CONFIRM: the input LED bracketed, copper when it lights
				const mk = e.at[0];
				// (never narrower than 4 units a side, so it reads on a phone)
				const mw = Math.max((G.T.cable / sc + 3) * sc * 0.55, 4 * sc),
					mh = (3.2 + 5 * 1.5 + 2) * sc * 0.55;
				if (t >= K.lock && t < K.pan + 0.15) brk('bMk', mk.x, mk.y, mw, mh, prog(t - K.lock, SPRINGS.actuate), t >= K.match ? ok : det);
				if (t >= K.check - 0.1 && e.tgt) {
					const r = 4.5 * sc;
					brk('bLed', e.tgt.x, e.tgt.y, r, r, prog(t - K.check + 0.1, SPRINGS.actuate), t >= K.on ? ok : det);
				}
			}
		}
		P.end();
	}

	/** restore the static (tested, open) markup: reduced motion switched on at runtime */
	unbuild() {
		this.rigView?.remove?.();
		this.rigView = null;
		this.visPool = null;
		this.fxPool = null;
		this.P = null;
		this.mkr = [];
		delete this.sec.dataset.rig;
		this.devSvg.innerHTML = this.devStatic;
		this.wires.innerHTML = '';
		this.over.innerHTML = '';
		for (const e of [this.shell, this.body, this.rim]) if (e) e.style.clipPath = '';
		for (const s of [this.wires, this.over, this.robots]) s.style.top = '';
		this.devSvg.style.transform = '';
		for (const b of this.blocks) {
			b.el.style.opacity = '';
			b.el.style.transform = '';
			b.o = b.ty = NaN;
		}
		if (this.bp) {
			this.bp.style.opacity = '';
			this.bp.style.display = '';
			this.bp.innerHTML = '';
		}
		this.bpDrawn = '';
		this.bpRoot = null;
		this.bpGroups = [];
		// the static page has no runs (and no override of them)
		if (this.run) this.run.style.height = '';
		this.n_ = {};
		this.last = {};
		this.qv.fill(NaN);
		this.clipQ.fill(NaN);
		this.lastT = -1;
		this.builtKey = '';
	}

	/* ------------------------------------------------------------------ the morph (staged) */
	/*
	 * The component becomes its compartment in three overlapping stages over MORPH_DUR of program time (τ = t − T_m):
	 *   doors (τ 0 → 0.16)   the face splits and its halves slide apart: the inside of the device is the module's ground
	 *   shell (τ ≥ MX0)      the shell grows out of the device to the module's width (spring morphX), its halves riding the
	 *                        edges as they go and fading into the rim; from MY0 its bottom edge drops (morphY) to just under
	 *                        the viewport, onto the blueprint drawn there
	 *   content              each block comes in, in place (opacity, a 10-unit rise), once the shell is fully wide and holds
	 *                        all of the block that is on screen: no frame shows text cut by a moving edge
	 * The controller may show this a little ahead of the scrolled program time when the visitor stops inside it (index.ts:
	 * the morph finishes on its own rather than resting half-open), so its inputs are the morph's own display time.
	 */
	static MX0 = 0.08;
	static MY0 = 0.18;
	/** the morph's display time after T_m (s): the scrolled one, or ahead of it while it finishes on its own */
	md = 0;
	/**
	 * A visitor who stops the wheel inside the morph never leaves it resting half-open. The display time follows the
	 * scrolled program time; once the scroll has settled (idle) inside the morph it runs on by itself to the open module
	 * (≈ 0.6 s, easing out); scrolling back rewinds it just behind the scroll (τ 0.12 s); forward it waits for the scroll to
	 * catch up. dt = 0 (a jump, a forced render): the scrolled time. Returns true while it moves (the ticker keeps running).
	 */
	morphStep(t: number, dt: number, idle: boolean, back: boolean) {
		const mt = this.B.morphT;
		if (!(mt > 0)) return false;
		const M = MORPH_DUR;
		const ts = Math.max(0, Math.min(M, t - mt));
		const m0 = this.md;
		if (ts >= this.md || dt <= 0) this.md = ts;
		else if (back || (idle && ts <= 0)) {
			// back (or resting before the morph's start): it closes just behind the scroll
			this.md = ts + (this.md - ts) * Math.exp(-dt / 0.12);
			if (this.md - ts < 1e-4) this.md = ts;
		}
		// resting inside the morph: it finishes on its own
		if (idle && dt > 0 && ts > 0 && this.md < M) this.md = Math.min(M, this.md + Math.max(0.5 * dt, (M - this.md) * (1 - Math.exp(-dt / 0.2))));
		return Math.abs(this.md - m0) > 1e-6;
	}
	/** inside the morph, not finished: the ticker waits for the scroll to settle (then the morph finishes on its own) */
	get morphPending() {
		const mt = this.B.morphT;
		return mt > 0 && ((this.t > mt && this.md < MORPH_DUR - 1e-6) || (this.t <= mt && this.md > 1e-6));
	}
	/** the shell's bottom edge (module px) dt after the morph starts: it falls to just under the viewport bottom
	 * (where the viewport bottom is at that program time, or in this frame if lower) and snaps to the full
	 * module when the spring settles, always off-screen; the page keeps rising, so the target moves with it */
	private bottomEdge(dt: number, visNow = -Infinity) {
		const G = this.G;
		const pY = prog(dt - StageView.MY0, SPRINGS.morphY);
		if (pY > 0.999 || this.B.morphT + dt >= this.B.tEnd) return this.Mh;
		const target = Math.min(this.Mh, Math.max(this.visBotAt(this.B.morphT + dt), visNow) - this.floor + this.edgePad);
		return G.devH + (target - G.devH) * pY;
	}
	/** content: each block starts once the shell is fully wide and its bottom edge holds all of the block that is on screen
	 * on a steady scroll (pure function of geometry); top-level blocks cascade a little in reading order */
	private computeStarts() {
		const mt = this.B.morphT;
		let tX = -1;
		if (mt > 0) for (let k = 0; k <= 360 && tX < 0; k++) if (prog(k * H - StageView.MX0, SPRINGS.morphX) >= 0.97) tX = k * H;
		const top = this.blocks.filter((b) => !b.nested).length || 1;
		const stag = Math.min(0.05, 0.24 / top);
		let last = -1;
		for (const b of this.blocks) {
			let st = -1;
			if (mt > 0)
				for (let k = Math.max(0, Math.round(tX / H)); k <= 360; k++) {
					const visMod = this.visBotAt(mt + k * H) - this.floor;
					if (this.bottomEdge(k * H) >= Math.min(b.y + b.h, visMod) - 0.5) {
						st = mt + k * H;
						break;
					}
				}
			if (st < 0 && mt > 0) st = mt + 3;
			if (st >= 0 && !b.nested && last >= 0 && st < last + stag) st = last + stag;
			if (st >= 0 && !b.nested) last = st;
			// blocks below the visible part of the module (they open off-screen) are complete by tEnd
			b.start = st >= 0 ? Math.min(st, this.B.tEnd - 0.22) : st;
		}
		const starts = this.blocks.map((b) => b.start).filter((x) => x >= 0);
		this.blockWin = starts.length ? [Math.min(...starts), Math.max(...starts) + 1.2] : [Infinity, -Infinity];
	}
	/** t: the morph's display time (program time, or a little ahead of it while the morph finishes on its own) */
	private morph(t: number, visNow: number) {
		const G = this.G,
			sc = G.sc,
			T = G.T;
		const L0 = G.devX - this.modX,
			R0 = this.modX + this.modW - (G.devX + G.devW);
		let pX = 0,
			yb = G.devH,
			rad = 12 * sc;
		const mt = this.B.morphT;
		if (mt > 0 && t >= mt) {
			pX = t >= this.B.tEnd ? 1 : prog(t - mt - StageView.MX0, SPRINGS.morphX);
			yb = this.bottomEdge(t - mt, visNow);
			rad = 12 * sc + (T.rMod - 12 * sc) * Math.min(1, pX);
		}
		const Li = L0 * (1 - pX),
			Ri = R0 * (1 - pX),
			Bi = Math.max(0, this.Mh - yb);
		const open = pX >= 0.999 && Bi <= 0.01;
		// (the clip as numbers first: its string only when it changed)
		const cq = this.clipQ;
		const q0 = open ? NaN : f(Ri),
			q1 = open ? NaN : f(Bi),
			q2 = open ? NaN : f(Li),
			q3 = open ? NaN : f(rad);
		if (!(cq[4] === (open ? 1 : 0) && Object.is(cq[0], q0) && Object.is(cq[1], q1) && Object.is(cq[2], q2) && Object.is(cq[3], q3))) {
			cq[0] = q0;
			cq[1] = q1;
			cq[2] = q2;
			cq[3] = q3;
			cq[4] = open ? 1 : 0;
			const clip = open ? 'none' : `inset(0px ${q0}px ${q1}px ${q2}px round ${q3}px)`;
			if (this.last.clip !== clip) {
				this.last.clip = clip;
				this.shell!.style.clipPath = clip;
				this.body!.style.clipPath = clip;
				this.rim!.style.clipPath = open ? 'none' : `inset(0px ${q0}px ${q1}px ${q2}px round ${f(rad + 1.5)}px)`;
			}
		}
		const bw = this.blockWin;
		const bk = t < bw[0] ? 'pre' : t > bw[1] ? 'post' : '';
		if (bk && this.last.blocks === bk) {
			// nothing in the content can change before the first block starts or after the last one settled
		} else for (const b of this.blocks) {
			let o = 0,
				y = f(-10 * sc);
			if (b.start >= 0 && t >= b.start) {
				const dt = t - b.start;
				o = Math.round(smooth(dt / 0.2) * 1000) / 1000;
				y = f(-10 * sc * (1 - prog(dt, SPRINGS.content)));
			}
			if (o !== b.o || y !== b.ty) {
				b.o = o;
				b.ty = y;
				b.el.style.opacity = o === 1 ? '1' : String(o);
				b.el.style.transform = y === 0 ? 'none' : `translateY(${y}px)`;
			}
		}
		this.last.blocks = bk;
		this.blueprintAt(t, pX);
		return { pX, Li, Ri, rad, open, L0, R0 };
	}

	/** the module's top-level content blocks (cached per measurement) */
	private topB: { of: Block[]; top: Block[] } | null = null;
	private topBlocks() {
		if (this.topB?.of !== this.blocks) this.topB = { of: this.blocks, top: this.blocks.filter((b) => !b.nested) };
		return this.topB.top;
	}
	/* ------------------------------------------------------------------ the blueprint (no empty plate before the morph) */
	/*
	 * Before the morph the module's reserved area is a drawing of the module it will become, not an empty slab: its outline
	 * (dashed), a dashed slot for every picture and card, a hairline for every line of text, measured from the real layout.
	 * The same grammar as Contact's unbuilt form (a dashed slot is a part the robots' work is about to make): no wireframe
	 * diagonals, no skeleton-loader pills (a calm drawing, not a page that failed to load). It draws itself as
	 * the program runs (block by block, in reading order, from the lead's arrival to the power-up), lights up at the
	 * power-up, and in the morph each block's drawing gives way to the block itself as it comes in, in the same place.
	 * Literal hex paint on every shape.
	 */
	private bpShapes: { k: number; svg: string }[] = [];
	private bpKey = '';
	private bpDrawn = '';
	private bpGroups: (SVGGElement | null)[] = [];
	private bpOutline: SVGElement | null = null;
	private bpRoot: SVGGElement | null = null;
	private bpOp: number[] = [];
	/** the blueprint was last drawn in its still state (blueprintAt) */
	private bpFlat = false;
	/** rebuild (reads only): the blueprint's shapes in module px, grouped by top-level content block */
	private measureBlueprint() {
		const mod = this.mod,
			body = this.body;
		this.bpShapes = [];
		if (!mod || !body || !this.bp) return;
		const mr = mod.getBoundingClientRect();
		const mTop = docTop(mod);
		const top = this.blocks.filter((b) => !b.nested);
		const idx = new Map(top.map((b, i) => [b.el, i]));
		// a block's own transform (it waits 10 units up before it comes in): rects are taken back to its layout place
		const dyOf = new Map<Element, number>();
		const shiftOf = (e: Element) => {
			const B = e.closest<HTMLElement>('[data-b]');
			if (!B) return 0;
			let d = dyOf.get(B);
			if (d == null) {
				d = B.getBoundingClientRect().top - mr.top - (docTop(B) - mTop);
				dyOf.set(B, d);
			}
			return d;
		};
		const groupOf = (e: Element) => {
			let B = e.closest<HTMLElement>('[data-b]');
			while (B && !idx.has(B)) B = B.parentElement?.closest<HTMLElement>('[data-b]') ?? null;
			return B ? idx.get(B)! : -1;
		};
		// on the plate (light) and on the ink shell growing over it (ink modules): steel that reads on both
		const dark = this.sec.classList.contains('cmp--dark');
		const C = dark ? { line: '#5A6676', bar: '#5A6676', fill: '#9AA6B5' } : { line: '#9AA6B5', bar: '#9AA6B5', fill: '#D3D9E0' };
		const push = (k: number, svg: string) => this.bpShapes.push({ k, svg });
		const W = mr.width;
		// pictures, videos and cards: a frame (with a faint tone for pictures)
		const media = body.querySelectorAll<HTMLElement>('figure, img, video, picture, iframe, canvas, [data-bp-box]');
		for (const e of Array.from(media)) {
			if (e.tagName !== 'FIGURE' && e.closest('figure')) continue;
			if (e.tagName === 'IMG' && e.closest('picture')) continue;
			const r = e.getBoundingClientRect();
			if (r.width < 8 || r.height < 8) continue;
			const x = r.left - mr.left,
				y = r.top - mr.top - shiftOf(e);
			const cs = getComputedStyle(e);
			const rr = Math.min(18, parseFloat(cs.borderTopLeftRadius) || parseFloat(cs.borderBottomLeftRadius) || 2);
			// a picture's place: a dashed slot with a faint tone (no diagonals, the wireframe's placeholder sign)
			push(
				groupOf(e),
				`<rect x="${f(x + 0.5)}" y="${f(y + 0.5)}" width="${f(r.width - 1)}" height="${f(r.height - 1)}" rx="${f(rr)}" fill="${C.fill}" fill-opacity="${dark ? 0.05 : 0.12}" stroke="${C.line}" stroke-width="1" stroke-dasharray="4 4"/>`,
			);
		}
		// every line of text: a bar at its x-height, as long as the line
		const tw = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
		const rg = document.createRange();
		const lines = new Map<string, { k: number; x0: number; x1: number; y: number; h: number }[]>();
		for (let n = tw.nextNode(); n; n = tw.nextNode()) {
			if (!n.nodeValue || !/\S/.test(n.nodeValue)) continue;
			const pe = n.parentElement;
			if (!pe || pe.closest('[aria-hidden="true"], .visually-hidden, svg, figure')) continue;
			rg.selectNodeContents(n);
			const k = groupOf(pe),
				dy = shiftOf(pe);
			for (const r of Array.from(rg.getClientRects())) {
				if (r.width < 3 || r.height < 6 || r.right < mr.left || r.left > mr.right) continue;
				const y = r.top - mr.top - dy;
				// fragments of one line (inline elements, words) join; side-by-side columns at the same height stay apart
				const key = `${k}|${Math.round(y / 4)}|${Math.round(r.height)}`;
				const x0 = r.left - mr.left,
					x1 = r.right - mr.left;
				const row = lines.get(key) ?? [];
				const L = row.find((q) => x0 <= q.x1 + 16 && x1 >= q.x0 - 16);
				if (L) {
					L.x0 = Math.min(L.x0, x0);
					L.x1 = Math.max(L.x1, x1);
				} else row.push({ k, x0, x1, y, h: r.height });
				lines.set(key, row);
			}
		}
		// (a hairline on the line's x-height, 1.5 px for headings: a drawing's text line, not a loader's pill)
		for (const L of Array.from(lines.values()).flat()) {
			const sw = L.h > 30 ? 1.5 : 1;
			const x0 = Math.max(4, L.x0),
				x1 = Math.min(W - 4, L.x1);
			if (x1 - x0 < 4) continue;
			const y = f(L.y + L.h * 0.56);
			push(L.k, `<line x1="${f(x0)}" y1="${y}" x2="${f(x1)}" y2="${y}" fill="none" stroke="${C.bar}" stroke-width="${sw}" stroke-linecap="round"/>`);
		}
		this.bpKey = `${f(W)}|${f(this.Mh)}|${this.bpShapes.length}|${this.bpShapes.reduce((a, s) => a + s.svg.length, 0)}`;
	}
	/** the blueprint's nodes (a write: the controller calls it with the other persistent nodes) */
	private writeBlueprint() {
		if (!this.bp || this.bpDrawn === this.bpKey) return;
		this.bpDrawn = this.bpKey;
		const W = this.modW,
			H2 = this.Mh,
			r = this.G.T.rMod;
		const dark = this.sec.classList.contains('cmp--dark');
		const n = this.blocks.filter((b) => !b.nested).length;
		const g: string[] = Array.from({ length: n + 1 }, () => '');
		for (const s of this.bpShapes) g[s.k < 0 ? n : s.k] += s.svg;
		this.bp.innerHTML =
			`<svg class="bp" width="${f(W)}" height="${f(H2)}" viewBox="0 0 ${f(W)} ${f(H2)}" aria-hidden="true" focusable="false"><g data-bp-root opacity="0">` +
			`<rect data-bp-outline x="0.5" y="0.5" width="${f(W - 1)}" height="${f(H2 - 1)}" rx="${f(r)}" fill="${dark ? '#0D1B2E' : '#F4F1EC'}" fill-opacity="${dark ? 0.05 : 0.35}" stroke="${dark ? '#5A6676' : '#9AA6B5'}" stroke-width="1" stroke-dasharray="4 4"/>` +
			g.map((x, i) => `<g data-bp-g="${i}" opacity="0">${x}</g>`).join('') +
			`</g></svg>`;
		this.bpRoot = this.bp.querySelector<SVGGElement>('[data-bp-root]');
		this.bpOutline = this.bp.querySelector<SVGElement>('[data-bp-outline]');
		this.bpGroups = Array.from(this.bp.querySelectorAll<SVGGElement>('[data-bp-g]'));
		this.bpOp = [];
		this.bpFlat = false;
		delete this.last.bpRoot;
		delete this.last.bpOut;
	}
	/** the blueprint at the morph's display time t: drawn block by block with the program, lit at the power-up, each block's
	 * drawing out as the block itself comes in */
	private blueprintAt(t: number, pX: number) {
		if (!this.bpRoot) return;
		const B = this.B,
			mt = B.morphT,
			pw = B.powerT > 0 ? B.powerT : mt;
		const top = this.topBlocks();
		const n = this.bpGroups.length;
		const t0 = 0.12,
			t1 = Math.max(t0 + 0.3, pw - 0.12);
		// between the drawing's last block drawn in and the power-up, before the morph, nothing in it changes (no writes)
		const flat = t >= Math.max(0.3, t1 + 0.29) && t <= pw && (mt <= 0 || t < mt) && pX <= 0.55;
		if (flat && this.bpFlat) return;
		this.bpFlat = flat;
		const done = mt > 0 && t >= mt && top.every((b) => b.o >= 1);
		// (at 60 % contrast, so the drawing never reads as a placeholder: the morph lands within 0.6 s of
		// the power-up and the module, not its drawing, is what the visitor reads)
		const rootOp = done ? '0' : (BP_CONTRAST * (0.62 + 0.38 * smooth((t - pw) / 0.18))).toFixed(3);
		if (this.last.bpRoot !== rootOp) {
			this.last.bpRoot = rootOp;
			this.bpRoot.setAttribute('opacity', rootOp);
			this.bp!.style.display = rootOp === '0' ? 'none' : '';
		}
		if (done) return;
		const outOp = (smooth(t / 0.3) * (1 - smooth((pX - 0.55) / 0.4))).toFixed(3);
		if (this.last.bpOut !== outOp) {
			this.last.bpOut = outOp;
			this.bpOutline!.setAttribute('opacity', outOp);
		}
		for (let i = 0; i < n; i++) {
			const ti = t0 + ((t1 - t0) * Math.min(i, n - 2)) / Math.max(1, n - 1);
			let o = smooth((t - ti) / 0.28);
			const b = top[i];
			// each block's drawing is gone before its text is half in (no bar ever reads as a strike-through)
			if (b && !Number.isNaN(b.o)) o *= 1 - smooth(b.o * 2.5);
			else if (i === n - 1 && mt > 0) o *= 1 - smooth((pX - 0.6) / 0.4);
			// (compared as hundredths: the string only when it changes; '0.5' and '0.50' are the same opacity)
			const v = Math.round(o * 100);
			if (this.bpOp[i] !== v) {
				this.bpOp[i] = v;
				this.bpGroups[i]!.setAttribute('opacity', String(v / 100));
			}
		}
	}

	/* ------------------------------------------------------------------ device state at t */
	/** the device's state, one object filled each frame (no garbage per frame) */
	private dst: DevState | null = null;
	devState(t: number): DevState {
		const d = this.B.dev;
		const st = (this.dst ??= restState(this.cfg.dir));
		st.led = d.led.at(t);
		st.bloom = d.bloom.at(t);
		st.glow = d.glow.at(t);
		st.act = d.act.at(t);
		st.lit = d.lit.at(t);
		st.lamp = d.lamp.at(t);
		st.pin = d.pin.at(t);
		const a0 = d.scrIn.at(t),
			a1 = d.scrOut.at(t);
		st.scr[0] = a0;
		st.scr[1] = a1;
		st.scrW[0] = d.scrIn.k.length ? Math.abs(a0 - d.scrIn.at(t - 0.016)) / 0.016 / 30 : 0;
		st.scrW[1] = d.scrOut.k.length ? Math.abs(a1 - d.scrOut.at(t - 0.016)) / 0.016 / 30 : 0;
		st.jaw[0] = d.jawIn.at(t);
		st.jaw[1] = d.jawOut.at(t);
		st.tp[0] = d.tpIn.at(t);
		st.tp[1] = d.tpOut.at(t);
		st.cage[0] = d.cageIn.at(t);
		st.cage[1] = d.cageOut.at(t);
		st.sweep = d.sweep.at(t);
		return st;
	}

	/* ------------------------------------------------------------------ one frame (pure function of t, the pen and the offset) */
	frame(t: number, S: Sample, c: FrameCtx) {
		if (!this.n_.ins) return;
		// only the pen moved (the tip riding a lane, a stage travelling): the lead is all that changes (the morph
		// is either not started, or open: t is the same, so is its clip unless the shell's edge must follow the viewport)
		const mt0 = this.B.morphT;
		const tm = Math.max(t, c.mt ?? t);
		const edgeLive = mt0 > 0 && tm >= mt0 && tm < this.B.tEnd;
		const G0 = this.G;
		const cellVis = G0.floor + G0.devH + 30 > (c.visTop ?? -Infinity) && G0.y0 - 40 < c.visBot + 20;
		lap0();
		this.writeBlueprint();
		lap('blueprint');
		if (t === this.lastT && tm === this.lastTm && (!this.cellStale || !cellVis)) {
			// (inside the morph the shell's bottom edge follows the viewport: the clip is all that moves with the pen)
			if (edgeLive && this.mod) this.morph(tm, c.visBot);
			this.cable(t, S, c);
			lap('lead.rest');
			return;
		}
		this.lastT = t;
		this.lastTm = tm;
		const G = this.G,
			sc = G.sc,
			D = DEV[this.cfg.dev],
			N = this.n_;
		const m = this.mod ? this.morph(tm, c.visBot) : { pX: 0, Li: 0, Ri: 0, rad: 0, open: false, L0: 0, R0: 0 };
		lap('morph');
		// the cell off screen (passed under the nav, or not up yet): only the module and the lead
		if (!cellVis) {
			this.cellStale = true;
			this.cable(t, S, c);
			lap('lead.rest');
			return;
		}
		this.cellStale = false;
		this.drawn = true;
		const st = this.devState(t);
		lap('devState');
		// ---- doors, housing, face, LED: the face splits and its halves slide apart (the inside is the module's ground), then
		// they ride the shell's edges out as it widens, fading into the rim (the device halves become the module's sides)
		const tau = this.B.morphT > 0 ? tm - this.B.morphT : -1;
		const doorP = tau > 0 ? smooth(tau / 0.16) : 0,
			doorOp = 1 - smooth((m.pX - 0.04) / 0.3),
			houseOp = tau > 0 ? 1 - smooth(tau / 0.14) : 1;
		const dOffL = (D.w / 2) * doorP + (m.L0 * m.pX) / sc,
			dOffR = (D.w / 2) * doorP + (m.R0 * m.pX) / sc;
		const dOff = Math.min(dOffL, dOffR);
		if (this.qd(Q.door, Math.round(dOffL * 100), Math.round(dOffR * 100), Math.round(doorOp * 1000), Math.round(houseOp * 1000))) {
			const hide = doorOp < 0.002;
			N.doors!.style.display = hide ? 'none' : '';
			N.housing!.style.display = houseOp < 0.002 || m.open ? 'none' : '';
			N.doors!.setAttribute('opacity', doorOp.toFixed(3));
			N.housing!.setAttribute('opacity', houseOp.toFixed(3));
			N.doorL!.setAttribute('transform', `translate(${f(-dOffL)} 0)`);
			N.doorR!.setAttribute('transform', `translate(${f(dOffR)} 0)`);
			// closed doors: one face, unclipped (no <use> clone to refresh each time the face changes)
			const split = dOff > 0.01;
			if (this.last.split !== String(split)) {
				this.last.split = String(split);
				if (split) N.doorL!.setAttribute('clip-path', `url(#dl${this.n})`);
				else N.doorL!.removeAttribute('clip-path');
				N.doorR!.style.display = split ? '' : 'none';
				// the right door's copy is drawn only while the doors are apart
				if (split) this.last.face = '';
			}
		}
		if (doorOp >= 0.002) {
			// re-drawn only when something visible changes (1/100 steps of light are below a pixel)
			const ch = this.qd(Q.face, Math.round(st.act * 1000), Math.round(st.lit * 100), Math.round(st.lamp * 100), Math.round(st.pin * 100), Math.round(st.glow * 100), Math.round(st.bloom * 100), Math.round((st.sweep ?? 0) * 200));
			if (ch || this.last.face !== 'drawn') {
				this.last.face = 'drawn';
				const fm = faceRaw(this.cfg.dev, st);
				this.P!.face.write(fm);
				// (the right door's copy: drawn once with the first face, hidden, so that the split only updates it)
				if (this.last.split === 'true' || this.P!.faceR.empty) this.P!.faceR.write(fm);
			}
		}
		lap('doors+face');
		// the terminals on the tab (screw heads, cage actuators, socket flashes, the toggle): they stay after the morph
		if (this.qd(Q.ports, Math.round(st.scr[0] * 100), Math.round(st.scr[1] * 100), Math.round(st.scrW[0] * 10), Math.round(st.scrW[1] * 10), Math.round(st.cage[0] * 1000), Math.round(st.cage[1] * 1000), Math.round(st.tp[0] * 100), Math.round(st.tp[1] * 100), Math.round(st.act * 1000))) {
			this.P!.ports.write(portPartsLive(this.cfg.dev, st));
		}
		if (this.qd(Q.led, Math.round(st.led * 100), Math.round(st.bloom * 100), Math.round(st.glow * 100))) {
			this.P!.led.write(tabLedLive(this.cfg.dev, st));
		}
		// a status LED on the device's face (y > 0: -X1, -K1, -A2, -Q1) belongs to the face: it leaves with the doors, so it
		// never stays behind over the opened module's text (else -Q1's LED sits on the Team copy after the morph)
		if (D.led[1] > 0) {
			const lo = doorOp.toFixed(3);
			if (this.last.ledOp !== lo) {
				this.last.ledOp = lo;
				N.led!.setAttribute('opacity', lo);
				N.led!.style.display = doorOp < 0.002 ? 'none' : '';
			}
		}
		lap('ports+led');
		// ---- seat recoil: the push of the conductor nudges the device housing (spring recoil, ≈1.5 units)
		const seatT = this.B.cable.seatT;
		const rk = seatT != null && t > seatT && t < seatT + 0.6 ? kick(t - seatT, SPRINGS.recoil, 38 * 1.2) * sc : 0;
		const rv = Math.abs(rk) > 0.02 ? `translateY(${f(rk)}px)` : '';
		if (this.last.recoil !== rv) {
			this.last.recoil = rv;
			this.devSvg.style.transform = rv;
		}
		// ---- jaws in the mouths (over the copper)
		const [inXd, outXd] = (this.mouthsXd ??= mouths(this.cfg.dev, this.cfg.dir));
		if (this.qd(Q.jaws, Math.round(st.jaw[0] * 1000), Math.round(st.jaw[1] * 1000))) {
			const cuw = G.T.cuw / sc;
			this.P!.jaws.write(jawsRaw(inXd, st.jaw[0], cuw) + (this.cfg.finale ? '' : jawsRaw(outXd, st.jaw[1], cuw)));
		}
		// ---- edge charge: copper along the module's top edge, out from the tab with the unfolding edges
		const mt = this.B.morphT;
		let env = 0;
		if (mt > 0 && tm >= mt + StageView.MX0) {
			const dt = tm - mt - StageView.MX0;
			env = smooth(dt / 0.06) * Math.exp(-Math.max(0, dt - 0.2) / 0.22);
		}
		const ek = env > 0.01 ? `${env.toFixed(3)}|${f(m.Li)}|${f(m.Ri)}` : '0';
		if (this.last.edge !== ek) {
			this.last.edge = ek;
			const yE = G.floor + 0.75,
				tw = 20 * sc;
			const xl = this.modX + m.Li + m.rad,
				xr = this.modX + this.modW - m.Ri - m.rad;
			const [a, b] = N.edge!;
			if (env > 0.01) {
				for (const [ln, x1, x2] of [
					[a, G.cx - tw, Math.min(G.cx - tw, xl)],
					[b, G.cx + tw, Math.max(G.cx + tw, xr)],
				] as [SVGLineElement, number, number][]) {
					ln.setAttribute('x1', f(x1) + '');
					ln.setAttribute('x2', f(x2) + '');
					ln.setAttribute('y1', f(yE) + '');
					ln.setAttribute('y2', f(yE) + '');
					ln.setAttribute('opacity', env.toFixed(3));
				}
			} else for (const ln of [a, b]) ln.setAttribute('opacity', '0');
		}
		lap('recoil+jaws+edge');
		// ---- the lead
		this.cable(t, S, c);
		this.markerAt(t, S);
		lap('lead.rest');
		// ---- effects
		this.fxAt(t);
		lap('fx');
		// ---- the props (their arm-bound parts follow the drawn, flexed arms)
		if (this.propsP) this.propsP.write(propsMarkup(this.B.props, t, (S.rig as ArmView) ?? null));
		lap('props');
		// ---- robots (mounted now if idle time has not done it yet)
		if (!this.rigView && S.rig) this.ensureRig();
		if (this.rigView && S.rig) {
			const r0 = PROF ? performance.now() : 0;
			this.rigView.frame(t, S.rig);
			lap('robots');
			this.visionAt(t, S);
			lap('vision');
			if (PROF) this.rigMs += performance.now() - r0;
		}
	}

	/* ------------------------------------------------------------------ the test lead */
	private outRoute() {
		if (this.outR) return this.outR;
		const G = this.G,
			T = G.T;
		const r = new Route(
			[
				{ x: G.outX, y: G.mouthY + G.CU + 6 * G.sc },
				{ x: G.outX, y: G.ductCy },
				{ x: G.exitX, y: G.ductCy },
				{ x: G.exitX, y: this.stageH },
			],
			[0, T.jr, T.jr, 0],
			[Infinity, G.chan, G.chan],
		);
		this.outR = { r, s0: r.sAtY(G.mouthY), sFloor: r.sAtY(G.floor, r.len * 0.5), sDown: r.segs[r.segs.length - 1].s0 };
		return this.outR;
	}
	private set(list: SVGPathElement[] | undefined, attr: string, v: string, key: string) {
		if (!list || this.last[key] === v) return;
		this.last[key] = v;
		for (const p of list) p.setAttribute(attr, v);
	}
	private cable(t: number, S: Sample, c: FrameCtx) {
		if (!PROF) return this.cableLead(t, S, c);
		const c0 = performance.now();
		this.cableLead(t, S, c);
		this.cableMs += performance.now() - c0;
	}
	/** the in-lead and the out-lead as last drawn, and what they were drawn from (a frame where only the pen
	 * moved, or only the other lead changed, builds no path string) */
	private inMemo = { t: NaN, sF: NaN, top: NaN, rv: -1, path: '', cu: '', leadLen: 0 };
	private outMemo = { t: NaN, sP: NaN, w: NaN, pen: false, rv: -1, path: '', cu: '' };
	private cableLead(t: number, S: Sample, c: FrameCtx) {
		const B = this.B,
			G = this.G,
			T = G.T,
			a = B.cable.arrive,
			N = this.n_;
		if (!a) return;
		const r0 = a.route.at(0);
		const sCorner = a.route.segs[0].len;
		let sPen = -1e9;
		if (c.pen > -1e8) sPen = c.pen <= r0.y ? c.pen - r0.y : Math.min(sCorner, c.pen - r0.y);
		const sCar = t > 0 ? S.front : -1e9;
		const sFront = Math.max(sPen, sCar);
		const M = this.inMemo;
		const RX = this.rx.in;
		const rv = RX ? RX.version : -1;
		// the in-lead is a function of the program time (the sample), the front and the stage's top; laid, of the front and
		// the top only (the laid curve is one object); settling, of the settling's own state too
		const same = M.sF === sFront && M.top === c.top && M.rv === rv && (M.t === t || (S.ropeOn && !!S.laid && S.laid === this.laidRef));
		if (!same) {
			M.t = t;
			M.sF = sFront;
			M.top = c.top;
			M.rv = rv;
			let path = '',
				cu = '';
			let leadLen = 0;
			if (sFront <= -1e8) {
				// the tip has not reached this stage yet
			} else if (sFront < 0) {
				const yT = r0.y + sFront;
				if (yT > c.top + 0.5) {
					path = `M${fs(r0.x)} ${fs(c.top)}L${fs(r0.x)} ${fs(Math.max(c.top, yT - G.CU))}`;
					cu = `M${fs(r0.x)} ${fs(Math.max(c.top, yT - G.CU))}L${fs(r0.x)} ${fs(yT)}`;
				}
			} else if (!S.ropeOn) {
				path = `M${fs(r0.x)} ${fs(c.top)}L${fs(r0.x)} ${fs(r0.y)}` + a.route.d(0, Math.max(0, sFront - G.CU)).replace('M', 'L');
				cu = a.route.d(Math.max(0, sFront - G.CU), sFront);
			} else {
				let flat: ArrayLike<number> | null = null;
				let nn = 0;
				let laidD: string | null = null;
				if (S.laid) {
					if (this.laidRef !== S.laid) {
						this.laidRef = S.laid;
						this.laidFlat = new Float64Array(S.laid.pts.length * 2);
						S.laid.pts.forEach((p, i) => {
							this.laidFlat![2 * i] = p.x;
							this.laidFlat![2 * i + 1] = p.y;
						});
						this.laidD = crPath(this.laidFlat, S.laid.pts.length, 'L');
					}
					flat = this.laidFlat;
					nn = S.laid.pts.length;
					laidD = this.laidD;
				} else if (S.pts) {
					flat = RX ? RX.pts(S.pts) : S.pts;
					nn = S.n;
				}
				if (flat && nn > 1) {
					// the laid part up to the grip start is the same every frame: cached
					if (this.leadHead?.top !== c.top) this.leadHead = { top: c.top, d: `M${fs(r0.x)} ${fs(c.top)}L${fs(r0.x)} ${fs(r0.y)}` + a.route.d(0, a.sA).replace('M', 'L') };
					path = this.leadHead.d + (laidD ?? crPath(flat, nn, 'L'));
					const ex = flat[2 * nn - 2],
						ey = flat[2 * nn - 1],
						px = flat[2 * nn - 4],
						py = flat[2 * nn - 3];
					const l = Math.hypot(ex - px, ey - py) || 1;
					cu = `M${fs(ex)} ${fs(ey)}L${fs(ex + ((ex - px) / l) * G.CU)} ${fs(ey + ((ey - py) / l) * G.CU)}`;
					leadLen = r0.y - c.top + a.sA + (S.laid ? S.laid.len : S.L);
				}
			}
			M.path = path;
			M.cu = cu;
			M.leadLen = leadLen;
		}
		const path = M.path,
			leadLen = M.leadLen;
		lap(same ? 'lead.in.memo' : 'lead.in.build');
		this.set(N.ins, 'd', path, 'ins');
		this.set(N.cu, 'd', M.cu, 'cu');
		lap('lead.in.set');
		// test-current pulses down the lead into the terminal
		let pulse = false;
		for (const e of B.fx) {
			if (e.k !== 'pulse' || !path || !leadLen) continue;
			const dp = (t - e.t) / (e.d ?? 0.22);
			if (dp <= 0 || dp >= 1) continue;
			const span = G.sc < 1 ? 260 : 480,
				len = G.sc < 1 ? 26 : 44;
			const total = leadLen + G.CU * 0.5;
			const pos = e.back ? total + len * 0.3 - (total + len) * dp : total - span + span * smooth(dp) + len * 0.3;
			this.set(N.pg, 'd', path, 'pgd');
			this.set(N.pc, 'd', path, 'pcd');
			this.set(N.pg, 'stroke-dasharray', `${f(len * 1.4)} 100000`, 'pga');
			this.set(N.pg, 'stroke-dashoffset', `${f(-(pos - len * 1.2))}`, 'pgo');
			this.set(N.pc, 'stroke-dasharray', `${len} 100000`, 'pca');
			this.set(N.pc, 'stroke-dashoffset', `${f(-(pos - len))}`, 'pco');
			pulse = true;
		}
		if (!pulse) {
			this.set(N.pg, 'stroke-dasharray', '0 100000', 'pga');
			this.set(N.pc, 'stroke-dasharray', '0 100000', 'pca');
		}
		// out-lead: presented by the out-mouth and carried up by the gripper arm (a rope: S.opts), let go into the
		// duct slot; from there the laid route out of the out-mouth, up the duct, across, down the exit lane. Its tip is the
		// max of the program carrot (program time) and the pen (scroll): monotone in scroll, continuous
		lap('lead.pulse');
		const OL = B.outLead;
		const held = !!(S.opts && OL && t >= OL.t0);
		if (!(held || (B.out && t >= B.out.t))) {
			this.set(N.oIns, 'd', '', 'oins');
			this.set(N.oCu, 'd', '', 'ocu');
			return;
		}
		const O = this.outRoute();
		// what the out-lead is drawn from besides the program time: the pen's arc length down the exit lane, its blend weight
		const sP = c.pen > G.ductCy + T.jr ? O.r.sAtY(Math.min(c.pen, this.stageH), O.sDown - 1) : -1;
		const w = this.tr.latched || t >= this.tr.tEnd ? 1 : smooth((t - this.outDone) / Math.max(0.05, this.tr.tEnd - this.outDone));
		const Mo = this.outMemo;
		const penOut = c.pen >= this.stageH;
		// (the pen counts only once the carrot has laid the lead to the bench: w > 0)
		const sPk = w > 0 ? sP : -1;
		const RO = this.rx.out;
		const orv = RO ? RO.version : -1;
		if (Mo.t !== t || Mo.sP !== sPk || Mo.w !== w || Mo.pen !== penOut || Mo.rv !== orv) {
			Mo.t = t;
			Mo.sP = sPk;
			Mo.rv = orv;
			Mo.w = w;
			let oPath = '',
				oCu = '';
			const mouthCu = `M${fs(G.outX)} ${fs(G.mouthY - 0.5)}L${fs(G.outX)} ${fs(G.mouthY + 6 * G.sc)}`;
			let ropeD = '',
				topY = 0;
			if (held) {
				const p = RO ? RO.pts(S.opts) : S.opts!,
					nn = p.length / 2;
				ropeD = crPath(p, nn);
				topY = p[2 * nn - 1];
				if (t < OL!.tR) {
					// held: the copper stub over the jaws, along the wire's end
					const ex = p[2 * nn - 2],
						ey = p[2 * nn - 1],
						px = p[2 * nn - 4],
						py = p[2 * nn - 3];
					const l = Math.hypot(ex - px, ey - py) || 1;
					oPath = ropeD;
					oCu = `M${fs(ex)} ${fs(ey)}L${fs(ex + ((ex - px) / l) * G.CU)} ${fs(ey + ((ey - py) / l) * G.CU)}` + mouthCu;
				}
			}
			if (!held || t >= OL!.tR) {
				const sC = O.s0 + S.outFront;
				// the pen takes over once the carrot has laid the lead to the bench level: blended in over the rest of the
				// program (the travelling stage puts the pen anywhere below the bench by then), so the tip runs on down
				// the exit lane instead of popping there; monotone in scroll, continuous, = max(carrot, pen) from tEnd
				const sEnd = O.s0 + B.out!.D;
				let sT = sC + w * Math.max(0, sP - sEnd);
				if (penOut && w >= 1) sT = O.r.len + G.CU;
				const ie = Math.min(O.r.len, sT - G.CU);
				if (held) {
					// the span from the mouth to the slot is still the rope (being drawn straight); the rest is the laid route
					const s1 = Math.max(O.s0, O.r.sAtY(Math.min(G.mouthY, topY)));
					oPath = ropeD + (ie > s1 ? O.r.d(s1, ie).replace('M', 'L') : '');
				} else oPath = O.r.d(0, Math.max(0, ie));
				oCu = (sT <= O.r.len ? O.r.d(Math.max(0, ie), sT) : '') + mouthCu;
			}
			Mo.path = oPath;
			Mo.cu = oCu;
			Mo.pen = penOut;
		}
		lap('lead.out.build');
		this.set(N.oIns, 'd', Mo.path, 'oins');
		this.set(N.oCu, 'd', Mo.cu, 'ocu');
	}

	/* ------------------------------------------------------------------ effects (seat ring, sparks, probe touch…) */
	private lastFx = NaN;
	/** each effect's window [from, to) (program time): outside every one, with nothing shown, there is nothing to draw */
	private fxSpans: [number, number][] = [];
	private fxAt(t: number) {
		const P = this.fxPool;
		if (!P || t === this.lastFx) return;
		this.lastFx = t;
		if (!P.count) {
			let any = false;
			for (const [a, b] of this.fxSpans) if (t >= a && t < b) any = true;
			if (!any) return;
		}
		P.begin();
		const F = this.B.fx;
		for (let i = 0; i < F.length; i++) this.fxEvent(P, i, F[i], t);
		P.end();
	}
	/** a copper glow (paint.ts glowMarkup: four discs in a group with the glow's opacity) as pool nodes */
	private glowPut(P: Pool, key: string, cx: string, cy: string, r: number, op: string) {
		P.put(key, 'g', { opacity: op });
		GLOW.forEach(([k, a], j) => P.put(key + j, 'circle', { class: 'glow', cx, cy, r: String(+(r * k).toFixed(2)), fill: PAL.cuLight, 'fill-opacity': a, stroke: 'none' }, undefined, key));
	}
	/** effect i at t: the shapes it shows (the same shapes and paint as its markup had) */
	private fxEvent(P: Pool, i: number, e: Compiled['fx'][number], t: number) {
		const sc = this.G.sc;
		const k = 'f' + i + ':';
		const dt = t - e.t;
		if (e.k === 'ring' && dt >= 0 && dt < 0.3) {
			const q = prog(dt, SPRINGS.ring);
			P.put(k + 'r', 'circle', { cx: fs(e.x!), cy: fs(e.y!), r: fs((4 + (e.small ? 8 : 16) * q) * sc), fill: 'none', stroke: e.small ? (this.dark ? COL.toolDark : COL.tool) : COL.cul, 'stroke-width': e.small ? 1 : 1.5, opacity: fs((e.small ? 0.6 : 0.9) * (1 - q)) });
			// a seat's soft copper glow at the mouth (the vignettes have no sparks: the site's one spark is the visitor's)
			if (!e.small && !this.cfg.finale) this.glowPut(P, k + 'g', fs(e.x!), fs(e.y!), 7 * sc, fs(0.85 * (1 - smooth(dt / 0.3))));
		}
		if (e.k === 'touch' && !this.cfg.finale && dt >= 0 && dt < 0.3) {
			// a probe bottoming (the +C4 vignette): a ring and a glow at the tip, no sparks
			const q = prog(dt, SPRINGS.ring);
			P.put(k + 'r', 'circle', { cx: fs(e.x!), cy: fs(e.y!), r: fs((3 + 9 * q) * sc), fill: 'none', stroke: COL.cul, 'stroke-width': 1.25, opacity: fs(0.85 * (1 - q)) });
			this.glowPut(P, k + 'g', fs(e.x!), fs(e.y!), 7 * sc, fs(0.9 * (1 - smooth(dt / 0.3))));
		} else if ((e.k === 'sparks' || e.k === 'touch') && dt >= 0 && dt < 0.18) {
			const rnd = lcg(e.seed || 3);
			const p = smooth(dt / 0.18);
			const nS = e.k === 'touch' ? 4 : 5,
				k0 = e.k === 'touch' ? 0.65 : 1;
			for (let j = 0; j < nS; j++) {
				const ang = ((-165 + j * (150 / (nS - 1)) + (rnd() - 0.5) * 14) * Math.PI) / 180,
					r1 = (4 + 14 * p) * sc * k0,
					r2 = (8 + 22 * p + rnd() * 4) * sc * k0;
				P.put(k + 's' + j, 'line', { x1: fs(e.x! + Math.cos(ang) * r1), y1: fs(e.y! + Math.sin(ang) * r1), x2: fs(e.x! + Math.cos(ang) * r2), y2: fs(e.y! + Math.sin(ang) * r2), stroke: COL.cul, 'stroke-width': 1.5, 'stroke-linecap': 'round', opacity: fs(1 - p) });
			}
			if (e.k === 'touch') this.glowPut(P, k + 'g', fs(e.x!), fs(e.y!), 7 * sc, fs(0.9 * (1 - p)));
		}
		if (e.k === 'brackets' && dt >= 0 && (e.t1 == null || t < e.t1 + 0.2)) {
			const q = prog(dt, SPRINGS.actuate);
			const out = e.t1 != null && t > e.t1 ? clamp01((t - e.t1) / 0.2) : 0;
			const sz = (e.r ?? 8) * (1.3 - 0.3 * q),
				c = 5 * sc;
			const op = Math.min(1, dt / 0.06) * (1 - out);
			const x0 = e.x! - sz,
				x1 = e.x! + sz,
				y0 = e.y! - sz,
				y1 = e.y! + sz;
			P.put(k + 'b', 'path', { d: `M${fs(x0)} ${fs(y0 + c)}V${fs(y0)}H${fs(x0 + c)} M${fs(x1 - c)} ${fs(y0)}H${fs(x1)}V${fs(y0 + c)} M${fs(x1)} ${fs(y1 - c)}V${fs(y1)}H${fs(x1 - c)} M${fs(x0 + c)} ${fs(y1)}H${fs(x0)}V${fs(y1 - c)}`, fill: 'none', stroke: this.dark ? COL.detDark : COL.det, 'stroke-width': 1.5, opacity: fs(op) });
		}
		if (e.k === 'ghost' && dt >= 0 && t < e.t1! + 0.15) {
			// the taught point: a dashed mouth where the program believes the terminal is (no label)
			const op = Math.min(1, dt / 0.15) * (1 - clamp01((t - e.t1!) / 0.15));
			const mw = 8 * sc,
				md = 7 * sc,
				col = this.dark ? COL.toolDark : COL.tool;
			P.put(k + 'm', 'rect', { x: fs(e.x! - mw / 2), y: fs(e.y!), width: fs(mw), height: fs(md), rx: '1.5', fill: 'none', stroke: col, 'stroke-width': 1, 'stroke-dasharray': '2 2', opacity: fs(op * 0.9) });
		}
		if (e.k === 'ghostScrew' && dt >= 0 && t < e.t1! + 0.15) {
			// the taught point (the +C1 vignette): a dashed screw head and pocket where the program was taught
			const op = Math.min(1, dt / 0.12) * (1 - clamp01((t - e.t1!) / 0.15));
			const col = this.dark ? COL.toolDark : COL.tool;
			// (literal paint on every shape, never inherited from the group)
			const pt = { fill: 'none', stroke: col, 'stroke-width': '1.25', 'stroke-dasharray': '2.5 2' };
			// (a teach-pendant waypoint of its own, clear of the real screw: a dashed head no wider than the bare
			// tab it lands on, the approach line from above, a small target ring on it; nothing shared with the real screw)
			const ring = { fill: 'none', stroke: col, 'stroke-width': '1.25', 'stroke-dasharray': '1.5 2' };
			const g = k + 'g';
			P.put(g, 'g', { opacity: fs(op * 0.95) });
			P.put(g + 0, 'rect', { x: fs(e.x! - 2.5 * sc), y: fs(e.y! - 0.2 * sc), width: fs(5 * sc), height: fs(2.6 * sc), rx: fs(0.7 * sc), ...pt }, undefined, g);
			P.put(g + 1, 'line', { x1: fs(e.x! - 1.4 * sc), y1: fs(e.y! + 1.1 * sc), x2: fs(e.x! + 1.4 * sc), y2: fs(e.y! + 1.1 * sc), ...pt }, undefined, g);
			P.put(g + 2, 'line', { x1: fs(e.x!), y1: fs(e.y! - 12 * sc), x2: fs(e.x!), y2: fs(e.y! - 1.2 * sc), ...pt }, undefined, g);
			P.put(g + 3, 'circle', { cx: fs(e.x!), cy: fs(e.y! - 5 * sc), r: fs(2.2 * sc), ...ring }, undefined, g);
		}
		if (e.k === 'continuity' && dt >= 0 && t < e.t1! + 0.24 && this.B.x4) {
			// the continuity test (the +C4 vignette): the conductor between the two needles lights up inside its insulation, once.
			// The insulation stays blue (no copper wash over it: copper at 35 % on the blue read as a muddy brown
			// while it faded); the core is lit copper and a soft halo hugs the cable's two edges outside it; at the end the
			// core narrows back into the conductor (the showpiece's test current does the same) and the halo fades
			const on = smooth(dt / 0.06),
				off = smooth((t - e.t1!) / 0.24);
			const yA = this.G.floor + this.B.x4.sy * sc,
				yB = this.G.mouthY + 2 * sc,
				x = this.G.inX,
				cw = this.G.T.cable,
				hw = Math.max(1.5, cw * 0.32);
			const ln = (key: string, dx: number, w: number, col: string, op: number) =>
				P.put(key, 'line', { x1: fs(x + dx), y1: fs(yA), x2: fs(x + dx), y2: fs(yB), fill: 'none', stroke: col, 'stroke-width': fs(w), 'stroke-linecap': 'butt', opacity: fs(op) });
			const halo = 0.42 * on * (1 - off);
			if (halo > 0.004) {
				ln(k + 'h0', -(cw + hw) / 2, hw, COL.cul, halo);
				ln(k + 'h1', (cw + hw) / 2, hw, COL.cul, halo);
			}
			const core = this.G.T.cuw * on * (1 - off);
			if (core > 0.05) ln(k + 'c', 0, core, COL.cul, 1);
		}
		if (e.k === 'plan' && dt >= 0 && t < e.t1! + 0.25 && e.pts) {
			// the planned tool path draws itself (dashed), then fades
			const pr = smooth(dt / (e.d ?? 0.42)),
				op = 1 - clamp01((t - e.t1!) / 0.25);
			let L = 0;
			for (let j = 1; j < e.pts.length; j++) L += Math.hypot(e.pts[j].x - e.pts[j - 1].x, e.pts[j].y - e.pts[j - 1].y);
			let left = L * pr,
				d = `M${fs(e.pts[0].x)} ${fs(e.pts[0].y)}`;
			for (let j = 1; j < e.pts.length && left > 0; j++) {
				const a = e.pts[j - 1],
					b = e.pts[j],
					l = Math.hypot(b.x - a.x, b.y - a.y) || 1,
					u = Math.min(1, left / l);
				d += `L${fs(a.x + (b.x - a.x) * u)} ${fs(a.y + (b.y - a.y) * u)}`;
				left -= l;
			}
			const det = this.dark ? COL.detDark : COL.det,
				dash = fs(3 * Math.max(1, sc * 0.8));
			P.put(k + 'p', 'path', { d, fill: 'none', stroke: det, 'stroke-width': 1.5, 'stroke-dasharray': `${dash} ${dash}`, 'stroke-linejoin': 'round', opacity: fs(0.85 * op) });
			if (pr >= 1) {
				const end = e.pts[e.pts.length - 1];
				P.put(k + 'e', 'circle', { cx: fs(end.x), cy: fs(end.y), r: fs(2.5 * sc), fill: 'none', stroke: det, 'stroke-width': 1.5, opacity: fs(0.85 * op) });
			}
		}
		if (e.k === 'miss' && dt >= 0 && dt < (e.d ?? 0.5)) {
			const op = Math.min(1, dt / 0.05) * (1 - clamp01((dt - (e.d ?? 0.5) + 0.25) / 0.25));
			// (larger and darker, it reads at 1× on a phone)
			const r = 5.5 * sc;
			// a steel ✕ (a protective stop, not an alarm: nothing broke, the program was wrong)
			const ln = { stroke: this.dark ? '#9AA6B5' : '#172A44', 'stroke-width': sc < 1.2 ? '2' : '2.5', 'stroke-linecap': 'round', fill: 'none' };
			const g = k + 'x';
			P.put(g, 'g', { opacity: fs(op) });
			P.put(g + 0, 'line', { x1: fs(e.x! - r), y1: fs(e.y! - r), x2: fs(e.x! + r), y2: fs(e.y! + r), ...ln }, undefined, g);
			P.put(g + 1, 'line', { x1: fs(e.x! + r), y1: fs(e.y! - r), x2: fs(e.x! - r), y2: fs(e.y! + r), ...ln }, undefined, g);
		}
	}
}
