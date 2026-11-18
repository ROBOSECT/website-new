/**
 * The hero: the test lead comes out of the R's stem foot on the first scroll and runs to the page's lane.
 * The R itself stays the kit's symbol (its opening is CSS: HeroSymbol.astro); only the lead moves.
 * Its route is the static lead Hero.astro draws in CSS for the page without JS ([data-hero-lead]: one box for the drop and
 * the run, one for the bend into the lane), measured here, so both are the same curve: down from the stem foot, a bend of
 * the page cable's radius (--bend), a run to the lane, a bend down the lane.
 * The tip runs along the route at a steady pace, a fixed number of px of cable per px of scroll, chosen so that it
 * reaches the lane just as the pen line (the bench, 70 % of the screen) does, then rides the pen:
 * s = softmin(rate · Ŷ, s at the pen). The static page (no JS, reduced motion, print): the CSS lead, laid end to end.
 */
import { clamp01, f, Route, softmin } from './core';

export class HeroView {
	hero: HTMLElement;
	wm: SVGSVGElement;
	wires: SVGSVGElement;
	img: HTMLElement | null;
	ins: SVGPathElement;
	cu: SVGPathElement;
	leadA: HTMLElement | null;
	leadB: HTMLElement | null;
	/** document geometry */
	x = 0;
	foot = 0;
	top = 0;
	bottom = 0;
	cable = 10;
	cuL = 13.5;
	cuW = 4.3;
	phone = false;
	/** the lead out of the stem foot (hero px) */
	route: Route | null = null;
	/** y (hero px) where the lead is straight down the lane, and the arc length there */
	private jogY = 0;
	private jogS = 0;
	/** px of lead per px of scroll until the tip meets the pen */
	private rate = 3;
	/** the opening has been hurried by a scroll that came first */
	private hurried = false;
	/** the symbol's opening (R, then the fitting) has ended: the lead may come out */
	private open = false;
	/** called when the opening ends, to draw a frame */
	onOpen: (() => void) | null = null;
	private last: Record<string, string> = {};

	constructor(hero: HTMLElement) {
		this.hero = hero;
		this.wm = hero.querySelector<SVGSVGElement>('[data-wordmark]')!;
		this.wires = hero.querySelector<SVGSVGElement>('[data-hero-wires]')!;
		this.img = hero.querySelector<HTMLElement>('[data-hero-img]');
		const lead = hero.querySelector<HTMLElement>('[data-hero-lead]');
		this.leadA = (lead?.children[0] as HTMLElement | undefined) ?? null;
		this.leadB = (lead?.children[1] as HTMLElement | undefined) ?? null;
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
		// the opening plays once: a later switch back to motion (print, the reduced-motion setting) shows the R at rest
		// the opening is the R, then the fitting (it enters only once the R is whole), then the lead out of its mouth: the
		// lead is held back (tip() is null) until every animation of the symbol has ended
		const anims = this.wm.getAnimations?.({ subtree: true }) ?? [];
		const mark = () => {
			this.wm.setAttribute('data-intro-done', '');
			this.open = true;
			this.onOpen?.();
		};
		if (anims.length === 0) this.open = true;
		else Promise.allSettled(anims.map((a) => a.finished)).then(mark);
	}

