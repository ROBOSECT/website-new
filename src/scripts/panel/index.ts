/**
 * The panel controller. One ticker, one smoothed scroll value Ŷ: every
 * animation on the home page is a pure function of Ŷ (program time, the pen, the hero detach), while the
 * page itself follows the native scroll Y. Never pinned: while a compartment's program
 * scrubs, the whole page slows (1× → r → 1×, C¹), so the compartment keeps rising and reaches the top as
 * its program completes. Every block of the page is drawn G(Y) − C lower than its layout position (G: the
 * extra scroll absorbed so far, C: the runs above the block), one scroll-driven CSS animation per block (C folded
 * into its keyframes), written here and run by the browser with the scroll (compositor). Browsers without scroll
 * timelines get no slow zones at all (no runs, no transforms): the page moves at 1× and each program spans its
 * cell's own travel (main-thread transforms would trail an async scroll). Contact's showpiece runs on its own clock
 * (showpiece/player.ts). Nothing here runs while the visitor does nothing.
 *
 * Robustness rules:
 * - the page is never moved against the visitor: a browser scroll-into-view is re-aimed only when its cause is known
 *   (keyboard focus, a hash, find-in-page = a jump while the page itself is not focused and no page input);
 *   scrollbar drags and programmatic scrolls are never touched;
 * - layout is measured with offsetTop chains (the glide's transforms never need to be switched off);
 * - a re-layout (resize, a late layout change) keeps the visitor's place (program time, or the stage under 30 % of
 *   the screen), reuses the programs' snapshot caches when the cell did not change, and only re-plans the zones;
 * - nothing that changes the layout happens while scrolling;
 * - reload / history keep the place (history.scrollRestoration = manual: the browser would restore the layout Y);
 * - print and reduced motion switch to the static, completed, open panel, keeping the place.
 *
 * Debug / QA: ?panel-capture=1 (no rAF; window.__scroll.tick(ms) steps the smoothing deterministically),
 * ?panel-debug=1 (HUD), ?panel-sda=0 (as without scroll timelines; the head script reads it too).
 * window.__scroll and window.__panel.
 */
import { H, PROF, PT, lap, lap0 } from './core';
import { HeroView } from './hero';
import { PROGRAMS } from './programs';
import { bpOf } from './program';
import { Glide, LAG, LINEAR_TAU, Smooth, firstDeviceT } from './scroll';
import { SimCache } from './sim';
import { StageView, docTop } from './stage';
import { Sleeve } from './sleeve';
import { ContactLead } from './showpiece/lead';

/** the most a rewinding program may run ahead of the page (px of scroll) */
const LAG_BACK = 8;

declare global {
	interface Window {
		__scroll?: unknown;
		__panel?: unknown;
	}
}

interface Saved {
	Y: number;
	V: number;
	w: number;
	h: number;
	sda: boolean;
	/** the compartments latched complete (an anchor jump opened them): a reload or Back shows them open again */
	L?: number[];
}
type Anchor =
	| { k: 'prog'; n: number; t: number }
	| { k: 'stage'; n: number; frac: number; line: number }
	| { k: 'el'; el: HTMLElement; frac: number; line: number }
	| { k: 'V'; V: number };

