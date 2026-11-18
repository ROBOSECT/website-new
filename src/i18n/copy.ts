/**
 * ROBOSECT — site copy, EN + IT.
 *
 * Source of truth for every string on the one-page home, nav, footer and news posts.
 * Both languages share the exact same key structure (and the same array lengths), so a
 * component can do `const t = copy[lang]` and never branch on language.
 *
 * Rules applied:
 * - The home speaks to switchboard builders first (owner, production and quality managers, the EPLAN office); wiring
 *   harnesses, robot cells and other manipulation are «Also for you». «Bring us a project» / «Proponeteci un progetto» is the
 *   main action; «Write to us» / «Scriveteci» in the bar and «Tell us about your process» / «Parlateci del vostro
 *   processo» for every other process (Italian addresses the reader as «voi», except the Team job line, which stays «tu»).
 * - No invented metrics, clients, testimonials, certifications or people. A proof point that is still missing is
 *   left out, not shown as a placeholder (Alex, 18/11/2026: no «[TBD: …]» on the pages).
 * - Facts used: the brand story (ROBOSECT-Il-Cavo/01-Storia-e-strategia/racconto-del-marchio.md) and the previous site
 *   (website-new `master` up to 42db8e8): University of Bologna spin-off; AIRISE.eu funding for an AI-based robotic platform
 *   for switchboard quality control (visual inspection of assembly defects, cable-marker reading, continuity testing);
 *   EIT Manufacturing and CTE COBO logos (relationship not stated, hence [TBD]); sponsor and exhibitor at IEEE/ASME AIM 2026,
 *   Genoa, 7–10 July 2026; the prototype video (robosect_v4.mp4, 90 s, no sound); Alessio Caporali, CEO & Co-Founder; the
 *   legal line. Reply within two working days: decided with the owner (November 2026).
 * - The connection-list rows in the demo drawing are illustrative (no device codes on screen).
 * - Anchor ids (`id`, `href`) are language-neutral on purpose: /#contact and /it/#contact.
 * - Strings use the typographic apostrophe (’) so they never need escaping.
 * - Any string that is '' is meant to be rendered conditionally (render only if non-empty).
 */

export type Lang = 'en' | 'it';