	/** top: the hero's layout top in the document (an offsetTop chain: the glide's transform does not count); the
	 * static lead is measured relative to the hero (both carry the same transform). penY: the pen line (viewport px) */
	rebuild(top: number, o: { vh: number; penY: number; cable: number; cuL: number; cuW: number; phone: boolean; lane?: number }) {
		const hr = this.hero.getBoundingClientRect();
		this.top = top;
		this.bottom = top + this.hero.offsetHeight;
		this.cable = o.cable;
		this.cuL = o.cuL;
		this.cuW = o.cuW;
		this.phone = o.phone;
		const bt = this.bottom - this.top;
		const A = this.leadA?.getBoundingClientRect(),
			B = this.leadB?.getBoundingClientRect();
		let x: number, ft: number, runY: number, lane: number, J: number;
		if (A && B && A.width > 0 && B.width > 0) {
			// the CSS lead: A's right border is the drop, its bottom border the run; B's left border is the lane
			const cw = parseFloat(getComputedStyle(this.leadA!).borderRightWidth) || o.cable;
			x = A.right - hr.left - cw / 2;
			ft = A.top - hr.top;
			runY = A.bottom - hr.top - cw / 2;
			lane = B.left - hr.left + cw / 2;
			J = Math.max(0, A.left - hr.left - lane);
		} else {
			// (no static lead in the markup) straight down from the stem foot
			const r = this.wm.getBoundingClientRect();
			x = r.left - hr.left + (6 / 76) * r.width;
			ft = r.bottom - hr.top;
			runY = ft;
			J = 0;
			lane = x;
		}
		this.x = x;
		this.foot = top + ft;
		this.route =
			Math.abs(lane - x) > 1
				? new Route(
						[
							{ x, y: ft - 0.5 },
							{ x, y: runY },
							{ x: lane, y: runY },
							{ x: lane, y: bt + 2 },
						],
						[0, J, J, 0],
					)
				: new Route(
						[
							{ x, y: ft - 0.5 },
							{ x, y: bt + 2 },
						],
						[0, 0],
					);
		const segs = this.route.segs;
		this.jogY = Math.abs(lane - x) > 1 ? runY + J : ft - 0.5;
		this.jogS = Math.abs(lane - x) > 1 ? segs[segs.length - 1].s0 : 0;
		// the pace: the tip reaches the lane's straight when the pen does (Yj px of scroll); where the pen is already past it at
		// the top of the page (phones), it catches up within ≈ a fifth of a screen
		const Yj = top + this.jogY - o.penY;
		const R0 = Math.max(Yj, 0.22 * o.vh);
		this.rate = Math.max(1.6, (this.jogS + R0 - Yj) / R0);
		// the lead's svg box is the strip from the lane to the stem (hero-local px kept by the viewBox)
		const h = hr.height,
			x0 = Math.floor(Math.min(x, lane) - 24),
			w = Math.ceil(Math.abs(lane - x)) + 48;
		this.wires.setAttribute('viewBox', `${x0} 0 ${w} ${f(h)}`);
		this.wires.setAttribute('width', String(w));
		this.wires.setAttribute('height', String(h));
		this.wires.style.left = x0 + 'px';
		this.wires.style.width = w + 'px';
		this.ins.setAttribute('stroke-width', String(o.cable));
		this.cu.setAttribute('stroke-width', String(o.cuW));
		this.last = {};
	}

	/** arc length of the tip along the lead (≤ 0: still in the R); g: the page's glide (the hero is drawn g lower) */
	private sAt(Yh: number, penY: number, g: number) {
		const sPen = this.jogS + (Yh + penY - (this.top + g) - this.jogY);
		return softmin(this.rate * Math.max(0, Yh), sPen, this.phone ? 16 : 24);
	}
	/** the travelling tip in document px (null: still in the R). Before the lane it is a y above the lane's straight that
	 * the compartments below read as «not here yet»; render reads the arc length back from it */
	tip(Yh: number, penY: number, g = 0) {
		if (!this.open) return null;
		const s = this.sAt(Yh, penY, g);
		if (s <= 0.5) return null;
		return this.top + g + this.jogY + (s - this.jogS);
	}

	/** document y where the lead runs straight down the lane (g: the glide) */
	laneY(g = 0) {
		return this.top + g + this.jogY;
	}

	private attr(e: Element, k: string, v: string) {
		const key = (e as Element & { _k?: string })._k ?? ((e as Element & { _k?: string })._k = Math.random().toString(36).slice(2));
		if (this.last[key + k] === v) return;
		this.last[key + k] = v;
		e.setAttribute(k, v);
	}

	/**
	 * Yh: smoothed scroll; tip: document px or null; done: the static page (nothing drawn here: the CSS lead shows)
	 */
	render(Yh: number, tip: number | null, o: { done: boolean; g?: number }) {
		const bt = this.bottom - this.top;
		const R = this.route!;
		const g = o.g ?? 0;
		// a scroll that comes before the opening has finished hurries it (≈ a third of its time left)
		if (!o.done && !this.hurried && Yh > 2) {
			this.hurried = true;
			for (const a of this.wm.getAnimations?.({ subtree: true }) ?? []) a.updatePlaybackRate(3);
		}
		let ins = '',
			cu = '';
		// (the static page: the lead laid in CSS shows, Hero.astro)
		if (!o.done && tip != null) {
			const s = tip - this.top - g - this.jogY + this.jogS;
			const sT = Math.min(R.len, s),
				sC = Math.max(0, Math.min(R.len, s - this.cuL));
			if (sC > 0) ins = R.d(0, sC);
			if (sT > sC) cu = R.d(sC, sT);
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
