/**
 * The robots build the form (client note 17, finale/SHOWPIECE-V2.md §1–§5). The page's side of the showpiece:
 *
 *   slots    when Contact comes into view the form is not built yet: every box is a faint dashed outline, one dashed wire
 *            runs from the cell's duct to every box's terminal (the mounting plate). It comes on with the cell's work light
 *   pulse    each job's hit sends a pulse: a carta core in a copper glow with a short trail, from the work the robot just did,
 *            up the wire it worked on into the duct, out of the cell and along the form's wire to the next box's terminal
 *   outline  two heads leave the terminal and run round the box; they meet on the far side
 *   power    the box powers up (CSS, opacity and transforms only: no layout shift): fill, rule, label, placeholder, a caret
 *            blinking twice, the select's chevron flipping like a lever, the checkbox snapping in, Send filling copper; an
 *            LED blooms at the terminal and rests as a dot; the wire behind the pulse is laid (a calm solid line)
 *
 * Everything is a pure function of the film time (and of what the visitor did: forced parts), so the clock that moves the
 * robots moves the form, and STOP, the fermata, a hidden tab or a seek hold it in the same frame. Usability first: the real
 * form is in the DOM from the start; a part with content or focus is never unbuilt; the first intent builds everything
 * (complete(), ≈ 300 ms, no pulses afterwards). Without JS, and with reduced motion, nothing here unbuilds anything.
 *
 * One SVG overlay over the card (pointer-events none, never in the layout), persistent nodes written by attribute.
 */
import { Route, f } from '../core';
import type { Pt } from '../robot/kin';
import type { Part, PartId } from './program';
import { DUCT, VB } from './scene';
import type { Compiled } from './state';
import { dropA, dropB } from './wire';
import { flexAt } from './program';

const SVGNS = 'http://www.w3.org/2000/svg';
/** the pulse's mean speed (px/s) and its time bounds (an eye can follow it across the card: sine in-out, peak ≈ 1.6× the
 * mean); the outline's draw; the drawn outline's fade into the box's own edge; the energise wipe across the box */
const SPEED = 1150,
	T_MIN = 0.42,
	T_MAX = 0.85,
	DRAW = 0.3,
	FADE = 0.5,
	WIPE = 0.34,
	WIPE_FADE = 0.36;
/** the instant build (an intent): one light runs down the form's wire and every box snaps in as it passes (s) */
const SNAP = 0.3;
/** RESET: the current drains bottom to top, the laid wire retracting with it, a part powering down as it passes (s) */
const DRAIN0 = 0.06,
	DRAIN_STEP = 0.075;
const COL = { paper: '#F4F1EC', mist: '#E2E6EB', cu: '#C9632C', cul: '#EC8A52' };
const yD = (DUCT.y0 + DUCT.y1) / 2;

interface PartEl extends Part {
	el: HTMLElement;
	box: HTMLElement;
	/** card px: the box, its terminal, the pulse's whole route (scene part + the form's wire + the tap) */
	r: { x0: number; y0: number; x1: number; y1: number };
	term: Pt;
	route: Route | null;
	/** the pulse's duration on this layout */
	T: number;
	/** the outline's two halves from the terminal */
	halfA: string;
	halfB: string;
	half: number;
	/** where the tap leaves the trunk (arc length along the trunk) */
	sBranch: number;
	tap: Pt[];
	/** the side its terminal is on (the energise wipe runs from it) */
	side: 'l' | 'r' | 't';
	/** live nodes */
	n: {
		tail: SVGPathElement;
		trail: SVGPathElement;
		glow: SVGPathElement;
		head: SVGGElement;
		spark: SVGCircleElement;
		oa: SVGPathElement;
		ob: SVGPathElement;
		wipe: SVGRectElement;
		front: SVGRectElement;
		bloom: SVGCircleElement;
		dot: SVGCircleElement;
	};
	/** written state: 0 slot, 1 outline being drawn, 2 built */
	b: number;
	/** nothing of its pulse is on screen (the frame skips it until one of its windows opens) */
	idle: boolean;
	last: Record<string, string>;
	/** what each node was last written (put) */
	lastN: Partial<Record<string, Record<string, string>>>;
}

export type Mode = 'center' | 'left' | 'right';

