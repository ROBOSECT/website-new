/**
 * "Back to where you clicked", site-wide rule: every way back to a page (Back to home, the logo, a link to the page you
 * came from, the browser's Back button) lands where the visitor had clicked, not at the top.
 *
 * - On every click on an internal link the place is saved in sessionStorage, per page: a reference element (the link,
 *   or, when the link sits in the sticky bar, the element at the centre of the screen: its child-index path) and its
 *   distance from the top of the viewport. Not scrollY: the home's height changes with width, fonts and the panel's glide.
 * - Only the return links do it: the ones marked data-ritorno (the logo, Back to home). Every other link (the menu,
 *   See how it works, the buttons) goes forward, and a page reached going forward starts at its top, or at its anchor
 *   (19/11/2026: «How it works» in the menu used to reopen the page where the visitor had left it, because the page
 *   was the one the visitor came from and every link to it was turned into Back).
 * - On arrival by a normal navigation the page remembers where it came from (history.state.rf). A return link to that
 *   page then IS the browser's Back: history.back(), so the entry comes back with its own restoration (the home's
 *   panel restores its program time, other pages the browser's). A link to a precise anchor (/#team) is left alone.
 * - A return link that reaches a page by a longer way (no rf: the visitor went home → products → packaging → logo)
 *   navigates normally and flags the target (robosect-want, valid 15 s): the panel restores its saved place for it
 *   (panel/index.ts), and this module finishes the job below.
 * - Safety net, after Back or a flagged return: when the reference element is not where it was (another viewport width,
 *   late images and fonts), the page is moved by the difference, a few times, instantly. A visitor who scrolls first
 *   is never moved.
 * All storage access is in try/catch: without it the pages behave as before.
 */
const KEY = 'robosect-ritorno';
const WANT = 'robosect-want';
const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/';

type Ref = { p: number[]; top: number; w: number };
type Store = Record<string, Ref>;

const read = (): Store => {
	try {
		return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Store;
	} catch {
		return {};
	}
};
const write = (s: Store) => {
	try {
		sessionStorage.setItem(KEY, JSON.stringify(s));
	} catch {
		/* storage blocked: the browser's own behaviour */
	}
};

const pathOf = (el: Element): number[] => {
	const p: number[] = [];
	for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) p.unshift(Array.prototype.indexOf.call(n.parentElement!.children, n));
	return p;
};
const byPath = (p: number[]): Element | null => {
	let n: Element | null = document.body;
	for (const i of p) n = n?.children[i] ?? null;
	return n;
};
const fixed = (el: Element) => {
	for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
		const pos = getComputedStyle(n).position;
		if (pos === 'fixed' || pos === 'sticky') return true;
	}
	return false;
};

function remember(a: HTMLAnchorElement) {
	let ref: Element | null = a;
	if (fixed(a)) {
		// the sticky bar never moves with the page: the thing under the middle of the screen is the reference
		ref = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
		if (!ref || ref === document.documentElement || ref === document.body || fixed(ref)) ref = null;
	}
	const s = read();
	if (!ref) {
		delete s[norm(location.pathname)];
		return write(s);
	}
	s[norm(location.pathname)] = { p: pathOf(ref), top: Math.round(ref.getBoundingClientRect().top), w: document.documentElement.clientWidth };
	write(s);
}

/** the visitor's own scroll or key cancels the correction */
function settle(ref: Ref) {
	let stop = false;
	const off = () => (stop = true);
	for (const t of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(t, off, { once: true, passive: true });
	let tries = 0;
	const step = () => {
		if (stop || tries++ > 6) return;
		const el = byPath(ref.p);
		if (el) {
			const d = el.getBoundingClientRect().top - ref.top;
			if (Math.abs(d) > 4) scrollTo({ top: scrollY + d, behavior: 'instant' });
		}
		setTimeout(step, 200);
	};
	const start = () => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(step, 250)));
	if (document.readyState === 'complete') start();
	else addEventListener('load', start, { once: true });
}

function init() {
	const here = norm(location.pathname);
	const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;

	// where this entry came from, kept in its history state (survives Back/Forward and reload)
	try {
		if (nav?.type === 'navigate' && document.referrer) {
			const r = new URL(document.referrer);
			if (r.origin === location.origin && norm(r.pathname) !== here) history.replaceState({ ...(history.state ?? {}), rf: norm(r.pathname) }, '');
		}
	} catch {
		/* no state */
	}

	document.addEventListener('click', (e) => {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
		if (!a || a.origin !== location.origin || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
		const dest = norm(a.pathname);
		if (dest === here) return; // same page: anchors and the logo on the home belong to the page itself
		remember(a);
		// a precise anchor goes to the anchor; a link that is not a return link goes forward, to the top of the page
		if (a.hash || !a.hasAttribute('data-ritorno')) return;
		const from = (history.state as { rf?: string } | null)?.rf;
		if (from === dest) {
			e.preventDefault();
			history.back();
		} else {
			try {
				sessionStorage.setItem(WANT, JSON.stringify({ p: dest, t: Date.now() }));
			} catch {
				/* storage blocked */
			}
		}
	});

	// back/forward, or a flagged return: the saved place of this page
	let want = false;
	try {
		const w = JSON.parse(sessionStorage.getItem(WANT) ?? 'null') as { p: string; t: number } | null;
		want = !!w && w.p === here && Date.now() - w.t < 15000;
		if (w && (want || Date.now() - w.t >= 15000)) sessionStorage.removeItem(WANT);
	} catch {
		/* storage blocked */
	}
	const ref = read()[here];
	if (ref && (nav?.type === 'back_forward' || want)) settle(ref);
	addEventListener('pageshow', (e) => {
		// restored from the bfcache: the page is as it was left, only a viewport change can have moved it
		if (e.persisted && ref) settle(ref);
	});
}

try {
	init();
} catch (err) {
	console.error(err);
}

export {};
