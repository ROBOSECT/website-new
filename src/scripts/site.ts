/**
 * Site-wide behaviour, every page: mobile menu, section entrances, the "ready" flag that keeps
 * the progressive-enhancement styles on (see the inline script in BaseLayout).
 */
declare global {
	interface Window {
		__robosectReady?: boolean;
	}
}

const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function initMenu() {
	const toggle = document.querySelector<HTMLButtonElement>('.nav__toggle');
	const menu = document.getElementById('site-menu');
	if (!toggle || !menu) return;
	const label = toggle.querySelector<HTMLElement>('[data-toggle-label]');
	const set = (open: boolean) => {
		toggle.setAttribute('aria-expanded', String(open));
		menu.classList.toggle('is-open', open);
		if (label) label.textContent = (open ? toggle.dataset.closeLabel : toggle.dataset.openLabel) ?? '';
	};
	toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
	menu.addEventListener('click', (e) => {
		if ((e.target as HTMLElement).closest('a')) set(false);
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
			set(false);
			toggle.focus();
		}
	});
	window.matchMedia('(min-width: 1100px)').addEventListener('change', () => set(false));
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

/** one brand on screen (note 10; review 3, S13): on the pages without the hero, the bar's logo leaves while the footer's big
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

/** print (review 3, ENG-11): pictures still waiting for their lazy load are fetched now, so the paper is not left with
 * empty boxes where a browser prints before scrolling them into view */
function initPrint() {
	addEventListener('beforeprint', () => document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = 'eager')));
}

initMenu();
initReveal();
initFooterBrand();
initPrint();
window.__robosectReady = true;
root.classList.add('js');

export {};
