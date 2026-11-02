/**
 * The showpiece's player (client notes 14, 16, 17; finale/SHOWPIECE-V2.md): a live machine, not a video, and the robots
 * build the Contact form. No timeline, no chapters, no time code, no captions, no codes, no zooms: the cell has its own
 * operator station with two real pushbuttons (HTML <button>s, keyboard-focusable, named in EN and IT):
 *
 *   RESET (blue, illuminated: IEC 60073 blue = a reset/mandatory action) resets the environment visibly and physically and
 *            runs the job again: the breaker trips, the work light dims, the clamp lets go and the cage opens, the wire ends
 *            spring back to their curled hang, each arm takes its tool home and waits bare over its first tool (program.ts
 *            resetBranch, QA'd at build time). The form's parts go back to their slots, except those with content or focus
 *            (form.ts reset), and are built again as the job runs. Pressed mid-job, the robots first finish the move they are
 *            in (≤ 2.2 s). Its lamp glows when the job has finished or the robots are stopped
 *   STOP     (red, latching: WCAG 2.2.2) a protective stop: the robots halt (at the next rest clear of a pulse) and hold, the
 *            build with them (it runs on the film's clock); pressed again (or RESET) they carry on
 *
 *   autoplay once ≥ 50 % of the stage (or 30 % of the form) is in view, the tab visible, no reduced motion, no latched STOP;
 *            off screen or hidden it holds in place and resumes in place. The nav's Let's talk only takes the visitor here:
 *            the film plays and the robots build the form in front of them (review 3: it is not an intent)
 *   intent   any sign the visitor wants to use the form (focus, Tab, typing, autofill, a press, or the pointer MOVED onto it
 *            and resting there 0.3 s: a pointer the page scrolls under is not an intent) builds every part at once
 *            (form.ts complete) and the cell settles to its end frame (the job done, the robots parked, the breaker on) in
 *            one short cross-fade, in step with the form's snap: the film never runs on beside a built form (review 3).
 *            RESET glows; it is the only thing that replays. Nothing reacts per keystroke
 *   Send     just sends (contact.ts): no climax here
 *   reduced motion: the end frame, the form built, RESET and STOP inert and unlit (client note 17: RESET does nothing heavy)
 *
 * Frames only when they matter: rAF runs while the film or a reset moves, never while held, stopped, off-screen, hidden or in
 * standby. QA: window.__show (state, seek, play, stop, reset, complete, form, perf, tick); ?panel-capture=1 steps the clock
 * from __showTick (no rAF).
 */
import { PROF } from '../core';
import { compileSteps } from './compile';
import { filmSrc, resetBranch, rests, type ResetSrc } from './program';
import { VB } from './scene';
import { frameState, startReset, type Compiled, type Reset } from './state';
import { Live, armsOf, derive, stageTree } from './render';
import { FormBuild } from './form';

interface Cfg {
	lang: string;
	ready: number;
	hold: number;
	/** the film times a RESET may start from (each one's whole reset passed the build-time robot QA) */
	resets: number[];
}
type State = 'poster' | 'playing' | 'stopped' | 'offscreen' | 'ready' | 'resetting';
/** the cell's settle to its end frame on an intent: one cross-fade (ms), in step with the form's 0.3 s snap */
const SETTLE_MS = 420;
/** film seconds per second of real time (review 3, SP-06/S12: the untouched build within note 17's ≈ 15–25 s: Send built at
 * film 28.8 s, 24 s of real time; the film's own times, its QA and capture mode's steps are unchanged) */
const FILM_RATE = 1.2;
/** a RESET's reverse runs faster still (review 3, SP-07; note 16 asked for 1–2 s): × 7/6 on top of the film's rate, 1.4 */
const RESET_BOOST = 7 / 6;
export interface ShowHooks {
	/** every part of the form is built (true) or not any more (a RESET: false) */
	onBuilt?: (all: boolean) => void;
}