export class FormBuild {
	parts: PartEl[] = [];
	/** parts built whatever the film time: content or focus at a RESET, the form on screen at load, an intent */
	forced = new Set<PartId>();
	/** after an intent: no pulses until a RESET (the visitor is using the form) */
	quiet = false;
	/** reduced motion / no build: every part built, the wiring calm, no pulses */
	still = false;
	mode: Mode = 'center';
	private trunk: Route | null = null;
	private dashed: SVGPathElement;
	private laid: SVGPathElement;
	private flash: SVGPathElement;
	private g: SVGGElement;
	private lastLaid = '';
	private plateOn = false;
	private measured = false;
	/** the instant build in progress: its start (ms) and the light's way down the wire */
	private snap: { t0: number; raf: number } | null = null;
	/** the last frame's arguments (the snap redraws between film frames) */
	private lastArgs: [number, boolean, number, number] = [0, false, 1, 0];
	/** RESET: the parts built when it was pressed, each with the reset time it powers down at */
	private drain = new Map<PartId, number>();
	/** no animation for the instant build (capture mode, reduced motion): everything at once */
	snapInstant = false;
	/** the breaker ON (client note 17, v2b): it builds no part, it powers what is built. A surge leaves the toggle's clamp, runs
	 * up drop A, out of the cell and down the laid harness to the last part built; every terminal blinks as it passes */
	private surge: {
		t: number;
		route: Route | null;
		T: number;
		/** each part built by then: the surge's time fraction at its tap */
		at: Map<PartId, number>;
		n: { tail: SVGPathElement; glow: SVGPathElement; trail: SVGPathElement; head: SVGGElement };
		last: Record<string, string>;
	} | null = null;
	constructor(
		private card: HTMLElement,
		private form: HTMLFormElement,
		private stage: HTMLElement,
		private sceneSvg: SVGSVGElement,
		private svg: SVGSVGElement,
		private C: Compiled,
	) {
		svg.textContent = '';
		const mk = <K extends keyof SVGElementTagNameMap>(tag: K, a: Record<string, string | number>, parent: Element = svg) => {
			const e = document.createElementNS(SVGNS, tag) as SVGElementTagNameMap[K];
			for (const k in a) e.setAttribute(k, String(a[k]));
			parent.appendChild(e);
			return e;
		};
		// the form's wire: dashed where nothing is built yet, laid (solid, calm) up to the last part built
		this.dashed = mk('path', { d: 'M0 0', fill: 'none', stroke: COL.mist, 'stroke-opacity': 0.34, 'stroke-width': 1, 'stroke-dasharray': '3 4', 'stroke-linejoin': 'round', 'data-wire': 'dashed' });
		// (opaque: carta at 45 % over the card's blue, so it covers the dashes under it; the wire only ever runs on the blue)
		this.laid = mk('path', { d: 'M0 0', fill: 'none', stroke: '#7A8CAB', 'stroke-width': 1.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'data-wire': 'laid' });
		// the instant build's one quick light down the wire (complete(): its segment and opacity written per frame)
		this.flash = mk('path', { d: 'M0 0', fill: 'none', stroke: COL.cul, 'stroke-width': 2.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: 0, 'data-wire': 'flash' });
		this.g = mk('g', {});
		const tOn = C.S.hits.find((h) => h.k === 'on')?.t;
		if (tOn != null) {
			const g = mk('g', { 'data-pulse': 'surge' }, this.g);
			const n = {
				tail: mk('path', { d: 'M0 0', fill: 'none', stroke: COL.cul, 'stroke-opacity': 0.4, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', visibility: 'hidden' }, g),
				glow: mk('path', { d: 'M0 0', fill: 'none', stroke: COL.cul, 'stroke-opacity': 0.2, 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', visibility: 'hidden' }, g),
				trail: mk('path', { d: 'M0 0', fill: 'none', stroke: COL.cul, 'stroke-opacity': 0.95, 'stroke-width': 2.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', visibility: 'hidden' }, g),
				head: mk('g', { visibility: 'hidden' }, g),
			};
			mk('circle', { r: 11, fill: COL.cul, 'fill-opacity': 0.12, stroke: 'none' }, n.head);
			mk('circle', { r: 8, fill: COL.cul, 'fill-opacity': 0.3, stroke: 'none' }, n.head);
			mk('circle', { r: 4.4, fill: COL.cul, 'fill-opacity': 0.85, stroke: 'none' }, n.head);
			mk('circle', { r: 2.4, fill: COL.paper, stroke: 'none' }, n.head);
			this.surge = { t: tOn, route: null, T: 0.6, at: new Map(), n, last: {} };
		}
		for (const p of C.parts) {
			const el = form.querySelector<HTMLElement>(`[data-part="${p.id}"]`);
			const box = el?.querySelector<HTMLElement>('[data-box]');
			if (!el || !box) continue;
			const g = mk('g', { 'data-pulse': p.id }, this.g);
			const n = {
				// the energise wipe: the current fills the box from its terminal (a faint carta fill and a bright front)
				wipe: mk('rect', { x: 0, y: 0, width: 0, height: 0, fill: COL.paper, 'fill-opacity': 0, stroke: 'none', visibility: 'hidden' }, g),
				front: mk('rect', { x: 0, y: 0, width: 0, height: 0, fill: COL.paper, 'fill-opacity': 0, stroke: 'none', visibility: 'hidden' }, g),
				oa: mk('path', { d: 'M0 0', fill: 'none', stroke: COL.paper, 'stroke-width': 1.5, 'stroke-linecap': 'square', visibility: 'hidden' }, g),
				ob: mk('path', { d: 'M0 0', fill: 'none', stroke: COL.paper, 'stroke-width': 1.5, 'stroke-linecap': 'square', visibility: 'hidden' }, g),
				// the pulse: a long faint tail, a soft glow, a bright short trail, the head; a spark where the job landed
				tail: mk('path', { d: 'M0 0', fill: 'none', stroke: COL.cul, 'stroke-opacity': 0.4, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', visibility: 'hidden' }, g),
				glow: mk('path', { d: 'M0 0', fill: 'none', stroke: COL.cul, 'stroke-opacity': 0.2, 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', visibility: 'hidden' }, g),
				trail: mk('path', { d: 'M0 0', fill: 'none', stroke: COL.cul, 'stroke-opacity': 0.95, 'stroke-width': 2.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', visibility: 'hidden' }, g),
				head: mk('g', { visibility: 'hidden' }, g),
				spark: mk('circle', { r: 2, fill: COL.cul, 'fill-opacity': 0.6, stroke: 'none', visibility: 'hidden' }, g),
				bloom: mk('circle', { r: 3, fill: COL.cul, 'fill-opacity': 0.5, stroke: 'none', visibility: 'hidden' }, g),
				dot: mk('circle', { r: 2, fill: COL.paper, 'fill-opacity': 0.85, stroke: 'none', visibility: 'hidden' }, g),
			};
			mk('circle', { r: 11, fill: COL.cul, 'fill-opacity': 0.12, stroke: 'none' }, n.head);
			mk('circle', { r: 8, fill: COL.cul, 'fill-opacity': 0.3, stroke: 'none' }, n.head);
			mk('circle', { r: 4.4, fill: COL.cul, 'fill-opacity': 0.85, stroke: 'none' }, n.head);
			mk('circle', { r: 2.4, fill: COL.paper, stroke: 'none' }, n.head);
			this.parts.push({ ...p, el, box, r: { x0: 0, y0: 0, x1: 0, y1: 0 }, term: { x: 0, y: 0 }, route: null, T: T_MIN, halfA: '', halfB: '', half: 0, sBranch: 0, tap: [], side: 'r', n, b: -1, idle: false, last: {}, lastN: {} });
		}
	}

	/* ------------------------------------------------------------ layout */
	/** card px of a scene point (the stage's own viewBox mapping, whatever transforms the page applies) */
	private scenePx(m: DOMMatrix, cr: DOMRect, P: Pt): Pt {
		const q = new DOMPoint(P.x, P.y).matrixTransform(m);
		return { x: q.x - cr.left, y: q.y - cr.top - this.dy };
	}
	/** the cell's displacement below its own place while it is stuck on a tall phone (the routes are its own place's) */
	private dy = 0;
	/** the routes on the current layout (on mount and on resize; dy: the stuck cell's displacement, px) */
	measure(dy = 0) {
		this.dy = dy;
		const cr = this.card.getBoundingClientRect();
		const sr0 = this.stage.getBoundingClientRect();
		const sr = new DOMRect(sr0.x, sr0.y - dy, sr0.width, sr0.height);
		const fr = this.form.getBoundingClientRect();
		const m = this.sceneSvg.getScreenCTM();
		if (!cr.width || !sr.width || !fr.width || !m) return false;
		const rel = (r: DOMRect) => ({ x0: r.left - cr.left, y0: r.top - cr.top, x1: r.right - cr.left, y1: r.bottom - cr.top });
		const S = rel(sr),
			F = rel(fr),
			K = { x0: 0, y0: 0, x1: cr.width, y1: cr.height };
		for (const p of this.parts) p.r = rel(p.box.getBoundingClientRect());
		const by = (id: PartId) => this.parts.find((p) => p.id === id)!;
		const name = by('name'),
			company = by('company'),
			send = by('send');
		// the mode: two columns (a box beside another) → the spine in their gutter; one column → the wire beside them
		const twoCol = Math.abs(name.r.y0 - company.r.y0) < 6 && company.r.x0 > name.r.x1;
		const formRight = F.x0 > S.x1 - 4;
		this.mode = twoCol ? 'center' : formRight ? 'left' : 'right';
		// the duct's end; the wire turns up out of it at once and leaves the cell along the stage's top edge, above everything
		// the robots ever reach (QA: nothing above y −101), never across an arm
		const E = this.scenePx(m, cr, { x: DUCT.x1, y: yD });
		const Eu = this.scenePx(m, cr, { x: DUCT.x1 + 5, y: VB.y + 2.5 });
		const head = [E, { x: Eu.x, y: E.y }, Eu];
		const fieldsTop = Math.min(...this.parts.map((p) => p.el.getBoundingClientRect().top - cr.top));
		let trunk: Pt[];
		let xs: number;
		const yEnd = this.mode === 'center' ? send.r.y0 : (send.r.y0 + send.r.y1) / 2;
		if (this.mode === 'center') {
			xs = Math.round((name.r.x1 + company.r.x0) / 2);
			// review 3 (SP-10/S10): the wire never hugs a label. Beside the cell (desktops) the jog rises in the open middle of
			// the gap between the heading’s words and the form, the run crosses the card’s top padding ≥ 30 px above the first
			// labels; under the cell (tablets) the run crosses midway between the cell and the first labels
			let yTop = Math.round(fieldsTop - 12);
			let xa = formRight ? Math.round((S.x1 + F.x0) / 2) : Math.round((F.x1 + K.x1) / 2);
			if (formRight) {
				yTop = Math.round(Math.max(12, Math.min(fieldsTop - 30, fieldsTop / 2 + 4)));
				const txt = textRight(this.card, cr, yTop, Eu.y);
				if (txt != null && F.x0 - txt >= 70) xa = Math.round((txt + F.x0) / 2);
			} else if (fieldsTop - S.y1 >= 24) yTop = Math.round((S.y1 + fieldsTop) / 2);
			trunk = Math.abs(Eu.y - yTop) < 3 ? [...head, { x: xs, y: Eu.y }, { x: xs, y: yEnd }] : [...head, { x: xa, y: Eu.y }, { x: xa, y: yTop }, { x: xs, y: yTop }, { x: xs, y: yEnd }];
		} else {
			xs = this.mode === 'left' ? Math.round((S.x1 + F.x0) / 2) : Math.round((F.x1 + K.x1) / 2);
			const yFirst = Math.min(...this.parts.map((p) => (p.r.y0 + p.r.y1) / 2));
			if (Eu.y <= yFirst - 6) trunk = [...head, { x: xs, y: Eu.y }, { x: xs, y: yEnd }];
			else {
				// the exit is lower than the first box: a hairpin in the gap
				const xh = xs + (this.mode === 'left' ? -8 : 8),
					yh = yFirst - 14;
				trunk = [...head, { x: xh, y: Eu.y }, { x: xh, y: yh }, { x: xs, y: yh }, { x: xs, y: yEnd }];
			}
		}
		trunk = simplify(trunk);
		this.trunk = new Route(trunk, corners(trunk, () => true));
		const T = this.trunk;
		// each part: its terminal on the inner edge (the spine's side), its tap, its outline, its pulse's route
		for (const p of this.parts) {
			const { x0, y0, x1, y1 } = p.r;
			const ym = Math.round((y0 + y1) / 2);
			let term: Pt, tapStart: Pt;
			let side: 'l' | 'r' | 't';
			let tap: Pt[];
			if (this.mode === 'center' && p.id === 'send') {
				side = 't';
				term = { x: xs, y: y0 };
				tapStart = term;
				tap = [];
			} else {
				side = this.mode === 'center' ? ((x0 + x1) / 2 < xs ? 'r' : 'l') : this.mode === 'left' ? 'l' : 'r';
				term = { x: side === 'r' ? x1 : x0, y: ym };
				tapStart = { x: xs, y: ym };
				tap = [tapStart, term];
				// the part's own words between its box and the wire (the consent's text beside its checkbox, the wire on that
				// side): the tap never crosses them; it comes along the gap above the part and drops onto the box's top
				const er = p.el.getBoundingClientRect();
				const ex0 = er.left - cr.left,
					ex1 = er.right - cr.left,
					ey0 = er.top - cr.top;
				if ((side === 'r' && ex1 > x1 + 4) || (side === 'l' && ex0 < x0 - 4)) {
					const above = this.parts.filter((q) => q !== p && q.r.y1 <= ey0 + 1).map((q) => q.r.y1);
					const yG = Math.round(above.length ? (Math.max(...above) + ey0) / 2 : ey0 - 6);
					const xm = Math.round((x0 + x1) / 2);
					side = 't';
					term = { x: xm, y: y0 };
					tapStart = { x: xs, y: yG };
					tap = [tapStart, { x: xm, y: yG }, term];
				}
			}
			p.term = term;
			p.tap = tap;
			p.side = side;
			p.sBranch = tap.length ? branchS(T, tapStart) : T.len;
			// the outline's two halves (square corners: the inputs are square)
			const [a, b] = halves(x0, y0, x1, y1, side);
			p.halfA = a.d;
			p.halfB = b.d;
			p.half = a.len;
			// the pulse: up the wire the robot worked on (the drop at the job's hit), into the duct, out to the form's wire
			const scene = this.scenePath(m, cr, p);
			const trunkPts = trunkUpTo(T, p.sBranch);
			const all = [...scene, ...trunkPts.slice(1), ...tap.slice(1)];
			const pts = simplify(all);
			const sceneN = scene.length;
			p.route = new Route(pts, corners(pts, (i) => i >= sceneN));
			p.T = Math.max(T_MIN, Math.min(T_MAX, p.route.len / SPEED));
			p.idle = false;
			p.n.spark.setAttribute('cx', f(pts[0].x) + '');
			p.n.spark.setAttribute('cy', f(pts[0].y) + '');
			p.last = {};
			p.lastN = {};
		}
		// the breaker's surge: from −F7:2's clamp (end A) up drop A, into the duct, down the trunk to the last tap built by then
		const U = this.surge;
		if (U) {
			const before = this.parts.filter((p) => this.doneT(p) <= U.t);
			U.at.clear();
			U.route = null;
			if (before.length) {
				const sMax = Math.max(...before.map((p) => p.sBranch));
				const scene = this.scenePath(m, cr, { t: U.t, src: { k: 'A', fromEnd: 0 } } as PartEl);
				const pts = simplify([...scene, ...trunkUpTo(T, sMax).slice(1)]);
				U.route = new Route(pts, corners(pts, (i) => i >= scene.length));
				U.T = Math.max(0.55, Math.min(1.05, U.route.len / 1250));
				for (const p of before) {
					const e = Math.max(0, Math.min(1, (U.route.len - (sMax - p.sBranch)) / U.route.len));
					U.at.set(p.id, Math.acos(1 - 2 * e) / Math.PI);
				}
			}
			U.last = {};
		}
		this.dashed.setAttribute('d', this.wireD(this.parts.map((p) => p.id)));
		this.lastLaid = '';
		this.measured = true;
		return true;
	}
	/** the pulse's way in the cell (card px): from the drop's point back up to its slot, up into the duct, along it to the
	 * duct's end (the form's wire starts there) */
	private scenePath(m: DOMMatrix, cr: DOMRect, p: PartEl): Pt[] {
		const S = this.C.S;
		const J = S.L.tr.r.fk(flexAt(this.C.flex, 'L', p.t), S.L.tr.toolAt(p.t)).T;
		const drop = p.src.k === 'A' ? dropA(S, p.t, J) : dropB(S, p.t, J);
		const pts = drop.pts.slice().reverse();
		// from fromEnd units up the drop
		let s = 0,
			i = 0;
		const out: Pt[] = [];
		if (p.src.fromEnd > 0) {
			while (i < pts.length - 1) {
				const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
				if (s + d >= p.src.fromEnd) {
					const u = (p.src.fromEnd - s) / d;
					out.push({ x: pts[i].x + (pts[i + 1].x - pts[i].x) * u, y: pts[i].y + (pts[i + 1].y - pts[i].y) * u });
					i++;
					break;
				}
				s += d;
				i++;
			}
		}
		for (; i < pts.length; i++) out.push(pts[i]);
		const slot = pts[pts.length - 1];
		out.push({ x: slot.x, y: yD }, { x: DUCT.x1, y: yD });
		return out.map((P) => this.scenePx(m, cr, P));
	}
	/** the form's wire to a set of parts: the trunk to the furthest one, and each one's tap */
	private wireD(ids: PartId[]) {
		const T = this.trunk;
		if (!T || !ids.length) return 'M0 0';
		let sMax = 0;
		let d = '';
		for (const p of this.parts) {
			if (!ids.includes(p.id)) continue;
			sMax = Math.max(sMax, p.sBranch);
			if (p.tap.length > 2) {
				const R = new Route(p.tap, corners(p.tap, () => true));
				d += R.d(0, R.len);
			} else if (p.tap.length) d += `M${f(p.tap[0].x)} ${f(p.tap[0].y)}L${f(p.tap[1].x)} ${f(p.tap[1].y)}`;
		}
		return T.d(0, sMax) + d;
	}

	/* ------------------------------------------------------------ state */
	/** the film time the part is built at (its pulse arrives, its outline closes) */
	doneT(p: PartEl) {
		return p.t + p.T + DRAW;
	}
	builtAt(p: PartEl, t: number, resetting: boolean, tau = this.lastArgs[3]) {
		if (this.still || this.forced.has(p.id)) return true;
		// after an intent only what the snap has reached is built (the cell has settled to its end frame meanwhile)
		if (this.quiet) return false;
		if (resetting) {
			const d = this.drain.get(p.id);
			return d != null && tau < d;
		}
		return t >= this.doneT(p);
	}
	/** every part built (on this film time)? */
	allBuilt(t: number, resetting = false) {
		return this.parts.every((p) => this.builtAt(p, t, resetting));
	}
	/** the form's attributes: managed (data-build), its plate lit with the cell's work light */
	setManaged(on: boolean) {
		if (on) this.form.setAttribute('data-build', '');
		else this.form.removeAttribute('data-build');
	}
	setPlate(on: boolean) {
		if (on === this.plateOn) return;
		this.plateOn = on;
		if (on) this.form.setAttribute('data-plate', '');
		else this.form.removeAttribute('data-plate');
	}
	/** one frame at film time t (resetting: a RESET's branch is running at its own time tau: the current drains, bottom to
	 * top, and nothing but the forced parts stays built) */
	frame(t: number, resetting: boolean, plate: number, tau = 0) {
		this.lastArgs = [t, resetting, plate, tau];
		if (!this.measured) {
			// (no layout to draw on yet: the parts' states still follow, so an early intent builds them)
			for (const p of this.parts) if (this.builtAt(p, t, resetting, tau)) this.setB(p, 2, true);
			return;
		}
		this.setPlate(this.still || plate > 0.95);
		const built: PartId[] = [];
		for (const p of this.parts) {
			const isBuilt = this.builtAt(p, t, resetting, tau);
			if (isBuilt) built.push(p.id);
			const b = isBuilt ? 2 : !resetting && !this.quiet && t >= p.t + p.T ? 1 : 0;
			this.setB(p, b, false);
			this.drawPulse(p, t, resetting);
		}
		this.drawSurge(t, resetting);
		const key = built.join(',');
		if (key !== this.lastLaid) {
			this.lastLaid = key;
			this.laid.setAttribute('d', this.wireD(built));
		}
	}
	/** a part's state attribute (data-fb on its wrapper: absent = built, the no-JS default) */
	private setB(p: PartEl, b: number, instant: boolean) {
		if (p.b === b) return;
		const was = p.b;
		p.b = b;
		if (b === 2) {
			p.el.removeAttribute('data-fb');
			// the power-up's one-off accents (caret, lever, snap, glow): not after an intent (the visitor is typing)
			if (was === 1 && !instant && !this.quiet) {
				p.el.setAttribute('data-pw', '');
				window.setTimeout(() => p.el.removeAttribute('data-pw'), 1400);
			}
		} else p.el.setAttribute('data-fb', String(b));
	}
	private put(p: PartEl, name: keyof PartEl['n'], k: string, v: string) {
		// (per node, per attribute: no key string built per call: the frame budget)
		const L = (p.lastN[name] ??= {});
		if (L[k] === v) return;
		L[k] = v;
		p.n[name].setAttribute(k, v);
	}
	private show(p: PartEl, name: keyof PartEl['n'], on: boolean) {
		this.put(p, name, 'visibility', on ? 'visible' : 'hidden');
	}
	private drawPulse(p: PartEl, t: number, resetting: boolean) {
		const R = p.route;
		const tau = t - p.t;
		const live = !this.still && !this.quiet && !resetting;
		// the fast path (the frame budget): outside every window of this part (pulse, outline, wipe, bloom, the surge's blink)
		// with everything already hidden, only its terminal dot can change
		const busy = live && ((tau >= -0.02 && tau < p.T + 1.1) || this.surgeBlink(p, t) >= 0);
		if (!busy && p.idle) {
			const dot = this.builtAt(p, t, resetting) && p.id !== 'send';
			this.show(p, 'dot', dot);
			if (dot) {
				this.put(p, 'dot', 'cx', f(p.term.x) + '');
				this.put(p, 'dot', 'cy', f(p.term.y) + '');
			}
			return;
		}
		p.idle = !busy;
		const inFlight = live && R && tau >= 0 && tau < p.T;
		const forced = this.forced.has(p.id);
		// the outline (not for a part already built: its pulse only lights its terminal)
		const drawing = live && !forced && tau >= p.T && tau < p.T + DRAW + FADE;
		if (inFlight) {
			// sine in-out: it leaves the work gently (the cause stays readable), crosses the card, settles onto the terminal
			const u = tau / p.T;
			const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
			const s = e * R.len;
			const h = R.at(s);
			this.show(p, 'head', true);
			this.put(p, 'head', 'transform', `translate(${f(h.x)} ${f(h.y)})`);
			this.show(p, 'trail', true);
			this.put(p, 'trail', 'd', R.d(Math.max(0, s - 90), s) || `M${f(h.x)} ${f(h.y)}`);
			this.show(p, 'glow', true);
			this.put(p, 'glow', 'd', R.d(Math.max(0, s - 50), s) || `M${f(h.x)} ${f(h.y)}`);
			this.show(p, 'tail', true);
			this.put(p, 'tail', 'd', R.d(Math.max(0, s - 260), s) || `M${f(h.x)} ${f(h.y)}`);
		} else {
			this.show(p, 'head', false);
			this.show(p, 'trail', false);
			this.show(p, 'glow', false);
			this.show(p, 'tail', false);
		}
		// the spark where the job landed: the pulse is born at the work (the clamp, the cage, the probe)
		const spark = live && R && tau >= 0 && tau < 0.32;
		if (spark) {
			const k = tau / 0.32;
			this.show(p, 'spark', true);
			this.put(p, 'spark', 'r', f(2.5 + 7 * k) + '');
			this.put(p, 'spark', 'fill-opacity', f(0.7 * (1 - k) * (1 - k)) + '');
		} else this.show(p, 'spark', false);
		if (drawing) {
			const k = Math.min(1, (tau - p.T) / DRAW);
			const ek = 1 - (1 - k) * (1 - k);
			const op = tau < p.T + DRAW ? 1 : Math.max(0, 1 - (tau - p.T - DRAW) / FADE);
			for (const [nm, d] of [
				['oa', p.halfA],
				['ob', p.halfB],
			] as const) {
				this.show(p, nm, op > 0.01);
				this.put(p, nm, 'd', d);
				this.put(p, nm, 'stroke-dasharray', `${f(ek * p.half)} ${f(p.half + 20)}`);
				this.put(p, nm, 'stroke-opacity', f(op) + '');
			}
		} else {
			this.show(p, 'oa', false);
			this.show(p, 'ob', false);
		}
		// the energise wipe: once the outline has closed, the current fills the box from its terminal side (a faint carta
		// fill behind a bright front), then lets the box's own fill take over
		const w0 = p.T + DRAW * 0.85;
		const wiping = live && !forced && p.side !== 't' && tau >= w0 && tau < w0 + WIPE + WIPE_FADE;
		if (wiping) {
			const { x0, y0, x1, y1 } = p.r;
			const W = x1 - x0;
			const k = Math.min(1, (tau - w0) / WIPE);
			const ek = 1 - Math.pow(1 - k, 3);
			const fade = tau < w0 + WIPE ? 1 : Math.max(0, 1 - (tau - w0 - WIPE) / WIPE_FADE);
			const wW = ek * W;
			const fromR = p.side === 'r';
			const xa = fromR ? x1 - wW : x0;
			this.show(p, 'wipe', true);
			this.put(p, 'wipe', 'x', f(xa) + '');
			this.put(p, 'wipe', 'y', f(y0) + '');
			this.put(p, 'wipe', 'width', f(wW) + '');
			this.put(p, 'wipe', 'height', f(y1 - y0) + '');
			this.put(p, 'wipe', 'fill-opacity', f(0.11 * fade) + '');
			const fx = fromR ? x1 - wW : x0 + wW - 2;
			this.show(p, 'front', k < 1);
			this.put(p, 'front', 'x', f(Math.max(x0, Math.min(x1 - 2, fx))) + '');
			this.put(p, 'front', 'y', f(y0) + '');
			this.put(p, 'front', 'width', '2');
			this.put(p, 'front', 'height', f(y1 - y0) + '');
			this.put(p, 'front', 'fill-opacity', f(0.75 * (1 - k)) + '');
		} else {
			this.show(p, 'wipe', false);
			this.show(p, 'front', false);
		}
		// the terminal's LED: a copper bloom when the pulse arrives, then a carta dot that stays while the part is built. When
		// the breaker goes ON its surge runs down the laid harness and every terminal it reaches blinks once
		const bloom = live && tau >= p.T && tau < p.T + 0.7;
		const lamp = live && p.id !== 'send' ? this.surgeBlink(p, t) : -1;
		if (bloom || lamp >= 0) {
			const k = bloom ? (tau - p.T) / 0.7 : lamp;
			this.show(p, 'bloom', true);
			this.put(p, 'bloom', 'cx', f(p.term.x) + '');
			this.put(p, 'bloom', 'cy', f(p.term.y) + '');
			this.put(p, 'bloom', 'r', f((bloom ? 3 : 2.5) + (bloom ? 8 : 5) * (1 - (1 - k) * (1 - k))) + '');
			this.put(p, 'bloom', 'fill-opacity', f((bloom ? 0.6 : 0.65) * (1 - k)) + '');
		} else this.show(p, 'bloom', false);
		const dot = this.builtAt(p, t, resetting) && p.id !== 'send';
		this.show(p, 'dot', dot);
		if (dot) {
			this.put(p, 'dot', 'cx', f(p.term.x) + '');
			this.put(p, 'dot', 'cy', f(p.term.y) + '');
		}
	}

	/** the surge's span on the film clock (a STOP never freezes it half-way), or null */
	surgeSpan(): [number, number] | null {
		const U = this.surge;
		return U && U.route ? [U.t, U.t + U.T + 0.42] : null;
	}
	/** the surge's blink phase (0…1) for a part's terminal at film time t, or −1 (its LED blinks as the surge passes its tap) */
	private surgeBlink(p: PartEl, t: number) {
		const U = this.surge;
		const u = U?.at.get(p.id);
		if (!U || u == null || this.forced.has(p.id)) return -1;
		const k = (t - (U.t + u * U.T)) / 0.42;
		return k >= 0 && k < 1 ? k : -1;
	}
	private sput(k: keyof NonNullable<FormBuild['surge']>['n'], a: string, v: string) {
		const U = this.surge!;
		const key = k + ':' + a;
		if (U.last[key] === v) return;
		U.last[key] = v;
		U.n[k].setAttribute(a, v);
	}
	private drawSurge(t: number, resetting: boolean) {
		const U = this.surge;
		if (!U) return;
		const R = U.route;
		const tau = t - U.t;
		const on = !this.still && !this.quiet && !resetting && R && tau >= 0 && tau < U.T;
		const vis = on ? 'visible' : 'hidden';
		for (const k of ['tail', 'glow', 'trail', 'head'] as const) this.sput(k, 'visibility', vis);
		if (!on || !R) return;
		const e = 0.5 - 0.5 * Math.cos((Math.PI * tau) / U.T);
		const s = e * R.len;
		const h = R.at(s);
		this.sput('head', 'transform', `translate(${f(h.x)} ${f(h.y)})`);
		this.sput('trail', 'd', R.d(Math.max(0, s - 90), s) || `M${f(h.x)} ${f(h.y)}`);
		this.sput('glow', 'd', R.d(Math.max(0, s - 50), s) || `M${f(h.x)} ${f(h.y)}`);
		this.sput('tail', 'd', R.d(Math.max(0, s - 260), s) || `M${f(h.x)} ${f(h.y)}`);
	}

	/* ------------------------------------------------------------ the visitor */
	/** an intent to use the form: every part built at once (client note 17: "everything snaps into place", ≈ 300 ms): one
	 * light runs down the form's wire from the cell and each box snaps in as it passes its tap; the box the visitor is in
	 * is built at once. No pulses afterwards (until a RESET) */
	complete(t: number, resetting = false) {
		if (this.quiet && this.parts.every((p) => this.forced.has(p.id))) return;
		// what is built at this moment stays built (the film's own builds, a RESET's drain not yet past it)
		if (!this.quiet) for (const p of this.parts) if (this.builtAt(p, t, resetting)) this.forced.add(p.id);
		this.quiet = true;
		const active = document.activeElement;
		for (const p of this.parts) if (active && p.el.contains(active)) this.forced.add(p.id);
		const T = this.trunk;
		if (this.snapInstant || !T || !this.measured) {
			for (const p of this.parts) this.forced.add(p.id);
			this.redraw();
			return;
		}
		if (this.snap) return;
		const t0 = performance.now();
		// one chain, guarded by its own token: a RESET (or a new snap) ends it, nothing it does outlives it
		const me = { t0, raf: 0 };
		this.snap = me;
		const step = () => {
			if (this.snap !== me) return;
			const k = Math.min(1, (performance.now() - t0) / (SNAP * 1000));
			// ease-out: it leaves fast and lands soft
			const s = (1 - Math.pow(1 - k, 2)) * T.len;
			for (const p of this.parts) if (!this.forced.has(p.id) && (p.sBranch <= s + 1 || k >= 1)) this.forced.add(p.id);
			this.flash.setAttribute('d', k < 1 ? T.d(Math.max(0, s - 160), s) || 'M0 0' : 'M0 0');
			this.flash.setAttribute('opacity', k < 1 ? '0.95' : '0');
			this.redraw();
			if (k < 1) me.raf = requestAnimationFrame(step);
			else this.snap = null;
		};
		step();
	}
	private redraw() {
		const [t, resetting, plate, tau] = this.lastArgs;
		this.frame(t, resetting, plate, tau);
	}
	/** a RESET: the parts with content or focus stay built (Send too, if anything has content); the rest power down as the
	 * current drains out of the form, bottom to top (frame(), on the reset's own clock), and are built again by the job */
	reset() {
		if (this.still) return;
		if (this.snap) {
			cancelAnimationFrame(this.snap.raf);
			this.snap = null;
			this.flash.setAttribute('opacity', '0');
		}
		this.quiet = false;
		const keep = new Set<PartId>();
		const active = document.activeElement;
		for (const p of this.parts) if (hasContent(p.el) || (active && p.el.contains(active))) keep.add(p.id);
		if (keep.size) keep.add('send');
		const [t, resetting] = this.lastArgs;
		const was = this.parts.filter((p) => !keep.has(p.id) && this.builtAt(p, t, resetting));
		this.drain.clear();
		was.reverse().forEach((p, k) => this.drain.set(p.id, DRAIN0 + k * DRAIN_STEP));
		this.forced = keep;
	}
	/** the form on screen when the build starts (a reload at Contact, an anchor): never unbuild what is being looked at */
	forceAll() {
		for (const p of this.parts) this.forced.add(p.id);
	}
	/** QA */
	state() {
		return this.parts.map((p) => ({ id: p.id, b: p.b, t: +p.t.toFixed(2), doneT: +this.doneT(p).toFixed(2), T: +p.T.toFixed(2), forced: this.forced.has(p.id), term: p.term, len: p.route ? Math.round(p.route.len) : 0 }));
	}
	get modeName() {
		return this.mode;
	}
}

/** does the part hold something the visitor gave (text, a choice, a tick)? */
export function hasContent(el: HTMLElement) {
	for (const c of Array.from(el.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'))) {
		if (c instanceof HTMLInputElement && c.type === 'checkbox') {
			if (c.checked) return true;
		} else if (c.value.trim() !== '') return true;
	}
	return false;
}

/** the right edge (card px) of the card's own words (heading, answer, invitation) on the lines between y0 and y1, or null */
function textRight(card: HTMLElement, cr: DOMRect, y0: number, y1: number) {
	let x: number | null = null;
	for (const el of Array.from(card.querySelectorAll<HTMLElement>('.card__title, .card__answer, .card__body, .card__time'))) {
		const rg = document.createRange();
		rg.selectNodeContents(el);
		for (const r of Array.from(rg.getClientRects())) {
			const top = r.top - cr.top,
				bot = r.bottom - cr.top;
			if (r.width < 1 || bot < y0 || top > y1) continue;
			x = Math.max(x ?? -Infinity, r.right - cr.left);
		}
	}
	return x;
}

/* ------------------------------------------------------------ geometry helpers */
function simplify(pts: Pt[]): Pt[] {
	const out: Pt[] = [];
	for (const p of pts) {
		const q = out[out.length - 1];
		if (q && Math.hypot(p.x - q.x, p.y - q.y) < 0.5) continue;
		out.push({ x: p.x, y: p.y });
	}
	// drop collinear middle points (axis-aligned runs)
	for (let i = out.length - 2; i >= 1; i--) {
		const a = out[i - 1],
			b = out[i],
			c = out[i + 1];
		const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
		const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
		if (Math.abs(cross) < 1e-6 && dot > 0) out.splice(i, 1);
	}
	return out;
}
/** corner radii for a polyline: 7 px, never more than half of either leg (a short drop onto a box's top) */
function corners(pts: Pt[], round: (i: number) => boolean) {
	const leg = (i: number) => Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
	return pts.map((_, i) => (i === 0 || i === pts.length - 1 || !round(i) ? 0 : Math.min(7, leg(i - 1) / 2, leg(i) / 2)));
}
/** the trunk's arc length at the point where a tap leaves it (its vertical run passing that y) */
function branchS(T: Route, P: Pt) {
	let best = T.len,
		bd = Infinity;
	for (let s = 0; s <= T.len; s += 1) {
		const q = T.at(s);
		const d = Math.hypot(q.x - P.x, q.y - P.y);
		if (d < bd) {
			bd = d;
			best = s;
		}
	}
	return best;
}
/** the trunk's points from its start up to arc length s (corners as the route's own points) */
function trunkUpTo(T: Route, s: number): Pt[] {
	const out: Pt[] = [];
	for (const g of T.segs) {
		if (g.s0 > s) break;
		const a = T.at(g.s0);
		out.push({ x: a.x, y: a.y });
	}
	const e = T.at(s);
	out.push({ x: e.x, y: e.y });
	return out;
}
/** a box's outline as two halves from its terminal on side l, r or t (square corners), each to the far side's middle */
function halves(x0: number, y0: number, x1: number, y1: number, side: 'l' | 'r' | 't') {
	const ym = (y0 + y1) / 2,
		xm = (x0 + x1) / 2;
	const P = (pts: number[][]) => {
		let d = '',
			len = 0;
		pts.forEach(([x, y], i) => {
			d += (i ? 'L' : 'M') + f(x) + ' ' + f(y);
			if (i) len += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
		});
		return { d, len };
	};
	if (side === 't')
		return [
			P([
				[xm, y0],
				[x1, y0],
				[x1, y1],
				[xm, y1],
			]),
			P([
				[xm, y0],
				[x0, y0],
				[x0, y1],
				[xm, y1],
			]),
		];
	const xa = side === 'r' ? x1 : x0,
		xb = side === 'r' ? x0 : x1;
	return [
		P([
			[xa, ym],
			[xa, y0],
			[xb, y0],
			[xb, ym],
		]),
		P([
			[xa, ym],
			[xa, y1],
			[xb, y1],
			[xb, ym],
		]),
	];
}
