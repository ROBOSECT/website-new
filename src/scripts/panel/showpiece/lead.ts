/**
 * +C7: the page's cable arriving at Contact (scroll-driven, at 1×: Contact has no slow zone). It comes down the left lane
 * from +C6's exit, turns into the card at the height of the stage's gland and runs through the card's padding (Carta on the
 * blue card, the site's rule) into the stage's left edge, where the stage's own −W0 continues it. A pure function of the
 * travelling tip (the pen), so it is scrubbed both ways like every lead. Persistent paths, attributes only.
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
	private last: Record<string, string> = {};
	constructor(sec: HTMLElement) {
		this.sec = sec;
		this.svg = sec.querySelector<SVGSVGElement>('[data-contact-lead]')!;
		this.ins = this.svg.querySelector('[data-cl-ins]')!;
		this.card = this.svg.querySelector('[data-cl-card]')!;
		this.cu = this.svg.querySelector('[data-cl-cu]')!;
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
		// the lead runs on at the pen's rate along its route (down the lane, then into the card)
		const s = pen >= 1e8 ? r.len : Math.max(0, Math.min(r.len, pen + 2));
		const body = Math.max(0, Math.min(s, r.len) - (s < r.len ? this.cuL : 0));
		this.set(this.ins, 'd', body > 0 ? r.d(0, Math.min(body, this.sCard)) : 'M0 0');
		this.set(this.card, 'd', body > this.sCard ? r.d(this.sCard, body) : 'M0 0');
		this.set(this.cu, 'd', s > 0 && s < r.len ? r.d(Math.max(0, s - this.cuL), s) : 'M0 0');
	}
}
