/**
 * The finale's drawing (rfilm.ts): one frame as markup (the build's poster: no-JS, reduced motion, first paint) and the live
 * renderer (persistent nodes written by attribute: the arms through draw.ts's ArmNodes, the cable's path, the ferrule's
 * transform). Literal hex paint on every shape. On the card's blue the cable is Carta, as the page's cable is inside the
 * card; the ferrule is the kit's (its collar the cable's colour, its tube copper).
 */
import { R_GEOMETRY as RG } from '../../../lib/cable-geometry';
import { f } from '../core';
import { PAL, RB, paintSvg } from '../paint';
import { ArmNodes, armMarkup, type ToolSt } from '../robot/draw';
import type { Pt } from '../robot/kin';
import { CL, CW, R_TF, VB, cable, ferrule, film, type Film, type Id } from './rfilm';

const C = { cable: PAL.paper, cu: PAL.cu, cuL: PAL.cuLight, bench: PAL.blueEdge, duct: '#1C4280', ductRim: PAL.blueEdge, tray: PAL.ink2, trayRim: PAL.blueEdge };

/** the page's cable inside the stage: in at the gland (the stage's left edge, 4 units under its top), down the left side,
 * along the duct under the bench, up through the bench into the R's stem foot */
export function w0Path() {
	const x0 = VB.x,
		yg = VB.y + 4,
		xd = VB.x + 8,
		yd = 14,
		xf = CL.x[0],
		r = 6;
	return `M${f(x0)} ${f(yg)}H${f(xd - r)}Q${f(xd)} ${f(yg)} ${f(xd)} ${f(yg + r)}V${f(yd - r)}Q${f(xd)} ${f(yd)} ${f(xd + r)} ${f(yd)}H${f(xf - r)}Q${f(xf)} ${f(yd)} ${f(xf)} ${f(yd - r)}V0`;
}
function poly(pts: Pt[]) {
	let d = '';
	for (let i = 0; i < pts.length; i++) d += `${i ? 'L' : 'M'}${f(pts[i].x)} ${f(pts[i].y)}`;
	return d;
}
/** the frame's state: everything the nodes read */
export interface RFrame {
	t: number;
	L: { q: ArrayLike<number>; open: number };
	R: { q: ArrayLike<number>; open: number };
	d: string;
	done: boolean;
	stub: string;
	fx: number;
	fy: number;
	crimp: number;
	glow: number;
}
export function frameAt(F: Film, t: number): RFrame {
	const c = cable(F, t);
	const done = t >= F.k.laid + 0.05;
	const fe = ferrule(F, t);
	// the free end's bare copper, until the ferrule is on it
	const sl = 3.2;
	const stub = t < F.k.fOn - 0.02 ? `M${f(c.end.x)} ${f(c.end.y)}l${f(c.dir.x * sl)} ${f(c.dir.y * sl)}` : 'M0 0';
	const g = t >= F.k.fOn ? Math.max(0, 1 - Math.abs(t - F.k.crimp) / 0.45) : 0;
	return {
		t,
		L: { q: F.L.qAt(t), open: F.L.grip.at(t) },
		R: { q: F.R.qAt(t), open: F.R.grip.at(t) },
		d: done ? '' : poly(c.pts),
		done,
		stub,
		fx: fe.dx,
		fy: fe.dy,
		crimp: fe.crimp,
		glow: g,
	};
}
const st = (open: number): ToolSt => ({ open, comp: 0, led: 0, spin: 0, cw: 3, roll: 0, hold: 0 });
const armRaw = (F: Film, id: Id, r: RFrame) => armMarkup(F.robs[id], r[id].q, 'gripper', st(r[id].open), 1, ['gripper']);

/** the static parts: the duct under the bench, the bench, the ferrule's tray */
function setMarkup(F: Film) {
	const xf = CL.x[0];
	let s = `<rect x="${f(VB.x - 2)}" y="6.5" width="${f(xf + 10 - VB.x)}" height="15" rx="3" fill="${C.duct}" stroke="${C.ductRim}" stroke-width="1.25" vector-effect="non-scaling-stroke"/>`;
	s += `<rect x="${f(VB.x)}" y="0" width="${VB.w}" height="2.5" fill="${C.bench}"/>`;
	// the ferrule's stand: a post and a cradle (the cable lies under it until it is drawn in)
	const cy = F.tray.y + 4;
	s += `<rect x="${f(F.tray.x - 1.2)}" y="${f(cy)}" width="2.4" height="${f(-cy)}" fill="${C.tray}" stroke="${C.trayRim}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
	s += `<rect x="${f(F.tray.x - 6)}" y="${f(cy)}" width="24" height="2.2" rx="0.8" fill="${C.tray}" stroke="${C.trayRim}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
	return s;
}
const ferruleMarkup = (fx: number, fy: number, crimp: number, glow: number) =>
	`<g data-fe transform="translate(${f(fx)} ${f(fy)})"><g transform="${R_TF}"><path d="${RG.ferrule.collar}" fill="${C.cable}"/><path d="${RG.ferrule.cu}" fill="${C.cu}"/>` +
	`<circle data-glow cx="${f((RG.ferrule.x0 + RG.ferrule.x1) / 2)}" cy="${RG.ferrule.y}" r="${f(9 + 4 * crimp)}" fill="${C.cuL}" opacity="${(0.4 * glow).toFixed(3)}"/></g></g>`;

