/**
 * The bench props of the vignettes: what each section's robot works on besides the page's lead, so that every scene shows
 * what its section says (programs.ts). A prop is drawn in cell units (origin: the device centre on the bench, y down, the
 * bench at y = 0), as a pure function of program time (and, for the props that follow an arm, of the arm's drawn joints),
 * in the cell's drawing style: literal hex paint on every shape, strokes that do not scale, copper only where something
 * real happens (a verified connection, a tick on the report).
 *
 *   TermStrip  a row of terminals on a DIN rail (a switchboard's terminal strip): the probe's sockets; a socket lights copper
 *              when its connection is verified; dashed outlines are the drawing (where the program believes they are)
 *   Sheet      a sheet of paper standing on the bench, or rising out of a Printer's slot: the report (rows with tick boxes)
 *              or the EPLAN connection list (rows: terminal · wire · terminal)
 *   Printer    the box a sheet comes out of
 *   Wires      the switchboard's wiring between two strips (+C4): each wire lights copper when the two probes verify it
 *   Harness    a flexible cable with a connector, routed by the gripper over a fork (+C5)
 *   Dress      the robot's own dress pack along its arm (+C5)
 *   Coil       a cable coil the gripper sets down (+C6)
 *
 * The same markup is the static drawing (Compartment.astro: the first frame and the end frame, no-JS and reduced motion)
 * and the live one (stage.ts writes it through a Patch: only changed attribute values are written). Each prop keeps the
 * same elements at every t (things come and go by opacity), so a frame never re-parses markup.
 */
import { clamp01, f } from './core';
import { PAL } from './paint';
import type { Builder } from './program';
import type { Poly } from './robot/draw';
import type { ArmTrack } from './robot/arm';
import type { Pt } from './robot/kin';

/** the arms' drawn joints, when the stage has them (the simulated, flexed pose); else the commanded pose is drawn */
export type ArmView = { L: ArrayLike<number>; R: ArrayLike<number> } | null;

export interface Prop {
	/** painted markup in cell units at program time t */
	draw(t: number, v?: ArmView): string;
	/** solid convex outlines (units) at t: the robot QA keeps every arm and tool clear of them (a tool tip may touch a
	 * contact during its contact window) */
	solids?(t: number): Poly[];
}

