/**
 * The hero: the R lets go of its copper on the first scroll (MOTION-SPEC v4 §3.9; logo D3: the copper is the ferrule),
 * scrubbed by Ŷ over [0, D]: anticipate (the ferrule is pressed onto the cable), pop (out, spark), unseat (it slides off the
 * cable's end and is gone), the bead glides through the R to the stem foot, hand-off. Then the tip drops out of the stem foot:
 * y = foot + softmin(3·(Ŷ − 0.92·D), Ŷ + penY − foot): faster than the page, then merged onto the pen.
 * The static page (no JS, reduced motion, print): the ferrule sits on the R and the lead is laid end to end.
 */
import { clamp01, f, prog, quintic, Route, smooth, softmin, SPRINGS } from './core';
import { R_GEOMETRY as RG } from '../../lib/cable-geometry';

const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const heroPhases = (p: number) => ({
	anticip: seg(p, 0.0, 0.1),
	pop: seg(p, 0.08, 0.2),
	unseat: seg(p, 0.16, 0.36),
	bead: seg(p, 0.26, 0.92),
	hand: seg(p, 0.88, 1.0),
});

export class HeroView {
	hero: HTMLElement;
	wm: SVGSVGElement;
	ferrule: SVGGElement;
	bead: SVGPathElement;
	trail: SVGPathElement;
	spark: SVGGElement;
	wires: SVGSVGElement;
	img: HTMLElement | null;
	ins: SVGPathElement;
	cu: SVGPathElement;
	rLen = 100;
	/** document geometry */
	x = 0;
	foot = 0;
	top = 0;
	bottom = 0;
	D = 170;
	cable = 10;
	cuL = 13.5;
	cuW = 4.3;
	phone = false;
	/** the lead out of the stem foot (hero px): straight down the lane; on phones the wordmark sits on the text edge, so the
	 * lead first bends from the stem into the gutter lane right under the R (an S-jog of radius JOG), then runs down */
	route: Route | null = null;
	/** y (hero px) where the lead is vertical in its lane again, and the arc length there */
	private jogY = 0;
	private jogS = 0;
	private last: Record<string, string> = {};

	constructor(hero: HTMLElement) {
		this.hero = hero;
		this.wm = hero.querySelector<SVGSVGElement>('[data-wordmark]')!;
		this.ferrule = this.wm.querySelector<SVGGElement>('[data-hw-ferrule]')!;
		this.bead = this.wm.querySelector<SVGPathElement>('[data-hw-bead]')!;
		this.trail = this.wm.querySelector<SVGPathElement>('[data-hw-trail]')!;
		this.spark = this.wm.querySelector<SVGGElement>('[data-hw-spark]')!;
		this.wires = hero.querySelector<SVGSVGElement>('[data-hero-wires]')!;
		this.img = hero.querySelector<HTMLElement>('[data-hero-img]');
		const NS = 'http://www.w3.org/2000/svg';
		this.wires.innerHTML = '';
		const mk = (stroke: string) => {
			const p = document.createElementNS(NS, 'path');
			p.setAttribute('fill', 'none');
			p.setAttribute('stroke', stroke);
			this.wires.appendChild(p);
			return p;
		};
		this.ins = mk('#F4F1EC');
		this.cu = mk('#EC8A52');
		const r = this.wm.querySelector<SVGPathElement>('[data-hw-r]');
		this.rLen = r ? r.getTotalLength() : 100;
	}

