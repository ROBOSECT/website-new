/**
 * The rope settles after the wheel stops (follow-through, no freeze).
 *
 * Every animation of a compartment is a pure function of its program time, and the program time follows the scroll: when
 * the visitor stops, everything stops where it is, the lead included, even mid-swing or bowed behind a hand that was moving.
 * A real cable does not stop there. Once the scroll has settled, a Relax takes the lead as it is drawn and lets it go on
 * under the same physics the simulation uses (Rope3: gravity, damping, length and bending constraints) with the pins it had
 * at that moment (the duct exit, the jaws, the mouth, the light tension of the feed), in real time: it sways, follows
 * through and comes to rest. It is display only: the simulation, its snapshot cache and every scrubbed frame stay what they
 * were (forward, backward and cold give the same state); nothing of it is ever read back into the program.
 *
 * When the scroll moves again the program time moves on and the drawn lead returns to the simulated one: the difference the
 * settling made fades out over ≈ 0.25 s (τ 0.08 s) on top of the simulated lead, so it never jumps; a jump of the program
 * (a hash, find-in-page, a re-layout) drops it at once.
 */
import { H } from './core';
import type { RopeCfg } from './program';
import { Rope3, type Pin } from './sim';

/** the rope is at rest when no node has moved more than this (px per 1/120 s step) for REST_STEPS steps */
const REST_V = 0.003;
const REST_STEPS = 30;
/** the longest a settling runs (s): the ropes' damping brings a swing to rest well within it */
const MAX_T = 6;
/** the fade back to the simulated lead (s) */
const TAU_BACK = 0.08;

export class Relax {
	/** the program time it started from */
	readonly t0: number;
	private rope: Rope3;
	/** the drawn lead when it started (the simulated one at t0) */
	private base: Float64Array;
	private out: Float64Array;
	private pins: Pin[];
	private rc: RopeCfg;
	private acc = 0;
	private age = 0;
	private still = 0;
	/** settling (true) or at rest */
	running = true;
	/** the weight of the settling's difference while the program time moves on (1 → 0) */
	w = 1;
	/** bumped whenever what it draws changed */
	version = 0;
	/**
	 * pts: the lead as drawn at t0 (interpolated between two 120 Hz states); next: the simulated nodes at the step after t0,
	 * whose pins are given (the pins are moved by the difference, so the pinned nodes start exactly where they are drawn)
	 */
	constructor(t0: number, pts: ArrayLike<number>, n: number, L: number, next: ArrayLike<number>, pins: Pin[], rc: RopeCfg) {
		this.t0 = t0;
		this.rc = rc;
		this.rope = new Rope3(n);
		this.rope.L = L;
		for (let i = 0; i < 2 * n; i++) this.rope.x[i] = this.rope.p[i] = pts[i];
		this.base = Float64Array.from({ length: 2 * n }, (_, i) => pts[i]);
		this.out = new Float64Array(2 * n);
		this.pins = pins.map((q) => ({ ...q, x: q.x + (pts[2 * q.i] - next[2 * q.i]), y: q.y + (pts[2 * q.i + 1] - next[2 * q.i + 1]) }));
	}
	/** advance the settling by dt (s, real time); returns true when the drawn lead changed */
	step(dt: number) {
		if (!this.running) return false;
		this.acc += Math.min(dt, 0.05);
		this.age += dt;
		const R = this.rope,
			n2 = 2 * R.n;
		let steps = 0;
		while (this.acc >= H && steps < 6) {
			R.step(H, this.rc, this.pins);
			this.acc -= H;
			steps++;
			let v = 0;
			for (let i = 0; i < n2; i++) v = Math.max(v, Math.abs(R.x[i] - R.p[i]));
			this.still = v < REST_V ? this.still + 1 : 0;
		}
		if (this.still >= REST_STEPS || this.age > MAX_T) this.running = false;
		if (steps) this.version++;
		return steps > 0;
	}
	/** the program time moved on: the difference fades (returns false once it is gone) */
	fade(dt: number) {
		this.running = false;
		this.w *= Math.exp(-Math.min(dt, 0.05) / TAU_BACK);
		this.version++;
		return this.w > 0.004;
	}
	/** the lead to draw: the settled one at t0; while fading, the simulated one plus what is left of the difference */
	pts(sim: ArrayLike<number> | null): Float64Array {
		const o = this.out,
			x = this.rope.x;
		if (this.w >= 1 || !sim) {
			o.set(x);
			return o;
		}
		const w = this.w,
			b = this.base;
		for (let i = 0; i < o.length; i++) o[i] = sim[i] + w * (x[i] - b[i]);
		return o;
	}
}
