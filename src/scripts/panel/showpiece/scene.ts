/**
 * The Contact showpiece: the scene's geometry, constants only.
 *
 * Units are the robot grid (1 u = 1 px × the stage scale), x right, y down, the bench and the device tabs' foot at y = 0,
 * the tab tops at y = −12. The stage viewBox is FIXED on every screen (no camera moves): x −184…184,
 * y −116…68; everything the film draws stays inside it (QA).
 *
 * The cell: L at x = −84 (camera · gripper · probe), R at x = +84 (driver · opener · probe), three-slot racks behind them;
 * on the bright work plate the breaker −F7 (screw clamps, toggle), the main connector −X0 (mouth 7 = spring cage with an
 * angled release slot, the test socket T7, six ring pins = the six compartments, the centre pin = the visitor), the duct
 * (cover off) and the protagonist W07 (DBU 0.75 mm², copper ends, its 07 marker sleeves): −F7:2 → −X0:7.
 */
import { SCREW_TIGHT, SOCKET_Y, screwTop, TAB } from '../devices';
import type { Pt } from '../robot/kin';

export const VB = { x: -184, y: -116, w: 368, h: 184 };
export const DOWN = Math.PI / 2;
/** half a beat at 100 BPM: every hit of the film lands on it, by waiting (never by speeding a move) */
export const GRID = 0.3;
export const qz = (t: number, g = GRID) => Math.ceil((t - 1e-6) / g) * g;

export const G = {
	bx: { L: -84, R: 84 },
	slots: { L: [-118, -142, -166], R: [118, 142, 166] },
	barTop: -36,
	dockF: -40,
	plateT: 2.5,
	tabTop: -TAB.h,
	/** the copper stub's length */
	CU: 5.6,
	/** the jaws hold end A this far above its insulation end: the palm passes over −F7's toggle (QA: ≥ 0.3 u), clear of
	 * the driver's collar */
	GIA: 14,
	/** end B: higher, the wrist comes down drop B clear of the toggle and the opener's blade works below the jaws */
	GIB: 18,
	/** W07's insulation (units) */
	wire: 3.2,
	/** the insulation stops 1 unit above the mouth */
	seatGap: 1,
};
/**
 * −F7, the breaker with screw clamps (stage x = x0 + device x). Mouths ±15 and screws ±27 from its centre, the toggle between
 * them (the body is 62 units wide rather than 56: at ±12 the gripper that switches it ON could not reach the knob
 * without touching the wire in −F7:2, and the driver kept only 2 u from the hand that holds end A: robot QA). It sits at the plate's left edge so drop A hangs 40 units left of drop B:
 * the hand that grips end B keeps its wrist clear of drop A
 */
export const F7 = { x0: -68, w: 62, h: 60, c: -37, m1: -52, m2: -22, s1: -64, s2: -10, piv: -37, mouth: 15, port: 27 };
/** −X0, the site's main connector (72 × 40) with the showpiece's tab: mouth 7 (cage), the angled release slot, T7 */
export const X0 = { x0: 8, w: 72, h: 40, c: 44, m7: 30, rel: 40, t7: 54, tab0: 20, tab1: 66, pinY: 22 };
/** the cage's release slot: angled 20° (up toward R); the opener's axis points down and to the left along it */
export const REL_TILT = (20 * Math.PI) / 180;
export const REL_PHI = DOWN + REL_TILT;
export const relU = { x: Math.cos(REL_PHI), y: Math.sin(REL_PHI) };
export const relAt = (d: number) => ({ x: X0.rel + relU.x * d, y: G.tabTop + relU.y * d });
/** the actuator's top along the slot at rest, and its stroke */
export const CAGE_D0 = 0.8;
export const CAGE_PUSH = 3;
/** the duct on the plate and its slots: the supply (−F7:1), W07 end A, end B, the page's cable −W0 */
export const DUCT = { x0: -68, x1: 82, y0: -110, y1: -96, slotA: -22, slotB: 17, slotS: -52, slotW: 72 };
/** the work plate, the rail */
export const PLATE = { x0: -72, y0: -114, x1: 86, y1: 64 };
export const SEAT = { A: { x: F7.m2, y: G.tabTop - G.seatGap }, B: { x: X0.m7, y: G.tabTop - G.seatGap } };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
/** each drop's length from its duct slot to the insulation end (constant: the wire does not stretch) */
export const LD = {
	A: dist({ x: DUCT.slotA, y: DUCT.y1 }, SEAT.A) + 3.2,
	B: dist({ x: DUCT.slotB, y: DUCT.y1 }, SEAT.B) + 3.4,
};
/** each end's curl (coil memory): its last Lc units curl by `ang` rad (sign + curls toward −x) */
export const CURL = { A: { Lc: 22, ang: 3.4, sign: 1 }, B: { Lc: 16, ang: 0.45, sign: 1 } };
/** the test points: −F7:1's screw head (line side, pre-wired, tight) and −X0:T7's contact */
export const TP = {
	f71: { x: F7.s1, y: screwTop(SCREW_TIGHT) },
	t7: { x: X0.t7, y: SOCKET_Y },
	t7Hover: 6,
};
/**
 * the three-slot racks (the site's rack idiom with a third slot): a bar with three slots the tool bodies hang through (their
 * plates rest on its edges), a post at the outer end (clear of the outermost plate) and a foot kept inside the stage
 */
export const SLOT_HW = 6.7;
export function rack3(id: 'L' | 'R') {
	const s = G.slots[id];
	const m = id === 'L' ? -1 : 1;
	const inner = s[0] - m * 12,
		outer = s[2] + m * 12;
	const post = outer - m * 1;
	const xs = [...s].sort((a, b) => a - b);
	const bars: [number, number][] = [];
	let a = Math.min(inner, outer);
	for (const x of xs) {
		bars.push([a, x - SLOT_HW]);
		a = x + SLOT_HW;
	}
	bars.push([a, Math.max(inner, outer)]);
	const foot: [number, number] = m > 0 ? [post - 10, Math.min(post + 6, VB.x + VB.w - 1)] : [Math.max(post - 6, VB.x + 1), post + 10];
	return { xs, bars, post, foot };
}

/** where W07's free drop hangs its insulation end (the renderer's model: straight down, its last Lc curling by ang); `upTo`:
 * the point at that arc length from the slot instead */
export function hangEnd(S: Pt, Ld: number, Lc: number, ang: number, sign: number, upTo = Ld) {
	let x = S.x,
		y = S.y;
	const n = 26,
		ds = Ld / n;
	for (let i = 1; i <= n; i++) {
		if (i * ds > upTo + 1e-9) {
			const r = upTo - (i - 1) * ds;
			const s0 = (i - 0.5) * ds,
				c0 = Ld - Lc;
			const th = Math.PI / 2 + (s0 > c0 ? sign * ang * Math.pow((s0 - c0) / Lc, 1.5) : 0);
			return { x: x + Math.cos(th) * r, y: y + Math.sin(th) * r };
		}
		const s = (i - 0.5) * ds,
			c0 = Ld - Lc;
		const th = Math.PI / 2 + (s > c0 ? sign * ang * Math.pow((s - c0) / Lc, 1.5) : 0);
		x += Math.cos(th) * ds;
		y += Math.sin(th) * ds;
	}
	return { x, y };
}