	/** top: the hero's layout top in the document (an offsetTop chain: the glide's transform does not count); the
	 * wordmark is measured relative to the hero (both carry the same transform) */
	rebuild(top: number, o: { vh: number; cable: number; cuL: number; cuW: number; phone: boolean; navH: number; lane?: number }) {
		const hr = this.hero.getBoundingClientRect();
		const r = this.wm.getBoundingClientRect();
		const vbY = RG.top - 0.5,
			vbH = RG.bot - RG.top + 1;
		this.top = top;
		this.bottom = top + this.hero.offsetHeight;
		this.x = r.left - hr.left + (RG.stemX / RG.W) * r.width;
		const scrollY = top - hr.top;
		this.foot = r.top + scrollY + ((RG.stemFootY - vbY) / vbH) * r.height;
		this.cable = o.cable;
		this.cuL = o.cuL;
		this.cuW = o.cuW;
		this.phone = o.phone;
		// the detach is a readable beat: 2–3 wheel notches at 1440 × 900 and on phones (client note 10, layout pass; the pacing
		// pass had ≈ 1.7), and it ends before the R reaches the (opaque) nav bar: the whole R is in view while the bead runs
		// through it (the hero's layout puts the wordmark low enough: Hero.astro). Where a short desktop's fold cannot afford
		// the wordmark that low (≈ 860 px tall and less) the pacing pass's rule stays: it may run until the R's bowl is half
		// under the bar (the ferrule, the stem and its foot, where the bead ends, stay in view), so the beat is not shorter there.
		const wmTop = r.top + scrollY;
		const strict = wmTop - o.navH - 8,
			soft = wmTop - o.navH + 0.55 * r.height;
		const lim = strict >= 0.16 * o.vh ? strict : soft;
		this.D = Math.max(80, Math.min((o.phone ? 0.3 : 0.27) * o.vh, 300, this.foot - 16, lim));
		// the lead: from the stem foot, straight down or (phones) bent into the lane under the R
		const ft = this.foot - this.top,
			bt = this.bottom - this.top,
			lane = o.lane ?? this.x;
		if (Math.abs(lane - this.x) > 1.5) {
			const J = HeroView.JOG;
			this.route = new Route(
				[
					{ x: this.x, y: ft - 0.5 },
					{ x: this.x, y: ft + J },
					{ x: lane, y: ft + J },
					{ x: lane, y: bt + 2 },
				],
				[0, J, J, 0],
			);
			this.jogY = ft + 2 * J;
		} else {
			this.route = new Route(
				[
					{ x: this.x, y: ft - 0.5 },
					{ x: this.x, y: bt + 2 },
				],
				[0, 0],
			);
			this.jogY = ft - 0.5;
		}
		const segs = this.route.segs;
		this.jogS = segs[segs.length - 1].s0;
		// the lead's svg box is the lane strip only (never over the text); hero-local px kept by the viewBox
		const h = hr.height,
			x0 = Math.floor(Math.min(this.x, lane) - 24),
			w = Math.ceil(Math.abs(lane - this.x)) + 48;
		this.wires.setAttribute('viewBox', `${x0} 0 ${w} ${f(h)}`);
		this.wires.setAttribute('width', String(w));
		this.wires.setAttribute('height', String(h));
		this.wires.style.left = x0 + 'px';
		this.wires.style.width = w + 'px';
		for (const p of [this.ins]) p.setAttribute('stroke-width', String(o.cable));
		this.cu.setAttribute('stroke-width', String(o.cuW));
		this.last = {};
	}

	static JOG = 6;
	/** arc length along the lead for a hero-local y of the tip: exact on the vertical run; through the jog (and 20 px below
	 * it) the tip covers the bend's extra length a little faster than the page scrolls, so it meets the pen in the lane */
	private sOf(y: number) {
		const ft = this.foot - this.top - 0.5;
		if (this.jogS <= 0.01 || y >= this.jogY + 20) return this.jogS + (y - this.jogY);
		return ((Math.max(ft, y) - ft) / (this.jogY + 20 - ft)) * (this.jogS + 20);
	}
	/** the travelling tip in document px (null: still inside the R); g: the page's glide (the hero is drawn g lower) */
	tip(Yh: number, penY: number, g = 0) {
		const Yhand = this.D * 0.92;
		if (Yh < Yhand) return null;
		const foot = this.foot + g;
		return foot + softmin(3 * (Yh - Yhand), Yh + penY - foot, this.phone ? 16 : 24);
	}