const NSS = ' vector-effect="non-scaling-stroke"';
const C = {
	paper: PAL.paper,
	face: PAL.paperFace,
	rim: PAL.rim,
	rail: PAL.bench,
	steel: PAL.steel,
	steelL: PAL.steelLight,
	ink: PAL.ink,
	ink2: PAL.ink2,
	blue: PAL.blue,
	slate: PAL.slate,
	cu: PAL.cu,
	cuL: PAL.cuLight,
	mist: PAL.mist,
};
const op = (v: number) => (v >= 0.999 ? '1' : v <= 0.001 ? '0' : v.toFixed(3));
const rectP = (x0: number, y0: number, x1: number, y1: number): Poly => [
	{ x: x0, y: y0 },
	{ x: x1, y: y0 },
	{ x: x1, y: y1 },
	{ x: x0, y: y1 },
];
const smooth = (u: number) => {
	const x = clamp01(u);
	return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/* ------------------------------------------------------------------ the terminal strip */
/** a terminal (units): body width, height, the socket's half-width and the contact's depth from the bench */
export const TERM = { w: 4.4, h: 10, sock: 1.1, ctc: -7.4 };

export class TermStrip implements Prop {
	/** each terminal's x over time: a slide (the board is a variant: the real terminals are not where the drawing says) */
	lit: number[];
	flash: { i: number; t0: number; t1: number }[] = [];
	constructor(
		readonly B: Builder,
		readonly xs: number[],
		readonly o: { ghost?: number[]; ghostT?: [number, number]; slide?: { t0: number; t1: number; from: number[] }; litAt?: number[] } = {},
	) {
		this.lit = xs.map((_, i) => o.litAt?.[i] ?? Infinity);
	}
	xAt(i: number, t: number) {
		const s = this.o.slide;
		if (!s) return this.xs[i];
		return lerp(s.from[i], this.xs[i], smooth((t - s.t0) / (s.t1 - s.t0)));
	}
	/** the socket contact of terminal i (stage px), where a probe's needle bottoms */
	socket(i: number): Pt {
		const G = this.B.G;
		return { x: G.cx + this.xs[i] * G.sc, y: G.floor + TERM.ctc * G.sc };
	}
	/** a point on terminal i's top face, `dx` units off its socket (stage px): a taught point that misses */
	top(x: number): Pt {
		const G = this.B.G;
		return { x: G.cx + x * G.sc, y: G.floor - TERM.h * G.sc };
	}
	/** terminal i is verified at t: its socket lights copper and stays lit */
	light(i: number, t: number) {
		this.lit[i] = Math.min(this.lit[i], t);
	}
	/** a test without a record: the socket glows and fades back */
	blink(i: number, t0: number, t1: number) {
		this.flash.push({ i, t0, t1 });
	}
	draw(t: number) {
		const { xs } = this;
		const w = TERM.w,
			h = TERM.h,
			sk = TERM.sock;
		const x0 = Math.min(...xs, ...(this.o.ghost ?? xs)) - w / 2 - 2,
			x1 = Math.max(...xs, ...(this.o.ghost ?? xs)) + w / 2 + 2;
		// the DIN rail under the terminals
		let s = `<rect x="${f(x0)}" y="-3.2" width="${f(x1 - x0)}" height="2.4" rx="0.6" fill="${C.rail}" stroke="${C.steelL}" stroke-width="1"${NSS}/>`;
		// the drawing: dashed outlines where the program believes the terminals are
		if (this.o.ghost) {
			const [g0, g1] = this.o.ghostT ?? [0, Infinity];
			const go = Math.min(smooth((t - g0) / 0.15), 1 - smooth((t - g1) / 0.2));
			for (const gx of this.o.ghost) s += `<rect x="${f(gx - w / 2)}" y="${-h - 1}" width="${w}" height="${h - 2}" rx="1" fill="none" stroke="${C.blue}" stroke-width="1.25" stroke-dasharray="2 2" opacity="${op(go * 0.85)}"${NSS}/>`;
		}
		xs.forEach((_, i) => {
			const x = this.xAt(i, t);
			const on = t >= this.lit[i] ? 1 : 0;
			let fl = 0;
			for (const q of this.flash) if (q.i === i && t >= q.t0 && t < q.t1 + 0.35) fl = Math.max(fl, Math.min(smooth((t - q.t0) / 0.06), 1 - smooth((t - q.t1) / 0.35)));
			const glow = Math.max(on * (t - this.lit[i] < 0.4 ? 1 - 0.55 * smooth((t - this.lit[i]) / 0.4) : 0.45), fl);
			s += `<rect x="${f(x - w / 2)}" y="${-h}" width="${w}" height="${h}" rx="1" fill="${C.paper}" stroke="${C.rim}" stroke-width="1.5"${NSS}/>`;
			// the socket: a bore with its contact at the bottom; verified: copper
			s += `<rect x="${f(x - sk)}" y="${-h - 0.6}" width="${2 * sk}" height="${f(h + TERM.ctc + 1.4)}" fill="${on ? C.cu : C.ink}"${NSS}/>`;
			s += `<rect x="${f(x - sk)}" y="${TERM.ctc}" width="${2 * sk}" height="0.8" fill="${on ? C.cuL : C.steelL}"${NSS}/>`;
			// a marker line on the face (the terminal's place in the strip), a soft copper glow over a socket that is lit
			s += `<line x1="${f(x - 1.2)}" y1="-5" x2="${f(x + 1.2)}" y2="-5" stroke="${C.steelL}" stroke-width="1"${NSS}/>`;
			s += `<circle cx="${f(x)}" cy="${-h}" r="3.4" fill="${C.cuL}" opacity="${op(glow * 0.55)}"/>`;
		});
		return s;
	}
	solids(t: number) {
		return this.xs.map((_, i) => {
			const x = this.xAt(i, t);
			return rectP(x - TERM.w / 2, -TERM.h, x + TERM.w / 2, 0);
		});
	}
}

/* ------------------------------------------------------------------ the switchboard around the strips */
/**
 * A switchboard's mounting plate behind its terminal strips, the wiring duct along its top and each terminal's wire up
 * into the duct: what makes a row of terminals read as a switchboard. Plates are drawn only beside the device (never over
 * it or the page's lead); the duct may run across between two plates (`span`), broken where the lead passes in front of it.
 * A verified connection (`link`) lights its two wires and its run inside the duct copper.
 */
export class Board implements Prop {
	links: { a: number; b: number; t: number }[] = [];
	constructor(
		readonly o: {
			plates: [number, number][];
			top: number;
			strips: TermStrip[];
			/** the duct's extent and the gaps in it (where the lead passes in front), units */
			span?: [number, number];
			gaps?: [number, number][];
		},
	) {}
	link(a: number, b: number, t: number) {
		this.links.push({ a, b, t });
	}
	private seg(x0: number, x1: number) {
		// [x0, x1] minus the gaps
		let out: [number, number][] = [[Math.min(x0, x1), Math.max(x0, x1)]];
		for (const [g0, g1] of this.o.gaps ?? [])
			out = out.flatMap(([a, b]): [number, number][] => (g1 <= a || g0 >= b ? [[a, b]] : ([[a, g0], [g1, b]] as [number, number][]).filter(([c, d]) => d - c > 0.2)));
		return out;
	}
	draw(t: number) {
		const o = this.o,
			top = o.top,
			dh = 5;
		let s = '';
		for (const [a, b] of o.plates) s += `<rect x="${f(a)}" y="${f(top - 2)}" width="${f(b - a)}" height="${f(-top + 2)}" rx="1.5" fill="#D3DAE3" stroke="${C.rim}" stroke-width="1.25"${NSS}/>`;
		// each terminal's wire, from its mouth (beside the socket) up into the duct; copper once its connection is verified
		for (const st of o.strips)
			st.xs.forEach((x, i) => {
				const on = t >= st.lit[i] ? 1 : 0;
				s += `<line x1="${f(x + 1.7)}" y1="${-TERM.h}" x2="${f(x + 1.7)}" y2="${f(top + dh)}" stroke="${on ? C.cu : C.blue}" stroke-width="1.5"${NSS}/>`;
			});
		const [d0, d1] = o.span ?? [Math.min(...o.plates.map((p) => p[0])), Math.max(...o.plates.map((p) => p[1]))];
		for (const [a, b] of this.seg(d0, d1)) {
			s += `<rect x="${f(a)}" y="${f(top)}" width="${f(b - a)}" height="${dh}" fill="${PAL.jaw}" stroke="${C.steelL}" stroke-width="1"${NSS}/>`;
			// the duct's comb (its slots)
			let comb = '';
			for (let x = a + 1.5; x < b - 0.5; x += 2.5) comb += `M${f(x)} ${f(top + dh)}v-2`;
			s += `<path d="${comb || 'M0 0'}" fill="none" stroke="${C.steelL}" stroke-width="1"${NSS}/>`;
		}
		// verified links: their run inside the duct, copper (a pulse as it lights)
		for (const L of this.links) {
			const on = t >= L.t ? 1 : 0,
				pulse = on ? 1 - smooth((t - L.t) / 0.5) : 0;
			for (const [a, b] of this.seg(L.a + 1.7, L.b + 1.7)) {
				s += `<line x1="${f(a)}" y1="${f(top + 2.4)}" x2="${f(b)}" y2="${f(top + 2.4)}" stroke="${C.cuL}" stroke-width="5" opacity="${op(pulse * 0.4)}"${NSS}/>`;
				s += `<line x1="${f(a)}" y1="${f(top + 2.4)}" x2="${f(b)}" y2="${f(top + 2.4)}" stroke="${C.cu}" stroke-width="1.75" opacity="${on}"${NSS}/>`;
			}
		}
		return s;
	}
	// (no solids: the plate and its duct are behind the work plane; the tools pass in front of them)
}

/* ------------------------------------------------------------------ paper: the report, the connection list */
export interface SheetOpts {
	/** centre x and width, height (units); the sheet stands on y0 (its bottom) */
	x: number;
	w: number;
	h: number;
	y0?: number;
	rows: number;
	/** report: tick boxes and lines; list: terminal · wire · terminal per row */
	kind: 'report' | 'list';
	/** each row's tick (program time; Infinity: never) */
	tick?: number[];
	/** the row the work is on: [row, t0, t1] (a steel bracket beside it) */
	cur?: [number, number, number][];
	/** a blank sheet: dashed lines, nothing ever written (nothing was recorded) */
	blank?: boolean;
	/** rising out of a slot at y0: the sheet's visible height grows from 0 at t0 to h at t1 (the printer feeds it) */
	rise?: [number, number];
	/** sheets already stacked behind it (one per switchboard) */
	stack?: number;
	/** each row appears with the print head: rows below the slot are not printed yet */
	printRows?: boolean;
}
export class Sheet implements Prop {
	constructor(readonly o: SheetOpts) {}
	/** the visible height at t */
	hAt(t: number) {
		const r = this.o.rise;
		return r ? this.o.h * smooth((t - r[0]) / (r[1] - r[0])) : this.o.h;
	}
	draw(t: number) {
		const o = this.o,
			y0 = o.y0 ?? 0,
			x0 = o.x - o.w / 2;
		const hv = this.hAt(t);
		let s = '';
		for (let k = o.stack ?? 0; k >= 1; k--) {
			const dx = 2.2 * k,
				dy = -2.2 * k;
			s += `<rect x="${f(x0 + dx)}" y="${f(y0 - o.h + dy)}" width="${f(o.w)}" height="${f(o.h)}" rx="0.8" fill="${C.face}" stroke="${C.steelL}" stroke-width="1"${NSS}/>`;
			// the sheets behind carry their own ticks (the last switchboards' reports)
			for (let r = 0; r < o.rows; r++) {
				const ry = y0 - o.h + dy + 7 + r * ((o.h - 10) / o.rows);
				s += `<line x1="${f(x0 + dx + o.w - 4)}" y1="${f(ry)}" x2="${f(x0 + dx + o.w - 2.4)}" y2="${f(ry)}" stroke="${C.steelL}" stroke-width="1"${NSS}/>`;
			}
		}
		// the sheet itself: its top rises out of the slot (the part still in the printer is not drawn)
		const top = y0 - hv;
		const vis = hv > 0.05 ? 1 : 0;
		s += `<rect x="${f(x0)}" y="${f(top)}" width="${f(o.w)}" height="${f(Math.max(0.01, hv))}" rx="0.8" fill="${C.paper}" stroke="${o.blank ? C.steelL : C.rim}" stroke-width="1.25"${o.blank ? ' stroke-dasharray="2.5 2"' : ''} opacity="${vis}"${NSS}/>`;
		// the header: a heavier bar (the document's title line, no words)
		const hy = top + 3.2;
		s += `<line x1="${f(x0 + 2.6)}" y1="${f(hy)}" x2="${f(x0 + o.w * 0.62)}" y2="${f(hy)}" stroke="${o.blank ? C.steelL : C.ink2}" stroke-width="2"${o.blank ? ' stroke-dasharray="2 2"' : ''} opacity="${op(vis * (hy < y0 - 0.5 ? 1 : 0))}"${NSS}/>`;
		const pitch = (o.h - 10) / o.rows;
		for (let r = 0; r < o.rows; r++) {
			const ry = top + 7.5 + r * pitch;
			const shown = vis && ry < y0 - 1 ? 1 : 0;
			const tk = o.tick?.[r] ?? Infinity;
			const tOn = t >= tk ? smooth((t - tk) / 0.12) : 0;
			let cur = 0;
			for (const [cr, c0, c1] of o.cur ?? []) if (cr === r) cur = Math.max(cur, Math.min(smooth((t - c0) / 0.08), 1 - smooth((t - c1) / 0.12)));
			const dash = o.blank ? ' stroke-dasharray="2 2"' : '';
			const ln = o.blank ? C.steelL : C.steel;
			if (o.kind === 'report') {
				// the tick box, the line of the test, the tick (copper: the connection was verified)
				s += `<rect x="${f(x0 + 2.4)}" y="${f(ry - 1.3)}" width="2.6" height="2.6" rx="0.4" fill="none" stroke="${ln}" stroke-width="1"${dash} opacity="${shown}"${NSS}/>`;
				s += `<line x1="${f(x0 + 6.6)}" y1="${f(ry)}" x2="${f(x0 + o.w - 2.6)}" y2="${f(ry)}" stroke="${ln}" stroke-width="1"${dash} opacity="${shown}"${NSS}/>`;
				s += `<path d="M${f(x0 + 2.8)} ${f(ry - 0.1)}L${f(x0 + 3.7)} ${f(ry + 0.9)}L${f(x0 + 5.6)} ${f(ry - 1.8)}" fill="none" stroke="${C.cu}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" opacity="${op(shown * tOn)}"${NSS}/>`;
			} else {
				// a connection: terminal · wire · terminal; checked: a copper tick at the row's end
				const a = x0 + 3,
					b = x0 + o.w - 7.4;
				s += `<circle cx="${f(a)}" cy="${f(ry)}" r="0.9" fill="${C.ink2}" opacity="${shown}"/>`;
				s += `<line x1="${f(a + 1.2)}" y1="${f(ry)}" x2="${f(b - 1.2)}" y2="${f(ry)}" stroke="${C.blue}" stroke-width="1.25" opacity="${shown}"${NSS}/>`;
				s += `<circle cx="${f(b)}" cy="${f(ry)}" r="0.9" fill="${C.ink2}" opacity="${shown}"/>`;
				s += `<path d="M${f(b + 2)} ${f(ry - 0.1)}L${f(b + 2.9)} ${f(ry + 0.9)}L${f(b + 4.8)} ${f(ry - 1.8)}" fill="none" stroke="${C.cu}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" opacity="${op(shown * tOn)}"${NSS}/>`;
			}
			// the row the work is on: a steel bracket in the margin
			s += `<path d="M${f(x0 - 1.2)} ${f(ry - 1.8)}H${f(x0 - 2.2)}V${f(ry + 1.8)}H${f(x0 - 1.2)}" fill="none" stroke="${C.blue}" stroke-width="1.5" opacity="${op(shown * cur)}"${NSS}/>`;
		}
		return s;
	}
	solids(t: number) {
		const o = this.o,
			y0 = o.y0 ?? 0,
			hv = this.hAt(t);
		const out: Poly[] = [];
		if (hv > 0.05) out.push(rectP(o.x - o.w / 2, y0 - hv, o.x + o.w / 2, y0));
		if (o.stack) out.push(rectP(o.x - o.w / 2, y0 - o.h - 2.2 * o.stack, o.x + o.w / 2 + 2.2 * o.stack, y0));
		return out;
	}
}
/** a small printer (or the list's feeder): a box with a slot on top, a status lamp that is copper while it prints */
export class Printer implements Prop {
	constructor(readonly o: { x: number; w: number; h: number; on?: [number, number] }) {}
	get slotY() {
		return -this.o.h;
	}
	draw(t: number) {
		const { x, w, h } = this.o;
		const x0 = x - w / 2;
		const on = this.o.on ? Math.min(smooth((t - this.o.on[0]) / 0.08), 1 - smooth((t - this.o.on[1]) / 0.15)) : 0;
		let s = `<rect x="${f(x0)}" y="${-h}" width="${w}" height="${h}" rx="2" fill="${C.ink2}" stroke="${C.steel}" stroke-width="1.5"${NSS}/>`;
		s += `<line x1="${f(x0 + 2)}" y1="${f(-h + 0.9)}" x2="${f(x0 + w - 2)}" y2="${f(-h + 0.9)}" stroke="${C.steelL}" stroke-width="1" stroke-opacity=".6"${NSS}/>`;
		// the slot the paper comes out of
		s += `<rect x="${f(x0 + 2.4)}" y="${f(-h - 0.6)}" width="${f(w - 4.8)}" height="1.6" rx="0.5" fill="${PAL.night}"/>`;
		// the status lamp: a steel ring, copper while a sheet is printed
		s += `<circle cx="${f(x0 + w - 3.4)}" cy="${f(-h / 2)}" r="1.2" fill="${C.ink}" stroke="${C.steelL}" stroke-width="1"${NSS}/>`;
		s += `<circle cx="${f(x0 + w - 3.4)}" cy="${f(-h / 2)}" r="1" fill="${C.cuL}" opacity="${op(on)}"/>`;
		return s;
	}
	solids() {
		const { x, w, h } = this.o;
		return [rectP(x - w / 2, -h, x + w / 2, 0)];
	}
}

/* ------------------------------------------------------------------ +C4: the board's wiring */
/** the wires between two strips' terminals (a switchboard's wiring behind the devices): pairs [a, b] (units), each lit
 * copper from its verification on; drawn as a wire that leaves one terminal's foot, runs under a common level and rises to
 * the other's foot */
export class Wires implements Prop {
	litAt: number[];
	constructor(readonly pairs: [number, number][], readonly lvl: number[]) {
		this.litAt = pairs.map(() => Infinity);
	}
	draw(t: number) {
		let s = '';
		this.pairs.forEach(([a, b], i) => {
			const y = this.lvl[i];
			const d = `M${f(a)} -10.5V${f(y + 2)}Q${f(a)} ${f(y)} ${f(a + Math.sign(b - a) * 2)} ${f(y)}H${f(b - Math.sign(b - a) * 2)}Q${f(b)} ${f(y)} ${f(b)} ${f(y + 2)}V-10.5`;
			const on = t >= this.litAt[i] ? 1 : 0;
			const pulse = on ? 1 - smooth((t - this.litAt[i]) / 0.5) : 0;
			s += `<path d="${d}" fill="none" stroke="${C.steelL}" stroke-width="1.5" stroke-linejoin="round"${NSS}/>`;
			s += `<path d="${d}" fill="none" stroke="${C.cuL}" stroke-width="5" stroke-linejoin="round" opacity="${op(pulse * 0.35)}"${NSS}/>`;
			s += `<path d="${d}" fill="none" stroke="${C.cu}" stroke-width="1.75" stroke-linejoin="round" opacity="${on}"${NSS}/>`;
		});
		return s;
	}
}

/* ------------------------------------------------------------------ arm-bound props (+C5, +C6) */
/** the tool centre point of arm `tr` at t in cell units: from the stage's drawn joints when given, else the commanded pose */
function tcpU(B: Builder, tr: ArmTrack, t: number, v?: ArmView) {
	const G = B.G;
	const q = v ? (tr.id === 'L' ? v.L : v.R) : tr.qAt(t);
	const k = tr.r.fk(q, tr.toolAt(t));
	const u = (p: Pt) => ({ x: (p.x - G.cx) / G.sc, y: (p.y - G.floor) / G.sc });
	return { T: u(k.T), W: u(k.W), E: u(k.E), S: u(k.S), F: u(k.F), a3: k.a3 };
}
/** a smooth curve through points (Catmull-Rom as cubic Béziers) */
function spline(p: Pt[]) {
	if (p.length < 2) return '';
	let d = `M${f(p[0].x)} ${f(p[0].y)}`;
	for (let i = 0; i < p.length - 1; i++) {
		const a = p[Math.max(0, i - 1)],
			b = p[i],
			c = p[i + 1],
			e = p[Math.min(p.length - 1, i + 2)];
		d += `C${f(b.x + (c.x - a.x) / 6)} ${f(b.y + (c.y - a.y) / 6)} ${f(c.x - (e.x - b.x) / 6)} ${f(c.y - (e.y - b.y) / 6)} ${f(c.x)} ${f(c.y)}`;
	}
	return d;
}
/** a hanging span between two supports: its middle sags by `sag` units (a flexible cable, not a rod) */
function sagPts(a: Pt, b: Pt, sag: number, n = 6): Pt[] {
	const out: Pt[] = [];
	for (let i = 0; i <= n; i++) {
		const u = i / n;
		out.push({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) + 4 * sag * u * (1 - u) });
	}
	return out;
}

