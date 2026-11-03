/**
 * The Contact finale's player: the robots make the R of the logo out of a straight cable (rfilm.ts), next to the form.
 *
 * A live animation on its own clock (not scroll-driven, not a video): it starts when the stage comes into view, pauses
 * off screen, with the tab hidden and while the visitor writes in the form, and holds its last frame (the finished R) when
 * it is done. The form is a plain, complete form from the start: the animation never blocks typing or sending. The
 * operator station: RESET (blue, lit when the R is finished) plays it again from the straight cable; STOP (red, latching)
 * halts the robots, a second press lets them go on. With reduced motion (or before the script runs, or without it) the
 * stage shows the finished R (the build's poster) and the station is inert.
 *
 * QA: window.__show (state, seek, play, stop, reset, complete, tEnd); ?panel-capture=1 steps the clock only from
 * __showTick (no rAF).
 */
import { film } from './rfilm';
import { Live } from './rview';

export interface ShowHooks {
	/** the form is complete (always: kept for the nav's indicator) */
	onBuilt?: (all: boolean) => void;
}
type State = 'poster' | 'playing' | 'paused' | 'stopped' | 'done';

export function initShowpiece(fig: HTMLElement, hooks: ShowHooks = {}) {
	const Q = new URLSearchParams(location.search);
	const CAPTURE = Q.get('panel-capture') === '1';
	const rmQ = window.matchMedia('(prefers-reduced-motion: reduce)');
	const root = document.documentElement;
	const svg = fig.querySelector<SVGSVGElement>('[data-show-svg]')!;
	const resetBtn = fig.querySelector<HTMLButtonElement>('[data-reset]')!;
	const stopBtn = fig.querySelector<HTMLButtonElement>('[data-stop]')!;
	hooks.onBuilt?.(true);

	const F = film();
	const tEnd = F.tEnd;
	let live: Live | null = null;
	let poster = '';
	let state: State = 'poster';
	let t = tEnd;
	let inView = false,
		typing = false,
		stopLatched = false,
		started = false;
	let raf = 0,
		last = 0;
	const motion = () => root.classList.contains('motion') && !rmQ.matches;

	const setState = (s: State) => {
		state = s;
		fig.dataset.state = s;
		if (s === 'done') fig.setAttribute('data-lamp', '');
		else fig.removeAttribute('data-lamp');
	};
	const mount = () => {
		if (live) return;
		poster = svg.innerHTML;
		live = new Live(svg, F);
	};
	const draw = () => live?.frame(Math.min(t, tEnd));
	const running = () => state === 'playing' && inView && !typing && !stopLatched && !document.hidden;
	const tick = (now: number) => {
		raf = 0;
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		step(dt);
		if (running()) raf = requestAnimationFrame(tick);
	};
	/** advance the film by dt seconds (rAF, or the capture tick) */
	function step(dt: number) {
		if (state !== 'playing' || !running()) return;
		t = Math.min(tEnd, t + dt);
		draw();
		if (t >= tEnd) setState('done');
	}
	const kick = () => {
		if (CAPTURE || raf || !running()) return;
		last = performance.now();
		raf = requestAnimationFrame(tick);
	};
	/** play from the straight cable */
	function play() {
		if (!motion() && !CAPTURE) return;
		mount();
		started = true;
		t = 0;
		draw();
		setState('playing');
		kick();
	}
	/** the finished R at once (Send, or an explicit request) */
	function complete(_why?: string) {
		if (!live) return;
		t = tEnd;
		draw();
		setState('done');
	}

	// the station
	resetBtn.addEventListener('click', () => {
		if (!motion()) return;
		stopLatched = false;
		stopBtn.setAttribute('aria-pressed', 'false');
		play();
	});
	stopBtn.addEventListener('click', () => {
		if (!motion()) return;
		stopLatched = !stopLatched;
		stopBtn.setAttribute('aria-pressed', String(stopLatched));
		if (!stopLatched) kick();
	});

	// reduced motion: the finished R (the poster), the station inert
	const applyMotion = () => {
		if (motion() || CAPTURE) {
			fig.removeAttribute('data-inert');
			return;
		}
		fig.setAttribute('data-inert', '');
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
		if (live) {
			t = tEnd;
			draw();
		}
		setState(live ? 'done' : 'poster');
	};
	rmQ.addEventListener?.('change', applyMotion);
	applyMotion();

	// in view: the first time it starts from the straight cable; later it goes on where it was
	const io = new IntersectionObserver(
		(es) => {
			for (const e of es) inView = e.isIntersecting;
			if (inView && !started && motion()) play();
			else kick();
		},
		{ threshold: 0.35 },
	);
	io.observe(fig.querySelector('[data-show-stage]') ?? fig);
	document.addEventListener('visibilitychange', () => kick());

	const api = {
		get state() {
			return state;
		},
		get t() {
			return t;
		},
		tEnd,
		k: F.k,
		play,
		complete,
		seek(s: number) {
			mount();
			started = true;
			t = Math.max(0, Math.min(tEnd, s));
			draw();
			setState(t >= tEnd ? 'done' : 'playing');
		},
		stop: () => stopBtn.click(),
		reset: () => resetBtn.click(),
		/** the poster markup (the build's end frame), for QA */
		poster: () => poster || svg.innerHTML,
	};
	(window as Window & { __show?: typeof api; __showTick?: (s: number) => void }).__show = api;
	if (CAPTURE) {
		inView = true;
		(window as Window & { __showTick?: (s: number) => void }).__showTick = (s: number) => step(s);
	}
	return {
		/** the visitor is writing: the robots hold still (and go on when they stop) */
		fermata(on: boolean) {
			typing = on;
			if (!on) kick();
		},
		complete,
	};
}
