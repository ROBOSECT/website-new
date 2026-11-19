/**
 * The menu button's icon: three short ROBOSECT cables (Carta, a flat cut on the left, the copper conductor at the head on
 * the right, the page cable's proportions: conductor ≈ 0.5 of the cable's width, ≈ 1.5 widths long). Opening the menu
 * bends them into the close X: the top and bottom cables swing into the diagonals with the head leading and the body
 * following (a sag that comes and goes, never a hinge), the middle one runs out of the right edge (a cable never
 * shortens: it leaves by the edge and comes back the same way). Same length at rest and in the X.
 * Units: the icon's 24 × 24 viewBox. `cablesAt(t)`: 0 = three cables, 1 = the X.
 */
type Pt = [number, number];
const REST: [Pt, Pt][] = [
	[[3, 6], [18.4, 6]],
	[[3, 12], [18.4, 12]],
	[[3, 18], [18.4, 18]],
];
// the diagonals of the X, 15.4 long like the cables, centred on the icon; the middle cable out past the right edge
const CROSS: [Pt, Pt][] = [
	[[6.55, 6.55], [17.45, 17.45]],
	[[27, 12], [42.4, 12]],
	[[6.55, 17.45], [17.45, 6.55]],
];
/** the sag at mid-bend, across the cable (the top one bows up, the bottom one down) */
const SAG = [-2.4, 0, 2.4];
/** the copper conductor's length */
export const TIP = 3.5;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
/** cubic in-out: the cable runs (brand motion principles) */
const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const f = (n: number) => +n.toFixed(2);
const pt = (p: Pt) => `${f(p[0])},${f(p[1])}`;

/** the three cables at t: for each, the cable's path and its copper conductor's path */
export function cablesAt(t: number): { cable: string; tip: string }[] {
	return REST.map((rest, i) => {
		const end = CROSS[i];
		// the head (the conductor's end) leads, the cut end follows; the middle cable slides out whole
		const tHead = i === 1 ? inOut(t) : inOut(clamp(t / 0.8));
		const tTail = i === 1 ? inOut(t) : inOut(clamp((t - 0.2) / 0.8));
		const p0: Pt = [lerp(rest[0][0], end[0][0], tTail), lerp(rest[0][1], end[0][1], tTail)];
		const p3: Pt = [lerp(rest[1][0], end[1][0], tHead), lerp(rest[1][1], end[1][1], tHead)];
		const s = SAG[i] * Math.sin(Math.PI * t);
		const c1: Pt = [lerp(p0[0], p3[0], 1 / 3), lerp(p0[1], p3[1], 1 / 3) + s];
		const c2: Pt = [lerp(p0[0], p3[0], 2 / 3), lerp(p0[1], p3[1], 2 / 3) + s];
		const dx = p3[0] - c2[0];
		const dy = p3[1] - c2[1];
		const len = Math.hypot(dx, dy) || 1;
		const head: Pt = [p3[0] + (dx / len) * TIP, p3[1] + (dy / len) * TIP];
		return { cable: `M${pt(p0)} C${pt(c1)} ${pt(c2)} ${pt(p3)}`, tip: `M${pt(p3)} L${pt(head)}` };
	});
}