/** the robot's dress pack: a cable from the pedestal along the upper arm and the forearm to the wrist, held by clamps on
 * the links, hanging loose between them (a cell planned with the robot's own cables in mind) */
export class Dress implements Prop {
	constructor(
		readonly B: Builder,
		readonly tr: ArmTrack,
	) {}
	draw(t: number, v?: ArmView) {
		const k = tcpU(this.B, this.tr, t, v);
		const m = this.tr.r.m;
		const out = (p: Pt, q: Pt, d: number) => {
			// a point offset d units to the link's outer side (away from the work, above it)
			const dx = q.x - p.x,
				dy = q.y - p.y,
				l = Math.hypot(dx, dy) || 1;
			let nx = -dy / l,
				ny = dx / l;
			if (ny > 0) {
				nx = -nx;
				ny = -ny;
			}
			return (u: number) => ({ x: p.x + dx * u + nx * d, y: p.y + dy * u + ny * d });
		};
		const up = out(k.S, k.E, 7.5),
			fo = out(k.E, k.W, 6.5);
		const base = { x: k.S.x - m * 9, y: -6 };
		const c1 = up(0.42),
			c2 = fo(0.3),
			c3 = fo(0.86);
		const pts = [base, ...sagPts(base, c1, 3, 3).slice(1), ...sagPts(c1, c2, 5.5, 5).slice(1), ...sagPts(c2, c3, 3, 4).slice(1), { x: k.W.x, y: k.W.y }];
		let s = `<path d="${spline(pts)}" fill="none" stroke="${C.slate}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
		s += `<path d="${spline(pts)}" fill="none" stroke="${C.steelL}" stroke-width="1" stroke-linecap="round" stroke-opacity=".55"${NSS}/>`;
		for (const c of [c1, c2, c3]) s += `<rect x="${f(c.x - 2.2)}" y="${f(c.y - 2.2)}" width="4.4" height="4.4" rx="1" fill="${C.ink2}" stroke="${C.steelL}" stroke-width="1"${NSS}/>`;
		return s;
	}
}

/** a camera on the arm's wrist, beside its tool (as on the prototype's arm): it looks along the tool axis; while it scans,
 * its cone reaches the work and sweeps across it (the site's sign: parentheses and cone = the camera has seen, where) */
export class WristCam implements Prop {
	scans: { t0: number; t1: number; a: Pt; b: Pt }[] = [];
	constructor(
		readonly B: Builder,
		readonly tr: ArmTrack,
	) {}
	/** sweep the cone's aim from a to b (units) over [t0, t1] */
	scan(t0: number, t1: number, a: Pt, b: Pt) {
		this.scans.push({ t0, t1, a, b });
	}
	draw(t: number, v?: ArmView) {
		const k = tcpU(this.B, this.tr, t, v);
		const m = this.tr.r.m;
		const ux = Math.cos(k.a3),
			uy = Math.sin(k.a3);
		// the outer side of the tool (away from the work's far side)
		const nx = -m * uy,
			ny = m * ux;
		const nn = nx < 0 === m > 0 ? 1 : -1;
		const n = { x: nx * nn, y: ny * nn };
		const c = { x: k.F.x + ux * 4.5 + n.x * 7.5, y: k.F.y + uy * 4.5 + n.y * 7.5 };
		const P = (a: number, b: number) => `${f(c.x + ux * a + n.x * b)} ${f(c.y + uy * a + n.y * b)}`;
		// the bracket to the flange, the body, the lens
		let s = `<path d="M${P(-3.6, -1.2)}L${P(-3.6, -4.6)}" stroke="${C.steel}" stroke-width="1.5" fill="none"${NSS}/>`;
		s += `<path d="M${P(-3, -2.6)}L${P(-3, 2.6)}L${P(2.6, 2.6)}L${P(2.6, -2.6)}Z" fill="${C.paper}" stroke="${C.steel}" stroke-width="1.25"${NSS}/>`;
		s += `<path d="M${P(2.6, -1.7)}L${P(2.6, 1.7)}L${P(4.2, 1.7)}L${P(4.2, -1.7)}Z" fill="${C.ink2}" stroke="${C.steel}" stroke-width="1"${NSS}/>`;
		// the cone (outline and a faint fill) to where it looks, sweeping
		let on = 0,
			aim = { x: c.x, y: c.y };
		for (const q of this.scans) {
			if (t < q.t0 - 0.08 || t > q.t1 + 0.18) continue;
			on = Math.min(smooth((t - q.t0 + 0.08) / 0.1), 1 - smooth((t - q.t1) / 0.18));
			const u = smooth((t - q.t0) / (q.t1 - q.t0));
			aim = { x: lerp(q.a.x, q.b.x, u), y: lerp(q.a.y, q.b.y, u) };
		}
		const L0 = { x: c.x + ux * 4.2, y: c.y + uy * 4.2 };
		const dx = aim.x - L0.x,
			dy = aim.y - L0.y,
			dl = Math.hypot(dx, dy) || 1;
		const w = 0.3 * dl;
		const p1 = { x: aim.x - (dy / dl) * w, y: aim.y + (dx / dl) * w },
			p2 = { x: aim.x + (dy / dl) * w, y: aim.y - (dx / dl) * w };
		s += `<path d="M${f(L0.x)} ${f(L0.y)}L${f(p1.x)} ${f(p1.y)}L${f(p2.x)} ${f(p2.y)}Z" fill="${C.blue}" fill-opacity=".08" stroke="${C.blue}" stroke-width="1" stroke-opacity=".55" opacity="${op(on)}"${NSS}/>`;
		s += `<line x1="${f(L0.x)}" y1="${f(L0.y)}" x2="${f(aim.x)}" y2="${f(aim.y)}" stroke="${C.blue}" stroke-width="1.25" opacity="${op(on * 0.8)}"${NSS}/>`;
		// the lens is lit while it scans
		s += `<circle cx="${f(L0.x)}" cy="${f(L0.y)}" r="0.9" fill="${C.cuL}" opacity="${op(on)}"/>`;
		return s;
	}
}

/** a harness: a flexible cable (the conductor colour) from a fixed clamp, a branch, and a connector at its free end, which
 * the gripper takes and routes over the fork; laid, it rests on the fork and the connector clips onto its mate */
export class Harness implements Prop {
	/** program times: the jaws close on the connector, it is over the fork, it is let go on its mate */
	k = { grip: Infinity, over: Infinity, drop: Infinity };
	constructor(
		readonly B: Builder,
		readonly tr: ArmTrack,
		readonly o: { clamp: Pt; rest: Pt; fork: { x: number; top: number }; mate: Pt },
	) {}
	/** the connector's place (units) at t */
	end(t: number, v?: ArmView): Pt {
		const k = this.k;
		if (t < k.grip) return this.o.rest;
		if (t >= k.drop) return this.o.mate;
		const T = tcpU(this.B, this.tr, t, v).T;
		// the connector hangs just under the jaws
		return { x: T.x, y: T.y + 2.4 };
	}
	path(t: number, v?: ArmView): Pt[] {
		const o = this.o,
			e = this.end(t, v);
		const fk = { x: o.fork.x, y: o.fork.top - 1.6 };
		// on the bench: a loose S from the clamp to the connector
		if (t < this.k.grip) return [o.clamp, { x: lerp(o.clamp.x, e.x, 0.3), y: -1.6 }, { x: lerp(o.clamp.x, e.x, 0.62), y: -4.4 }, { x: e.x - 2, y: -1.8 }, e];
		// lifted: the span from the clamp hangs to the jaws; routed: clamp → fork → connector (it settles onto the fork)
		const free = (): Pt[] => {
			const sag = Math.max(2, 0.18 * Math.hypot(e.x - o.clamp.x, e.y - o.clamp.y));
			return [o.clamp, ...sagPts(o.clamp, e, sag, 10).slice(1)];
		};
		const routed = (): Pt[] => [o.clamp, ...sagPts(o.clamp, fk, 2.5, 4).slice(1), ...sagPts(fk, e, Math.max(1.5, 0.12 * Math.hypot(e.x - fk.x, e.y - fk.y)), 6).slice(1)];
		const w = smooth((t - this.k.over) / 0.3);
		if (w <= 0) return free();
		if (w >= 1) return routed();
		const A = free(),
			R = routed();
		return A.map((p, i) => ({ x: lerp(p.x, R[i].x, w), y: lerp(p.y, R[i].y, w) }));
	}
	draw(t: number, v?: ArmView) {
		const o = this.o;
		const pts = this.path(t, v);
		const e = pts[pts.length - 1];
		let s = '';
		// the harness board behind (a formboard), the fork on it: a post with a U at its top
		s += `<rect x="${f(o.fork.x - 7)}" y="${f(o.fork.top - 9)}" width="14" height="${f(-o.fork.top + 9)}" rx="1.5" fill="#D3DAE3" stroke="${C.rim}" stroke-width="1.25"${NSS}/>`;
		s += `<rect x="${f(o.fork.x - 0.9)}" y="${f(o.fork.top)}" width="1.8" height="${f(-o.fork.top)}" fill="${C.steelL}" stroke="${C.steel}" stroke-width="1"${NSS}/>`;
		s += `<path d="M${f(o.fork.x - 2)} ${f(o.fork.top - 4)}V${f(o.fork.top - 1)}A2 2 0 0 0 ${f(o.fork.x + 2)} ${f(o.fork.top - 1)}V${f(o.fork.top - 4)}" fill="none" stroke="${C.steel}" stroke-width="1.75" stroke-linecap="round"${NSS}/>`;
		// the mate the connector clips onto, and the clamp at the fixed end
		s += `<rect x="${f(o.mate.x - 2)}" y="${f(o.mate.y + 1.4)}" width="4" height="${f(-o.mate.y - 1.4)}" rx="0.8" fill="${C.ink2}" stroke="${C.steel}" stroke-width="1"${NSS}/>`;
		s += `<rect x="${f(o.clamp.x - 2.4)}" y="${f(o.clamp.y - 2)}" width="4.8" height="${f(2 - o.clamp.y)}" rx="0.8" fill="${C.ink2}" stroke="${C.steel}" stroke-width="1"${NSS}/>`;
		// the cable, and its branch leaving a third of the way along (the harness has more than one end)
		const d = spline(pts);
		s += `<path d="${d}" fill="none" stroke="${C.blue}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
		// a branch leaving a third of the way along, with its own small connector (never below the bench)
		const bi = Math.max(1, Math.round(pts.length * 0.34));
		const bp = pts[bi];
		const bl = Math.min(6, Math.max(0, -bp.y - 3.4));
		s += `<path d="M${f(bp.x)} ${f(bp.y)}q${f(-2)} ${f(bl * 0.5)} ${f(-2.6)} ${f(bl)}" fill="none" stroke="${C.blue}" stroke-width="1.6" stroke-linecap="round"/>`;
		s += `<rect x="${f(bp.x - 4.2)}" y="${f(bp.y + bl - 0.4)}" width="3.2" height="2.8" rx="0.5" fill="${C.ink2}"/>`;
		// the connector at the free end (a housing with its latch)
		s += `<rect x="${f(e.x - 2.6)}" y="${f(e.y - 1.8)}" width="5.2" height="4.2" rx="0.7" fill="${C.ink2}" stroke="${C.steelL}" stroke-width="1"${NSS}/>`;
		s += `<line x1="${f(e.x - 1.4)}" y1="${f(e.y + 2.9)}" x2="${f(e.x + 1.4)}" y2="${f(e.y + 2.9)}" stroke="${C.steelL}" stroke-width="1.25"${NSS}/>`;
		return s;
	}
	solids() {
		const o = this.o;
		// (the fork stands on the harness board behind the work plane: the gripper passes in front of it; the mate is solid)
		return [rectP(o.mate.x - 2, o.mate.y + 1.4, o.mate.x + 2, 0)];
	}
}