	private attr(e: Element, k: string, v: string) {
		const key = (e as Element & { _k?: string })._k ?? ((e as Element & { _k?: string })._k = Math.random().toString(36).slice(2));
		if (this.last[key + k] === v) return;
		this.last[key + k] = v;
		e.setAttribute(k, v);
	}

	/**
	 * Yh: smoothed scroll; tip: document px or null; done: the static page (the ferrule on the R, the lead laid end to end)
	 */
	render(Yh: number, tip: number | null, o: { done: boolean; g?: number }) {
		const fx0 = RG.ferrule.x0;
		const D = this.D;
		const bt = this.bottom - this.top;
		const p = o.done ? 1 : clamp01(Yh / D);
		const ph = heroPhases(p);
		const bl = 12,
			tl = 46,
			L = this.rLen;
		let tx: number,
			sx = 1,
			fo = 1,
			pos = (L + 2) * quintic(ph.bead),
			on = ph.bead > 0 && ph.hand < 1,
			trailOp = 0.32 * (1 - ph.hand);
		if (o.done) {
			// the static page: the ferrule sits on the R (no bead, no trail)
			pos = bl;
			on = false;
			trailOp = 0;
			tx = 0;
		} else {
			// pressed on, pop (spring: the overshoot is visible when scrubbed), unseat: it slides off the cable's end (clear of
			// the O) and is gone by the time the bead is well into the R
			const comp = 0.18 * smooth(ph.anticip);
			const popV = prog(ph.pop * 0.32, SPRINGS.pop);
			const un = smooth(ph.unseat);
			sx = 1 - comp + comp * popV;
			tx = 4 * popV * (1 - un) + 10 * un;
			fo = 1 - smooth(clamp01((ph.unseat - 0.3) / 0.7));
		}
		this.attr(this.ferrule, 'transform', `translate(${f(tx + fx0)} 0) scale(${f(sx)} 1) translate(${-fx0} 0)`);
		this.attr(this.ferrule, 'opacity', f(fo) + '');
		this.attr(this.spark, 'opacity', !o.done && ph.pop > 0 && ph.pop < 1 ? f(Math.sin(Math.PI * ph.pop)) + '' : '0');
		this.attr(this.bead, 'stroke-dasharray', on ? `${bl} ${f(L + 200)}` : `0 ${f(L + 200)}`);
		this.attr(this.bead, 'stroke-dashoffset', f(-(pos - bl)) + '');
		this.attr(this.trail, 'stroke-dasharray', on && trailOp > 0 ? `${f(Math.min(tl, Math.max(0, pos - bl)))} ${f(L + 200)}` : `0 ${f(L + 200)}`);
		this.attr(this.trail, 'stroke-dashoffset', f(-Math.max(0, pos - bl - tl)) + '');
		this.attr(this.trail, 'stroke-opacity', f(trailOp) + '');
		// the lead out of the stem foot (Carta on the ink nameplate, copper tip), hero-local px
		let ins = '',
			cu = '';
		const R = this.route!;
		if (o.done) ins = R.d(0, R.len);
		else if (tip != null && tip > this.foot + (o.g ?? 0) + 0.5) {
			const sT = Math.min(R.len, this.sOf(tip - this.top - (o.g ?? 0)));
			const sC = Math.max(0, sT - this.cuL);
			ins = R.d(0, sC);
			cu = R.d(sC, sT);
		}
		this.attr(this.ins, 'd', ins);
		this.attr(this.cu, 'd', cu);
		// the photograph drifts with the first screen (scroll-linked, transform only)
		if (this.img) {
			const k = clamp01(Yh / Math.max(1, bt));
			this.attr(this.img, 'style', `transform:translateY(${f(k * 40)}px) scale(${(1 + 0.05 * k).toFixed(4)})`);
		}
	}
}
