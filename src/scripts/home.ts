/**
 * Homepage behaviour: the panel under test (scripts/panel), Contact's showpiece where the robots build the form
 * (scripts/panel/showpiece), the form (scripts/contact.ts: mailto until a backend exists), and the nav's current-section
 * state.
 */
import { initPanel } from './panel/index';
import { initShowpiece } from './panel/showpiece/player';
import { initContact } from './contact';

const root = document.documentElement;
let panel: ReturnType<typeof initPanel> | undefined;
try {
	panel = initPanel();
} catch (err) {
	// the static, tested panel is the fallback: no pinning, every module open
	root.classList.remove('motion');
	console.error(err);
}

function initShow() {
	const fig = document.querySelector<HTMLElement>('section[data-contact] [data-show]');
	let show: ReturnType<typeof initShowpiece> | null = null;
	try {
		// the robots build the form: when every part is built, the nav's indicator shows its seventh pin
		if (fig) show = initShowpiece(fig, { onBuilt: (all) => panel?.setFormBuilt(all) });
		// a form that is not unbuilt at load (reduced motion, or on screen at load) is built from the start: the nav's
		// seventh pin at once, not only once the cell has drawn its first frame (else, with reduced motion on a phone,
		// the pin would wait until the visitor reached Contact)
		if (fig && !document.querySelector('[data-contact-form]')?.hasAttribute('data-build')) panel?.setFormBuilt(true);
	} catch (err) {
		// the form never depends on the film: without it the form is a plain form and Send still hands the request off
		console.error(err);
		show = null;
		document.querySelectorAll<HTMLElement>('[data-contact-form] [data-fb]').forEach((p) => p.removeAttribute('data-fb'));
		document.querySelector('[data-contact-form]')?.removeAttribute('data-build');
	}
	initContact(show);
}

function initNavState() {
	const links = new Map<string, HTMLElement>();
	document.querySelectorAll<HTMLElement>('[data-nav-link]').forEach((a) => links.set(a.dataset.navLink!, a));
	if (!links.size) return;
	// Contact has no link of its own: the bar's call to action (Let's talk / Parliamone) is its way in, so it is the one
	// marked while Contact is the section on screen: its compartment at the 40 % line, or,
	// with no section there (its own top padding, the closing duct and the footer coming up), still in view below the bar
	// once its top has passed the line. Visual positions (the panel's glide is a transform: the rect includes it).
	const cta = document.querySelector<HTMLElement>('[data-nav-cta]');
	const contact = document.querySelector<HTMLElement>('section#contact');
	const bar = document.querySelector<HTMLElement>('[data-nav]');
	if (cta && contact) links.set('contact', cta);
	const contactInView = () => {
		if (!contact) return false;
		const r = contact.getBoundingClientRect(),
			vh = window.innerHeight;
		return r.top < 0.4 * vh && r.bottom > (bar?.offsetHeight ?? 0) + 0.12 * vh;
	};
	let last = '',
		painted: string | null = null;
	const paint = (sec: string) => {
		last = sec;
		const current = !sec && contactInView() ? 'contact' : sec;
		if (current === painted) return;
		painted = current;
		links.forEach((a, id) => {
			if (id === current) a.setAttribute('aria-current', 'location');
			else a.removeAttribute('aria-current');
		});
	};
	// (the section events come only when the section changes: with none at the line, Contact is checked as the page moves)
	window.addEventListener('scroll', () => !last && paint(''), { passive: true });
	// in motion the panel knows where every compartment is drawn (the runs never show, the page glides): it names the
	// compartment under 40 % of the screen each frame it moves (section boxes include their invisible runs, so
	// observing them would lag one compartment)
	document.addEventListener('panel:section', (e) => paint((e as CustomEvent<string>).detail));
	// static page (no JS motion: reduced motion, print): the stage crossing a thin line at 40 % of the screen
	if (!('IntersectionObserver' in window)) return;
	const inBand = new Set<string>();
	const order = Array.from(document.querySelectorAll<HTMLElement>('section[id]')).map((s) => s.id);
	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				const id = (e.target as HTMLElement).closest('section')!.id;
				if (e.isIntersecting) inBand.add(id);
				else inBand.delete(id);
			}
			if (panel?.isMotion()) return;
			paint(order.filter((id) => inBand.has(id)).pop() ?? '');
		},
		{ rootMargin: '-40% 0px -59% 0px' },
	);
	document.querySelectorAll<HTMLElement>('section[id] > .pin > .stage, section[id] > .stage').forEach((st) => io.observe(st));
}