/** a coil of cable: loose loops on the bench at first, carried by the gripper by its top, set down as a neat coil */
export class Coil implements Prop {
	k = { grip: Infinity, down: Infinity };
	constructor(
		readonly B: Builder,
		readonly tr: ArmTrack,
		readonly o: { at: Pt; place: Pt; r: number },
	) {}
	/** the coil's top (where the jaws hold it), units */
	top(t: number, v?: ArmView): Pt {
		const k = this.k;
		if (t < k.grip) return { x: this.o.at.x, y: -2 * this.o.r * 0.55 };
		if (t >= k.down) return { x: this.o.place.x, y: -2 * this.o.r * 0.55 };
		const T = tcpU(this.B, this.tr, t, v).T;
		return { x: T.x, y: T.y + 1.2 };
	}
	draw(t: number, v?: ArmView) {
		const r = this.o.r,
			k = this.k;
		// tidy: 0 loose … 1 neat (it is wound neat while it is carried)
		const neat = t < k.grip ? 0 : t >= k.down ? 1 : smooth((t - k.grip) / Math.max(0.2, k.down - k.grip));
		const held = t >= k.grip && t < k.down;
		const tp = this.top(t, v);
		const ry = r * 0.55;
		const cy = held ? tp.y + ry : -ry;
		const cx = tp.x;
		let s = '';
		for (let i = 0; i < 4; i++) {
			// loose: each loop its own size and offset; neat: the loops on one another
			const jx = (1 - neat) * [-4.6, 3.4, -2.2, 5][i],
				jy = (1 - neat) * [0.8, -0.6, 0.4, -0.3][i],
				jr = 1 + (1 - neat) * [0.24, -0.18, 0.32, -0.1][i];
			const rr = r * jr * (1 - 0.06 * i * neat);
			s += `<ellipse cx="${f(cx + jx + i * 0.5 * neat)}" cy="${f(cy + jy)}" rx="${f(rr)}" ry="${f(ry * jr)}" fill="none" stroke="${C.blue}" stroke-width="1.5"/>`;
		}
		// the two ends: one leaves the coil down to the bench, the other is tucked in (neat) or trails (loose)
		const ex = cx + r * 0.9;
		// (it ends on the bench, never below it)
		const ey0 = cy + 0.4 * ry;
		s += `<path d="M${f(ex)} ${f(ey0)}q${f(3 + 5 * (1 - neat))} ${f(Math.max(0, -0.8 - ey0) * 0.3)} ${f(5 + 6 * (1 - neat))} ${f(Math.max(0, -0.8 - ey0))}" fill="none" stroke="${C.blue}" stroke-width="1.5" stroke-linecap="round"/>`;
		// a tie (neat): a short copper-free band around the loops
		s += `<rect x="${f(cx - r - 1)}" y="${f(cy - 1.1)}" width="2.2" height="2.2" rx="0.5" fill="${C.ink2}" opacity="${op(neat >= 1 ? 1 : 0)}"/>`;
		s += `<rect x="${f(cx + r - 1.2)}" y="${f(cy - 1.1)}" width="2.2" height="2.2" rx="0.5" fill="${C.ink2}" opacity="${op(neat >= 1 ? 1 : 0)}"/>`;
		return s;
	}
	solids(t: number) {
		if (t >= this.k.grip && t < this.k.down) return [];
		const x = t < this.k.grip ? this.o.at.x : this.o.place.x;
		// (its lower loops: the jaws take it by the top loop)
		return [rectP(x - this.o.r - 1, -this.o.r * 0.55, x + this.o.r + 1, 0)];
	}
}

/** all of a program's props at t (cell units) */
export function propsMarkup(list: Prop[], t: number, v?: ArmView) {
	let s = '';
	for (const p of list) s += p.draw(t, v);
	return s;
}