export function initPanel() {
	const root = document.documentElement;
	const Q = new URLSearchParams(location.search);
	const CAPTURE = Q.get('panel-capture') === '1';
	/** the leads settle after the wheel stops (relax.ts); off in capture mode (deterministic stills) unless ?panel-relax=1 */
	const RELAX = !CAPTURE || Q.get('panel-relax') === '1';
	const DEBUG = Q.get('panel-debug') === '1';
	const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	const heroEl = document.querySelector<HTMLElement>('[data-hero]');
	const sections = Array.from(document.querySelectorAll<HTMLElement>('section.cmp[data-cmp]'));
	if (!heroEl || !sections.length) return;
	const stages = sections.map((s) => new StageView(s, PROGRAMS[Number(s.dataset.cmp)]));
	// the wire-marker sleeves, one per compartment; +C1's has a twin on the ink nameplate
	const sleeves = stages.map((s) => new Sleeve(s.sec));
	sleeves[0]?.attachTwin(heroEl);
	const byN = (n: number) => stages.find((s) => s.n === n)!;
	// +C7 Contact is not a compartment program: its film runs on its own clock
	// (showpiece/player.ts); here only the page's cable arriving into its stage and its sleeve
	const contactSec = document.querySelector<HTMLElement>('section[data-contact]');
	const clead = contactSec ? new ContactLead(contactSec) : null;
	const csleeve = contactSec ? new Sleeve(contactSec) : null;
	const ccard = contactSec?.querySelector<HTMLElement>('[data-card]') ?? null;
	const footerEl = document.querySelector<HTMLElement>('body > footer, .footer');
	/** Contact's card and the footer as the last layout had them (document px): the resize anchor's reference */
	let belowEls: { el: HTMLElement; top: number; h: number }[] = [];
	let contactTop = 0,
		contactH = 0,
		cardOff = 0;
	const hero = new HeroView(heroEl);
	const sductL = document.querySelector<HTMLElement>('.sduct--l');
	const sductR = document.querySelector<HTMLElement>('.sduct--r');
	const nav = document.querySelector<HTMLElement>('[data-nav]');
	// probe: the pen line (CSS, svh) measured in px
	const probe = document.createElement('div');
	probe.style.cssText = 'position:absolute;left:0;top:0;width:0;visibility:hidden;pointer-events:none;height:var(--bench)';
	document.body.append(probe);
	// scroll timelines: the head script decided before first paint (the runs are CSS on html.sda); without them there
	// is no slow zone (no runs, no transforms): the page moves natively at 1×
	const SDA = root.classList.contains('sda');
	const slowCss = document.createElement('style');
	slowCss.setAttribute('data-panel-glide', '');
	document.head.append(slowCss);
	// the blocks of the page that glide: the hero, the side ducts, every compartment, the closing duct, the footer
	const blocks: { el: HTMLElement; C: number; g: string }[] = [heroEl, sductL, sductR, ...sections, contactSec, document.querySelector<HTMLElement>('.cab__close'), document.querySelector<HTMLElement>('body > footer, .footer')]
		.filter((e): e is HTMLElement => !!e)
		.map((el) => ({ el, C: 0, g: '' }));
	let glide = new Glide();
	if (CAPTURE) root.classList.add('panel-capture');
	const hud = DEBUG ? document.body.appendChild(Object.assign(document.createElement('div'), { className: 'panel-hud' })) : null;

	let motion = root.classList.contains('motion');
	const sm = new Smooth(0.15);
	let vw = 0,
		vh = 0,
		penY = 0,
		navH = 0,
		built = false,
		lastInput = -1e9,
		pointerHeld = false,
		prevY: number | null = null,
		formBuilt = false,
		rebuilds = 0,
		sig = '',
		section = '';
	const perf = { frames: 0, ms: [] as number[], steps: [] as number[], sim: [] as number[], detail: [] as number[][] };
	// the morph's own display time: this frame's dt, whether the visitor has stopped (the scroll settled, no input for
	// 0.12 s), whether the scroll goes back; a morph still moving or waiting keeps the ticker running
	let frameDt = 0,
		frameIdle = false,
		frameBack = false,
		renderedY: number | null = null,
		quietT = 0,
		inputSeq = 0,
		seenSeq = 0,
		morphBusy = false;
	/* ------------------------------------------------------------ position helpers */
	/** the page's visual scroll position V(Y) = Y − G(Y) is strictly increasing (screen speed ≥ r > 0) */
	const V = (Y: number) => Y - glide.G(Y);
	/** the native Y where the page shows visual position v */
	function Vinv(v: number) {
		if (!glide.zones.length) return Math.max(0, v);
		let lo = v - 1,
			hi = v + glide.total + 1;
		for (let i = 0; i < 48; i++) {
			const m = (lo + hi) / 2;
			if (m - glide.G(m) < v) lo = m;
			else hi = m;
		}
		return Math.max(0, (lo + hi) / 2);
	}
	const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
	const goTo = (y: number) => {
		window.scrollTo({ top: Math.max(0, Math.round(y)), behavior: 'instant' });
		prevY = window.scrollY;
	};
	/** where the visitor is: inside a program (its time), or the stage under 30 % of the screen (its fraction), or the
	 * visual position (hero, footer) */
	function anchorNow(Y = window.scrollY): Anchor {
		if (!built) return { k: 'V', V: Y };
		for (const s of stages)
			if (!s.free && !s.tr.latched && Y >= s.tr.y0 && Y <= s.tr.yEnd) return { k: 'prog', n: s.n, t: s.tr.tAt(Y) };
		const line = 0.3 * vh;
		for (const s of stages) {
			const st = s.tr.stageTop(Y) - Y;
			if (st <= line && st + s.stageH > line) return { k: 'stage', n: s.n, frac: (line - st) / Math.max(1, s.stageH), line };
		}
		// below the zones: Contact's card or the footer, by the point of it at the line (a rotation or a
		// resize changes the layout above it; a visual offset would land somewhere else). From the last layout's numbers:
		// at a resize event the DOM is already the new layout, the model is still the one the visitor saw
		for (const b of belowEls) {
			const top = b.top + glide.G(Y) - glide.total - Y;
			// (on screen at all: the point of it at the line, which may lie above or below it)
			if (top < vh && top + b.h > navH) return { k: 'el', el: b.el, frac: (line - top) / Math.max(1, b.h), line };
		}
		return { k: 'V', V: V(Y) };
	}
	function anchorY(a: Anchor) {
		if (a.k === 'prog') return byN(a.n).tr.yAt(a.t);
		if (a.k === 'stage') {
			const s = byN(a.n);
			return s.tr.yForScreen(a.frac * s.stageH, a.line);
		}
		if (a.k === 'el') {
			// (a block below the zones is drawn at its layout + G − the total of the runs: on screen at V(Y) − that)
			const top = docTop(a.el) - glide.total;
			return Math.min(maxScroll(), Vinv(top + a.frac * a.el.offsetHeight - a.line));
		}
		return Vinv(a.V);
	}
	/** the field the visitor is writing in stays on screen across a re-layout (a rotation while typing) */
	function keepFocusInView() {
		const f = document.activeElement as HTMLElement | null;
		if (!f || !f.matches?.('input, select, textarea') || !contactSec?.contains(f)) return;
		const r = f.getBoundingClientRect();
		const top = navH + 12,
			bot = window.innerHeight - 12;
		if (r.top >= top && r.bottom <= bot) return;
		// (centred in the room under the bar, or its top just under the bar if it is taller than the room)
		const room = bot - top;
		const want = r.height < room ? top + (room - r.height) / 2 : top;
		goTo(window.scrollY + r.top - want);
	}

	/* ------------------------------------------------------------ layout (the only DOM reads) */
	/** what the zones depend on: every compartment's track position and size, the hero, the viewport */
	function signature() {
		return `${document.documentElement.clientWidth}|${window.innerHeight}|${heroEl!.offsetHeight}|` + stages.map((s) => `${docTop(s.pin ?? s.stage)}:${(s.pin ?? s.stage).offsetHeight}:${s.stage.offsetHeight}`).join(',');
	}
	let leadTok = { lane: 9, cable: 5, cuL: 6.75, cuW: 2.15, jr: 5 };
	/** +C7's own geometry: the cable's route into the stage's gland, the sleeve's place (layout reads) */
	function relayoutContact() {
		if (!contactSec || !ccard) return;
		contactTop = docTop(contactSec);
		contactH = contactSec.offsetHeight;
		cardOff = docTop(ccard) - contactTop;
		csleeve?.measure(ccard, { vh, cu: leadTok.cuL });
		clead?.measure(leadTok);
	}
	/** the re-layout as steps: the first boot yields to the browser between them (no long task: each compartment's
	 * program compiles in its own slice); a re-layout later runs them in one go (the programs are cached by then) */
	function* rebuildSteps(): Generator<void> {
		vw = document.documentElement.clientWidth;
		vh = window.innerHeight;
		penY = probe.offsetHeight || 0.7 * vh;
		const bp = bpOf(vw);
		const phone = bp === 'phone';
		// without slow zones the page moves at 1× while a program runs: a short smoothing keeps the robots with the page
		sm.setTau(!SDA ? LINEAR_TAU : phone || matchMedia('(pointer: coarse)').matches ? 0.13 : 0.15);
		const duct = bp === 'phone' ? 10 : bp === 'tablet' ? 16 : 24;
		const lane = sductL ? sductL.offsetLeft + duct / 2 : 9;
		navH = nav?.offsetHeight ?? (phone ? 52 : 64);
		// each stage measures itself (offsets and relative rects: the glide's transforms do not matter) and plans its zone;
		// writes and reads in separate passes (two layouts in all): clear the run overrides, measure, set the overrides
		for (const s of stages) s.clearRun();
		// (the first boot yields here too, so the page's own start-up and the first program's compile are two
		// tasks, not one long one)
		yield;
		for (const s of stages) {
			s.rebuild({ penY, vh, nav: navH, lane, linear: !SDA });
			yield;
		}
		for (const s of stages) s.applyRun();
		// the zones, in page order: each program starts where the pen meets its arrival start
		const gl = new Glide();
		const maxY = maxScroll();
		for (const s of stages) s.place(gl, { penY, vh, maxY, nav: navH });
		glide = gl;
		yield;
		// short viewports (the phone stage scale, global.css): the phone's lead, as in the stages
		const thin = phone || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) < 0.95;
		const cable = thin ? 5 : bp === 'tablet' ? 7 : 10;
		const cuL = thin ? 6.75 : bp === 'tablet' ? 9.5 : 13.5;
		hero.rebuild(docTop(heroEl!), { vh, navH, cable, cuL, cuW: thin ? 2.15 : bp === 'tablet' ? 3 : 4.3, phone, lane });
		stages.forEach((s, i) => sleeves[i].measure(s.stage, { vh, cu: cuL, hero: heroEl }));
		leadTok = { lane, cable, cuL, cuW: thin ? 2.15 : bp === 'tablet' ? 3 : 4.3, jr: bp === 'phone' ? 5 : bp === 'tablet' ? 8 : 12 };
		relayoutContact();
		belowEls = [ccard ?? contactSec, footerEl].filter((e): e is HTMLElement => !!e).map((el) => ({ el, top: docTop(el), h: el.offsetHeight }));
		for (const b of blocks) {
			const s = stages.find((k) => k.sec === b.el);
			b.C = s ? s.tr.C : b.el === heroEl || b.el === sductL || b.el === sductR ? 0 : glide.total;
		}
		writeGlide();
		sm.y = window.scrollY;
		sm.v = 0;
		built = true;
		rebuilds++;
		sig = signature();
		yield;
		render(true);
		buildIdle();
	}
	function rebuild() {
		for (const _ of rebuildSteps());
	}
	const yieldTask = () =>
		(window as Window & { scheduler?: { yield?: () => Promise<void> } }).scheduler?.yield?.() ??
		new Promise<void>((r) => {
			const ch = new MessageChannel();
			ch.port1.onmessage = () => r();
			ch.port2.postMessage(0);
		});
	async function rebuildAsync() {
		for (const _ of rebuildSteps()) await yieldTask();
	}
	/** the persistent nodes of the stages not drawn yet, one stage per idle slice (a stage builds itself anyway in the
	 * frame it first comes on screen) */
	let buildId = 0;
	function buildIdle() {
		const id = ++buildId;
		const Y = window.scrollY;
		const todo = stages.filter((s) => !s.built || !s.rigMounted || !s.drawn).sort((a, b) => Math.abs(a.tr.pinTop - Y) - Math.abs(b.tr.pinTop - Y));
		// one part per idle slice: a stage's lead and device, then its robots, then its first drawing (each a short task)
		const next = () => {
			if (id !== buildId || !built || !motion) return;
			const s = todo[0];
			if (!s) return;
			if (!s.built) s.ensureBuilt();
			else if (!s.rigMounted) s.ensureRig();
			else {
				if (!s.drawn) prime(s);
				todo.shift();
			}
			if (todo.length) idle(next);
		};
		idle(next);
	}
	/** a stage's first drawing, off screen in idle time, at the program time the scroll gives it now: its parts are created
	 * (the device's markup, the effects, the robots' transform lists) here rather than in the frame it comes on screen, which
	 * then writes only what differs */
	function prime(s: StageView) {
		const Y = window.scrollY;
		const tr = s.tr,
			off = s.free ? 0 : tr.offset(Y),
			top = tr.pinTop + off;
		const tip = hero.tip(sm.y, penY, glide.G(Y));
		const pen = !motion ? s.stageH + 10 : tip == null ? -1e9 : tip === Infinity ? 1e9 : tip - top;
		const t = s.t;
		const S = tr.cache.sample(t);
		s.S = S;
		// (the whole cell: off screen its visible band is empty)
		s.frame(t, S, { top: -StageView.LEAD_EXT, pen, visBot: 1e6, visTop: -1e6, mt: s.B.morphT > 0 ? s.B.morphT + s.md : undefined });
		s.key = '';
	}
	const idle = (cb: () => void) => (window.requestIdleCallback ? window.requestIdleCallback(cb, { timeout: 2000 }) : window.setTimeout(cb, 32));
	/** a re-layout that keeps the visitor's place (a: where the visitor was before the layout changed) */
	function relayout(a: Anchor = anchorNow()) {
		rebuild();
		goTo(anchorY(a));
		keepFocusInView();
		prefill(CAPTURE);
		scrollApi.settle();
	}

	/** the glide as scroll-driven animations of the root scroller over [first zone, last zone]: one per distinct C, the
	 * runs above the block folded into its keyframes (exact piecewise cubics as cubic-béziers). Fail-safe: if the
	 * animation were ever not applied, a block shows at its layout position (off by at most its own run), not 8000 px
	 * away. Written only when it changes (rewriting restarts the animations). */
	function writeGlide() {
		let css = '';
		const on = motion && SDA && glide.zones.length > 0 && glide.total > 0.5;
		const groups = new Map<string, number>();
		if (on) {
			const K = glide.keyframes();
			for (const b of blocks) {
				const key = b.C.toFixed(2);
				if (groups.has(key)) continue;
				const i = groups.size;
				groups.set(key, i);
				css += `@keyframes panel-glide-${i}{${K.frames.map((k) => `${(k.p * 100).toFixed(6)}%{transform:translateY(${(k.v - b.C).toFixed(3)}px);animation-timing-function:${k.ease}}`).join('')}}`;
				css += `html.motion [data-glide="${i}"]{animation:panel-glide-${i} linear both;animation-timeline:scroll(root block);animation-range:${K.from.toFixed(2)}px ${K.to.toFixed(2)}px}`;
			}
		}
		if (slowCss.textContent !== css) slowCss.textContent = css;
		for (const b of blocks) {
			const g = on ? String(groups.get(b.C.toFixed(2))) : '';
			if (g !== b.g) {
				b.g = g;
				if (g) b.el.setAttribute('data-glide', g);
				else b.el.removeAttribute('data-glide');
			}
		}
		// the side ducts end at the closing duct: shorter by every run (they glide by G, which reaches the total)
		const bot = on ? `${(48 + glide.total).toFixed(2)}px` : '';
		for (const d of [sductL, sductR]) if (d && d.style.bottom !== bot) d.style.bottom = bot;
	}

	const eagerDone = new Set<StageView>();
	function eager(s: StageView) {
		if (eagerDone.has(s)) return;
		eagerDone.add(s);
		s.sec.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
	}

	/* ------------------------------------------------------------ one frame */
	function phaseOf(s: StageView, Y: number) {
		const tr = s.tr;
		if (tr.latched || tr.held) return 'latched';
		if (sm.y < tr.y0) return 'before';
		if (sm.y < tr.yEnd) return 'running';
		if (!s.free && Y < tr.yB) return 'speeding-up';
		return 'done';
	}
	/** one frame. Y: the scroll position read at the start of this frame (reading it again after DOM writes
	 * would force a synchronous layout of the whole page) */
	function render(force: boolean, Yin?: number) {
		if (!built) return;
		const t0 = performance.now();
		if (PROF) {
			PT.cur = {};
			lap0();
		}
		const Y = Yin ?? window.scrollY,
			Yh = sm.y;
		renderedY = Y;
		let steps = 0,
			simMs = 0;
		// the nav's logo shows only once the hero wordmark has gone under the nav (one brand on screen: home.ts)
		const G = glide.G(Y);
		const th = performance.now();
		if (Yh < hero.bottom + G + 60 || force) hero.render(Yh, hero.tip(Yh, penY, G), { done: false, g: G });
		const heroMs = performance.now() - th;
		lap('hero');
		let drawn = 0,
			rig0 = 0,
			cab0 = 0;
		for (const s of stages) {
			rig0 += s.rigMs;
			cab0 += s.cableMs;
		}
		const tip = hero.tip(Yh, penY, G);
		let curS: StageView | null = null,
			sec = '',
			busy = false;
		const line = 0.4 * vh;
		for (let si = 0; si < stages.length; si++) {
			const s = stages[si];
			const tr = s.tr;
			const off = s.free ? 0 : tr.offset(Y);
			const top = tr.pinTop + off,
				st = top - Y;
			if (tr.latched && (Y < tr.y0 - 0.5 * vh || Y > tr.yB + 0.5 * vh)) tr.latched = false;
			s.vis = st < vh + 60 && st + s.stageH > -60;
			// the nav's current section: the stage under 40 % of the screen (visual positions: the runs never show)
			if (st <= line && st + s.stageH > line) sec = s.sec.id;
			const t = Yh < tr.y0 && !tr.latched && !tr.held ? 0 : tr.tAt(Yh);
			s.t = t;
			s.off = off;
			// the morph's display time (off screen it is the scrolled time: a stage comes back into view as scrolled)
			if (s.morphStep(t, s.vis && !force ? frameDt : 0, frameIdle, frameBack)) busy = true;
			if (s.vis && s.morphPending) busy = true;
			const ph = phaseOf(s, Y);
			if (s.phase !== ph) {
				s.phase = ph;
				s.phaseKey = `c${s.n}:${ph}`;
				s.sec.dataset.cmpState = ph;
				// the module's pictures load while its program runs, so the morph never opens onto empty frames
				// (in a task of its own: switching the pictures to eager starts their fetch and decode, not a frame's work)
				if (ph !== 'before' && !eagerDone.has(s)) setTimeout(() => eager(s), 0);
			}
			if (!s.phaseKey) s.phaseKey = `c${s.n}:${s.phase}`;
			if (s.vis && st < vh * 0.7) curS = s;
			const pen = !motion ? s.stageH + 10 : tip == null ? -1e9 : tip === Infinity ? 1e9 : tip - top;
			// its wire marker rides the tip down the lane (above the stage too), once the lead above it is laid to the pen
			const prev = si > 0 ? stages[si - 1] : null;
			sleeves[si].frame(pen, !prev || prev.tr.latched || prev.t >= prev.tr.tEnd - 1e-3);
			lap('stages');
			// off screen: nothing to draw (no simulation either); drawn in the frame it comes on screen
			if (!s.vis) {
				s.key = '';
				s.relaxDrop();
				continue;
			}
			const visBot = Y + vh - top;
			s.visBot = visBot;
			// its persistent nodes, if this is the first time it is drawn (it then redraws whole)
			if (s.ensureBuilt()) lap('build');
			// the leads settling once the scroll has settled (display only); while it moves them the stage redraws its leads
			if (RELAX && s.relaxTick(t, frameIdle, force ? 0 : frameDt)) {
				s.key = '';
				busy = true;
			}
			// what this frame draws from (quantised below what shows; numbers, not a key string: the frame budget)
			const kq = s.kq,
				q0 = Math.round(t * 1e5),
				q1 = Math.round(s.md * 1e5),
				q2 = Math.round(pen * 100),
				q3 = Math.round(off * 100),
				q4 = Math.round(visBot);
			if (s.key && !force && kq[0] === q0 && kq[1] === q1 && kq[2] === q2 && kq[3] === q3 && kq[4] === q4) continue;
			s.key = 'k';
			kq[0] = q0;
			kq[1] = q1;
			kq[2] = q2;
			kq[3] = q3;
			kq[4] = q4;
			const s0 = tr.cache.stats.steps,
				ts = performance.now();
			const S = tr.cache.sample(t);
			simMs += performance.now() - ts;
			steps += tr.cache.stats.steps - s0;
			s.S = S;
			lap('sim');
			s.frame(t, S, { top: -StageView.LEAD_EXT, pen, visBot, visTop: Y + navH - top, mt: s.B.morphT > 0 ? s.B.morphT + s.md : undefined });
			lap0();
			drawn++;
		}
		// +C7: the page's cable arriving into the stage's gland (at 1×: Contact is past every zone), its sleeve
		if (contactSec && clead) {
			const cTop = contactTop + (SDA && glide.zones.length ? G - glide.total : 0);
			const penC = !motion ? 1e9 : tip == null ? -1e9 : tip === Infinity ? 1e9 : tip - cTop;
			const vis = cTop - Y < vh + 60 && cTop + contactH - Y > -60;
			if (vis || force) clead.frame(penC);
			lap('contact');
			const prev = stages[stages.length - 1];
			csleeve?.frame(penC >= 1e8 ? 1e9 : penC - cardOff, !prev || prev.tr.latched || prev.t >= prev.tr.tEnd - 1e-3);
			if (cTop - Y <= line && cTop + contactH - Y > line) sec = contactSec.id;
		}
		let rig1 = 0,
			cab1 = 0;
		for (const s of stages) {
			rig1 += s.rigMs;
			cab1 += s.cableMs;
		}
		morphBusy = busy;
		// the nav's connector glyph (wordless): one pin per compartment whose power-up the
		// scroll has passed (both ways), the seventh when the robots have built the Contact form
		let x0 = 0;
		if (formBuilt) x0 = 7;
		else for (const s of stages) if (!s.cfg.finale && s.B.powerT > 0 && (s.tr.latched || s.t >= s.B.powerT)) x0++;
		const x0s = String(x0);
		if (nav && nav.dataset.x0 !== x0s) nav.dataset.x0 = x0s;
		if (curS && curS.phaseKey !== root.dataset.panelPhase) root.dataset.panelPhase = curS.phaseKey;
		if (sec !== section) {
			section = sec;
			document.dispatchEvent(new CustomEvent('panel:section', { detail: sec }));
		}
		const ms = performance.now() - t0;
		if (PROF && PT.cur) {
			PT.cur.total = ms;
			PT.cur.drawn = drawn;
			const W = window as Window & { __ptF?: Record<string, number>[] };
			(W.__ptF ??= []).push(PT.cur);
			PT.cur = null;
		}
		perf.frames++;
		perf.ms.push(ms);
		perf.detail.push([ms, heroMs, rig1 - rig0, cab1 - cab0, simMs, drawn]);
		perf.steps.push(steps);
		perf.sim.push(simMs);
		// the last 3000 frames, trimmed in blocks (a shift per frame moves the whole array)
		if (perf.ms.length > 4000) for (const a of [perf.ms, perf.steps, perf.sim, perf.detail] as unknown[][]) a.splice(0, a.length - 3000);
		if (hud)
			hud.textContent =
				`Y ${Y.toFixed(0)}  Ŷ ${Yh.toFixed(1)}  v ${sm.v.toFixed(0)}\n` +
				stages.map((s) => `+C${s.n} t ${s.t.toFixed(2)}/${s.tr.tEnd.toFixed(2)} ${s.phase}`).join('\n') +
				`\nJS ${ms.toFixed(2)} ms  steps ${steps}`;
		// (QA: a checker that reads the frame the visitor sees, after it is drawn, not the one before)
		(window as Window & { __panelAfterFrame?: () => void }).__panelAfterFrame?.();
	}

	/* ------------------------------------------------------------ ticker: one rAF, stops when settled */
	/** a browser scroll-into-view (find-in-page, focus) aims with the transforms of the frame it ran in (prevY): the
	 * native Y that shows what it meant to show (the same visual position under the old glide) */
	const REAIM = Q.get('panel-reaim') !== '0';
	function reaim(prevY: number, Y: number) {
		if (!REAIM) return Y;
		const want = Y - glide.G(prevY);
		if (Math.abs(V(Y) - want) < 1) return Y;
		const Yc = Math.round(Vinv(want));
		// it only ever goes on in the jump's own direction (and by less than the glide difference)
		return Math.sign(Yc - Y) === Math.sign(Y - prevY) ? Yc : Y;
	}
	/** a jump whose cause is the browser's find-in-page: the page itself is not focused (the find bar is), no page
	 * input, no pointer held, and the glide differs between the two positions (else nothing is off). Scrollbar drags
	 * (the page is focused, a pointer is held) and programmatic scrolls (the page is focused) never qualify. */
	function foundInPage(prevY: number, Y: number) {
		return REAIM && !pointerHeld && performance.now() - lastInput > 400 && !document.hasFocus() && Math.abs(glide.G(Y) - glide.G(prevY)) > 0.08 * vh;
	}
	function step(dt: number) {
		let Y = window.scrollY;
		let jumped = false;
		// a jump (anchor, find-in-page, Home/End, a scrollbar drag): only the last 0.3·vh is animated
		if (Math.abs(Y - sm.y) > 1.5 * vh) {
			sm.y = Y - Math.sign(Y - sm.y) * 0.3 * vh;
			sm.v = 0;
			jumped = true;
		}
		if (prevY != null && Y !== prevY && foundInPage(prevY, Y)) {
			const Yc = reaim(prevY, Y);
			if (Yc !== Y) {
				goTo(Yc);
				Y = window.scrollY;
				if (Math.abs(Y - sm.y) > 1.5 * vh) {
					sm.y = Y - Math.sign(Y - sm.y) * 0.3 * vh;
					sm.v = 0;
				}
			}
			// the compartment the match is in shows its end state (open module): the match is readable
			for (const s of stages) if (!s.free && Y + 0.5 * vh >= s.tr.y0 && Y < s.tr.yB) s.tr.latched = true;
		}
		prevY = Y;
		const v0 = sm.y;
		sm.step(dt, Y);
		// the program never trails the page by more than the plans allow for: forward by the lag the end
		// gap is planned with (LAG, a brisk wheel; at most 0.15·vh), backward by a few px (from its first device beat a
		// device has only 12 px under it: a rewinding program that ran ahead of the page drew it under the screen's edge)
		const capF = Math.min(LAG, 0.15 * vh);
		if (Y - sm.y > capF) sm.y = Y - capF;
		else if (sm.y - Y > LAG_BACK) sm.y = Y + LAG_BACK;
		if (inputSeq !== seenSeq) {
			seenSeq = inputSeq;
			quietT = 0;
		} else quietT += dt;
		// (a jump lands every morph on its scrolled time: nothing rewinds or finishes on its own after a jump)
		frameDt = jumped ? 0 : dt;
		frameIdle = sm.settled(Y) && quietT > 0.12;
		frameBack = sm.y < v0 - 1e-3;
		render(false, Y);
		frameDt = 0;
		return Y;
	}
	let running = false,
		last = 0;
	function loop(now: number) {
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		const Y = step(dt);
		// the frame's own scroll position: no layout read after the frame's writes
		// (a few more frames after the scroll settles: the leads' settling starts 0.12 s after the last input)
		if (!sm.settled(Y) || morphBusy || (RELAX && quietT <= 0.15)) requestAnimationFrame(loop);
		else running = false;
	}
	function kick() {
		if (CAPTURE || running || !motion || !built) return;
		running = true;
		last = performance.now();
		requestAnimationFrame(loop);
	}
	function onVisibility() {
		if (document.visibilityState === 'visible') {
			if (!built) return;
			sm.y = window.scrollY;
			sm.v = 0;
			prevY = window.scrollY;
			render(true);
		} else savePos();
	}

	/* ------------------------------------------------------------ input, anchors, focus */
	const markInput = () => {
		lastInput = performance.now();
		inputSeq++;
	};
	for (const ev of ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown', 'mousedown']) addEventListener(ev, markInput, { passive: true, capture: true });
	// a held pointer (a scrollbar drag, text selection, a middle-click autoscroll) is input for as long as it is held
	const press = () => {
		pointerHeld = true;
		markInput();
	};
	const release = () => {
		pointerHeld = false;
		markInput();
	};
	addEventListener('pointerdown', press, { passive: true, capture: true });
	addEventListener('mousedown', press, { passive: true, capture: true });
	for (const ev of ['pointerup', 'pointercancel', 'mouseup', 'dragend']) addEventListener(ev, release, { passive: true, capture: true });
	addEventListener('blur', () => (pointerHeld = false));
	addEventListener('pointermove', (e) => e.buttons && markInput(), { passive: true, capture: true });
	addEventListener('scroll', kick, { passive: true });
	document.addEventListener('visibilitychange', onVisibility);
	// keyboard focus: the browser scrolled the element into view with the page's transforms as they were: re-aim;
	// inside a module that is not open yet: open it (keyboard users never meet clipped content)
	document.addEventListener('focusin', (e) => {
		if (!motion || !built) return;
		const Y = window.scrollY;
		if (prevY != null && Math.abs(Y - prevY) > 1 && Math.abs(glide.G(Y) - glide.G(prevY)) > 1) {
			const Yc = reaim(prevY, Y);
			if (Yc !== Y) goTo(Yc);
		}
		prevY = window.scrollY;
		for (const s of stages)
			if (s.mod && s.mod.contains(e.target as Node) && s.B.morphT > 0 && s.t < s.B.morphT + 0.9) {
				s.tr.latched = true;
				s.key = '';
				kick();
				if (CAPTURE) render(true);
			}
	});
	// in-page anchors land with the target (the compartment: its legend) under the nav, and the compartment
	// latched complete (anchor jumps complete instantly); the latch lets go once the visitor leaves it
	function hashY(id: string): number | null {
		const target = document.getElementById(id);
		if (!target) return null;
		const pad0 = parseFloat(getComputedStyle(root).scrollPaddingTop || '80');
		// Contact lies past every slow zone: there the page's visual and layout positions agree (its glide is 0)
		if (contactSec && contactSec.contains(target)) {
			const el = target === contactSec ? (ccard ?? contactSec) : target;
			return Math.max(0, Math.min(maxScroll(), docTop(el) - pad0));
		}
		const s = stages.find((k) => k.sec === target || k.sec.contains(target));
		if (!s) return null;
		eager(s);
		const el = target === s.sec ? (s.sec.querySelector<HTMLElement>('.legend, [data-card]') ?? s.stage) : target;
		const local = el.getBoundingClientRect().top - s.stage.getBoundingClientRect().top;
		const pad = parseFloat(getComputedStyle(root).scrollPaddingTop || '80');
		const y = Math.max(0, s.tr.yForScreen(local, pad));
		if (y < s.tr.yEnd) s.tr.latched = true;
		s.key = '';
		return y;
	}
	document.addEventListener('click', (e) => {
		if (!motion || !built) return;
		const a = (e.target as Element).closest?.('a[href*="#"]') as HTMLAnchorElement | null;
		if (!a || a.origin !== location.origin || a.pathname !== location.pathname) return;
		const id = decodeURIComponent(a.hash.slice(1));
		const y = id ? hashY(id) : null;
		if (y == null) return;
		e.preventDefault();
		// the visitor's place, for back/forward (scroll restoration is manual on this page: the panel restores it)
		history.replaceState({ ...(history.state ?? {}), panelY: window.scrollY }, '');
		history.pushState({ panelY: y }, '', '#' + id);
		goTo(y);
		markInput();
		kick();
		const target = document.getElementById(id);
		target?.setAttribute('tabindex', target.getAttribute('tabindex') ?? '-1');
		target?.focus({ preventScroll: true });
	});
	// back/forward between the page's own anchors: the place the visitor had there
	// (the browser may still scroll to the entry's fragment after popstate, with the glide as it was: the place is
	// applied again on hashchange and in the next frame)
	let popY: number | null = null;
	addEventListener('popstate', (e) => {
		const y = (e.state as { panelY?: number } | null)?.panelY;
		if (!motion || !built || typeof y !== 'number') return;
		popY = y;
		const apply = () => {
			if (popY == null) return;
			if (Math.abs(window.scrollY - popY) > 1) goTo(popY);
			markInput();
			kick();
		};
		apply();
		requestAnimationFrame(() => {
			apply();
			requestAnimationFrame(() => {
				apply();
				popY = null;
			});
		});
	});
	// a hash typed in the address bar: the browser aimed without the glide
	addEventListener('hashchange', () => {
		if (!motion || !built) return;
		if (popY != null) {
			goTo(popY);
			return;
		}
		const y = hashY(decodeURIComponent(location.hash.slice(1)));
		if (y == null) return;
		goTo(y);
		markInput();
		kick();
	});
	// PageDown / PageUp / Space inside a slow zone would move the content only r × a page: page by the visual distance
	// (the scroll stays native and smooth; the programs scrub through)
	addEventListener('keydown', (e) => {
		if (!motion || !built || !glide.zones.length || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
		const k = e.key;
		const dir = k === 'PageDown' || (k === ' ' && !e.shiftKey) ? 1 : k === 'PageUp' || (k === ' ' && e.shiftKey) ? -1 : 0;
		if (!dir) return;
		const t = e.target as HTMLElement | null;
		if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY|VIDEO|AUDIO|IFRAME|OPTION)$/.test(t.tagName) || t.closest('[role=button],[role=checkbox],[role=switch],[role=tab],[role=menuitem],[role=slider],[role=listbox]'))) return;
		const Y = window.scrollY;
		const page = 0.875 * (vh - navH);
		const Yt = Math.min(maxScroll(), Vinv(V(Y) + dir * page));
		// outside the zones the glide is flat there: the browser's own paging is the same
		if (Math.abs(Yt - Y - dir * page) < 2 || (dir < 0 && Y <= 0)) return;
		e.preventDefault();
		markInput();
		window.scrollTo({ top: Math.max(0, Yt), behavior: rmQuery.matches ? 'instant' : 'smooth' });
	});

	/* ------------------------------------------------------------ prefill the snapshot caches in idle time */
	let prefillId = 0;
	function prefill(sync: boolean) {
		const id = ++prefillId;
		// nearest to the visitor first
		const Y = window.scrollY;
		const todo = stages.slice().sort((a, b) => Math.abs(a.tr.y0 - Y) - Math.abs(b.tr.y0 - Y));
		const run = () => {
			if (id !== prefillId) return;
			const tS = performance.now();
			while (todo.length && (sync || performance.now() - tS < 4)) {
				const s = todo[0];
				const end = s.cfg.finale ? s.B.finaleEnd : s.tr.tEnd;
				s.tr.cache.seek(end + 0.05, sync ? Infinity : 60);
				if (s.tr.cache.sim.t >= end) todo.shift();
			}
			if (todo.length) (window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 16)))(run);
		};
		run();
	}

	/* ------------------------------------------------------------ static (reduced motion, print) ↔ motion, keeping the place */
	function toStatic() {
		if (!motion) return window.scrollY;
		const v = built ? V(window.scrollY) : window.scrollY;
		motion = false;
		root.classList.remove('motion');
		// the static page is an ordinary page: the browser's own restoration is right for it
		if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
		for (const s of stages) s.unbuild();
		for (const sl of sleeves) sl.reset();
		built = false;
		writeGlide();
		hero.render(0, null, { done: true });
		// the static page is the same layout without the runs: the visual position is its scroll position
		window.scrollTo({ top: v, behavior: 'instant' });
		return v;
	}
	/** v: the visual position to come back to (default: where the static page is) */
	function toMotion(v = window.scrollY) {
		if (motion) return;
		motion = true;
		root.classList.add('motion');
		if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
		boot({ V: v });
	}
	rmQuery.addEventListener('change', () => (rmQuery.matches ? toStatic() : toMotion()));
	// printing / saving as PDF: the static, tested, open panel (the whole content, no transforms); back after
	let printing: number | null = null;
	addEventListener('beforeprint', () => {
		if (!motion) return;
		printing = toStatic();
	});
	addEventListener('afterprint', () => {
		if (printing == null) return;
		const v = printing;
		printing = null;
		if (!rmQuery.matches) toMotion(v);
		else window.scrollTo({ top: v, behavior: 'instant' });
	});

	/* ------------------------------------------------------------ reload / history: keep the place */
	const POS_KEY = 'robosect-panel:' + location.pathname;
	function savePos() {
		if (!motion || !built) return;
		const Y = window.scrollY;
		const s: Saved = { Y, V: V(Y), w: vw, h: vh, sda: SDA, L: stages.filter((k) => k.tr.latched).map((k) => k.n) };
		try {
			sessionStorage.setItem(POS_KEY, JSON.stringify(s));
		} catch {
			/* storage blocked: the browser's own restoration (approximate) */
		}
	}
	addEventListener('pagehide', savePos);
	let restore: Saved | null = null;
	{
		const nt = (performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
		if (motion && (nt === 'reload' || nt === 'back_forward')) {
			try {
				restore = JSON.parse(sessionStorage.getItem(POS_KEY) ?? 'null') as Saved | null;
			} catch {
				restore = null;
			}
		}
		// the layout is final at first paint (CSS runs): an unchanged viewport can go back right away, before the fonts
		if (restore && restore.w === document.documentElement.clientWidth && restore.h === window.innerHeight && restore.sda === SDA) window.scrollTo({ top: restore.Y, behavior: 'instant' });
	}

	/* ------------------------------------------------------------ QA hooks */
	const scrollApi = {
		ready: false,
		to(y: number, o?: { jump?: boolean }) {
			if (o?.jump) lastInput = -1e9;
			else markInput();
			window.scrollTo({ top: y, behavior: 'instant' });
			if (!CAPTURE) kick();
			return window.scrollY;
		},
		/** capture mode: advance the smoothing (and the finale clock) by ms, in 60 Hz substeps, and render */
		tick(ms: number) {
			const n = Math.max(1, Math.round(ms / 16.667));
			for (let i = 0; i < n; i++) {
				step(ms / 1000 / n);
				// the showpiece's own clock steps with it in capture mode (showpiece/player.ts)
				(window as Window & { __showTick?: (s: number) => void }).__showTick?.(ms / 1000 / n);
			}
			return { Y: window.scrollY, Yh: sm.y };
		},
		settle() {
			sm.y = window.scrollY;
			sm.v = 0;
			prevY = window.scrollY;
			render(true);
		},
		state() {
			return {
				Y: window.scrollY,
				Yh: sm.y,
				v: sm.v,
				vh,
				benchY: penY,
				section,
				cmps: stages.map((s) => ({
					n: s.n,
					t: s.t,
					off: s.off,
					/** stage top and bench on screen (model), screen speed (× scroll) at the native scroll position */
					top: s.tr.stageTop(window.scrollY) - window.scrollY,
					bench: s.tr.stageTop(window.scrollY) + s.floor - window.scrollY,
					speed: s.tr.speed(window.scrollY),
					phase: phaseOf(s, window.scrollY),
					latched: s.tr.latched,
					held: s.tr.held,
					/** the morph's display time after T_m (s): ahead of t − T_m while a morph the visitor stopped in finishes */
					md: s.md,
				})),
			};
		},
	};
	const view = (S: ReturnType<SimCache['sample']>) => ({
		t: S.t,
		ropeOn: S.ropeOn,
		laid: !!S.laid,
		pts: S.pts ? Array.from({ length: S.n }, (_, i) => [S.pts![2 * i], S.pts![2 * i + 1]]) : S.laid ? S.laid.pts.map((p) => [p.x, p.y]) : [],
		L: S.L,
		rig: S.rig,
	});
	const panelApi = {
		ready: false,
		get rebuilds() {
			return rebuilds;
		},
		sda: SDA,
		tracks: () =>
			stages.map((s) => ({
				n: s.n,
				y0: s.tr.y0,
				yEnd: s.tr.yEnd,
				yA: s.tr.yA,
				yB: s.tr.yB,
				/** the 1× lead-in before the zone (px), whether the device is on screen from the first device beat */
				leadIn: s.tr.yA - s.tr.y0,
				devVis: s.tr.zone ? s.tr.zone.vis : true,
				/** the 1× rise before the program starts (short viewports), the run set here (null: the CSS run) */
				delay: s.tr.zone ? s.tr.zone.d : 0,
				runOverride: s.tr.runOverride,
				pinTop: s.tr.pinTop,
				/** the run (extra scroll), program scroll S, hold ratio r, ramps, screen travel D */
				pinLen: s.tr.pinLen,
				pinVh: s.tr.pinLen / vh,
				S: s.tr.z?.S ?? s.tr.yEnd - s.tr.y0,
				r: s.tr.z?.r ?? 1,
				rd: s.tr.z?.rd ?? 0,
				ru: s.tr.z?.ru ?? 0,
				D: s.tr.D,
				tEnd: s.tr.tEnd,
				k: s.tr.kEff,
				stageH: s.stageH,
				floor: s.floor,
				sda: SDA,
				held: s.tr.held,
				morphT: s.B.morphT,
				powerT: s.B.powerT,
				/** the first device beat or close-up (s): from then on device, arms and close-ups are whole on screen */
				dev1: firstDeviceT(s.B),
				spans: s.B.spans,
				/** the narrative spans the scroll is spent by: kind, program time, weight */
				pace: s.tr.warp.spans,
			})),
		layout: () =>
			stages.map((s) => ({
				n: s.n,
				W: s.G.T.W,
				sc: s.G.sc,
				floor: s.floor,
				y0: s.G.y0,
				Mh: s.Mh,
				stageH: s.stageH,
				devW: s.G.devW,
				devH: s.G.devH,
				cx: s.G.cx,
				inX: s.G.inX,
				outX: s.G.outX,
				mouthY: s.G.mouthY,
				bx: s.G.bx,
				rack: s.G.rack,
				visBot: s.visBot,
				blocks: s.blocks.length,
			})),
		beats: (n: number) => byN(n).B.beats.map((b) => ({ t: Math.round(b.t * 1000), name: b.name })),
		qa: (n: number) => (byN(n).B.rig?.qa ? byN(n).B.rig!.qa!(byN(n).tr.tEnd) : { robots: false, note: 'stage 1: no robot rig mounted' }),
		yAt: (n: number, t: number) => byN(n).tr.yAt(t),
		/** visual position ↔ native scroll */
		V: (y: number) => V(y),
		Vinv: (v: number) => Vinv(v),
		scrollTo(n: number, beat: string | number, offMs = 0) {
			const s = byN(n);
			let t = typeof beat === 'number' ? beat / 1000 : (s.B.beats.find((b) => b.name === beat) ?? { t: 0 }).t;
			t += offMs / 1000;
			scrollApi.to(s.tr.yAt(t));
			scrollApi.settle();
			return window.scrollY;
		},
		setProgress(n: number, u: number) {
			const s = byN(n);
			scrollApi.to(s.tr.y0 + u * (s.tr.yB - s.tr.y0));
			scrollApi.settle();
			return window.scrollY;
		},
		complete(n?: number) {
			for (const s of stages) if (n == null || s.n === n) s.tr.latched = true;
			render(true);
		},
		sample(n: number) {
			const s = byN(n);
			return s.S ? view(s.S) : null;
		},
		cold(n: number, t: number) {
			const ca = new SimCache(byN(n).B, 1e9);
			return view(ca.sample(t));
		},
		perf() {
			const a = perf.ms.slice().sort((x, y) => x - y),
				q = (p: number) => a[Math.min(a.length - 1, Math.floor(p * a.length))] || 0;
			const b = perf.sim.slice().sort((x, y) => x - y),
				qs = (p: number) => b[Math.min(b.length - 1, Math.floor(p * b.length))] || 0;
			// the frames at or above the p95: what they spent (ms): hero, robots, the lead, simulation, stages drawn (robots and the
			// lead are timed only with ?panel-prof=1: their timers cost more than some of what they timed)
			const p95 = q(0.95);
			const top = perf.detail.filter((d) => d[0] >= p95);
			const avg = (i: number) => (top.length ? top.reduce((x, d) => x + d[i], 0) / top.length : 0);
			const slow = { hero: avg(1), robots: avg(2), lead: avg(3), sim: avg(4), stages: avg(5) };
			return { frames: perf.frames, p50: q(0.5), p95, max: a[a.length - 1] || 0, stepsMax: Math.max(0, ...perf.steps), simP50: qs(0.5), simP95: qs(0.95), simMax: b[b.length - 1] || 0, slow };
		},
		perfReset() {
			perf.ms.length = 0;
			perf.steps.length = 0;
			perf.sim.length = 0;
			perf.detail.length = 0;
			perf.frames = 0;
		},
		/** QA: render compartment n at `steps` program times in [t0, t1] (already cached); ms per frame, total and robots */
		bench(n: number, t0: number, t1: number, steps = 120) {
			const s = byN(n);
			const S0 = performance.now();
			s.rigMs = 0;
			const times: number[] = [];
			for (let i = 0; i < steps; i++) {
				const t = t0 + ((t1 - t0) * i) / (steps - 1);
				if (PROF) {
					PT.cur = { t };
					lap0();
				}
				const a = performance.now();
				const S = s.tr.cache.sample(t);
				s.frame(t, S, { top: -s.off, pen: 1e9, visBot: s.visBot });
				times.push(performance.now() - a);
				if (PROF && PT.cur) {
					PT.cur.total = times[times.length - 1];
					((window as Window & { __ptF?: Record<string, number>[] }).__ptF ??= []).push(PT.cur);
					PT.cur = null;
				}
			}
			times.sort((x, y) => x - y);
			return { total: performance.now() - S0, per: (performance.now() - S0) / steps, p95: times[Math.floor(steps * 0.95)], rig: s.rigMs / steps };
		},
		/** the stage model at native scroll Y: offset, stage top and bench on screen, screen speed */
		stageAt(n: number, Y: number) {
			const tr = byN(n).tr;
			return { off: tr.offset(Y), top: tr.stageTop(Y) - Y, bench: tr.stageTop(Y) + byN(n).floor - Y, speed: tr.speed(Y) };
		},
		/** the hero's detach distance D (px of scroll) */
		heroD: () => hero.D,
		/** QA: when each lead of compartment n is a free rope (stepped with pins: what a settling can start from), every 50 ms:
		 * 'i' in-lead, 'o' out-lead, 'b' both, '.' neither */
		ropeModes(n: number) {
			const ca = new SimCache(byN(n).B, 1e9);
			let out = '';
			for (let t = 0; t <= byN(n).tr.tEnd; t += 0.05) {
				ca.seek(t);
				const a = !!ca.sim.ropePins,
					b = !!ca.sim.oropePins;
				out += a && b ? 'b' : a ? 'i' : b ? 'o' : '.';
			}
			return out;
		},
		/** the leads' settling after the wheel stops (relax.ts), compartment n */
		relax: (n: number) => byN(n).relaxState(),
		/** the robot layer of compartment n */
		robotLayer: (n: number) => byN(n).robots,
		/** QA: the re-layout path (as a resize or a late layout change would run it) */
		relayout: () => relayout(),
		/** QA: static ↔ motion as reduced motion or print would switch */
		toStatic: () => toStatic(),
		toMotion: () => toMotion(),
		H,
	};
	window.__scroll = scrollApi;
	window.__panel = panelApi;

	/* ------------------------------------------------------------ boot */
	let lastW = 0,
		lastH = 0,
		firstBoot = true;
	async function boot(o?: { V?: number }) {
		if (!motion) return;
		try {
			// the first boot in slices (no long task); a later one (reduced motion off, after print) at once
			if (firstBoot && !CAPTURE) await rebuildAsync();
			else rebuild();
			if (!motion) return;
			// the viewport changed while booting: measure again (cached programs, at once)
			if (document.documentElement.clientWidth !== vw || Math.abs(window.innerHeight - vh) >= 120) rebuild();
		} catch (err) {
			// the static, tested panel is the fallback
			console.error(err);
			motion = false;
			root.classList.remove('motion');
			for (const s of stages) s.unbuild();
			if (restore) window.scrollTo({ top: restore.V, behavior: 'instant' });
			return;
		}
		lastW = vw;
		lastH = vh;
		if (o?.V != null) goTo(Vinv(o.V));
		else if (firstBoot && restore) {
			// what an anchor jump had opened is open again after a reload or Back
			for (const s of stages) if (restore.L?.includes(s.n)) s.tr.latched = true;
			goTo(restore.w === vw && restore.h === vh && restore.sda === SDA ? restore.Y : Vinv(restore.V));
			// a fragment naming a compartment whose track the restored place lies in: its latch, as the jump had it
			const id = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
			const tgt = id ? document.getElementById(id) : null;
			const s = tgt ? stages.find((k) => k.sec === tgt || k.sec.contains(tgt)) : null;
			if (s && !s.free && window.scrollY + 0.5 * vh >= s.tr.y0 && window.scrollY < s.tr.yB) s.tr.latched = true;
		} else if (location.hash) {
			const y = hashY(decodeURIComponent(location.hash.slice(1)));
			if (y != null) goTo(y);
		}
		firstBoot = false;
		prefill(CAPTURE);
		scrollApi.settle();
		scrollApi.ready = true;
		panelApi.ready = true;
		root.dataset.panelReady = '1';
	}
	// a resize re-lays out once it settles (a window drag sends many); phones: the URL bar changes innerHeight by
	// < 120 px, which is not a re-layout (the pen line is in svh)
	// the place is taken at the first resize event of a burst (the model is still the one the visitor saw)
	let resizeT = 0,
		resizeA: Anchor | null = null;
	addEventListener('resize', () => {
		if (!motion || !built) return;
		if (document.documentElement.clientWidth === lastW && Math.abs(window.innerHeight - lastH) < 120) return;
		// (from the place last drawn: by the resize event the browser may already have clamped the scroll
		// position to the new, shorter page)
		resizeA ??= anchorNow(renderedY ?? window.scrollY);
		clearTimeout(resizeT);
		resizeT = window.setTimeout(() => {
			const a = resizeA;
			resizeA = null;
			if (!motion || !built) return;
			// (QA: the place the re-layout kept)
			(window as Window & { __resizeAnchor?: unknown }).__resizeAnchor = a && a.k === 'el' ? { ...a, el: a.el.tagName } : a;
			relayout(a ?? undefined);
			lastW = vw;
			lastH = vh;
		}, 140);
	});
	// a late layout change (web font swap, an image without a box, the visitor resizing the message box): re-plan only
	// when what the zones depend on moved (the signature), once it settles; never inside the frame that changed it
	if ('ResizeObserver' in window) {
		const cab = document.querySelector<HTMLElement>('[data-cab]');
		let roT = 0;
		const ro = new ResizeObserver(() => {
			if (!motion || !built || roT) return;
			roT = window.setTimeout(() => {
				roT = 0;
				requestAnimationFrame(() => {
					if (!motion || !built) return;
					if (signature() !== sig) relayout();
					else if (contactSec) {
						// below the last zone (Contact, the footer): only Contact's own geometry can change (the receipt, the
						// message box): the cable's gland and the sleeve's place
						relayoutContact();
						render(true);
					}
				});
			}, 120);
		});
		if (cab) ro.observe(cab);
		if (heroEl) ro.observe(heroEl);
		if (contactSec) ro.observe(contactSec);
	}
	(document.fonts?.ready ?? Promise.resolve()).then(() => boot());
	/** every part of the Contact form is built (showpiece/form.ts): the nav's indicator shows its seventh pin */
	function setFormBuilt(all: boolean) {
		if (all === formBuilt) return;
		formBuilt = all;
		if (!motion && nav) nav.dataset.x0 = all ? '7' : '6';
		kick();
		if (CAPTURE) render(true);
	}
	return { isMotion: () => motion, setFormBuilt };
}
