/**
 * Wire-marker sleeves (client note 8): every compartment's name ("+C1 · THE PROBLEM") is printed on a sleeve threaded on
 * the test lead. As the tip comes down the lane (it rides the pen: the smoothed scroll + 0.70·vh, MOTION-SPEC §3.8) it
 * carries the sleeve just above the copper; when the sleeve reaches its place beside the compartment's heading it catches
 * there (the lead keeps sliding through it) with a small spring settle, and a hairline bracket draws out from it to frame
 * the heading. A pure function of the pen, so it is scrubbed both ways like everything else; an anchor jump or a latch
 * lands it settled. Reduced motion and no JS: the static copy inside the heading block, settled (CSS).
 *
 * The live sleeve sits in the section, outside the track's clip, so it can ride in from above the stage (over the previous
 * compartment's exit lane, where the same lead comes down). +C1's lead comes out of the ink nameplate (the hero), which
 * paints above the cabinet: there a twin sleeve inside the hero, in the inverse colours (ink sleeve, paper print), carries
 * it; the two meet exactly at the nameplate's edge, the way the lead itself turns from Carta to blu cavo there.
 */
import { kick, smooth } from './core';
import { docTop } from './stage';

/** the catch: the sleeve arrives at the pen's rate (1 px per px of scroll) and a stiff, slightly underdamped spring stops
 * it (≈ 5 px past its place, back within ≈ 60 px of scroll). Scrubbed: virtual time = px of pen travel / RATE */
const CATCH = { w: 50, z: 0.6 };
const RATE = 500;

export class Sleeve {
	sec: HTMLElement;
	live: HTMLElement | null;
	twin: HTMLElement | null = null;
	br: HTMLElement | null;
	head: HTMLElement | null;
	/** section px: the settled centre; the stage's top; the sleeve's length; its centre above the tip; the ride */
	settle = 0;
	base = 0;
	len = 0;
	gap = 0;
	ride = 300;
	/** the hero's top minus the section's top (document px), for the twin */
	twinOff = 0;
	/** what is drawn: y (1/100 px), opacity, bracket scale and opacity (1/1000) */
	private lv = [NaN, NaN, NaN, NaN];

	constructor(sec: HTMLElement) {
		this.sec = sec;
		this.live = sec.querySelector<HTMLElement>(':scope > [data-sleeve]');
		this.br = sec.querySelector<HTMLElement>('[data-sleeve-br]');
		this.head = sec.querySelector<HTMLElement>('[data-legend-head]');
	}
	/** +C1: a twin inside the nameplate (inverse colours), cloned from the live sleeve */
	attachTwin(hero: HTMLElement) {
		if (!this.live || this.twin) return;
		const t = this.live.cloneNode(true) as HTMLElement;
		t.removeAttribute('data-sleeve');
		t.classList.add('sleeve--ink', 'sleeve--twin');
		hero.appendChild(t);
		this.twin = t;
	}

	/** layout reads (rebuild): the heading's centre in the section, the stage's top, the sleeve's length */
	measure(stage: HTMLElement, o: { vh: number; cu: number; hero?: HTMLElement | null }) {
		const st = docTop(this.sec);
		this.base = docTop(stage) - st;
		if (this.head) this.settle = docTop(this.head) - st + this.head.offsetHeight / 2;
		this.len = this.live?.offsetHeight || 120;
		// the sleeve's lower end a little above the copper tip
		this.gap = this.len / 2 + o.cu + 0.6 * o.cu + 4;
		this.ride = Math.min(480, Math.max(220, 0.5 * o.vh));
		if (this.twin && o.hero) this.twinOff = st - docTop(o.hero);
		this.lv = [NaN, NaN, NaN, NaN];
	}

	/**
	 * one frame. pen: the travelling tip in stage px (−1e9: not out of the R yet; 1e9: tested, laid end to end);
	 * ready: the lead above this stage is laid down to the pen (the previous compartment's exit leg reached it)
	 */
	frame(pen: number, ready: boolean) {
		const L = this.live;
		if (!L) return;
		let y = this.settle,
			op = 1,
			brK = 1,
			brO = 1;
		if (pen < 1e8) {
			const p = pen + this.base - this.gap; // where the sleeve rides: just above the tip
			const d = p - this.settle;
			if (d < 0) {
				y = p;
				op = ready && pen > -1e8 ? smooth((d + this.ride) / 110) : 0;
				brK = 0;
				brO = 0;
			} else if (d < 400) {
				// the catch's spring has rung out well within 400 px of pen travel: settled beyond
				y = this.settle + kick(d / RATE, CATCH, RATE);
				brK = smooth((d - 8) / 110);
				brO = smooth(d / 36);
			}
		}
		// hidden and far up the lane: nothing moves (one comparison per frame for the sleeves not in play)
		if (op === 0) y = 0;
		const l = this.lv;
		const yq = Math.round(y * 100),
			oq = Math.round(op * 1000),
			kq = Math.round(brK * 1000),
			bq = Math.round(brO * 1000);
		if (l[0] === yq && l[1] === oq && l[2] === kq && l[3] === bq) return;
		// (each property only when it changed: while the sleeve rides the tip only its place does; engine pass)
		if (l[0] !== yq) {
			L.style.translate = `0 ${(yq / 100).toFixed(2)}px`;
			if (this.twin) this.twin.style.translate = `0 ${(yq / 100 + this.twinOff).toFixed(2)}px`;
		}
		if (l[1] !== oq) {
			const o = (oq / 1000).toFixed(3);
			L.style.opacity = o;
			if (this.twin) this.twin.style.opacity = o;
		}
		if (this.br && l[2] !== kq) this.br.style.transform = kq >= 999 ? '' : `scaleY(${(kq / 1000).toFixed(3)})`;
		if (this.br && l[3] !== bq) this.br.style.opacity = bq >= 999 ? '' : (bq / 1000).toFixed(3);
		l[0] = yq;
		l[1] = oq;
		l[2] = kq;
		l[3] = bq;
	}
	/** the static page (reduced motion switched on, print): the CSS copy shows, settled */
	reset() {
		for (const e of [this.live, this.twin]) {
			if (!e) continue;
			e.style.translate = '';
			e.style.opacity = '';
		}
		if (this.br) {
			this.br.style.transform = '';
			this.br.style.opacity = '';
		}
		this.lv = [NaN, NaN, NaN, NaN];
	}
}