export const copy = {
	en: {
		meta: {
			htmlLang: 'en',
			ogLocale: 'en_GB',
			dateLocale: 'en-GB',
			title: 'ROBOSECT | Robotics for cables and everything that bends',
			description:
				'Robots that test electrical switchboards starting from your EPLAN connection list, with a test report for every board, and robotic manipulation of cables and deformable parts, from wiring harnesses to reel changes on packaging machines. A University of Bologna spin-off.',
			ogTitle: 'Automation stops at the cable. Ours doesn’t.',
			ogDescription:
				'ROBOSECT builds robots that test switchboards starting from your EPLAN project, and takes robotic manipulation all the way to cables and deformable parts. A University of Bologna spin-off.',
			ogImageAlt:
				'Two collaborative robots testing the wires of an electrical switchboard on the bench',
		},

		brand: {
			name: 'ROBOSECT',
			descriptor: 'Robotics for cables and everything that bends',
			tagline: 'Automation, down to the last wire.',
		},

		a11y: {
			skipToContent: 'Skip to content',
			homeLink: 'ROBOSECT, back to homepage',
			openMenu: 'Open menu',
			closeMenu: 'Close menu',
			linkedin: 'ROBOSECT on LinkedIn (opens in a new tab)',
			email: 'Email ROBOSECT',
			opensInNewTab: '(opens in a new tab)',
			playVideo: 'Play video',
			pauseVideo: 'Pause video',
			closeVideo: 'Close the video',
		},

		nav: {
			// every link goes to a place on the home page. `id` is the section the bar marks while it is on screen; `anchor`
			// is the place the link scrolls to (inside that section, when it is not the section itself)
			links: [
				{ id: 'how-it-works', anchor: 'how-it-works', label: 'How it works' },
				{ id: 'what-you-get', anchor: 'products', label: 'Products' },
				{ id: 'proof', anchor: 'proof', label: 'Prototype' },
				{ id: 'also-for-you', anchor: 'work', label: 'Engineering & R&D' },
				{ id: 'team', anchor: 'team', label: 'Team' },
			],
			blog: 'News',
			// Label and ariaLabel are in the TARGET language: render the link with lang="it" / lang="en".
			langSwitch: {
				label: 'Italiano',
				short: 'IT',
				ariaLabel: 'Leggi il sito in italiano',
			},
			// the bar's action is for every visitor (switchboards or any other process); «Bring us a project» is the main action
			// (hero, What you get, contact)
			cta: 'Write to us',
			// narrow phones: the same action in fewer letters (the bar holds the logo, this button and the menu button)
			ctaShort: 'Write to us',
			ctaTiny: 'Write to us',
		},

		cta: {
			label: 'Bring us a project',
			promise: 'We will tell you plainly whether a robot can do it, and how.',
		},

		// the action for every process (Also for you, the hero's second line)
		ctaAll: {
			label: 'Tell us about your process',
			promise: 'Switchboards, wiring harnesses, reels, robot cells or any part that is hard to handle: we will tell you plainly whether a robot can do it, and how.',
		},

		hero: {
			headline: 'Automation stops at the cable. Ours doesn’t.',
			subheadline:
				'Robots that test your switchboards starting from your EPLAN project: every connection checked, every switchboard leaves with its test report. Switchboards come first; the same platform takes robotic manipulation all the way to the hardest case, cables and deformable parts.',
			primaryCta: { label: 'Bring us a project', href: '#contact' },
			secondaryCta: { label: 'Watch the demo', duration: '1:30' },
			otherLine: { text: 'Not a switchboard builder?', link: 'Tell us about your process' },
			proofChips: [
				'University of Bologna spin-off',
				'AIRISE.eu-funded project',
				'Working prototype on a real switchboard',
			],
			imageAlt:
				'The ROBOSECT prototype: two collaborative robots testing the wires of an electrical switchboard laid on the bench',
			videoTitle: 'The ROBOSECT prototype testing a switchboard',
		},

		problem: {
			id: 'problem',
			eyebrow: 'The problem',
			title: 'Switchboard testing is still done by hand, wire by wire.',
			intro:
				'A skilled technician, a tester and the connection list: one point at a time, every board. It is the part of the job automation has never reached.',
			points: [
				{
					title: 'Hours of your best people',
					body: 'Point-by-point testing ties up a skilled technician for hours. The very person you need on the next board.',
				},
				{
					title: 'Every board is a variant',
					body: 'Built-to-order switchboards change every time. Nobody reprograms a robot for a board that is built once.',
				},
				{
					title: 'No record of what was tested',
					body: 'At the end there is, at best, a list ticked by hand. Showing your customer which wire was tested, and how, is hard.',
				},
			],
			vision: {
				label: 'What the robot sees',
				found: 'components found',
				caption: 'No program written by hand for this board: the robot recognizes it on its own.',
			},
			closing: 'This is where automation has always stopped. It is where we start.',
		},

		process: {
			id: 'how-it-works',
			eyebrow: 'How it works',
			title: 'From your EPLAN project to the test report, in three steps',
			intro:
				'Nobody programs the robot board by board. It starts from the data you already have and looks at the real switchboard.',
			steps: [
				{
					number: '01',
					kicker: 'Sees',
					title: 'It sees the real switchboard',
					body: 'Cameras and 3D sensors, with deep-learning models, find components, terminals and markers where they really are, not where the drawing puts them.',
				},
				{
					number: '02',
					kicker: 'Starts',
					title: 'It starts from your EPLAN connection list',
					body: 'The system imports the schematic and the connection list you already have and builds the test sequence from them. A new board is not a new robot program.',
				},
				{
					number: '03',
					kicker: 'Records',
					title: 'It leaves the test report',
					body: 'Two collaborative arms with custom probes check the continuity of each connection. Every test is logged: the board leaves with its report. The decisions stay with your tester.',
				},
			],
			demo: {
				label: 'Animated drawing: the terminals of a switchboard light up one by one while a test report fills in line by line beside it.',
				reportTitle: 'Test report',
				reportSub: 'Continuity test · from the EPLAN connection list',
				to: 'to',
				result: 'OK',
				rows: [
					['Terminal block', 'Relay coil'],
					['Relay contact', 'Spring terminal'],
					['Spring terminal', 'Controller supply'],
					['Controller output', 'Input module'],
					['Input module', 'Power supply 0 V'],
					['Power supply 24 V', 'Main connector'],
					['Terminal block', 'Earth bar'],
				],
				summary: '7 of 7 connections checked',
				caption: 'Illustrative drawing: made-up board and rows, not a real report.',
			},
			techLine: {
				text: 'Inside: perception, EPLAN and CAD integration, cable-aware planning with a digital twin.',
			},
		},

		benefits: {
			id: 'what-you-get',
			eyebrow: 'What you get',
			// the one action under the products: a demo request goes through «Bring us a project» too
			ctaPromise: 'A demo or a project of your own: we will tell you plainly whether a robot can do it, and how.',
			title: 'What changes in your testing',
			intro:
				'The robot does the round of the test points. Your people check the results and decide.',
			items: [
				{
					title: 'Fewer hours of manual testing',
					body: 'The robot goes from point to point; the technician no longer spends the day with the probes in hand.',
				},
				{
					title: 'Every connection checked',
					body: 'The sequence comes from the connection list: every wire on the list gets its test, none is skipped in a hurry.',
				},
				{
					title: 'A report for your customer',
					body: 'Every switchboard leaves with its digital test report, traceable. Ready to hand over with the board.',
				},
				{
					title: 'Skilled people on the work that matters',
					body: 'The robot takes the repetitive round of the test points. The decisions stay with the people who know the trade.',
				},
			],
			products: {
				id: 'products',
				title: 'Four products, from switchboards to reels',
				intro: 'Three tools for switchboard testing and one for packaging machines. The first three share one thing: your project data. The reel-change cell comes from the same work on deformable objects. Each one works on its own.',
				forLabel: 'For',
				cards: [
					{
						media: 'reader',
						alt: 'Render of the Cable Reader: a C-shaped bench unit with the camera head above a white base',
						status: 'Prototype',
						name: 'Cable Reader',
						line: 'A semi-automatic bench unit: a camera reads the cable labels from above and a status light guides the operator.',
						forWhom: 'Small switchboard builders',
						note: '',
					},
					{
						media: 'cell',
						alt: 'Two collaborative arms over a wired switchboard, one probe touching a terminal',
						status: 'In validation',
						name: 'Quality Control Cell',
						line: 'A robot cell with two collaborative arms: it tests every connection from your EPLAN list, and each switchboard leaves with its digital report.',
						forWhom: 'Larger builders and companies with their own switchboard shop',
						note: '',
					},
					{
						media: 'schemes',
						alt: 'Switchboard rebuilt as data: components, terminals, ducts and wire paths',
						status: 'In development',
						name: 'Schematic conversion',
						line: 'Turns schematics that exist only as PDF into the structured data the other products need.',
						forWhom: 'Builders and maintainers whose schematics exist only as PDF',
						note: '',
					},
					{
						media: 'reel',
						alt: 'Simulation: a robot arm carries a tape off a reel, over three rollers and through the exit clamp',
						status: 'In development',
						name: 'Reel-change cell',
						line: 'A robot cell that loads the new reel, threads the tape and splices it, as a retrofit or an option.',
						forWhom: 'Makers and users of automatic packaging machines',
						note: 'Seen so far in simulation: find the loose end, take it, thread the tape and join it.',
					},
				],
			},
		},

		proof: {
			id: 'proof',
			eyebrow: 'Prototype',
			title: 'A real prototype, on a real switchboard',
			intro:
				'Two collaborative arms with custom probes test the connections of an electrical switchboard. It is a prototype, and we call it that.',
			status: 'Status: working prototype',
			video: {
				id: 'video',
				title: 'The prototype at work',
				caption:
					'A camera on one arm locates the components of a switchboard, then two collaborative arms probe its wires. The corner of the frame shows when the footage is sped up or slowed down (×0.5 to ×8).',
				description:
					'Video, 90 seconds, no sound, English captions: a camera on one collaborative robot locates the 25 components of a switchboard, then two arms probe its wires one by one.',
				posterAlt: 'Still frame from above: two collaborative robot arms over an open switchboard',
			},
			photo: {
				alt: 'Two collaborative robot arms centimetres apart over a terminal block: on the left a gripper, on the right a test probe pointing down',
				caption: 'Two arms in one workspace: their tools work centimetres apart on the same terminal block, without touching.',
			},
			factsTitle: 'Who stands behind it',
			facts: [
				{
					name: 'University of Bologna spin-off',
					detail: 'ROBOSECT SRL is a spin-off of the Alma Mater Studiorum – Università di Bologna, founded in 2024 and born from years of academic research and European innovation projects.',
					logoAlt: 'Alma Mater Studiorum – Università di Bologna',
					mark: '',
				},
				{
					name: 'AIRISE.eu-funded project: CONTEST',
					detail: 'Funding to develop an AI-based robotic platform for switchboard quality control: visual inspection of assembly defects, cable-marker reading, continuity testing.',
					logoAlt: 'AIRISE.eu',
					mark: '',
				},
				{
					name: 'Patented technology',
					detail: 'Italian patent 102023000014613, extended to the EU.',
					logoAlt: '',
					mark: 'PATENT',
				},
				{
					name: 'Startup awards',
					detail: 'Emilia-Romagna startCUP 2022, 3rd place. University of Bologna Call for Startup and Business Plan 2022, 1st place.',
					logoAlt: '',
					mark: '2022',
				},
				{
					name: 'Incubated at EIT Manufacturing and CTE COBO',
					detail: 'Two incubation programmes that follow the company as it moves from the lab to its first customers.',
					logoAlt: '',
					mark: 'EIT · COBO',
				},
				{
					name: 'Sponsor and exhibitor at IEEE/ASME AIM 2026',
					detail: 'Genoa, 7–10 July 2026.',
					logoAlt: '',
					mark: 'AIM 2026',
				},
			],
			targets: {
				title: 'What the project is aiming for',
				toWord: 'to',
				items: [
					{ from: '30 s', to: '10 s', label: 'One connection test' },
					{ from: '45 min', to: '15 min', label: 'The reference switchboard' },
				],
				note: 'These are the targets of the AIRISE project, not measurements. Measured figures will be published with their test conditions.',
			},
		},

		alsoFor: {
			id: 'also-for-you',
			eyebrow: 'Also for you',
			title: 'A platform for deformable objects',
			intro: 'Not a switchboard builder? The same base, perception, planning and execution, works wherever parts are hard to handle: cables, wiring harnesses and other parts that bend.',
			statusLabel: 'Status',
			items: [
				{
					title: 'Wiring harness makers and remanufacturers',
					body: 'Perception of cables, branches and connectors; grasping and routing of flexible cables. Built for variants and for remanufacturing, where every harness comes back in a different condition.',
					status: 'Open to collaboration',
				},
				{
					title: 'Robot cells and integrators',
					body: 'Collision-free trajectories that account for cables, including the robot’s own dress pack. We are looking for integrators to work with: partners, not only customers.',
					status: 'Open to collaboration',
				},
				{
					title: 'Other manipulation tasks',
					body: 'Processes with flexible parts, inspection tasks or high product variability: robotic systems designed around your process.',
					status: 'On request',
				},
			],
			work: {
				id: 'work',
				title: 'Engineering and R&D for what bends',
				intro: 'We also work for hire: the team that built the platform does the job. Three ways to work together; if none fits, write to us anyway.',
				items: [
					{
						kicker: 'Projects',
						title: 'Engineering projects',
						body: 'Custom robotics for deformable objects. We study your process, tell you whether a robot can do it, and build the proof of concept.',
					},
					{
						kicker: 'Licences',
						title: 'Licensable modules',
						body: 'Parts of the platform, such as a motion planner that accounts for cables and dress packs, that you can license and build into your own system.',
					},
					{
						kicker: 'Funding',
						title: 'Funded projects',
						body: 'We take part in research and innovation projects, like the AIRISE.eu project behind our switchboard robot. Bring a use case and we look at the right call together.',
					},
				],
			},
			cta: 'Tell us about your process',
		},

		team: {
			id: 'team',
			eyebrow: 'Team',
			title: 'From the lab to the factory floor',
			intro:
				'ROBOSECT is a team of robotics engineers, AI researchers and industrial automation specialists with roots at the University of Bologna. One goal: robots that work on real products, not only in the lab.',
			areas: [
				{
					title: 'Robotics & motion planning',
					body: 'Industrial robot programming, trajectory planning and collision-free motion in cluttered cells.',
				},
				{
					title: 'AI & computer vision',
					body: 'Deep learning, 3D perception and detection of deformable objects, built on years of academic publications and applied research.',
				},
				{
					title: 'Systems & product engineering',
					body: 'End-effectors, sensing hardware and control software, integrated into robotic platforms built for production.',
				},
				{
					title: 'Industrial partnerships',
					body: 'Work with manufacturers and European research programmes to turn research results into technology on the shop floor.',
				},
			],
			founders: {
				title: 'The team',
				intro: 'A University of Bologna spin-off, founded in 2024. Prof. Gianluca Palli advises the team.',
				people: [
					{
						name: 'Alessio Caporali',
						role: 'CEO & Co-Founder',
						bio: '',
						photoAlt: 'Alessio Caporali, CEO & Co-Founder of ROBOSECT',
					},
					{
						name: 'Kevin Galassi',
						role: 'Co-Founder',
						bio: '',
						photoAlt: '',
					},
					{
						name: 'Davide Chiaravalli',
						role: 'Co-Founder',
						bio: '',
						photoAlt: '',
					},
					{
						name: 'Giorgio Medico',
						role: 'Research Engineer',
						bio: '',
						photoAlt: '',
					},
					{
						name: 'Alex Pasquali',
						role: 'Research Engineer',
						bio: '',
						photoAlt: '',
					},
					{
						name: 'Gianluca Palli',
						role: 'Advisor',
						bio: '',
						photoAlt: '',
					},
				],
			},
			joinUs: {
				text: 'Want to build robots that handle what others avoid?',
				cta: 'Write to us',
			},
		},

		contact: {
			id: 'contact',
			eyebrow: 'Contact',
			closingTag: 'Automation, down to the last wire.',
			title: 'Bring us a project.',
			answer: 'We will tell you plainly whether a robot can do it, and how.',
			body: 'A few lines are enough: what you do, what you would like a robot to handle, how it is done today.',
			responseTime: 'We reply within two working days.',
			form: {
				name: { label: 'Name and surname' },
				company: { label: 'Company' },
				email: { label: 'Work email', placeholder: 'name@company.com' },
				phone: { label: 'Phone' },
				sector: {
					label: 'What do you do?',
					// the first option is the switchboard builders': it shows the switchboard questions
					options: ['Electrical switchboards', 'Wiring harnesses', 'Robot cells and integration', 'Packaging machines', 'Other manipulation'],
				},
				sbGroup: 'If you build switchboards',
				boards: {
					label: 'What switchboards do you build?',
					placeholder: 'Choose one',
					options: ['Machine-mounted', 'Power distribution', 'Automation and control', 'Other'],
				},
				volumes: {
					label: 'Switchboards per year',
					placeholder: 'Choose one',
					options: ['Fewer than 100', '100–500', 'More than 500'],
				},
				eplan: {
					label: 'Do you use EPLAN?',
					placeholder: 'Choose one',
					options: ['Yes', 'No', 'Other software'],
				},
				process: {
					label: 'How is it done today, and what would you like a robot to handle?',
					placeholder: 'e.g. what you make, how many pieces, what is still done by hand',
				},
				required: 'required',
				optional: 'optional',
				consent: {
					prefix: 'I have read the',
					linkLabel: 'Privacy Policy',
					suffix: 'and agree that ROBOSECT SRL may use my data to reply to this request.',
				},
				submit: 'Send the request',
			},
			direct: {
				label: 'Prefer email? Write to',
				email: 'info@robosect.it',
				address: 'Via Lazio 2, 40139 Bologna, Italy',
				linkedin: 'Follow ROBOSECT on LinkedIn',
			},
			// Contact's showpiece: the robots build this form, one part per job;
			// no codes and no words on the stage but the station's RESET and STOP
			show: {
				figureLabel: 'Animation, about {s} s: two robot arms bend a straight cable, step by step, into the R of the ROBOSECT logo and crimp the copper ferrule on its end. RESET runs it again, STOP stops the robots.',
				details: [
					'The cable comes up through the bench and lies straight along it.',
					'The left arm takes it and lays it into the R’s stem, its top corner and its top.',
					'The right arm takes it over and lays the bowl, the leg and the foot of the R.',
					'The right arm slides the copper ferrule onto the free end and crimps it. The robots park: the cable is the R of the logo.',
				],
				station: {
					group: 'Operator station',
					reset: 'RESET',
					stop: 'STOP',
					resetLabel: 'Reset and run again',
					stopLabel: 'Stop the robots',
				},
			},
			handoff: {
				helper: 'Your email app opens with the request ready. It leaves only when you press Send there.',
				live: 'Your email app should open with the request filled in. Press Send there to deliver it.',
				// (the confirmation never claims the mail app opened, and says each thing once)
				receiptHeading: 'Your request is ready to send.',
				lead: 'Your email app should open with it, addressed to info@robosect.it. Press Send there: nothing leaves until you do.',
				nothingOpened: 'Nothing opened? Use Open the email again, or copy the message and write to info@robosect.it.',
				reply: 'We reply within two working days.',
				openAgain: 'Open the email again ↗',
				copyMessage: 'Copy the message',
				copyAddress: 'Copy the address',
				noApp: 'No email app?',
				noAppText: 'Copy the message and send it to info@robosect.it from any email account.',
				copied: 'Copied ✓',
				selectCopy: 'Select it and copy (Ctrl+C / ⌘C)',
				shortened: '[Message shortened for the email app: the full text is on the page — Copy the message]',
				restored: 'Your request is still ready to send.',
				change: 'Change the request',
				noscript: 'Your email app will open with the request. If nothing opens, write to info@robosect.it.',
				subject: 'A switchboard to test',
				subjectOther: 'A process to automate',
				consentLine: 'Consent: the sender has read the Privacy Policy and agrees that ROBOSECT SRL may use these data to reply to this request.',
				previewTo: 'To',
				previewSubject: 'Subject',
			},
		},

		footer: {
			tagline: 'Automation, down to the last wire.',
			descriptor: 'Robotics for cables and everything that bends.',
			ecosystemTitle: 'Ecosystem',
			partnerAlts: {
				unibo: 'University of Bologna',
				spinoff: 'Spin-off of the University of Bologna',
				cobo: 'CTE COBO',
				eit: 'EIT Manufacturing, co-funded by the European Union',
			},
			columns: {
				site: 'Site',
				legal: 'Legal',
				contact: 'Contact',
			},
			links: {
				how: 'How it works',
				products: 'Products',
				work: 'Engineering & R&D',
				team: 'Team',
				blog: 'News',
				contact: 'Contact',
				linkedin: 'LinkedIn',
				legalNotes: 'Legal Notes',
				privacy: 'Privacy Policy',
				cookies: 'Cookie Policy',
				genderPolicy: 'Gender Equality and Diversity Policy',
			},
			legal:
				'ROBOSECT SRL – Via Lazio 2, 40139, Bologna – CF/PIVA: 04228581205 – Numero REA BO - 578120 – Capitale Sociale 10.000 €',
			rights: '© ROBOSECT SRL. All rights reserved.',
			legalLanguageNote: '',
		},

		blog: {
			title: 'News',
			metaTitle: 'News',
			metaDescription: 'Projects, events and milestones from ROBOSECT.',
			intro: 'Projects, events and milestones from the ROBOSECT team.',
			readMore: 'Read more',
			backToBlog: 'Back to the site',
			publishedOn: 'Published on',
			tagsLabel: 'Tags',
			empty: 'No posts yet.',
			homeTeaserTitle: 'Latest news',
			languageNote: '',
		},

		notFound: {
			metaTitle: 'Page not found',
			title: 'Open circuit.',
			line: 'This page isn’t connected to anything.',
			back: 'Back to home',
		},
	},

	it: {
		meta: {
			htmlLang: 'it',
			ogLocale: 'it_IT',
			dateLocale: 'it-IT',
			title: 'ROBOSECT | Robotica per i cavi e per tutto ciò che si piega',
			description:
				'Robot che collaudano i quadri elettrici partendo dalla vostra lista collegamenti EPLAN, con un verbale per ogni quadro, e manipolazione robotica di cavi e parti deformabili, dai cablaggi al cambio bobina nelle macchine di confezionamento. Spin-off dell’Università di Bologna.',
			ogTitle: 'L’automazione si ferma al cavo. La nostra no.',
			ogDescription:
				'ROBOSECT sviluppa robot che collaudano i quadri elettrici partendo dal vostro progetto EPLAN, e porta la manipolazione robotica fino a cavi e parti deformabili. Spin-off dell’Università di Bologna.',
			ogImageAlt:
				'Due robot collaborativi provano i fili di un quadro elettrico sul banco',
		},

		brand: {
			name: 'ROBOSECT',
			descriptor: 'Robotica per i cavi e per tutto ciò che si piega',
			tagline: 'Automazione, fino all’ultimo filo.',
		},

		a11y: {
			skipToContent: 'Vai al contenuto',
			homeLink: 'ROBOSECT, torna alla home',
			openMenu: 'Apri il menu',
			closeMenu: 'Chiudi il menu',
			linkedin: 'ROBOSECT su LinkedIn (si apre in una nuova scheda)',
			email: 'Scrivete a ROBOSECT',
			opensInNewTab: '(si apre in una nuova scheda)',
			playVideo: 'Avvia il video',
			pauseVideo: 'Metti in pausa il video',
			closeVideo: 'Chiudi il video',
		},

		nav: {
			links: [
				{ id: 'how-it-works', anchor: 'how-it-works', label: 'Come funziona' },
				{ id: 'what-you-get', anchor: 'products', label: 'Prodotti' },
				{ id: 'proof', anchor: 'proof', label: 'Prototipo' },
				{ id: 'also-for-you', anchor: 'work', label: 'Ingegneria e R&D' },
				{ id: 'team', anchor: 'team', label: 'Team' },
			],
			blog: 'News',
			langSwitch: {
				label: 'English',
				short: 'EN',
				ariaLabel: 'Read the site in English',
			},
			cta: 'Scriveteci',
			ctaShort: 'Scriveteci',
			ctaTiny: 'Scriveteci',
		},

		cta: {
			label: 'Proponeteci un progetto',
			promise: 'Vi diciamo con franchezza se un robot può farlo, e come.',
		},

		ctaAll: {
			label: 'Parlateci del vostro processo',
			promise: 'Quadri, cablaggi, bobine, celle robotizzate o un pezzo difficile da maneggiare: vi diciamo con franchezza se un robot può farlo, e come.',
		},

		hero: {
			headline: 'L’automazione si ferma al cavo. La nostra no.',
			subheadline:
				'Robot che collaudano i vostri quadri elettrici partendo dal progetto EPLAN: ogni collegamento verificato, ogni quadro esce con il suo verbale. I quadri vengono per primi; la stessa piattaforma porta la manipolazione robotica fino al caso più difficile, cavi e parti deformabili.',
			primaryCta: { label: 'Proponeteci un progetto', href: '#contact' },
			secondaryCta: { label: 'Guardate la demo', duration: '1:30' },
			otherLine: { text: 'Non costruite quadri?', link: 'Parlateci del vostro processo' },
			proofChips: [
				'Spin-off dell’Università di Bologna',
				'Progetto finanziato da AIRISE.eu',
				'Prototipo funzionante su un quadro vero',
			],
			imageAlt:
				'Il prototipo ROBOSECT: due robot collaborativi provano i fili di un quadro elettrico appoggiato sul banco',
			videoTitle: 'Il prototipo ROBOSECT collauda un quadro',
		},

		problem: {
			id: 'problem',
			eyebrow: 'Il problema',
			title: 'Il collaudo dei quadri si fa ancora a mano, filo per filo.',
			intro:
				'Un tecnico esperto, un tester e la lista collegamenti: un punto alla volta, quadro dopo quadro. È la parte del lavoro dove l’automazione non è mai arrivata.',
			points: [
				{
					title: 'Ore delle persone più esperte',
					body: 'Il collaudo punto per punto tiene occupato per ore un tecnico esperto. Proprio la persona che servirebbe sul quadro successivo.',
				},
				{
					title: 'Ogni quadro è una variante',
					body: 'I quadri su commessa cambiano ogni volta. Nessuno riprogramma un robot per un quadro che si costruisce una volta sola.',
				},
				{
					title: 'Nessuna traccia di cosa è stato provato',
					body: 'A fine collaudo resta, se va bene, una lista spuntata a mano. Dimostrare al cliente quale filo è stato provato, e come, è difficile.',
				},
			],
			vision: {
				label: 'Cosa vede il robot',
				found: 'componenti trovati',
				caption: 'Nessun programma scritto a mano per questo quadro: lo riconosce da solo.',
			},
			closing: 'Qui l’automazione si è sempre fermata. Noi partiamo da qui.',
		},

		process: {
			id: 'how-it-works',
			eyebrow: 'Come funziona',
			title: 'Dal vostro progetto EPLAN al verbale di collaudo, in tre passi',
			intro:
				'Nessuno programma il robot quadro per quadro. Parte dai dati che avete già e guarda il quadro vero.',
			steps: [
				{
					number: '01',
					kicker: 'Vede',
					title: 'Vede il quadro vero',
					body: 'Telecamere e sensori 3D, con modelli di deep learning, trovano componenti, morsetti e siglature dove stanno davvero, non dove dice il disegno.',
				},
				{
					number: '02',
					kicker: 'Parte',
					title: 'Parte dalla vostra lista collegamenti EPLAN',
					body: 'Il sistema importa lo schema e la lista collegamenti che avete già e costruisce da lì la sequenza di prova. Un quadro nuovo non è un nuovo programma robot.',
				},
				{
					number: '03',
					kicker: 'Documenta',
					title: 'Lascia il verbale di collaudo',
					body: 'Due bracci collaborativi con puntali su misura verificano la continuità di ogni collegamento. Ogni prova è registrata: il quadro esce con il suo verbale. Le decisioni restano al vostro collaudatore.',
				},
			],
			demo: {
				label: 'Disegno animato: i morsetti di un quadro si accendono uno alla volta mentre accanto un verbale di collaudo si compila riga per riga.',
				reportTitle: 'Verbale di collaudo',
				reportSub: 'Prova di continuità · dalla lista collegamenti EPLAN',
				to: 'a',
				result: 'OK',
				rows: [
					['Morsettiera', 'Bobina relè'],
					['Contatto relè', 'Morsetto a molla'],
					['Morsetto a molla', 'Alimentazione controllore'],
					['Uscita controllore', 'Modulo ingressi'],
					['Modulo ingressi', 'Alimentatore 0 V'],
					['Alimentatore 24 V', 'Connettore principale'],
					['Morsettiera', 'Barra di terra'],
				],
				summary: '7 collegamenti su 7 verificati',
				caption: 'Disegno illustrativo: quadro e righe di fantasia, non un verbale reale.',
			},
			techLine: {
				text: 'Dentro: percezione, integrazione EPLAN e CAD, pianificazione con digital twin che tiene conto dei cavi.',
			},
		},

		benefits: {
			id: 'what-you-get',
			eyebrow: 'Cosa ottenete',
			ctaPromise: 'Una demo o un vostro progetto: vi diciamo con franchezza se un robot può farlo, e come.',
			title: 'Cosa cambia nel vostro collaudo',
			intro:
				'Il robot fa il giro dei punti di prova. Le vostre persone controllano gli esiti e decidono.',
			items: [
				{
					title: 'Meno ore di collaudo manuale',
					body: 'Il robot va da un punto all’altro; il tecnico non passa più la giornata con i puntali in mano.',
				},
				{
					title: 'Ogni collegamento verificato',
					body: 'La sequenza nasce dalla lista collegamenti: ogni filo della lista ha la sua prova, nessuno saltato per fretta.',
				},
				{
					title: 'Un verbale per il vostro cliente',
					body: 'Ogni quadro esce con il suo verbale di collaudo digitale, tracciabile. Pronto da consegnare insieme al quadro.',
				},
				{
					title: 'Persone esperte sul lavoro che conta',
					body: 'Il robot si prende il giro ripetitivo dei punti di prova. Le decisioni restano a chi conosce il mestiere.',
				},
			],
			products: {
				id: 'products',
				title: 'Quattro prodotti, dai quadri alle bobine',
				intro: 'Tre strumenti per il collaudo dei quadri e uno per le macchine di confezionamento. I primi tre hanno una cosa in comune: i dati del vostro progetto. La cella cambio bobina nasce dallo stesso lavoro sugli oggetti deformabili. Ognuno funziona anche da solo.',
				forLabel: 'Per',
				cards: [
					{
						media: 'reader',
						alt: 'Render del Cable Reader: un’unità da banco a C con la testa della telecamera sopra una base bianca',
						status: 'Prototipo',
						name: 'Cable Reader',
						line: 'Un’unità da banco semiautomatica: una telecamera legge le etichette dei cavi dall’alto e una spia di stato guida l’operatore.',
						forWhom: 'Piccoli costruttori di quadri',
						note: '',
					},
					{
						media: 'cell',
						alt: 'Due bracci collaborativi sopra un quadro cablato, un puntale tocca un morsetto',
						status: 'In validazione',
						name: 'Quality Control Cell',
						line: 'Una cella robotizzata con due bracci collaborativi: prova ogni collegamento della vostra lista EPLAN e ogni quadro esce con il suo verbale digitale.',
						forWhom: 'Costruttori più grandi e aziende con un reparto quadri interno',
						note: '',
					},
					{
						media: 'schemes',
						alt: 'Quadro ricostruito come dati: componenti, morsetti, canaline e percorsi dei fili',
						status: 'In sviluppo',
						name: 'Conversione degli schemi',
						line: 'Trasforma gli schemi che esistono solo in PDF nei dati strutturati che servono agli altri prodotti.',
						forWhom: 'Costruttori e manutentori con gli schemi solo in PDF',
						note: '',
					},
					{
						media: 'reel',
						alt: 'Simulazione: un braccio robotico porta il nastro fuori dalla bobina, sopra tre rulli e dentro la pinza d’uscita',
						status: 'In sviluppo',
						name: 'Cella cambio bobina',
						line: 'Una cella robotizzata che carica la bobina nuova, infila il nastro e fa la giunta, in retrofit o come opzione.',
						forWhom: 'Costruttori e utilizzatori di macchine automatiche per il confezionamento',
						note: 'Finora in simulazione: trovare il capo libero, prenderlo, infilare il nastro e giuntarlo.',
					},
				],
			},
		},

		proof: {
			id: 'proof',
			eyebrow: 'Prototipo',
			title: 'Un prototipo vero, su un quadro vero',
			intro:
				'Due bracci collaborativi con puntali progettati su misura collaudano i collegamenti di un quadro elettrico. È un prototipo, e lo chiamiamo così.',
			status: 'Stato: prototipo funzionante',
			video: {
				id: 'video',
				title: 'Il prototipo al lavoro',
				caption:
					'Una telecamera su un braccio trova i componenti di un quadro elettrico, poi due bracci collaborativi ne verificano i fili. Nell’angolo del video compare la velocità quando le riprese sono accelerate o rallentate (da ×0,5 a ×8).',
				description:
					'Video di 90 secondi, senza audio, con didascalie in inglese: una telecamera su un robot collaborativo trova i 25 componenti di un quadro elettrico, poi due bracci ne verificano i fili uno per uno.',
				posterAlt: 'Fotogramma dall’alto: due bracci robotici collaborativi sopra un quadro elettrico aperto',
			},
			photo: {
				alt: 'Due bracci robotici collaborativi a pochi centimetri sopra una morsettiera: a sinistra una pinza, a destra un puntale di prova rivolto in basso',
				caption: 'Due bracci nello stesso spazio: i loro attrezzi lavorano a pochi centimetri sulla stessa morsettiera, senza toccarsi.',
			},
			factsTitle: 'Chi c’è dietro',
			facts: [
				{
					name: 'Spin-off dell’Università di Bologna',
					detail: 'ROBOSECT SRL, fondata nel 2024, è uno spin-off dell’Alma Mater Studiorum – Università di Bologna, nato da anni di ricerca accademica e di progetti europei di innovazione.',
					logoAlt: 'Alma Mater Studiorum – Università di Bologna',
					mark: '',
				},
				{
					name: 'Progetto finanziato da AIRISE.eu: CONTEST',
					detail: 'Finanziamento per sviluppare una piattaforma robotica basata su AI per il controllo qualità dei quadri elettrici: ispezione visiva dei difetti di montaggio, lettura delle siglature, prova di continuità.',
					logoAlt: 'AIRISE.eu',
					mark: '',
				},
				{
					name: 'Tecnologia brevettata',
					detail: 'Brevetto italiano 102023000014613, esteso all’UE.',
					logoAlt: '',
					mark: 'BREVETTO',
				},
				{
					name: 'Premi per le startup',
					detail: 'Emilia-Romagna startCUP 2022, terzo posto. Call UniBo per Startup e Business Plan 2022, primo posto.',
					logoAlt: '',
					mark: '2022',
				},
				{
					name: 'In incubazione a EIT Manufacturing e CTE COBO',
					detail: 'Due percorsi di incubazione che accompagnano l’azienda dal laboratorio ai primi clienti.',
					logoAlt: '',
					mark: 'EIT · COBO',
				},
				{
					name: 'Sponsor ed espositore a IEEE/ASME AIM 2026',
					detail: 'Genova, 7–10 luglio 2026.',
					logoAlt: '',
					mark: 'AIM 2026',
				},
			],
			targets: {
				title: 'Dove punta il progetto',
				toWord: 'a',
				items: [
					{ from: '30 s', to: '10 s', label: 'Una prova di collegamento' },
					{ from: '45 min', to: '15 min', label: 'Il quadro di riferimento' },
				],
				note: 'Sono gli obiettivi del progetto AIRISE, non misure. I valori misurati li pubblicheremo con le loro condizioni di prova.',
			},
		},

		alsoFor: {
			id: 'also-for-you',
			eyebrow: 'Anche per voi',
			title: 'Una piattaforma per gli oggetti deformabili',
			intro: 'Non costruite quadri? La stessa base, percezione, pianificazione ed esecuzione, lavora ovunque i pezzi siano difficili da maneggiare: cavi, cablaggi e altre parti che si piegano.',
			statusLabel: 'Stato',
			items: [
				{
					title: 'Produttori e rigeneratori di cablaggi',
					body: 'Percezione di cavi, diramazioni e connettori; presa e instradamento di cavi flessibili. Pensato per le varianti e per il rigenerato, dove ogni cablaggio rientra in condizioni diverse.',
					status: 'Aperto a collaborazioni',
				},
				{
					title: 'Celle robotizzate e integratori',
					body: 'Traiettorie senza collisioni che tengono conto dei cavi, compreso il dress pack del robot. Cerchiamo integratori con cui lavorare: partner, non solo clienti.',
					status: 'Aperto a collaborazioni',
				},
				{
					title: 'Altra manipolazione',
					body: 'Processi con parti flessibili, compiti di ispezione o grande varietà di prodotto: sistemi robotici progettati attorno al vostro processo.',
					status: 'Su progetto',
				},
			],
			work: {
				id: 'work',
				title: 'Ingegneria e R&D per ciò che si piega',
				intro: 'Lavoriamo anche su commissione: il lavoro lo fa il team che ha costruito la piattaforma. Tre modi di lavorare insieme; se nessuno fa al caso vostro, scriveteci lo stesso.',
				items: [
					{
						kicker: 'Progetti',
						title: 'Progetti di ingegneria',
						body: 'Robotica su misura per oggetti deformabili. Studiamo il vostro processo, vi diciamo se un robot può farlo e costruiamo la prova di fattibilità.',
					},
					{
						kicker: 'Licenze',
						title: 'Moduli in licenza',
						body: 'Parti della piattaforma, come un pianificatore di movimento che tiene conto di cavi e dress pack, che potete prendere in licenza e integrare nel vostro sistema.',
					},
					{
						kicker: 'Finanziamenti',
						title: 'Progetti finanziati',
						body: 'Partecipiamo a progetti di ricerca e innovazione, come il progetto AIRISE.eu dietro il nostro robot per quadri. Portate un caso d’uso e guardiamo insieme il bando giusto.',
					},
				],
			},
			cta: 'Parlateci del vostro processo',
		},

		team: {
			id: 'team',
			eyebrow: 'Team',
			title: 'Dal laboratorio alla linea di produzione',
			intro:
				'ROBOSECT è un team di ingegneri robotici, ricercatori di intelligenza artificiale e specialisti di automazione industriale, con radici all’Università di Bologna. Un obiettivo: robot che lavorano su prodotti veri, non solo in laboratorio.',
			areas: [
				{
					title: 'Robotica e motion planning',
					body: 'Programmazione di robot industriali, pianificazione delle traiettorie e movimenti senza collisioni in celle affollate.',
				},
				{
					title: 'AI e visione artificiale',
					body: 'Deep learning, percezione 3D e riconoscimento di oggetti deformabili, su una base di anni di pubblicazioni accademiche e ricerca applicata.',
				},
				{
					title: 'Ingegneria di sistema e di prodotto',
					body: 'End-effector, hardware di sensing e software di controllo, integrati in piattaforme robotiche pensate per la produzione.',
				},
				{
					title: 'Partnership industriali',
					body: 'Collaborazione con aziende manifatturiere e programmi di ricerca europei per portare i risultati della ricerca in reparto.',
				},
			],
			founders: {
				title: 'Il team',
				intro: 'Spin-off dell’Università di Bologna, nato nel 2024. Il prof. Gianluca Palli segue il team come advisor.',
				people: [
					{
						name: 'Alessio Caporali',
						role: 'CEO e co-fondatore',
						bio: '',
						photoAlt: 'Alessio Caporali, CEO e co-fondatore di ROBOSECT',
					},
					{
						name: 'Kevin Galassi',
						role: 'Co-fondatore',
						bio: '',
						photoAlt: '',
					},
					{
						name: 'Davide Chiaravalli',
						role: 'Co-fondatore',
						bio: '',
						photoAlt: '',
					},
					{
						name: 'Giorgio Medico',
						role: 'Ingegnere di ricerca',
						bio: '',
						photoAlt: '',
					},
					{
						name: 'Alex Pasquali',
						role: 'Ingegnere di ricerca',
						bio: '',
						photoAlt: '',
					},
					{
						name: 'Gianluca Palli',
						role: 'Advisor',
						bio: '',
						photoAlt: '',
					},
				],
			},
			joinUs: {
				text: 'Vuoi lavorare su robot che fanno ciò che gli altri evitano?',
				cta: 'Scrivici',
			},
		},

		contact: {
			id: 'contact',
			eyebrow: 'Contatti',
			closingTag: 'Automazione, fino all’ultimo filo.',
			title: 'Proponeteci un progetto.',
			answer: 'Vi diciamo con franchezza se un robot può farlo, e come.',
			body: 'Bastano poche righe: di cosa vi occupate, cosa vorreste affidare a un robot, come lo fate oggi.',
			responseTime: 'Rispondiamo entro due giorni lavorativi.',
			form: {
				name: { label: 'Nome e cognome' },
				company: { label: 'Azienda' },
				email: { label: 'Email aziendale', placeholder: 'nome@azienda.it' },
				phone: { label: 'Telefono' },
				sector: {
					label: 'Di cosa vi occupate?',
					options: ['Quadri elettrici', 'Cablaggi', 'Celle robotizzate e integrazione', 'Macchine per il confezionamento', 'Altra manipolazione'],
				},
				sbGroup: 'Se costruite quadri',
				boards: {
					label: 'Che quadri costruite?',
					placeholder: 'Scegliete',
					options: ['A bordo macchina', 'Di distribuzione', 'Di automazione', 'Altro'],
				},
				volumes: {
					label: 'Quadri all’anno',
					placeholder: 'Scegliete',
					options: ['Meno di 100', 'Da 100 a 500', 'Oltre 500'],
				},
				eplan: {
					label: 'Usate EPLAN?',
					placeholder: 'Scegliete',
					options: ['Sì', 'No', 'Altro software'],
				},
				process: {
					label: 'Come lo fate oggi, e cosa vorreste affidare a un robot?',
					placeholder: 'per esempio: cosa producete, quanti pezzi, cosa si fa ancora a mano',
				},
				required: 'obbligatorio',
				optional: 'facoltativo',
				consent: {
					prefix: 'Ho letto',
					linkLabel: 'l’informativa privacy',
					suffix: 'e acconsento al trattamento dei miei dati da parte di ROBOSECT SRL per ricevere risposta a questa richiesta.',
				},
				submit: 'Inviate la richiesta',
			},
			direct: {
				label: 'Preferite l’email? Scriveteci a',
				email: 'info@robosect.it',
				address: 'Via Lazio 2, 40139 Bologna',
				linkedin: 'Seguite ROBOSECT su LinkedIn',
			},
			show: {
				figureLabel: 'Animazione, circa {s} s: due bracci robotici piegano un cavo dritto, passo dopo passo, fino a farne la R del logo ROBOSECT, poi crimpano il puntale di rame sulla sua estremità. RESET la riavvia, STOP ferma i robot.',
				details: [
					'Il cavo esce dal banco e ci resta disteso, dritto.',
					'Il braccio sinistro lo prende e lo posa nell’asta della R, nell’angolo in alto e nel tratto superiore.',
					'Il braccio destro lo prende in consegna e posa l’occhiello, la gamba e il piede della R.',
					'Il braccio destro infila il puntale di rame sull’estremità libera e lo crimpa. I robot tornano a riposo: il cavo è la R del logo.',
				],
				station: {
					group: 'Pulsantiera di comando',
					reset: 'RESET',
					stop: 'STOP',
					resetLabel: 'Reset e riavvia',
					stopLabel: 'STOP: ferma i robot',
				},
			},
			handoff: {
				helper: 'Si apre il vostro programma di posta con la richiesta pronta. Parte solo quando premete Invia lì.',
				live: 'Dovrebbe aprirsi il vostro programma di posta con la richiesta compilata. Premete Invia lì per recapitarcela.',
				receiptHeading: 'La richiesta è pronta da inviare.',
				lead: 'Dovrebbe aprirsi il vostro programma di posta con la richiesta, indirizzata a info@robosect.it. Premete Invia lì: non parte nulla finché non lo fate.',
				nothingOpened: 'Non si è aperto nulla? Riaprite l’email, oppure copiate il messaggio e scrivete a info@robosect.it.',
				reply: 'Rispondiamo entro due giorni lavorativi.',
				openAgain: 'Riaprite l’email ↗',
				copyMessage: 'Copiate il messaggio',
				copyAddress: 'Copiate l’indirizzo',
				noApp: 'Nessun programma di posta?',
				noAppText: 'Copiate il messaggio e inviatelo a info@robosect.it da qualsiasi casella di posta.',
				copied: 'Copiato ✓',
				selectCopy: 'Selezionatelo e copiatelo (Ctrl+C / ⌘C)',
				shortened: '[Messaggio accorciato per il programma di posta: il testo completo è sulla pagina — Copiate il messaggio]',
				restored: 'La vostra richiesta è ancora pronta da inviare.',
				change: 'Modificate la richiesta',
				noscript: 'Si aprirà il vostro programma di posta con la richiesta. Se non si apre nulla, scrivete a info@robosect.it.',
				subject: 'Un quadro da collaudare',
				subjectOther: 'Un processo da automatizzare',
				consentLine: 'Consenso: chi scrive ha letto l’informativa privacy e acconsente al trattamento dei dati da parte di ROBOSECT SRL per ricevere risposta a questa richiesta.',
				previewTo: 'A',
				previewSubject: 'Oggetto',
			},
		},

		footer: {
			tagline: 'Automazione, fino all’ultimo filo.',
			descriptor: 'Robotica per i cavi e per tutto ciò che si piega.',
			ecosystemTitle: 'Ecosistema',
			partnerAlts: {
				unibo: 'Università di Bologna',
				spinoff: 'Spin-off dell’Università di Bologna',
				cobo: 'CTE COBO',
				eit: 'EIT Manufacturing, cofinanziato dall’Unione Europea',
			},
			columns: {
				site: 'Sito',
				legal: 'Informazioni legali',
				contact: 'Contatti',
			},
			links: {
				how: 'Come funziona',
				products: 'Prodotti',
				work: 'Ingegneria e R&D',
				team: 'Team',
				blog: 'News',
				contact: 'Contatti',
				linkedin: 'LinkedIn',
				legalNotes: 'Note legali',
				privacy: 'Informativa privacy',
				cookies: 'Cookie policy',
				genderPolicy: 'Politica per la parità di genere e la diversità',
			},
			legal:
				'ROBOSECT SRL – Via Lazio 2, 40139, Bologna – CF/PIVA: 04228581205 – Numero REA BO - 578120 – Capitale Sociale 10.000 €',
			rights: '© ROBOSECT SRL. Tutti i diritti riservati.',
			legalLanguageNote: 'I documenti legali sono al momento disponibili in inglese.',
		},

		blog: {
			title: 'News',
			metaTitle: 'News',
			metaDescription: 'Progetti, eventi e traguardi di ROBOSECT.',
			intro: 'Progetti, eventi e traguardi del team ROBOSECT.',
			readMore: 'Leggi l’articolo',
			backToBlog: 'Torna al sito',
			publishedOn: 'Pubblicato il',
			tagsLabel: 'Tag',
			empty: 'Nessun articolo, per ora.',
			homeTeaserTitle: 'Ultime news',
			languageNote: 'Gli articoli sono al momento disponibili solo in inglese.',
		},

		notFound: {
			metaTitle: 'Pagina non trovata',
			title: 'Circuito aperto.',
			line: 'Questa pagina non è collegata.',
			back: 'Torna alla home',
		},
	},
} as const;

export type Copy = (typeof copy)[Lang];