/** the whole stage at t as markup (the poster) */
export function frameMarkup(F: Film, t: number) {
	const r = frameAt(F, t);
	let s = setMarkup(F);
	s += `<path d="${w0Path()}" fill="none" stroke="${C.cable}" stroke-width="${f(CW)}" stroke-linejoin="round"/>`;
	s += `<g>${paintSvg(armRaw(F, 'L', r), RB.blue)}</g><g>${paintSvg(armRaw(F, 'R', r), RB.blue)}</g>`;
	s += r.done
		? `<path d="${RG.rD}" transform="${R_TF}" fill="none" stroke="${C.cable}" stroke-width="${RG.w}" stroke-linejoin="round"/>`
		: `<path d="${r.d}" fill="none" stroke="${C.cable}" stroke-width="${f(CW)}" stroke-linejoin="round"/>`;
	s += `<path d="${r.stub}" fill="none" stroke="${C.cu}" stroke-width="${f(CW * 0.42)}"/>`;
	s += ferruleMarkup(r.fx, r.fy, r.crimp, r.glow);
	return s;
}

/** the live stage: nodes built once, attributes per frame */
export class Live {
	private arms: Record<Id, ArmNodes>;
	private cab: SVGPathElement;
	private fin: SVGPathElement;
	private stub: SVGPathElement;
	private fe: SVGGElement;
	private glow: SVGCircleElement;
	private last: Record<string, string> = {};
	constructor(
		readonly svg: SVGSVGElement,
		readonly F: Film = film(),
	) {
		const r = frameAt(F, 0);
		svg.innerHTML =
			setMarkup(F) +
			`<path d="${w0Path()}" fill="none" stroke="${C.cable}" stroke-width="${f(CW)}" stroke-linejoin="round"/>` +
			`<g data-arm="L">${paintSvg(armRaw(F, 'L', r), RB.blue)}</g><g data-arm="R">${paintSvg(armRaw(F, 'R', r), RB.blue)}</g>` +
			`<path data-cab d="${r.d}" fill="none" stroke="${C.cable}" stroke-width="${f(CW)}" stroke-linejoin="round"/>` +
			`<path data-fin d="${RG.rD}" transform="${R_TF}" fill="none" stroke="${C.cable}" stroke-width="${RG.w}" stroke-linejoin="round" display="none"/>` +
			`<path data-stub d="${r.stub}" fill="none" stroke="${C.cu}" stroke-width="${f(CW * 0.42)}"/>` +
			ferruleMarkup(r.fx, r.fy, r.crimp, r.glow);
		this.arms = { L: new ArmNodes(svg.querySelector('[data-arm="L"]')!, F.robs.L), R: new ArmNodes(svg.querySelector('[data-arm="R"]')!, F.robs.R) };
		this.cab = svg.querySelector('[data-cab]')!;
		this.fin = svg.querySelector('[data-fin]')!;
		this.stub = svg.querySelector('[data-stub]')!;
		this.fe = svg.querySelector('[data-fe]')!;
		this.glow = svg.querySelector('[data-glow]')!;
	}
	private set(e: Element, a: string, v: string, k: string) {
		if (this.last[k] === v) return;
		this.last[k] = v;
		e.setAttribute(a, v);
	}
	frame(t: number) {
		const r = frameAt(this.F, t);
		for (const id of ['L', 'R'] as Id[]) this.arms[id].frame({ q: r[id].q, tool: 'gripper', st: st(r[id].open), lock: 1 });
		this.set(this.cab, 'display', r.done ? 'none' : 'inline', 'cd');
		this.set(this.fin, 'display', r.done ? 'inline' : 'none', 'fd');
		if (!r.done) this.set(this.cab, 'd', r.d, 'c');
		this.set(this.stub, 'd', r.stub, 's');
		this.set(this.fe, 'transform', `translate(${f(r.fx)} ${f(r.fy)})`, 'f');
		this.set(this.glow, 'opacity', (0.4 * r.glow).toFixed(3), 'g');
		this.set(this.glow, 'r', f(9 + 4 * r.crimp) + '', 'gr');
	}
}
