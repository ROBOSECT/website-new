/**
 * Arrival rules, site-wide (19/11/2026: «links to home and to the other sections always start from the head»).
 *
 * - Every link of the site goes forward: the logo, Back to home, a link to a page the visitor came from. The page it
 *   opens starts at its top, or at its anchor when the link names one (/#team: the section's title lands under the bar,
 *   the panel and the browser do it). No link is turned into the browser's Back, and none flags a place to restore.
 * - A page reached going forward from the site with no anchor is put at its top (top()), in case the host kept a scroll.
 * - The browser's own Back and Forward are left as they are. Safety net: on each click on an internal link the place is
 *   saved in sessionStorage, per page (a reference element and its distance from the top of the viewport, not scrollY:
 *   the home's height changes with width, fonts and the panel's glide); after Back, when the reference element is not
 *   where it was (another viewport width, late images and fonts), the page is moved by the difference, a few times,
 *   instantly. A visitor who scrolls first is never moved.
 * All storage access is in try/catch: without it the pages behave as before.
 */
const KEY = 'robosect-ritorno';
// /it/ and /it/index.html are the same page (the preview copy of the site links its pages as index.html files)
const norm = (p: string) => p.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';

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

/** reached going forward from another page of the site: a referrer of this origin (an outside arrival may carry a text
 * fragment the browser scrolls to, which location.hash does not show) */
const inner = () => {
	try {
		return !!document.referrer && new URL(document.referrer).origin === location.origin;
	} catch {
		return false;
	}
};

/** a page reached going forward, with no anchor, starts at its top: the browser does it, and this makes sure of it where a
 * host keeps a scroll position between the documents of its frame (19/11/2026, the claude.ai preview). Now and once more
 * after the load; the visitor's own scroll or key wins. */
function top() {
	let stop = false;
	for (const t of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(t, () => (stop = true), { once: true, passive: true });
	const go = () => {
		if (!stop && scrollY !== 0) scrollTo({ top: 0, behavior: 'instant' });
	};
	go();
	if (document.readyState === 'complete') requestAnimationFrame(go);
	else addEventListener('load', () => requestAnimationFrame(go), { once: true });
}

function init() {
	const here = norm(location.pathname);
	const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;

	document.addEventListener('click', (e) => {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
		if (!a || a.origin !== location.origin || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
		const dest = norm(a.pathname);
		if (dest === here) return; // same page: anchors and the logo on the home belong to the page itself
		remember(a);
	});

	// browser Back/Forward: the saved place of this page
	const ref = read()[here];
	if (ref && nav?.type === 'back_forward') settle(ref);
	else if (nav?.type === 'navigate' && !location.hash && inner()) top();
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