/** one brand on screen: the bar's logo stays hidden while any part of the hero wordmark is in view below the bar
 * (the page loads at the top with it hidden: no flash), and comes in once the wordmark has gone under the bar */
function initBrandOnce() {
	const wm = document.querySelector<SVGElement>('[data-wordmark]');
	const nav = document.querySelector<HTMLElement>('[data-nav]');
	// the footer's big wordmark is the brand too: the bar's logo leaves while it is in view
	const foot = document.querySelector<HTMLElement>('.footer__mark');
	if (!wm || !nav || !('IntersectionObserver' in window)) {
		document.body.classList.remove('hero-brand-visible');
		return;
	}
	let io: IntersectionObserver | null = null;
	const seen = new Map<Element, boolean>();
	const watch = () => {
		io?.disconnect();
		seen.clear();
		io = new IntersectionObserver(
			(es) => {
				for (const e of es) seen.set(e.target, e.isIntersecting);
				document.body.classList.toggle('hero-brand-visible', [...seen.values()].some(Boolean));
			},
			{ rootMargin: `-${nav.offsetHeight}px 0px 0px 0px` },
		);
		io.observe(wm);
		if (foot) io.observe(foot);
	};
	watch();
	let t = 0;
	window.addEventListener('resize', () => {
		clearTimeout(t);
		t = window.setTimeout(watch, 150);
	});
}

/** the prototype video from the first screen: a modal dialog; the file is fetched only when it opens (without JS the
 * links go to the video in the Prototype section) */
function initVideoDialog() {
	const dlg = document.querySelector<HTMLDialogElement>('[data-video-dialog]');
	const v = dlg?.querySelector<HTMLVideoElement>('video');
	if (!dlg || !v || typeof dlg.showModal !== 'function') return;
	let opener: HTMLElement | null = null;
	document.querySelectorAll<HTMLElement>('[data-video-open]').forEach((a) =>
		a.addEventListener('click', (e) => {
			e.preventDefault();
			opener = a;
			if (!v.src && v.dataset.src) v.src = v.dataset.src;
			dlg.showModal();
			v.play().catch(() => {});
		}),
	);
	dlg.querySelector('[data-video-close]')?.addEventListener('click', () => dlg.close());
	// a click on the backdrop closes it
	dlg.addEventListener('click', (e) => {
		if (e.target === dlg) dlg.close();
	});
	dlg.addEventListener('close', () => {
		v.pause();
		opener?.focus({ preventScroll: true });
	});
}

/** How it works: the drawing's run (test points light, the report fills) once it is on screen and its module is open
 * (in motion the panel opens it after the robot's job: [data-b] reaches full opacity). With reduced motion it stays as
 * drawn: finished. It runs again each time it comes back on screen. */
function initDemo() {
	const fig = document.querySelector<HTMLElement>('[data-sb]');
	if (!fig || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	let poll = 0;
	const opened = () => Number(getComputedStyle(fig).opacity) > 0.95;
	const run = () => {
		fig.removeAttribute('data-run');
		void fig.offsetWidth;
		fig.setAttribute('data-run', '');
	};
	new IntersectionObserver(
		(es) => {
			for (const e of es) {
				clearInterval(poll);
				if (!e.isIntersecting) continue;
				if (opened()) run();
				else
					poll = window.setInterval(() => {
						if (opened()) {
							clearInterval(poll);
							run();
						}
					}, 200);
			}
		},
		{ threshold: 0.5 },
	).observe(fig);
}

initShow();
initNavState();
initBrandOnce();
initVideoDialog();
initDemo();
