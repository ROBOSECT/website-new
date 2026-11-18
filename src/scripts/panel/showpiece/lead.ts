/**
 * +C7: the page's cable arriving at Contact (scroll-driven, at 1×: Contact has no slow zone). It comes down the left lane
 * from +C6's exit, turns into the card at the height of the stage's gland and runs through the card's padding (Carta on the
 * blue card, the site's rule) into the stage's left edge, where the stage's own −W0 continues it. A pure function of the
 * travelling tip (the pen), so it is scrubbed both ways like every lead. Persistent paths, attributes only.
 * The lead ends in a little fitting (Sistemini.astro, the same as under the head's R, drawn in the stage's viewBox) whose
 * narrow mouth takes it, a little before the stage's edge, and whose wide end is on the stage's own cable: the lead stops at
 * the mouth (its copper tip goes in), then the fitting enters as the scroll goes on (--a, 0 → 1 over FIT_RUN lengths of it).
 */
import { Route, f } from '../core';
import { docTop } from '../stage';
import { VB } from './rfilm';

export class ContactLead {
	sec: HTMLElement;
	svg: SVGSVGElement;
	ins: SVGPathElement;
	card: SVGPathElement;
	cu: SVGPathElement;
	r: Route | null = null;
	/** the route's length, the arc length where it enters the card, the copper stub's length (px) */
	len = 0;
	sCard = 0;
	cuL = 13.5;
	/** the fitting: its svg (--a), its length along the lead (px), the arc length where the lead enters its mouth */
	fit: SVGSVGElement | null = null;
	fitL = 0;
	sFit = 0;
	private last: Record<string, string> = {};
	constructor(sec: HTMLElement) {
		this.sec = sec;
		this.svg = sec.querySelector<SVGSVGElement>('[data-contact-lead]')!;
		this.ins = this.svg.querySelector('[data-cl-ins]')!;
		this.card = this.svg.querySelector('[data-cl-card]')!;
		this.cu = this.svg.querySelector('[data-cl-cu]')!;
		this.fit = sec.querySelector<SVGSVGElement>('[data-cl-fit]');
	}
	/** layout reads (offset chains: the glide's transforms do not count). lane: the lane's x in page px; cable, cu: widths */
	measure(o: { lane: number; cable: number; cuL: number; cuW: number; jr: number }) {
		const sec = this.sec;
		const top = docTop(sec);
		const card = sec.querySelector<HTMLElement>('[data-card]');
		const stage = sec.querySelector<HTMLElement>('[data-show-stage]');
		if (!card || !stage) return;
		let left = 0;
		for (let n: HTMLElement | null = stage; n && n !== sec; n = n.offsetParent as HTMLElement | null) left += n.offsetLeft;
		let cardLeft = 0;
		for (let n: HTMLElement | null = card; n && n !== sec; n = n.offsetParent as HTMLElement | null) cardLeft += n.offsetLeft;
		const sTop = docTop(stage) - top;
		// the gland: the stage's −W0 enters 4 units under its top edge (y −112 of the viewBox's −116)
		const scale = stage.offsetWidth / VB.w;
		const sh = stage.offsetHeight;
		// (phones frame the stage with a camera: the gland is where −W0 leaves the frame's left edge at READY's framing;
		// the static entry height is the same fraction of the box)
		const yGland = sTop + Math.min(sh * 0.5, 4 * scale + Math.max(0, (sh - VB.h * scale) / 2));
		const x0 = o.lane - this.secLeft();
		const jr = Math.max(4, o.jr);
		this.r = new Route(
			[
				{ x: x0, y: -2 },
				{ x: x0, y: yGland },
				{ x: left + 1, y: yGland },
			],
			[0, jr, 0],
		);
		this.len = this.r.len;
		// the fitting is 9 head units long, one head unit = 0.75 of the stage's (9 over 12): 6.75 units of the viewBox
		this.fitL = 6.75 * scale;
		this.sFit = this.r.len - 1 - this.fitL;
		this.sCard = this.r.len - Math.max(0, left - cardLeft) - 1;
		this.cuL = o.cuL;
		for (const p of [this.ins, this.card]) p.setAttribute('stroke-width', String(o.cable));
		this.cu.setAttribute('stroke-width', String(o.cuW));
		this.svg.setAttribute('width', String(sec.offsetWidth));
		this.svg.setAttribute('height', String(sec.offsetHeight));
		this.last = {};
	}
	private secLeft() {
		let l = 0;
		for (let n: HTMLElement | null = this.sec; n; n = n.offsetParent as HTMLElement | null) l += n.offsetLeft;
		return l;
	}
	private set(e: Element, a: string, v: string) {
		const k = a + (e === this.ins ? 'i' : e === this.card ? 'c' : 'u');
		if (this.last[k] === v) return;
		this.last[k] = v;
		e.setAttribute(a, v);
	}
	/** pen: the travelling tip in section px (1e9: laid end to end) */
	frame(pen: number) {
		const r = this.r;
		if (!r) return;
		// the lead runs on at the pen's rate along its route (down the lane, then into the card), as far as the fitting's mouth
		const raw = pen >= 1e8 ? 1e9 : pen + 2;
		const sFit = this.sFit;
		// the fitting enters after the lead has arrived, over 8 of its own lengths of scroll; back out as the scroll goes back
		const a = Math.max(0, Math.min(1, (raw - sFit) / (8 * this.fitL)));
		let body: number,
			cuA: number,
			cuB: number;
		if (raw < sFit) {
			const s = Math.max(0, raw);
			body = Math.max(0, s - this.cuL);
			cuA = body;
			cuB = s;
		} else {
			// (the copper tip goes into the mouth as the fitting comes)
			const v = this.cuL * (1 - a);
			body = sFit - v;
			cuA = body;
			cuB = v > 0.3 ? sFit : 0;
		}
		this.set(this.ins, 'd', body > 0 ? r.d(0, Math.min(body, this.sCard)) : 'M0 0');
		this.set(this.card, 'd', body > this.sCard ? r.d(this.sCard, body) : 'M0 0');
		this.set(this.cu, 'd', cuB > cuA ? r.d(cuA, cuB) : 'M0 0');
		if (this.fit) {
			const v = a.toFixed(3);
			if (this.last.a !== v) {
				this.last.a = v;
				this.fit.style.setProperty('--a', v);
			}
		}
	}
}
