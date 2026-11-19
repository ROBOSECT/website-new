/**
 * Site-wide behaviour, every page: mobile menu, section entrances, the "ready" flag that keeps
 * the progressive-enhancement styles on (see the inline script in BaseLayout).
 */
import './ritorno';
import { cablesAt } from '../lib/menu-cables';

declare global {
	interface Window {
		__robosectReady?: boolean;
	}
}

const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/** the menu button's three cables bend into the X and back (lib/menu-cables), 0.4 s, cubic in-out; reduced motion: at once */
function cableIcon(svg: SVGSVGElement | null) {
	const paths = svg ? Array.from(svg.querySelectorAll<SVGGElement>('g')).map((g) => Array.from(g.querySelectorAll('path'))) : [];
	let now = 0;
	let raf = 0;
	const draw = (t: number) => {
		now = t;
		cablesAt(t).forEach((c, i) => {
			paths[i]?.[0]?.setAttribute('d', c.cable);
			paths[i]?.[1]?.setAttribute('d', c.tip);
		});
	};
	return (open: boolean) => {
		if (!paths.length) return;
		cancelAnimationFrame(raf);
		const to = open ? 1 : 0;
		if (!root.classList.contains('motion')) return draw(to);
		const from = now;
		const ms = 400 * Math.abs(to - from);
		const t0 = performance.now();
		const step = (time: number) => {
			const k = ms ? Math.min(1, (time - t0) / ms) : 1;
			draw(from + (to - from) * k);
			if (k < 1) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
	};
}

/** the menu, below 1100 px a drawer from the right under the bar (NavBar.astro). Open: the X and the drawer, the page
 * behind it inert (no focus, no clicks); Esc, a tap on the dim ground, the X or a link close it. The page keeps its
 * scroll (no overflow lock: the place the visitor is at stays where scripts/ritorno.ts reads it). */
function initMenu() {
	const toggle = document.querySelector<HTMLButtonElement>('.nav__toggle');
	const menu = document.getElementById('site-menu');
	if (!toggle || !menu) return;
	const label = toggle.querySelector<HTMLElement>('[data-toggle-label]');
	const scrim = document.querySelector<HTMLElement>('[data-nav-scrim]');
	const icon = cableIcon(toggle.querySelector<SVGSVGElement>('[data-cables]'));
	const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
	const set = (open: boolean) => {
		if (open === isOpen()) return;
		toggle.setAttribute('aria-expanded', String(open));
		menu.classList.toggle('is-open', open);
		scrim?.classList.toggle('is-open', open);
		document.querySelectorAll<HTMLElement>('main, footer.footer').forEach((el) => (el.inert = open));
		if (label) label.textContent = (open ? toggle.dataset.closeLabel : toggle.dataset.openLabel) ?? '';
		icon(open);
	};
	// closing by hand puts the focus back on the button, so it never stays in the hidden drawer
	const close = () => {
		const inside = menu.contains(document.activeElement);
		set(false);
		if (inside) toggle.focus({ preventScroll: true });
	};
	toggle.addEventListener('click', () => {
		const open = !isOpen();
		set(open);
		// the menu comes before the toggle in the page order: without this, Tab from the toggle skips the open menu
		if (open) menu.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
	});
	menu.addEventListener('click', (e) => {
		if ((e.target as HTMLElement).closest('a')) set(false);
	});
	scrim?.addEventListener('click', close);
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && isOpen()) {
			set(false);
			toggle.focus();
		}
	});
	window.matchMedia('(min-width: 1100px)').addEventListener('change', () => set(false));
}

/** the logo's bead of current (NavBar.astro): on hover or keyboard focus it runs once, whole, then waits for the next */
function initLogoBead() {
	const brand = document.querySelector<HTMLElement>('.nav__brand');
	if (!brand) return;
	const run = () => {
		if (!root.classList.contains('motion') || brand.hasAttribute('data-run')) return;
		brand.setAttribute('data-run', '');
	};
	brand.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && run());
	brand.addEventListener('focus', () => brand.matches(':focus-visible') && run());
	brand.addEventListener('animationend', (e) => {
		if ((e.target as Element).classList.contains('nav__cu')) brand.removeAttribute('data-run');
	});
}