export function initShowpiece(fig: HTMLElement, hooks: ShowHooks = {}) {
	const cfg = JSON.parse(fig.dataset.cfg ?? '{}') as Cfg;
	const Q = new URLSearchParams(location.search);
	const CAPTURE = Q.get('panel-capture') === '1';
	const rmQ = window.matchMedia('(prefers-reduced-motion: reduce)');
	const root = document.documentElement;
	const stageEl = fig.querySelector<HTMLElement>('[data-show-stage]')!;
	const svg = fig.querySelector<SVGSVGElement>('[data-show-svg]')!;
	const resetBtn = fig.querySelector<HTMLButtonElement>('[data-reset]')!;
	const stopBtn = fig.querySelector<HTMLButtonElement>('[data-stop]')!;
	const card = fig.closest<HTMLElement>('[data-card]')!;
	const overlay = card.querySelector<SVGSVGElement>('[data-build-wire]');
	const form = card.querySelector<HTMLFormElement>('[data-contact-form]');
	const formcell = card.querySelector<HTMLElement>('[data-formcell]');

	let C: Compiled | null = null;
	let live: Live | null = null;
	let fb: FormBuild | null = null;
	let mode: 'desk' | 'phone' = 'desk';
	let state: State = 'poster';
	/** the film clock (s) */
	let t = cfg.hold;
	/** the film clock's motion: run at rate 1, ease in (accelerando), ease out to a stop (ritardando), or stopped */
	const clk = { mode: 'stop' as 'run' | 'acc' | 'dec' | 'stop', r: 0, aT: 0.5, d0t: 0, dStop: 0, dT: 0, dS: 0 };
	let stopLatched = false;
	let typing = false;
	let started = false;
	let inView = false;
	let visStage = 0,
		visForm = 0;
	/** RESET pressed mid-job: the film time the robots finish their move at, then the reset starts there */
	let resetAt: number | null = null;
	let rs: Reset | null = null;
	/** the reset's clock rate (a STOP eases it to 0, a release back to 1) */
	let rr = 1,
		rrTarget = 1;
	let restsCache: number[] | null = null;
	let lastFrameKey = '';
	let allBuilt: boolean | null = null;
	/** the form was not on screen when the build took it over (else it stays built: never unbuild what is looked at) */
	let unbuiltAtStart = false;
	/** an intent came before the film was compiled */
	let pendingComplete = false;
	let pendingSettle = false;
	const perf = { frames: 0, raf: 0, ms: [] as number[], at: [] as number[] };
	const tEnd = () => cfg.hold;

	/* ------------------------------------------------------------ the form: unbuilt from the start (motion, off screen) */
	const formOnScreen = () => {
		if (!form) return false;
		const r = form.getBoundingClientRect();
		return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
	};
	const motion = () => root.classList.contains('motion') && !rmQ.matches;
	if (form && motion() && !CAPTURE && !formOnScreen() && !location.hash.match(/^#contact$/)) {
		// the slots until the cell builds them (CSS keys off data-build + data-fb; form.ts takes over once compiled)
		unbuiltAtStart = true;
		form.setAttribute('data-build', '');
		form.querySelectorAll<HTMLElement>('[data-part]').forEach((p) => {
			if (!hasAny(p)) p.setAttribute('data-fb', '0');
		});
	} else if (form && CAPTURE && motion()) {
		unbuiltAtStart = true;
		form.setAttribute('data-build', '');
		form.querySelectorAll<HTMLElement>('[data-part]').forEach((p) => p.setAttribute('data-fb', '0'));
	}
	function hasAny(el: HTMLElement) {
		return Array.from(el.querySelectorAll<HTMLInputElement>('input, select, textarea')).some((c) => (c.type === 'checkbox' ? c.checked : c.value.trim() !== ''));
	}

	/* ------------------------------------------------------------ compile in idle slices, mount */
	let compiling = false;
	function compile() {
		if (compiling || C) return;
		compiling = true;
		const g = compileSteps();
		const idle = (cb: (d?: IdleDeadline) => void) => (window.requestIdleCallback ? window.requestIdleCallback(cb, { timeout: 400 }) : window.setTimeout(cb, 16));
		const run = (d?: IdleDeadline) => {
			const t0 = performance.now();
			let r = g.next();
			while (!r.done && performance.now() - t0 < 2 && (!d || d.timeRemaining() > 6)) r = g.next();
			if (r.done) {
				C = r.value;
				firstMount();
				return;
			}
			idle(run);
		};
		if (CAPTURE) {
			let r = g.next();
			while (!r.done) r = g.next();
			C = r.value;
			firstMount();
		} else idle(run);
	}
	function layoutMode() {
		return stageEl.clientWidth < 520 ? 'phone' : 'desk';
	}
	/**
	 * The live stage, in three steps (engine pass, boot blocking time: the first mount is three short tasks in idle time, not
	 * one long one): the scene's nodes are built off the page (the poster stays on screen meanwhile), then the form's build
	 * is set up and measured, then the nodes take the poster's place and the first frame is drawn. A re-mount (a resize that
	 * changes the composition) runs them in one go.
	 */
	function* mountSteps(): Generator<void> {
		if (!C) return;
		const md = layoutMode();
		const A = armsOf(C);
		const holder = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		const tree = stageTree(C, { mode: md, uid: `sp-${cfg.lang}` });
		const nl = new Live(holder, tree, A.frame, A.init, A.robs);
		yield;
		if (form && overlay && !fb) {
			fb = new FormBuild(card, form, stageEl, svg, overlay, C);
			fb.still = !motion() && !CAPTURE;
			fb.snapInstant = CAPTURE || fb.still;
			if (!unbuiltAtStart || fb.still) fb.forceAll();
			fb.setManaged(!fb.still);
			if (pendingComplete) fb.complete(t, false);
			yield;
		}
		mode = md;
		svg.textContent = '';
		svg.setAttribute('viewBox', `${VB.x} ${VB.y} ${VB.w} ${VB.h}`);
		// the arms' print: the wordmark where the arm is long enough, the R mark on phones
		svg.setAttribute('data-logo', mode === 'desk' ? 'w' : 'r');
		fig.dataset.mode = mode;
		svg.append(...Array.from(holder.childNodes));
		live = nl;
		fig.dataset.mounted = '';
		lastFrameKey = '';
		fb?.measure(stuckDy());
		draw();
		paint();
	}
	function mount() {
		for (const _ of mountSteps());
	}
	/** the cell is ready: with motion it waits at rest (the film's first frame: bare arms, tools racked, the wire hanging) for
	 * the visitor to arrive; in reduced motion it shows the end frame (the job done, the robots parked) and RESET starts it */
	function firstMount() {
		if (rmQ.matches && !CAPTURE) {
			t = tEnd();
			state = 'ready';
		} else {
			t = 0;
			state = 'poster';
		}
		const after = () => {
			if (pendingSettle) {
				pendingSettle = false;
				settle('still');
			} else maybeAutoplay();
		};
		if (CAPTURE) {
			mount();
			after();
			return;
		}
		const g = mountSteps();
		const idle = (cb: () => void) => (window.requestIdleCallback ? window.requestIdleCallback(cb, { timeout: 300 }) : window.setTimeout(cb, 16));
		const step = () => {
			if (g.next().done) after();
			else idle(step);
		};
		step();
	}

	/* ------------------------------------------------------------ the clock */
	const nextRest = (from: number) => {
		if (!C) return from;
		restsCache ??= rests(C.S);
		for (const r of restsCache) if (r >= from) return r;
		return cfg.hold;
	};
	/** a stop never freezes a pulse half-way to the form: the next rest after the last pulse in flight lands */
	const clearOfPulses = (at: number) => {
		if (!fb) return at;
		let x = at;
		for (const p of fb.parts) if (x >= p.t - 0.02 && x < fb.doneT(p) + 0.05) x = fb.doneT(p) + 0.05;
		const sg = fb.surgeSpan();
		if (sg && x >= sg[0] - 0.02 && x < sg[1] + 0.05) x = sg[1] + 0.05;
		return x;
	};
	/** the first film time ≥ from whose RESET passed the QA (the end frame always did) */
	const nextSafe = (from: number) => {
		for (const r of cfg.resets) if (r >= from - 1e-4) return r;
		return cfg.hold;
	};
	function run() {
		if (state === 'ready' || state === 'resetting') return;
		if (t >= tEnd() - 1e-6 && resetAt == null) return;
		clk.mode = 'acc';
		clk.aT = 0.5;
		state = 'playing';
		kick();
	}
	/** ease to a stop at `stop` (film time) from the current rate */
	function decelTo(stop: number) {
		const r0 = Math.max(0.15, clk.r);
		const d = Math.max(0, stop - t);
		clk.mode = 'dec';
		clk.d0t = t;
		clk.dStop = stop;
		clk.dT = d > 0 ? (2 * d) / r0 : 0;
		clk.dS = 0;
		kick();
	}
	function holdHere(st: State) {
		clk.mode = 'stop';
		clk.r = 0;
		state = st;
		paint();
	}
	function onClockStopped() {
		if (resetAt != null && Math.abs(t - resetAt) < 1e-6) {
			const at = resetAt;
			resetAt = null;
			beginReset(filmSrc(C!.S, Math.min(at, cfg.hold)));
		}
	}
	function advance(dt: number) {
		if (!live) return;
		if (rs) {
			rr += Math.sign(rrTarget - rr) * Math.min(Math.abs(rrTarget - rr), dt / 0.3);
			rs.tau = Math.min(rs.B.tEnd, rs.tau + dt * rr * RESET_BOOST);
			if (rs.tau >= rs.B.tEnd - 1e-9) endReset();
			return;
		}
		const was = clk.mode;
		if (clk.mode === 'acc') {
			clk.r = Math.min(1, clk.r + dt / clk.aT);
			if (clk.r >= 1) clk.mode = 'run';
			t += clk.r * dt;
		} else if (clk.mode === 'run') {
			clk.r = 1;
			t += dt;
		} else if (clk.mode === 'dec') {
			clk.dS += dt;
			const T = clk.dT;
			if (T <= 0 || clk.dS >= T) {
				t = clk.dStop;
				clk.mode = 'stop';
				clk.r = 0;
			} else {
				const u = clk.dS / T;
				t = clk.d0t + (clk.dStop - clk.d0t) * (1 - (1 - u) * (1 - u));
				clk.r = (2 * (clk.dStop - clk.d0t) * (1 - u)) / T;
			}
		}
		// RESET mid-job: the robots finish the move they are in, easing into the reset's start
		if (resetAt != null && (clk.mode === 'run' || clk.mode === 'acc') && resetAt - t <= 0.3 * Math.max(0.15, clk.r)) decelTo(resetAt);
		if (t >= tEnd() && !rs && resetAt == null) {
			t = tEnd();
			clk.mode = 'stop';
			clk.r = 0;
			if (state !== 'ready') state = 'ready';
		}
		if (was !== 'stop' && clk.mode === 'stop') onClockStopped();
	}

	/* ------------------------------------------------------------ RESET (client note 16): the cell and the form */
	function beginReset(src: ResetSrc) {
		if (!C) return;
		const B = resetBranch(C.S, src);
		rs = startReset(C, B);
		rr = rrTarget = stopLatched ? 0 : 1;
		state = 'resetting';
		clk.mode = 'stop';
		clk.r = 0;
		lastFrameKey = '';
		fb?.reset();
		paint();
		kick();
		if (CAPTURE) draw();
	}
	function endReset() {
		rs = null;
		t = 0;
		started = true;
		lastFrameKey = '';
		state = 'poster';
		if (stopLatched) holdHere('stopped');
		else if (!inView && !CAPTURE) holdHere('offscreen');
		else run();
	}
	function resetPress() {
		// reduced motion: RESET does nothing heavy (client note 17): the end frame stays, the button is inert and unlit
		if (!C || !live || !motion()) return;
		if (rs) {
			// a reset already running: RESET releases a latched STOP
			if (stopLatched) release();
			return;
		}
		stopLatched = false;
		started = true;
		if (t >= cfg.hold - 1e-6) return beginReset(filmSrc(C.S, cfg.hold));
		// before the first tool is coupled the cell is still at rest: the job (and the build) simply start again
		const first = Math.min(...C.S.couples.map((c) => c.t0));
		if (t <= first + 1e-6) {
			fb?.reset();
			t = 0;
			lastFrameKey = '';
			state = 'poster';
			run();
			paint();
			if (CAPTURE) draw();
			return;
		}
		const s = nextSafe(t);
		if (Math.abs(s - t) < 1e-6 && clk.mode === 'stop') return beginReset(filmSrc(C.S, s));
		resetAt = s;
		if (clk.mode === 'stop' || state !== 'playing') {
			if (state !== 'playing') state = 'poster';
			run();
		}
		paint();
	}

	/* ------------------------------------------------------------ STOP (client note 16, WCAG 2.2.2): a latching protective stop */
	function stopPress() {
		if (!live || !motion()) return;
		if (stopLatched) return release();
		stopLatched = true;
		if (rs) rrTarget = 0;
		else if (state === 'playing' || clk.mode !== 'stop') {
			state = 'stopped';
			const r = nextRest(clearOfPulses(t));
			decelTo(Math.min(resetAt ?? Infinity, r - t <= 0.8 ? r : clearOfPulses(t + 0.175 * Math.max(0.15, clk.r))));
		} else if (state !== 'ready') state = 'stopped';
		paint();
		kick();
	}
	function release() {
		stopLatched = false;
		if (rs) rrTarget = 1;
		else if (state === 'stopped' || state === 'poster') {
			if (!started && !CAPTURE) {
				state = 'poster';
				maybeAutoplay();
			} else if (!inView && !CAPTURE) state = 'offscreen';
			else run();
		}
		paint();
		kick();
	}

	/* ------------------------------------------------------------ the frame */
	let raf = 0;
	let last = 0;
	function needsFrames() {
		if (!live || document.hidden) return false;
		if (rs) return rr > 0 || rrTarget > 0;
		return clk.mode !== 'stop';
	}
	let inLoop = false;
	function kick() {
		if (CAPTURE || raf || inLoop || !needsFrames()) return;
		last = performance.now();
		raf = requestAnimationFrame(loop);
	}
	function loop(now: number) {
		raf = 0;
		perf.raf++;
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		inLoop = true;
		try {
			// (real time: the film's rate; QA ticks and capture steps are in film seconds)
			step(dt * FILM_RATE);
		} finally {
			inLoop = false;
		}
		if (needsFrames()) raf = requestAnimationFrame(loop);
	}
	function step(dt: number) {
		const t0 = performance.now();
		advance(dt);
		draw();
		paint();
		perf.frames++;
		perf.ms.push(performance.now() - t0);
		// (QA, ?panel-prof=1: the film time of each frame)
		if (PROF) perf.at.push(rs ? -rs.tau : t);
		if (perf.ms.length > 8000) {
			perf.ms.splice(0, 4000);
			perf.at.splice(0, 4000);
		}
	}
	function draw() {
		if (!live || !C) return;
		const key = rs ? `r${rs.tau.toFixed(4)}` : `${t.toFixed(4)}`;
		if (key === lastFrameKey) return;
		lastFrameKey = key;
		const fs = frameState(C, t, rs);
		live.frame(derive(C, fs));
		if (fb) {
			fb.frame(t, !!rs, fs.plate, rs ? rs.tau : 0);
			const all = fb.allBuilt(t, !!rs);
			if (all !== allBuilt) {
				allBuilt = all;
				hooks.onBuilt?.(all);
				if (all) fig.dataset.built = '';
				else delete fig.dataset.built;
			}
		}
	}

	/* ------------------------------------------------------------ the HTML around the stage (only what changed) */
	const painted = { lamp: '', stop: '', held: false, inert: null as boolean | null };
	function paint() {
		if (fig.dataset.state !== state) fig.dataset.state = state;
		const mo = motion();
		// reduced motion: the station is inert (nothing to stop, nothing heavy to reset): disabled, unlit
		if (painted.inert !== !mo) {
			painted.inert = !mo;
			resetBtn.disabled = !mo;
			stopBtn.disabled = !mo;
			if (mo) delete fig.dataset.inert;
			else fig.dataset.inert = '';
		}
		// RESET's lamp: lit when the job has finished or the robots are stopped (the button that makes sense to press)
		const lamp = mo && !!live && !rs && resetAt == null && (state === 'ready' || stopLatched || (state !== 'playing' && t >= cfg.hold - 1e-6)) ? 'on' : '';
		if (lamp !== painted.lamp) {
			painted.lamp = lamp;
			if (lamp) fig.dataset.lamp = lamp;
			else delete fig.dataset.lamp;
		}
		const st = String(stopLatched);
		if (st !== painted.stop) {
			painted.stop = st;
			stopBtn.setAttribute('aria-pressed', st);
			if (stopLatched) fig.dataset.stopped = '';
			else delete fig.dataset.stopped;
		}
		// RESET pressed mid-job: the robots first finish the move they are in; the button holds pressed, its lamp blinking
		const held = resetAt != null;
		if (held !== painted.held) {
			painted.held = held;
			if (held) fig.dataset.held = '';
			else delete fig.dataset.held;
		}
		syncFollow();
	}

	/* ------------------------------------------------------------ tall phones: the cell follows the build (review 3, S4) */
	// the fields run far below the cell on a phone: while the robots build them the cell stays in view under the bar (CSS
	// sticky inside the cell-and-form box: native scrolling, released at the form's end), so the job and the box it builds
	// share the screen wherever the visitor reads. An intent (the form complete, the robots parked), STOP, the end frame or
	// Send release it; stuck, it fades out first (it is then at its own place, above the screen)
	const followQ = window.matchMedia('(max-width: 699px) and (min-height: 640px)');
	const anchor = card.querySelector<HTMLElement>('[data-show-anchor]');
	let followOn = false,
		stuckOn = false,
		gapNat = 0,
		unstickT = 0,
		fRaf = 0;
	const gapNow = () => (anchor ? fig.getBoundingClientRect().top - anchor.getBoundingClientRect().bottom : 0);
	/** how far the stuck cell is below its own place (px; 0 unstuck) */
	function stuckDy() {
		return followOn && stuckOn ? Math.max(0, gapNow() - gapNat) : 0;
	}
	/** the untouched build has just ended: the visitor sees the robots park and RESET light for a beat before the cell lets go */
	let readyAt = 0,
		readyT = 0;
	function wantFollow() {
		if (!followQ.matches || !anchor || CAPTURE || !motion() || stopLatched || card.hasAttribute('data-sent')) return false;
		if (fb?.quiet || fb?.still) return false;
		if (state === 'ready') {
			if (!followOn) return false;
			if (!readyAt) {
				readyAt = performance.now();
				clearTimeout(readyT);
				readyT = window.setTimeout(syncFollow, 1650);
			}
			return performance.now() - readyAt < 1600;
		}
		readyAt = 0;
		return state === 'poster' || state === 'playing' || state === 'offscreen' || state === 'resetting';
	}
	function setStuck(on: boolean) {
		if (on === stuckOn) return;
		stuckOn = on;
		if (on) fig.dataset.stuck = '';
		else delete fig.dataset.stuck;
	}
	function checkStuck() {
		fRaf = 0;
		if (followOn) setStuck(gapNow() - gapNat > 0.5);
	}
	function syncFollow() {
		const want = wantFollow();
		if (want === followOn) return;
		clearTimeout(unstickT);
		if (want) {
			delete fig.dataset.unstick;
			if (!('follow' in fig.dataset)) gapNat = gapNow();
			followOn = true;
			fig.dataset.follow = '';
			checkStuck();
			return;
		}
		followOn = false;
		const off = () => {
			delete fig.dataset.unstick;
			delete fig.dataset.follow;
			setStuck(false);
		};
		if (stuckOn && !document.hidden) {
			fig.dataset.unstick = '';
			unstickT = window.setTimeout(off, 260);
		} else off();
	}
	window.addEventListener(
		'scroll',
		() => {
			if (followOn && !fRaf) fRaf = requestAnimationFrame(checkStuck);
		},
		{ passive: true },
	);
	followQ.addEventListener?.('change', () => syncFollow());

	/* ------------------------------------------------------------ policy */
	function maybeAutoplay() {
		if (!live || started || rmQ.matches || stopLatched || document.hidden || !inView) return;
		started = true;
		t = 0;
		run();
	}
	/** the visitor wants to use the form: every part built at once (the form's 0.3 s snap) and the cell settles to its end
	 * frame with it (review 3: the robots never run on beside a built form, nor beside the confirmation) */
	function complete(reason: string) {
		if (fb) {
			if (!fb.still) fb.complete(t, !!rs);
			lastFrameKey = '';
			draw();
			// (the snap runs on its own clock, ≈ 0.3 s: the built state, the nav's pin and the follow, once it has landed)
			window.setTimeout(() => {
				lastFrameKey = '';
				draw();
				syncFollow();
			}, 380);
		} else pendingComplete = true;
		if (form && !fb && unbuiltAtStart) {
			// (not compiled yet: the slots are plain CSS; build them at once)
			form.querySelectorAll<HTMLElement>('[data-part][data-fb]').forEach((p) => p.removeAttribute('data-fb'));
		}
		settle(reason);
	}
	/** the cell to its end frame (the job done, the breaker on, the robots parked with their probes, RESET lit): a short
	 * cross-fade from what is on screen (a copy of the stage's drawing over the live one, fading out), instant off screen,
	 * under a latched STOP, in capture mode and in reduced motion. A film already past Send's build is the robots parking:
	 * it finishes on its own */
	let ghost: SVGSVGElement | null = null;
	function settle(reason: string) {
		started = true;
		if (!C || !live) {
			pendingSettle = true;
			return;
		}
		if (!rs && resetAt == null && t >= tEnd() - 1e-6) {
			state = 'ready';
			paint();
			return;
		}
		const sendDone = fb ? Math.max(...fb.parts.map((p) => fb!.doneT(p))) : cfg.ready;
		if (!rs && resetAt == null && state === 'playing' && t >= sendDone) return;
		const animate = inView && !document.hidden && !CAPTURE && !stopLatched && motion() && reason !== 'still';
		if (animate && !ghost && typeof svg.animate === 'function') {
			const g = svg.cloneNode(true) as SVGSVGElement;
			g.removeAttribute('data-show-svg');
			g.setAttribute('class', 'show__svg show__ghost');
			g.setAttribute('aria-hidden', 'true');
			stageEl.appendChild(g);
			ghost = g;
			const an = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SETTLE_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });
			const done = () => {
				g.remove();
				if (ghost === g) ghost = null;
			};
			an.onfinish = done;
			an.oncancel = done;
		}
		rs = null;
		resetAt = null;
		rr = rrTarget = 1;
		t = tEnd();
		clk.mode = 'stop';
		clk.r = 0;
		state = 'ready';
		lastFrameKey = '';
		draw();
		paint();
	}
	/** (contact.ts, the visitor writing: kept for its callers; the film is already at its end frame by then) */
	function fermata(on: boolean) {
		typing = on;
	}

	/* ------------------------------------------------------------ intent (client note 17: usability is sacred) */
	if (form) {
		const go = (why: string) => complete(why);
		form.addEventListener('focusin', () => go('focus'));
		form.addEventListener('input', () => go('input'), { passive: true });
		form.addEventListener('change', () => go('change'));
		form.addEventListener('keydown', () => go('key'), { passive: true });
		// autofill: Chromium/WebKit start the (empty) animation the form's CSS ties to :-webkit-autofill
		form.addEventListener('animationstart', (e) => {
			if ((e as AnimationEvent).animationName === 'cf-autofill') go('autofill');
		});
		const zone = formcell ?? form;
		zone.addEventListener('pointerdown', (e) => {
			if ((e as PointerEvent).pointerType !== 'touch') go('press');
		});
		// a tap (touch: a scroll that passes over the form is not an intent)
		let tap: { x: number; y: number; t: number } | null = null;
		zone.addEventListener('pointerdown', (e) => {
			const p = e as PointerEvent;
			if (p.pointerType === 'touch') tap = { x: p.clientX, y: p.clientY, t: performance.now() };
		});
		zone.addEventListener('pointerup', (e) => {
			const p = e as PointerEvent;
			if (tap && p.pointerType === 'touch' && Math.hypot(p.clientX - tap.x, p.clientY - tap.y) < 10 && performance.now() - tap.t < 600) go('tap');
			tap = null;
		});
		// the pointer brought onto the form and resting there 0.3 s (review 3, SP-01/ENG-1): only a trusted move of the pointer
		// itself (≥ 3 px from where it last was) starts the dwell, never the page scrolling under a resting pointer (the
		// browser then fires pointerover/enter at the same spot); a wheel, a scroll or the pointer leaving cancels it
		let dwell = 0;
		let lastScroll = -1e9;
		let last: { x: number; y: number } | null = null;
		const cancel = () => {
			clearTimeout(dwell);
			dwell = 0;
		};
		const scrolled = () => {
			lastScroll = performance.now();
			cancel();
		};
		window.addEventListener('wheel', scrolled, { passive: true });
		window.addEventListener('scroll', scrolled, { passive: true });
		document.addEventListener(
			'pointermove',
			(e) => {
				const p = e as PointerEvent;
				if (p.pointerType === 'touch' || !p.isTrusted) return;
				const moved = last ? Math.hypot(p.clientX - last.x, p.clientY - last.y) : Math.hypot(p.movementX || 0, p.movementY || 0);
				last = { x: p.clientX, y: p.clientY };
				if (dwell || moved < 3 || performance.now() - lastScroll < 250) return;
				if (!(p.target instanceof Node) || !zone.contains(p.target)) return;
				dwell = window.setTimeout(() => {
					dwell = 0;
					if (zone.matches(':hover') && performance.now() - lastScroll >= 250) go('hover');
				}, 300);
			},
			{ passive: true },
		);
		zone.addEventListener('pointerleave', cancel);
	}
	// (the nav's Let's talk only takes the visitor here: the film plays and builds the form in front of them; review 3)

	/* ------------------------------------------------------------ the world: visibility, tab, reduced motion */
	const onVis = () => {
		const now = visStage >= 0.5 || visForm >= 0.3;
		const gone = visStage < 0.2 && visForm < 0.1;
		if (now) {
			inView = true;
			if (rs && !stopLatched) rrTarget = 1;
			if (!started) maybeAutoplay();
			else if (state === 'offscreen') {
				if (!stopLatched) run();
				else state = 'stopped';
			}
			kick();
		} else if (gone) {
			inView = false;
			if (rs) rr = rrTarget = 0;
			if (state === 'playing') holdHere('offscreen');
		}
	};
	if ('IntersectionObserver' in window) {
		const io = new IntersectionObserver(
			(es) => {
				for (const e of es) {
					if (e.target === stageEl) visStage = e.intersectionRatio;
					else visForm = e.intersectionRatio;
				}
				onVis();
			},
			{ threshold: [0, 0.1, 0.2, 0.3, 0.5, 1] },
		);
		io.observe(stageEl);
		if (formcell) io.observe(formcell);
		const near = new IntersectionObserver(
			(es) => {
				if (es.some((e) => e.isIntersecting)) {
					compile();
					near.disconnect();
				}
			},
			{ rootMargin: '150% 0px 150% 0px' },
		);
		near.observe(stageEl);
	} else {
		inView = true;
		compile();
	}
	document.addEventListener('visibilitychange', () => {
		if (document.hidden) {
			if (state === 'playing') holdHere('offscreen');
		} else {
			if (state === 'offscreen' && inView && !stopLatched) run();
			if (!started) maybeAutoplay();
			kick();
		}
	});
	rmQ.addEventListener('change', () => {
		// reduced motion switched on: the cell at its end frame at once, the form built, the station inert
		if (rmQ.matches) {
			settle('still');
			if (fb) {
				fb.still = true;
				fb.forceAll();
				fb.setManaged(false);
				lastFrameKey = '';
				draw();
			}
		}
		paint();
	});

	/* ------------------------------------------------------------ the station's buttons */
	resetBtn.addEventListener('click', () => {
		resetBtn.setAttribute('data-press', '');
		setTimeout(() => resetBtn.removeAttribute('data-press'), 160);
		resetPress();
	});
	stopBtn.addEventListener('click', () => stopPress());
	let roT = 0;
	if ('ResizeObserver' in window)
		new ResizeObserver(() => {
			clearTimeout(roT);
			roT = window.setTimeout(() => {
				if (!live) return;
				if (layoutMode() !== mode) mount();
				else if (fb) {
					fb.measure(stuckDy());
					lastFrameKey = '';
					draw();
				}
			}, 120);
		}).observe(card);

	// QA hooks
	const api = {
		seek: (x: number) => {
			rs = null;
			resetAt = null;
			t = Math.max(0, Math.min(x, tEnd()));
			started = true;
			clk.mode = 'stop';
			clk.r = 0;
			state = t >= tEnd() ? 'ready' : 'stopped';
			lastFrameKey = '';
			draw();
			paint();
			return t;
		},
		play: () => (stopLatched ? release() : run()),
		stop: () => stopPress(),
		reset: () => resetPress(),
		complete: (why = 'qa') => complete(why),
		fermata: (on: boolean) => fermata(on),
		state: () => ({ state, t, typing, stopLatched, started, inView, visStage, visForm, resetAt, reset: rs ? { tau: rs.tau, end: rs.B.tEnd, src: rs.B.src.t } : null, compiled: !!C, mode, raf: perf.raf, frames: perf.frames, clk: clk.mode, ready: cfg.ready, hold: cfg.hold, built: allBuilt, formMode: fb?.modeName ?? null }),
		form: () => fb?.state() ?? [],
		/** QA: a RESET frame at reset time x (from the end frame) */
		resetAt: (x: number) => {
			if (!C) return;
			if (!rs) beginReset(filmSrc(C.S, cfg.hold));
			rs!.tau = Math.min(rs!.B.tEnd, x);
			rr = rrTarget = 0;
			lastFrameKey = '';
			draw();
			paint();
		},
		perf: () => {
			const a = perf.ms.slice().sort((x, y) => x - y);
			const q = (p: number) => a[Math.min(a.length - 1, Math.floor(p * a.length))] || 0;
			return { frames: perf.frames, raf: perf.raf, p50: q(0.5), p95: q(0.95), max: a[a.length - 1] || 0 };
		},
		perfSeries: () => ({ ms: perf.ms.slice(), at: perf.at.slice() }),
		perfReset: () => {
			perf.ms.length = 0;
			perf.at.length = 0;
			perf.frames = 0;
			perf.raf = 0;
		},
		tick: (ms: number) => {
			const n = Math.max(1, Math.round(ms / 16.667));
			for (let i = 0; i < n; i++) step(ms / 1000 / n);
		},
		compiled: () => !!C,
		resets: () => cfg.resets.slice(),
	};
	(window as Window & { __show?: typeof api; __showTick?: (s: number) => void }).__show = api;
	if (CAPTURE) (window as Window & { __showTick?: (s: number) => void }).__showTick = (s: number) => step(s);
	paint();
	return { fermata, complete, isBuilt: () => !!allBuilt, api };
}
