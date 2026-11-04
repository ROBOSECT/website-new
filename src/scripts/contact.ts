/**
 * Contact: the form beside the robots' finale. Validity (batched: on change, on blur,
 * or 400 ms after the last keystroke; nothing reacts per keystroke, no frame is ever scheduled by typing), the standby of the
 * cell while the visitor writes, the synchronous mail handoff, the length guard, the copy chain, the "nothing opened?"
 * detector and the confirmation. Sending just sends: no climax.
 *
 * The handoff runs first, synchronously inside the submit event (iOS Safari composes only with the user's activation): the
 * animation can never block the request. Without a backend the page never says "sent" (a backend later: one function,
 * `deliver`, swaps the mailto for the endpoint).
 */
type Show = {
	fermata(on: boolean): void;
	complete(why: string): void;
} | null;

interface Cfg {
	live: string;
	handoff: { subject: string; subjectOther: string; sbSector: string; consentLine: string; shortened: string; copied: string; selectCopy: string; nothingOpened: string; restored: string; previewTo: string; previewSubject: string };
	fieldLabels: Record<string, string>;
}
const TO = 'info@robosect.it';
const MAX_URL = 1800;
const REQUIRED = ['sector', 'name', 'company', 'email', 'consent'];
/** the switchboard questions: sent only when the visitor builds switchboards */
const SB_KEYS = ['boards', 'volumes', 'eplan'];

