/**
 * The panel under test: one illustrative 24 V DC connection list that runs through the whole home page. It is the robots'
 * internal model (which terminal each vignette's lead goes into, what the camera reads): none of these
 * tags is ever printed on screen. Device tags follow IEC 81346 with one-letter classes (-X, -K, -A, -Q, -G, -F, -W). The
 * compartment programs (device, direction, seed, timeline) live in scripts/panel/programs.ts.
 */
export interface Connection {
	n: number;
	from: string;
	to: string;
	wire: string;
	colour: 'DBU' | 'GNYE';
}

/** one wire per compartment: +C1 tests connection 1, … +C7 (the visitor's request) connection 7 */
export const CONNECTIONS: Connection[] = [
	{ n: 1, from: '-W1', to: '-X1:13', wire: '0.75 mm²', colour: 'DBU' },
	{ n: 2, from: '-X1:14', to: '-K1:A1', wire: '0.75 mm²', colour: 'DBU' },
	{ n: 3, from: '-K1:13', to: '-X2:1', wire: '0.75 mm²', colour: 'DBU' },
	{ n: 4, from: '-X2:4', to: '-A1:L+', wire: '0.75 mm²', colour: 'DBU' },
	{ n: 5, from: '-A1:Q0.0', to: '-A2:I0.0', wire: '0.5 mm²', colour: 'DBU' },
	{ n: 6, from: '-A2:M', to: '-G1:−', wire: '0.75 mm²', colour: 'DBU' },
	{ n: 7, from: '-G1:+', to: '-X0:1', wire: '0.75 mm²', colour: 'DBU' },
];

/** the film's circuit: W07, DBU 0.75 mm², −F7:2 → −X0:7; R = ρ·L/A with ρ_Cu 0.0172 Ω·mm²/m and L the drawn length (mm) */
export const SHOW = { n: '07', wire: 'W07', from: '-F7:2', to: '-X0:7', section: 0.75, colour: 'DBU', rho: 0.0172 } as const;