function initReveal() {
	const groups = document.querySelectorAll<HTMLElement>('[data-reveal]');
	groups.forEach((g) => Array.from(g.children).forEach((c, i) => (c as HTMLElement).style.setProperty('--i', String(i))));
	if (reduceMotion.matches || !('IntersectionObserver' in window)) {
		groups.forEach((g) => g.classList.add('is-in'));
		return;
	}
	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (e.isIntersecting) {
					e.target.classList.add('is-in');
					io.unobserve(e.target);
				}
			}
		},
		{ rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
	);
	groups.forEach((g) => io.observe(g));
}

/** one brand on screen: on the pages without the hero, the bar's logo leaves while the footer's big
 * wordmark is in view (the home page does the same with its hero: scripts/home.ts) */
function initFooterBrand() {
	if (document.body.classList.contains('is-home') || !('IntersectionObserver' in window)) return;
	const foot = document.querySelector<HTMLElement>('.footer__mark');
	const nav = document.querySelector<HTMLElement>('[data-nav]');
	if (!foot || !nav) return;
	new IntersectionObserver((es) => document.body.classList.toggle('footer-brand-visible', es[es.length - 1].isIntersecting), {
		rootMargin: `-${nav.offsetHeight}px 0px 0px 0px`,
	}).observe(foot);
}

/** the bar is sticky and the page keeps a scroll padding as tall as the bar (anchors land under it), so Chrome scrolls
 * every bar item that takes the keyboard focus "into view" and moves the page up by half a screen at each Tab. The bar
 * is always on screen: the place is put back at once. (The focus scroll happens before focusin, its scroll event only
 * in the next frame: the last scroll event still holds the place the visitor was at.) */
function initBarFocus() {
	const nav = document.querySelector<HTMLElement>('[data-nav]');
	if (!nav) return;
	let lastY = window.scrollY;
	addEventListener('scroll', () => (lastY = window.scrollY), { passive: true });
	nav.addEventListener('focusin', () => {
		if (Math.abs(window.scrollY - lastY) > 1) window.scrollTo({ top: lastY, behavior: 'instant' });
	});
}

/** print: pictures still waiting for their lazy load are fetched now, so the paper is not left with
 * empty boxes where a browser prints before scrolling them into view */
function initPrint() {
	addEventListener('beforeprint', () => document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = 'eager')));
}

/** the language switch keeps the place: the same page in the other language, at the section the visitor is reading
 * (same anchors in both languages). Only where the other language has the same page (the legal pages exist in English
 * only: there the switch goes to the Italian home, at its top). */
function initLangPlace() {
	const a = document.querySelector<HTMLAnchorElement>('a.nav__lang');
	if (!a) return;
	const base = a.getAttribute('href') ?? '';
	// (index.html: the preview copy of the site links its pages as files)
	const bare = (p: string) => p.replace(/index\.html$/, '').replace(/^\/it(?=\/)/, '') || '/';
	a.addEventListener('click', () => {
		a.setAttribute('href', base);
		if (a.hash || bare(a.pathname) !== bare(location.pathname)) return;
		const line = (document.querySelector<HTMLElement>('[data-nav]')?.offsetHeight ?? 0) + 0.4 * window.innerHeight;
		let id = '';
		for (const s of document.querySelectorAll<HTMLElement>('main section[id]')) if (s.getBoundingClientRect().top <= line) id = s.id;
		if (id && id !== 'main') a.setAttribute('href', `${base}#${id}`);
	});
}

initMenu();
initLogoBead();
initBarFocus();
initReveal();
initFooterBrand();
initPrint();
initLangPlace();
window.__robosectReady = true;
root.classList.add('js');

export {};