export function initContact(show: Show) {
	const sec = document.querySelector<HTMLElement>('section[data-contact]');
	const form = sec?.querySelector<HTMLFormElement>('[data-contact-form]');
	const fig = sec?.querySelector<HTMLElement>('[data-show]');
	if (!sec || !form || !fig) return null;
	const cfg = JSON.parse(fig.dataset.cfg ?? '{}') as Cfg;
	const sendRow = form.querySelector<HTMLElement>('[data-part="send"]')!;
	const sendBtn = sendRow.querySelector<HTMLButtonElement>('button')!;
	const receipt = sec.querySelector<HTMLElement>('[data-receipt]')!;
	const receiptH = receipt.querySelector<HTMLElement>('[data-receipt-h]')!;
	const receiptLead = receipt.querySelector<HTMLElement>('[data-receipt-lead]')!;
	const mailAgain = receipt.querySelector<HTMLAnchorElement>('[data-mail-again]')!;
	const preview = receipt.querySelector<HTMLElement>('[data-preview]')!;
	const liveEl = sec.querySelector<HTMLElement>('[data-live]')!;
	const copyMsg = receipt.querySelector<HTMLButtonElement>('[data-copy="message"]')!;
	const copyAddr = receipt.querySelector<HTMLButtonElement>('[data-copy="address"]')!;
	const el = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | RadioNodeList | null;
	const partOf = (name: string) => form.querySelector<HTMLElement>(`[data-part="${name}"]`);

	let message = { subject: '', body: '', href: '', full: '' };

	/* ------------------------------------------------------------ validity (batched): a valid required box's rule turns copper */
	const isValid = (name: string) => {
		const e = el(name);
		if (!e) return false;
		if (e instanceof RadioNodeList) return e.value !== '';
		if (e instanceof HTMLInputElement && e.type === 'checkbox') return e.checked;
		return e.value.trim() !== '' && e.checkValidity();
	};
	function refresh() {
		let n = 0;
		for (const k of REQUIRED) {
			const ok = isValid(k);
			if (ok) n++;
			const f = partOf(k);
			if (f && ok !== f.hasAttribute('data-valid')) {
				if (ok) f.setAttribute('data-valid', '');
				else f.removeAttribute('data-valid');
			}
		}
		if ((n === REQUIRED.length) !== sendRow.hasAttribute('data-armed')) {
			if (n === REQUIRED.length) sendRow.setAttribute('data-armed', '');
			else sendRow.removeAttribute('data-armed');
		}
	}
	let deb = 0;
	const later = () => {
		clearTimeout(deb);
		deb = window.setTimeout(refresh, 400);
	};
	form.addEventListener('input', later, { passive: true });
	form.addEventListener('change', () => {
		clearTimeout(deb);
		refresh();
	});
	form.addEventListener('focusout', () => {
		clearTimeout(deb);
		refresh();
	});

	/* ------------------------------------------------------------ standby: the cell rests while the visitor writes */
	let leaveT = 0;
	form.addEventListener('focusin', (e) => {
		clearTimeout(leaveT);
		const t = e.target as HTMLElement;
		if (t.matches('input[type="text"], input[type="email"], input[type="tel"], textarea')) show?.fermata(true);
	});
	form.addEventListener('keydown', () => show?.fermata(true), { passive: true, once: false });
	form.addEventListener('focusout', (e) => {
		const to = (e as FocusEvent).relatedTarget as Node | null;
		if (to && form.contains(to)) return;
		clearTimeout(leaveT);
		leaveT = window.setTimeout(() => show?.fermata(false), 2000);
	});

	/* ------------------------------------------------------------ compose and hand off (synchronously) */
	function compose() {
		const data = new FormData(form!);
		const L = cfg.fieldLabels;
		const sector = String(data.get('sector') ?? '');
		const sb = sector === cfg.handoff.sbSector;
		const keys = ['sector', 'name', 'company', 'email', 'phone', 'boards', 'volumes', 'eplan', 'process'].filter((k) => sb || !SB_KEYS.includes(k));
		const vals: Record<string, string> = {};
		for (const key of keys) vals[key] = String(data.get(key) ?? '').trim();
		const co = vals.company;
		const subject = `${sb ? cfg.handoff.subject : cfg.handoff.subjectOther}${co ? ` · ${co}` : ''}`;
		const bodyOf = (v: Record<string, string>, note = '') => {
			const lines: string[] = [];
			for (const key of keys) if (v[key]) lines.push(`${L[key] ?? key}: ${v[key]}`);
			lines.push('', cfg.handoff.consentLine);
			return lines.join('\n') + note;
		};
		const url = (b: string) => `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(b)}`;
		const fullBody = bodyOf(vals);
		let body = fullBody;
		let href = url(body);
		let shortened = false;
		// the length guard: the identifying fields and the consent line always stay; only the free texts
		// is shortened (how they test today), cut at a word boundary, then the note
		if (href.length > MAX_URL) {
			shortened = true;
			const note = '\n\n' + cfg.handoff.shortened;
			const v = { ...vals };
			for (const key of ['process']) {
				if (url(bodyOf(v, note)).length <= MAX_URL) break;
				const whole = v[key];
				// the longest prefix (binary search on its length) that fits, then back to the last space
				let lo = 0,
					hi = whole.length;
				while (lo < hi) {
					const mid = Math.ceil((lo + hi) / 2);
					if (url(bodyOf({ ...v, [key]: whole.slice(0, mid) + ' …' }, note)).length <= MAX_URL) lo = mid;
					else hi = mid - 1;
				}
				let cut = whole.slice(0, lo);
				const sp = cut.lastIndexOf(' ');
				if (sp > lo * 0.6) cut = cut.slice(0, sp);
				v[key] = cut ? cut.trimEnd() + ' …' : '';
			}
			body = bodyOf(v, note);
			href = url(body);
		}
		const full = `${cfg.handoff.previewTo}: ${TO}\n${cfg.handoff.previewSubject}: ${subject}\n\n${fullBody}`;
		return { subject, body, href, full, shortened };
	}
	/** the handoff (a backend later replaces this one function) */
	function deliver(href: string) {
		// (QA: the handoff is recorded instead of leaving the page)
		if (form!.dataset.qa === 'no-mailto') return void ((window as Window & { __mailto?: string }).__mailto = href);
		// (a sandboxed frame may refuse the navigation: the confirmation still offers the link and the copy)
		try {
			window.location.href = href;
		} catch {
			/* the receipt's own link and copy buttons remain */
		}
	}

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		// (the browser only fires submit for a valid form: an invalid one shows its own messages)
		const m = compose();
		message = m;
		deliver(m.href);
		mailAgain.href = m.href;
		preview.textContent = m.full;
		if (m.shortened) {
			copyMsg.classList.add('btn');
			mailAgain.classList.remove('btn');
			mailAgain.classList.add('receipt__ghost');
		}
		detectNothing();
		show?.complete('send');
		sendBtn.setAttribute('data-press', '');
		setTimeout(() => sendBtn.removeAttribute('data-press'), 80);
		// the confirmation replaces the form at once (Send's press reads first: 120 ms)
		window.setTimeout(() => showReceipt(true), 120);
	});

	let announced = false;
	function showReceipt(anim: boolean) {
		if (!receipt.hidden) return;
		// (Enter in a field submits too; that field is hidden with the form, so the heading takes the focus)
		const ae = document.activeElement;
		const focusWasHere = !ae || ae === document.body || form!.contains(ae);
		form!.setAttribute('data-sent', '');
		// (the card too: the form's wire overlay goes with the form where :has() is not supported)
		form!.closest('[data-card]')?.setAttribute('data-sent', '');
		receipt.hidden = false;
		if (anim) receipt.setAttribute('data-appear', '');
		if (focusWasHere) receiptH.focus({ preventScroll: true });
		// the shorter confirmation replaces the taller form: its heading is brought just under the bar when it
		// is not on screen (html's scroll-padding-top is the bar's height)
		const r = receiptH.getBoundingClientRect();
		const bar = document.querySelector<HTMLElement>('[data-nav]')?.offsetHeight ?? 0;
		if (r.top < bar + 4 || r.bottom > window.innerHeight - 8) receiptH.scrollIntoView({ block: 'start' });
		if (!announced) {
			announced = true;
			liveEl.textContent = cfg.live;
		}
	}
	receipt.querySelector('[data-change]')?.addEventListener('click', () => {
		receipt.hidden = true;
		receipt.removeAttribute('data-appear');
		form.removeAttribute('data-sent');
		form.closest('[data-card]')?.removeAttribute('data-sent');
		receiptLead.removeAttribute('data-on');
		sendBtn.focus({ preventScroll: true });
	});

	/* ------------------------------------------------------------ "nothing opened?" (no blur, no hide within 1.8 s) */
	function detectNothing() {
		let left = false;
		const mark = () => (left = true);
		addEventListener('blur', mark, { once: true });
		document.addEventListener('visibilitychange', mark, { once: true });
		addEventListener('pagehide', mark, { once: true });
		setTimeout(() => {
			removeEventListener('blur', mark);
			document.removeEventListener('visibilitychange', mark);
			removeEventListener('pagehide', mark);
			if (!left) {
				receiptLead.setAttribute('data-on', '');
				liveEl.textContent = cfg.handoff.nothingOpened;
			}
		}, 1800);
	}

	/* ------------------------------------------------------------ the copy chain */
	async function copyText(text: string, btn: HTMLButtonElement) {
		const label = btn.textContent ?? '';
		const done = () => {
			btn.textContent = cfg.handoff.copied;
			liveEl.textContent = cfg.handoff.copied;
			setTimeout(() => (btn.textContent = label), 2000);
		};
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				return done();
			}
		} catch {
			/* denied: the next fallback */
		}
		try {
			const ta = document.createElement('textarea');
			ta.value = text;
			ta.setAttribute('readonly', '');
			ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
			document.body.appendChild(ta);
			ta.select();
			const ok = document.execCommand('copy');
			ta.remove();
			if (ok) return done();
		} catch {
			/* the last resort below */
		}
		// select it for the visitor: the preview, selected, with how to copy it
		preview.textContent = text;
		preview.hidden = false;
		const r = document.createRange();
		r.selectNodeContents(preview);
		const sel = getSelection();
		sel?.removeAllRanges();
		sel?.addRange(r);
		btn.textContent = cfg.handoff.selectCopy;
	}
	copyMsg.addEventListener('click', () => copyText(message.full || compose().full, copyMsg));
	copyAddr.addEventListener('click', () => copyText(TO, copyAddr));

	refresh();
	return { refresh };
}
