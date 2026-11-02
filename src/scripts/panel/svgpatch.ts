/**
 * Markup kept as persistent nodes (engine pass, client notes 10 and 14: the frame budget). A device's moving parts (screw
 * heads, cage actuators, LEDs, jaws, the face's lamps) and the cell's effects are described as markup (devices.ts, shared
 * with the build's static drawing, and stage.ts fx). Writing them with innerHTML whenever one changed re-parsed the string,
 * re-created the nodes (a style pass for each new node) and re-ran the paint resolver over the string, every frame a screw
 * turned or a ring grew.
 *
 * A Patch keeps the nodes: the new markup is tokenised; when it has the same shape as what is drawn (the same elements,
 * classes and attribute names, in the same order and nesting) only the attribute values that differ are written. Otherwise
 * (an LED's lamp appearing, an effect starting or ending) it is drawn once with innerHTML, painted (paint.ts: literal hex on
 * every shape, client note 9), and becomes the new shape. Paint attributes come from the class, so a value write never
 * touches them. The drawn result is the same DOM the innerHTML of the same markup would give.
 */
import { PROF } from './core';

/** one pass over the markup: a tag (opening or closing) or an attribute */
const TOK = /<(\/?)([a-zA-Z]+)|([\w:-]+)="([^"]*)"/g;

export class Patch {
	/** what is drawn: the raw markup, its shape, its elements (document order) and, flat, every raw attribute value */
	private raw = '';
	private shape = '';
	private els: Element[] = [];
	private vals: string[] = [];
	constructor(
		readonly g: Element,
		private paint: (raw: string) => string,
	) {}
	/** draw `raw` (unpainted markup); returns true when something was written */
	write(raw: string): boolean {
		if (raw === this.raw) return false;
		// tokenise: the shape (tags, nesting, classes, attribute names) and the values
		let shape = '';
		const vals: string[] = [],
			names: string[] = [],
			owner: number[] = [];
		let el = -1;
		TOK.lastIndex = 0;
		for (let m = TOK.exec(raw); m; m = TOK.exec(raw)) {
			if (m[2]) {
				if (m[1]) shape += '/' + m[2];
				else {
					shape += '<' + m[2];
					el++;
				}
			} else if (m[3] === 'class') shape += '.' + m[4];
			else {
				shape += ' ' + m[3];
				names.push(m[3]);
				vals.push(m[4]);
				owner.push(el);
			}
		}
		this.raw = raw;
		if (shape === this.shape && el + 1 === this.els.length) {
			const o = this.vals,
				E = this.els;
			for (let k = 0; k < vals.length; k++) if (vals[k] !== o[k]) E[owner[k]].setAttribute(names[k], vals[k]);
			this.vals = vals;
			return true;
		}
		if (PROF) ((window as Window & { __patchMiss?: string[][] }).__patchMiss ??= []).push([this.shape, shape, String(Math.round(performance.now())), this.g.closest('section')?.id ?? '', this.g.getAttribute('class') ?? this.g.tagName]);
		this.g.innerHTML = raw ? this.paint(raw) : '';
		this.shape = shape;
		this.vals = vals;
		this.els = Array.from(this.g.querySelectorAll('*'));
		// (a markup the tokeniser and the parser read differently would never patch: it is redrawn whole each time)
		if (this.els.length !== el + 1) this.shape = '';
		return true;
	}
	/** nothing drawn yet */
	get empty() {
		return this.raw === '';
	}
	/** forget what is drawn (the group was emptied or rebuilt elsewhere) */
	reset() {
		this.raw = '';
		this.shape = '';
		this.els = [];
		this.vals = [];
	}
}
