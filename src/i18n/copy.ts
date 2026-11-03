/**
 * ROBOSECT — site copy, EN + IT.
 *
 * Source of truth for every string on the homepage, the technology page, nav, footer and blog index.
 * Both languages share the exact same key structure (and the same array lengths), so a
 * component can do `const t = copy[lang]` and never branch on language.
 *
 * Rules applied:
 * - The home speaks to switchboard builders first (owner, production and quality managers, the EPLAN office); wiring
 *   harnesses and robot cells are secondary («Also for you»). One call to action everywhere: «Send us a switchboard» /
 *   «Proponeteci un quadro».
 * - No invented metrics, clients, testimonials, certifications or people. Every missing
 *   proof point is a visible placeholder that starts with "[TBD:". Search for "[TBD:" before
 *   going live; none of them should reach production.
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
			title: 'ROBOSECT | Robotics for Cables, Wiring Harnesses & Switchboards',
			description:
				'AI-driven robots that work on cables: automatic switchboard testing, wiring harness handling and cable-aware motion planning from EPLAN/CAD data.',
			ogTitle: 'Automation stops at the cable. Ours doesn’t.',
			ogDescription:
				'ROBOSECT, a University of Bologna spin-off, builds robots that see, plan around and work on cables, wiring harnesses and switchboards.',
			ogImageAlt:
				'Two collaborative robots with custom probe end-effectors positioned over an electrical switchboard',
		},

		brand: {
			name: 'ROBOSECT',
			descriptor: 'Robotics for cables, wiring harnesses and switchboards',
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
			// `page: true` links go to their own page (the technology page), the others to a homepage section
			links: [
				{ id: 'how-it-works', label: 'How it works', page: false },
				{ id: 'what-you-get', label: 'What you get', page: false },
				{ id: 'proof', label: 'Prototype', page: false },
				{ id: 'technology', label: 'Technology', page: true },
				{ id: 'team', label: 'Team', page: false },
			],
			blog: 'News',
			// Label and ariaLabel are in the TARGET language: render the link with lang="it" / lang="en".
			langSwitch: {
				label: 'Italiano',
				short: 'IT',
				ariaLabel: 'Leggi il sito in italiano',
			},
			cta: 'Send us a switchboard',
			// narrow phones: the same action in fewer letters (the bar holds the logo, this button and the menu button)
			ctaShort: 'Send a switchboard',
			ctaTiny: 'Your switchboard',
		},

		cta: {
			label: 'Send us a switchboard',
			promise: 'We will tell you plainly whether a robot can test it, and how.',
		},

		hero: {
			headline: 'Automation stops at the cable. Ours doesn’t.',
			subheadline:
				'Robots that test your switchboards starting from your EPLAN project. They check every connection, and every switchboard leaves with its test report.',
			primaryCta: { label: 'Send us a switchboard', href: '#contact' },
			secondaryCta: { label: 'Watch the prototype', duration: '1:30', href: '#video' },
			proofChips: [
				'University of Bologna spin-off',
				'AIRISE.eu-funded project',
				'Working prototype on a real switchboard',
			],
			imageAlt:
				'ROBOSECT prototype: two collaborative robots with red custom probe end-effectors working on an electrical switchboard',
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
				link: 'The technology',
			},
		},

		benefits: {
			id: 'what-you-get',
			eyebrow: 'What you get',
			title: 'What changes in your testing',
			intro:
				'The robot does the round of the test points. Your people check the results and decide. The figures below are published only once measured on the prototype.',
			items: [
				{
					title: 'Fewer hours of manual testing',
					body: 'The robot goes from point to point; the technician no longer spends the day with the probes in hand.',
					value: '[TBD: minutes per switchboard]',
					valueLabel: 'Test cycle per switchboard',
				},
				{
					title: 'Every connection checked',
					body: 'The sequence comes from the connection list: every wire on the list gets its test, none is skipped in a hurry.',
					value: '[TBD: % of test points reached automatically]',
					valueLabel: 'Test points reached automatically',
				},
				{
					title: 'A report for your customer',
					body: 'Every switchboard leaves with its digital test report, traceable. Ready to hand over with the board.',
					value: '[TBD: anonymised sample report]',
					valueLabel: 'Sample report',
				},
				{
					title: 'Skilled people on the work that matters',
					body: 'The robot takes the repetitive round of the test points. The decisions stay with the people who know the trade.',
					value: '[TBD: technician hours freed per switchboard]',
					valueLabel: 'Technician time freed',
				},
			],
			note: 'Every figure will come with its test conditions: [TBD: switchboard type, number of test points, date of measurement].',
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
				alt: 'A red custom probe end-effector mounted on the wrist of a collaborative robot, with its probe tip pointing down',
				caption: 'One of the two probe end-effectors, designed by ROBOSECT for continuity testing.',
			},
			factsTitle: 'Who stands behind it',
			facts: [
				{
					name: 'University of Bologna spin-off',
					detail: 'ROBOSECT SRL is a spin-off of the Alma Mater Studiorum – Università di Bologna, born from years of academic research and European innovation projects.',
					logoAlt: 'Alma Mater Studiorum – Università di Bologna',
				},
				{
					name: 'AIRISE.eu-funded project',
					detail: 'Funding to develop an AI-based robotic platform for switchboard quality control: visual inspection of assembly defects, cable-marker reading, continuity testing. [TBD: confirm project name, CONTENT or CONTEST]',
					logoAlt: 'AIRISE.eu',
				},
				{
					name: 'Sponsor and exhibitor at IEEE/ASME AIM 2026',
					detail: 'Genoa, 7–10 July 2026.',
					logoAlt: '',
				},
			],
		},

		alsoFor: {
			id: 'also-for-you',
			eyebrow: 'Also for you',
			title: 'You don’t build switchboards? Cables are our job anyway.',
			intro: 'The same base, perception, planning and execution, works on other parts that bend.',
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
			],
			cta: 'Tell us about your process',
		},

		technology: {
			id: 'technology',
			metaTitle: 'Technology',
			metaDescription:
				'The ROBOSECT platform: RGB, RGB-D and 3D perception, EPLAN and CAD integration, cable-aware planning with a digital twin, cobots that test and document.',
			eyebrow: 'Technology',
			title: 'One stack, built around the cable',
			body: 'Most automation stacks treat cables as noise. Ours treats them as the main subject: perception models that detect deformable linear objects, a digital twin fed by your engineering data, and planning that simulates what flexes. It comes from years of research at the University of Bologna and in European innovation projects, and it runs today on a working prototype.',
			pillars: [
				{
					title: 'A digital twin from your design data',
					body: 'CAD and EPLAN data become the robot’s map of the product; perception then corrects that map against the real part.',
				},
				{
					title: 'Operators stay in control',
					body: 'The robot takes on repetitive and physically demanding work. Skilled people keep the decisions that matter.',
				},
				{
					title: 'Traceable by design',
					body: 'Every robotic operation is recorded and feeds quality reports and production analytics automatically.',
				},
			],
			photo: {
				alt: 'Two collaborative robots with red custom probe end-effectors positioned over an electrical switchboard',
				caption:
					'The ROBOSECT dual-arm setup: each arm carries a custom probe end-effector for continuity testing on a switchboard.',
			},
			platformTitle: 'The platform, in four parts',
			platformIntro:
				'The same digital model of the product runs through all four, so the robot knows what it should find before it starts looking.',
			platform: [
				{
					number: '01',
					kicker: 'Perceive',
					title: 'See the real product',
					body: 'Cameras and 3D sensors, paired with deep-learning models, find components, cables, connectors and labels on the actual part, and reconstruct where everything really is, not where the drawing says it should be.',
					specs: [
						'RGB, RGB-D and 3D sensing',
						'Detection of components, cables, connectors and deformable linear objects',
						'Compensation of manufacturing tolerances and positioning errors',
						'Continuous monitoring during execution',
					],
				},
				{
					number: '02',
					kicker: 'Integrate',
					title: 'Start from your EPLAN and CAD data',
					body: 'The system imports the engineering data you already have. A new product does not mean a new robot program.',
					specs: [
						'CAD models and electrical schematics (EPLAN)',
						'Connection lists and component libraries',
						'Production data from your management systems',
						'New variants with minimal operator input',
					],
				},
				{
					number: '03',
					kicker: 'Plan',
					title: 'Plan around the cable',
					body: 'A planning engine that combines AI reasoning, a digital twin and physics-based simulation generates collision-free trajectories that account for cables, harnesses and the robot’s own dress pack.',
					specs: [
						'Digital twin of cell and product',
						'Physics-based simulation',
						'Collision avoidance that includes cables and dress packs',
						'Real-time trajectory generation',
					],
				},
				{
					number: '04',
					kicker: 'Execute',
					title: 'Act, measure, document',
					body: 'Collaborative robots with custom end-effectors, vision sensors and force-controlled tools carry out the task. Every operation is logged, so each product comes with its own digital record.',
					specs: [
						'Electrical continuity testing',
						'Connector insertion and cable routing',
						'Harness manipulation and precision assembly',
						'Automatic digital reports and full traceability',
					],
				},
			],
			statusTitle: 'Where it stands, application by application',
			statusLabel: 'Status',
			applications: [
				{
					title: 'Automatic switchboard testing',
					body: 'Continuity testing generated from the CAD/EPLAN connection list and carried out by robots, with a digital test report. In development within the AIRISE.eu project: visual inspection of assembly defects and cable-marker reading.',
					status: 'Prototype',
				},
				{
					title: 'Wiring harness automation',
					body: 'Robotic handling, assembly and remanufacturing of automotive wiring harnesses.',
					status: 'Open to collaboration',
				},
				{
					title: 'Cable-aware motion planning',
					body: 'Collision-free trajectories that account for cables, dress packs and deformable objects.',
					status: 'Open to collaboration',
				},
				{
					title: 'Custom robotics for deformable parts',
					body: 'Tailored robotic systems for processes with flexible parts, inspection tasks or high product variability.',
					status: 'On request',
				},
			],
			back: 'Back to home',
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
				title: 'Founders',
				intro: '[TBD: one sentence on when and how ROBOSECT was founded]',
				people: [
					{
						name: 'Alessio Caporali',
						role: 'CEO & Co-Founder',
						bio: '[TBD: two-line bio, background and focus]',
						photoAlt: '[TBD: portrait photo] Alessio Caporali, CEO & Co-Founder of ROBOSECT',
						linkedinLabel: 'Alessio Caporali on LinkedIn',
					},
					{
						name: '[TBD: co-founder name]',
						role: '[TBD: role]',
						bio: '[TBD: two-line bio, background and focus]',
						photoAlt: '[TBD: portrait photo]',
						linkedinLabel: '[TBD: co-founder name] on LinkedIn',
					},
				],
			},
			publications: {
				label: 'Selected publications',
				href: '[TBD: link to publication list]',
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
			title: 'Send us a switchboard.',
			answer: 'We will tell you plainly whether a robot can test it, and how.',
			body: 'A few lines are enough: what switchboards you build, how many a year, how you test them today.',
			responseTime: 'We reply within two working days.',
			form: {
				name: { label: 'Name and surname' },
				company: { label: 'Company' },
				email: { label: 'Work email', placeholder: 'name@company.com' },
				phone: { label: 'Phone' },
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
					label: 'How do you test them today?',
					placeholder: 'e.g. one technician, tester and connection list, about … hours per board',
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
				figureLabel: 'Animation, about {s} s: two robot arms build this contact form, one part per job, the Send button last. RESET runs it again, STOP stops the robots.',
				details: [
					'The camera follows a wire from end to end: the Name box. It finds one end curled away from where the drawing puts it: Company.',
					'The gripper combs that end straight: Work email. It grips it firmly: Phone. It inserts it in the breaker’s screw clamp: What switchboards do you build.',
					'The screwdriver tightens the clamp: Switchboards per year. The gripper gives the wire a pull test: Do you use EPLAN.',
					'The gripper takes the wire’s other end: How do you test them today. The opener holds a spring cage open, the end goes in and the cage snaps shut: the consent box.',
					'The gripper switches the breaker on: the current runs through every box built so far.',
					'Two probes test the circuit from end to end: Send the request. The robots park.',
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
				consentLine: 'Consent: the sender has read the Privacy Policy and agrees that ROBOSECT SRL may use these data to reply to this request.',
				previewTo: 'To',
				previewSubject: 'Subject',
			},
		},

		footer: {
			tagline: 'Automation, down to the last wire.',
			descriptor: 'Robotics for cables, wiring harnesses and switchboards.',
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
				technology: 'Technology',
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
			backToBlog: 'Back to news',
			publishedOn: 'Published on',
			tagsLabel: 'Tags',
			empty: 'No posts yet.',
			homeTeaserTitle: 'Latest news',
			viewAll: 'All news',
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
			title: 'ROBOSECT | Robotica per cavi, cablaggi e quadri elettrici',
			description:
				'Robot con AI che lavorano sui cavi: collaudo automatico dei quadri elettrici, automazione dei cablaggi e pianificazione anticollisione, a partire da EPLAN/CAD.',
			ogTitle: 'L’automazione si ferma al cavo. La nostra no.',
			ogDescription:
				'ROBOSECT, spin-off dell’Università di Bologna, sviluppa robot che riconoscono i cavi e ci lavorano sopra: collaudo dei quadri elettrici, cablaggi, motion planning.',
			ogImageAlt:
				'Due robot collaborativi con end-effector a puntale su misura posizionati sopra un quadro elettrico',
		},

		brand: {
			name: 'ROBOSECT',
			descriptor: 'Robotica per cavi, cablaggi e quadri elettrici',
			tagline: 'Automazione, fino all’ultimo filo.',
		},

		a11y: {
			skipToContent: 'Vai al contenuto',
			homeLink: 'ROBOSECT, torna alla home',
			openMenu: 'Apri il menu',
			closeMenu: 'Chiudi il menu',
			linkedin: 'ROBOSECT su LinkedIn (si apre in una nuova scheda)',
			email: 'Scrivi a ROBOSECT',
			opensInNewTab: '(si apre in una nuova scheda)',
			playVideo: 'Avvia il video',
			pauseVideo: 'Metti in pausa il video',
			closeVideo: 'Chiudi il video',
		},

		nav: {
			links: [
				{ id: 'how-it-works', label: 'Come funziona', page: false },
				{ id: 'what-you-get', label: 'Cosa ottenete', page: false },
				{ id: 'proof', label: 'Prototipo', page: false },
				{ id: 'technology', label: 'Tecnologia', page: true },
				{ id: 'team', label: 'Team', page: false },
			],
			blog: 'News',
			langSwitch: {
				label: 'English',
				short: 'EN',
				ariaLabel: 'Read the site in English',
			},
			cta: 'Proponeteci un quadro',
			ctaShort: 'Proponete un quadro',
			ctaTiny: 'Il vostro quadro',
		},

		cta: {
			label: 'Proponeteci un quadro',
			promise: 'Vi diciamo con franchezza se un robot può collaudarlo, e come.',
		},

		hero: {
			headline: 'L’automazione si ferma al cavo. La nostra no.',
			subheadline:
				'Robot che collaudano i vostri quadri elettrici partendo dal progetto EPLAN. Verificano ogni collegamento, e ogni quadro esce con il suo verbale di collaudo.',
			primaryCta: { label: 'Proponeteci un quadro', href: '#contact' },
			secondaryCta: { label: 'Guardate il prototipo', duration: '1:30', href: '#video' },
			proofChips: [
				'Spin-off dell’Università di Bologna',
				'Progetto finanziato da AIRISE.eu',
				'Prototipo funzionante su un quadro vero',
			],
			imageAlt:
				'Prototipo ROBOSECT: due robot collaborativi con end-effector rossi a puntale, progettati su misura, al lavoro su un quadro elettrico',
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
				link: 'La tecnologia',
			},
		},

		benefits: {
			id: 'what-you-get',
			eyebrow: 'Cosa ottenete',
			title: 'Cosa cambia nel vostro collaudo',
			intro:
				'Il robot fa il giro dei punti di prova. Le vostre persone controllano gli esiti e decidono. I numeri qui sotto li pubblichiamo solo dopo averli misurati sul prototipo.',
			items: [
				{
					title: 'Meno ore di collaudo manuale',
					body: 'Il robot va da un punto all’altro; il tecnico non passa più la giornata con i puntali in mano.',
					value: '[TBD: minuti per quadro]',
					valueLabel: 'Tempo ciclo di collaudo per quadro',
				},
				{
					title: 'Ogni collegamento verificato',
					body: 'La sequenza nasce dalla lista collegamenti: ogni filo della lista ha la sua prova, nessuno saltato per fretta.',
					value: '[TBD: % di punti di prova raggiunti in automatico]',
					valueLabel: 'Punti di prova raggiunti in automatico',
				},
				{
					title: 'Un verbale per il vostro cliente',
					body: 'Ogni quadro esce con il suo verbale di collaudo digitale, tracciabile. Pronto da consegnare insieme al quadro.',
					value: '[TBD: esempio di verbale anonimizzato]',
					valueLabel: 'Verbale d’esempio',
				},
				{
					title: 'Persone esperte sul lavoro che conta',
					body: 'Il robot si prende il giro ripetitivo dei punti di prova. Le decisioni restano a chi conosce il mestiere.',
					value: '[TBD: ore di tecnico liberate per quadro]',
					valueLabel: 'Tempo del tecnico liberato',
				},
			],
			note: 'Ogni numero arriverà con le sue condizioni di prova: [TBD: tipo di quadro, numero di punti di prova, data della misura].',
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
				alt: 'Un end-effector rosso a puntale, progettato su misura, montato sul polso di un robot collaborativo, con il puntale rivolto in basso',
				caption: 'Uno dei due end-effector a puntale, progettati da ROBOSECT per la prova di continuità.',
			},
			factsTitle: 'Chi c’è dietro',
			facts: [
				{
					name: 'Spin-off dell’Università di Bologna',
					detail: 'ROBOSECT SRL è uno spin-off dell’Alma Mater Studiorum – Università di Bologna, nata da anni di ricerca accademica e di progetti europei di innovazione.',
					logoAlt: 'Alma Mater Studiorum – Università di Bologna',
				},
				{
					name: 'Progetto finanziato da AIRISE.eu',
					detail: 'Finanziamento per sviluppare una piattaforma robotica basata su AI per il controllo qualità dei quadri elettrici: ispezione visiva dei difetti di montaggio, lettura delle siglature, prova di continuità. [TBD: confermare il nome del progetto, CONTENT o CONTEST]',
					logoAlt: 'AIRISE.eu',
				},
				{
					name: 'Sponsor ed espositore a IEEE/ASME AIM 2026',
					detail: 'Genova, 7–10 luglio 2026.',
					logoAlt: '',
				},
			],
		},

		alsoFor: {
			id: 'also-for-you',
			eyebrow: 'Anche per voi',
			title: 'Non costruite quadri? I cavi sono comunque il nostro mestiere.',
			intro: 'La stessa base, percezione, pianificazione ed esecuzione, lavora anche su altre parti che si piegano.',
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
			],
			cta: 'Raccontateci il vostro processo',
		},

		technology: {
			id: 'technology',
			metaTitle: 'Tecnologia',
			metaDescription:
				'La piattaforma ROBOSECT: percezione RGB, RGB-D e 3D, integrazione EPLAN e CAD, pianificazione con digital twin che tiene conto dei cavi, cobot che collaudano e documentano.',
			eyebrow: 'Tecnologia',
			title: 'Una piattaforma costruita attorno al cavo',
			body: 'Quasi tutte le piattaforme di automazione trattano i cavi come un disturbo. La nostra li mette al centro: modelli di percezione che riconoscono oggetti lineari deformabili, un digital twin alimentato dai vostri dati di progettazione e una pianificazione che simula ciò che si flette. Nasce da anni di ricerca all’Università di Bologna e in progetti europei di innovazione, e oggi è al lavoro su un prototipo funzionante.',
			pillars: [
				{
					title: 'Un digital twin dai vostri dati di progetto',
					body: 'I dati CAD ed EPLAN diventano la mappa del prodotto per il robot; la percezione poi la corregge confrontandola con il pezzo reale.',
				},
				{
					title: 'L’operatore resta al comando',
					body: 'Il robot si prende il lavoro ripetitivo e fisicamente pesante. Le decisioni che contano restano alle persone esperte.',
				},
				{
					title: 'Tracciabilità nativa',
					body: 'Ogni operazione robotica viene registrata e alimenta in automatico report di qualità e analisi di produzione.',
				},
			],
			photo: {
				alt: 'Due robot collaborativi con end-effector rossi a puntale, progettati su misura, posizionati sopra un quadro elettrico',
				caption:
					'Il setup ROBOSECT a due bracci: ogni braccio monta un end-effector a puntale progettato su misura per la prova di continuità sul quadro.',
			},
			platformTitle: 'La piattaforma, in quattro parti',
			platformIntro:
				'Lo stesso modello digitale del prodotto le attraversa tutte: il robot sa già cosa deve trovare prima ancora di guardare.',
			platform: [
				{
					number: '01',
					kicker: 'Percezione',
					title: 'Vedere il prodotto reale',
					body: 'Telecamere e sensori 3D, insieme a modelli di deep learning, individuano componenti, cavi, connettori ed etichette sul pezzo vero e ricostruiscono dove si trova davvero ogni elemento, non dove dovrebbe stare secondo il disegno.',
					specs: [
						'Sensori RGB, RGB-D e 3D',
						'Riconoscimento di componenti, cavi, connettori e oggetti lineari deformabili',
						'Compensazione delle tolleranze di produzione e degli errori di posizionamento',
						'Monitoraggio continuo durante l’esecuzione',
					],
				},
				{
					number: '02',
					kicker: 'Integrazione',
					title: 'Si parte dai vostri dati EPLAN e CAD',
					body: 'Il sistema importa i dati di progettazione che avete già. Un prodotto nuovo non significa un nuovo programma robot.',
					specs: [
						'Modelli CAD e schemi elettrici (EPLAN)',
						'Liste collegamenti e librerie componenti',
						'Dati di produzione dai vostri sistemi gestionali',
						'Nuove varianti con un intervento minimo dell’operatore',
					],
				},
				{
					number: '03',
					kicker: 'Pianificazione',
					title: 'Traiettorie che tengono conto dei cavi',
					body: 'Un motore di pianificazione che unisce ragionamento AI, digital twin e simulazione fisica genera traiettorie senza collisioni, considerando cavi, cablaggi e il dress pack del robot stesso.',
					specs: [
						'Digital twin della cella e del prodotto',
						'Simulazione basata sulla fisica',
						'Anticollisione che include cavi e dress pack',
						'Generazione delle traiettorie in tempo reale',
					],
				},
				{
					number: '04',
					kicker: 'Esecuzione',
					title: 'Agire, misurare, documentare',
					body: 'Robot collaborativi con end-effector su misura, sensori di visione e utensili in controllo di forza eseguono il lavoro. Ogni operazione viene registrata: ogni prodotto ha la sua documentazione digitale.',
					specs: [
						'Prova di continuità elettrica',
						'Inserimento connettori e instradamento cavi',
						'Manipolazione di cablaggi e assemblaggio di precisione',
						'Report digitali automatici e tracciabilità completa',
					],
				},
			],
			statusTitle: 'A che punto è, applicazione per applicazione',
			statusLabel: 'Stato',
			applications: [
				{
					title: 'Collaudo automatico dei quadri elettrici',
					body: 'Prova di continuità generata dalla lista collegamenti CAD/EPLAN ed eseguita dai robot, con verbale di collaudo digitale. In sviluppo nel progetto AIRISE.eu: ispezione visiva dei difetti di montaggio e lettura delle siglature dei cavi.',
					status: 'Prototipo',
				},
				{
					title: 'Automazione dei cablaggi',
					body: 'Manipolazione, assemblaggio e rigenerazione robotizzati dei cablaggi automotive.',
					status: 'Aperto a collaborazioni',
				},
				{
					title: 'Pianificazione del movimento attenta ai cavi',
					body: 'Traiettorie senza collisioni che tengono conto di cavi, dress pack e oggetti deformabili.',
					status: 'Aperto a collaborazioni',
				},
				{
					title: 'Robotica su misura per parti deformabili',
					body: 'Sistemi robotici dedicati per processi con parti flessibili, attività di ispezione o forte variabilità di prodotto.',
					status: 'Su progetto',
				},
			],
			back: 'Torna alla home',
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
				title: 'Fondatori',
				intro: '[TBD: una frase su quando e come è nata ROBOSECT]',
				people: [
					{
						name: 'Alessio Caporali',
						role: 'CEO e co-fondatore',
						bio: '[TBD: bio di due righe, percorso e ambito di lavoro]',
						photoAlt: '[TBD: foto ritratto] Alessio Caporali, CEO e co-fondatore di ROBOSECT',
						linkedinLabel: 'Alessio Caporali su LinkedIn',
					},
					{
						name: '[TBD: nome co-fondatore]',
						role: '[TBD: ruolo]',
						bio: '[TBD: bio di due righe, percorso e ambito di lavoro]',
						photoAlt: '[TBD: foto ritratto]',
						linkedinLabel: '[TBD: nome co-fondatore] su LinkedIn',
					},
				],
			},
			publications: {
				label: 'Pubblicazioni selezionate',
				href: '[TBD: link all’elenco delle pubblicazioni]',
			},
			joinUs: {
				text: 'Volete lavorare su robot che fanno ciò che gli altri evitano?',
				cta: 'Scriveteci',
			},
		},

		contact: {
			id: 'contact',
			eyebrow: 'Contatti',
			closingTag: 'Automazione, fino all’ultimo filo.',
			title: 'Proponeteci un quadro.',
			answer: 'Vi diciamo con franchezza se un robot può collaudarlo, e come.',
			body: 'Bastano poche righe: che quadri costruite, quanti all’anno, come li collaudate oggi.',
			responseTime: 'Rispondiamo entro due giorni lavorativi.',
			form: {
				name: { label: 'Nome e cognome' },
				company: { label: 'Azienda' },
				email: { label: 'Email aziendale', placeholder: 'nome@azienda.it' },
				phone: { label: 'Telefono' },
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
					label: 'Come collaudate oggi?',
					placeholder: 'es. un tecnico con tester e lista collegamenti, circa … ore a quadro',
				},
				required: 'obbligatorio',
				optional: 'facoltativo',
				consent: {
					prefix: 'Ho letto',
					linkLabel: 'l’informativa privacy',
					suffix: 'e acconsento al trattamento dei miei dati da parte di ROBOSECT SRL per ricevere risposta a questa richiesta.',
				},
				submit: 'Invia la richiesta',
			},
			direct: {
				label: 'Preferite l’email? Scriveteci a',
				email: 'info@robosect.it',
				address: 'Via Lazio 2, 40139 Bologna',
				linkedin: 'Seguite ROBOSECT su LinkedIn',
			},
			show: {
				figureLabel: 'Animazione, circa {s} s: due bracci robotici costruiscono questo modulo di contatto, una parte per ogni operazione, per ultimo il pulsante Invia. RESET la riavvia, STOP ferma i robot.',
				details: [
					'La telecamera segue un filo da un capo all’altro: la casella Nome. Trova un capo arricciato, non dove lo mette il disegno: Azienda.',
					'La pinza raddrizza quel capo: Email aziendale. Lo afferra con decisione: Telefono. Lo inserisce nel morsetto a vite dell’interruttore: Che quadri costruite.',
					'L’avvitatore serra il morsetto: Quadri all’anno. La pinza fa la prova di trazione sul filo: Usate EPLAN.',
					'La pinza prende l’altro capo del filo: Come collaudate oggi. La leva tiene aperto il morsetto a molla, il capo entra e la molla si richiude: la casella del consenso.',
					'La pinza chiude l’interruttore: la corrente attraversa tutte le caselle già costruite.',
					'Due puntali collaudano il circuito da un capo all’altro: Invia la richiesta. I robot tornano a riposo.',
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
				nothingOpened: 'Non si è aperto nulla? Usate Riapri l’email, oppure copiate il messaggio e scrivete a info@robosect.it.',
				reply: 'Rispondiamo entro due giorni lavorativi.',
				openAgain: 'Riapri l’email ↗',
				copyMessage: 'Copia il messaggio',
				copyAddress: 'Copia l’indirizzo',
				noApp: 'Nessun programma di posta?',
				noAppText: 'Copiate il messaggio e inviatelo a info@robosect.it da qualsiasi casella di posta.',
				copied: 'Copiato ✓',
				selectCopy: 'Selezionatelo e copiatelo (Ctrl+C / ⌘C)',
				shortened: '[Messaggio accorciato per il programma di posta: il testo completo è sulla pagina — Copia il messaggio]',
				restored: 'La vostra richiesta è ancora pronta da inviare.',
				change: 'Modifica la richiesta',
				noscript: 'Si aprirà il vostro programma di posta con la richiesta. Se non si apre nulla, scrivete a info@robosect.it.',
				subject: 'Un quadro da collaudare',
				consentLine: 'Consenso: chi scrive ha letto l’informativa privacy e acconsente al trattamento dei dati da parte di ROBOSECT SRL per ricevere risposta a questa richiesta.',
				previewTo: 'A',
				previewSubject: 'Oggetto',
			},
		},

		footer: {
			tagline: 'Automazione, fino all’ultimo filo.',
			descriptor: 'Robotica per cavi, cablaggi e quadri elettrici.',
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
				technology: 'Tecnologia',
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
			backToBlog: 'Torna alle news',
			publishedOn: 'Pubblicato il',
			tagsLabel: 'Tag',
			empty: 'Nessun articolo, per ora.',
			homeTeaserTitle: 'Ultime news',
			viewAll: 'Tutte le news',
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
