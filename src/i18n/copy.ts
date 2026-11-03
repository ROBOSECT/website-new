/**
 * ROBOSECT — homepage copy, EN + IT.
 *
 * Source of truth for every string on the redesigned homepage, nav, footer and blog index.
 * Both languages share the exact same key structure (and the same array lengths), so a
 * component can do `const t = copy[lang]` and never branch on language.
 *
 * Rules applied:
 * - No invented metrics, clients, testimonials, certifications or people. Every missing
 *   proof point is a visible placeholder that starts with "[TBD:". Search for "[TBD:" before
 *   going live; none of them should reach production.
 * - Facts used (all verified in the previous site, website-new `master` up to 42db8e8):
 *   University of Bologna spin-off (landing/Intro.astro + spin-off logo); AIRISE.eu funding for an
 *   AI-based robotic platform for control-panel quality control (blog post); EIT Manufacturing
 *   and CTE COBO logos (landing/SiteFooter.astro — relationship not stated, hence [TBD]); sponsor and
 *   exhibitor at IEEE/ASME AIM 2026, Genoa, 7–10 July 2026 (blog post); "Prototype Connection
 *   Testing Platform" video (landing/Technology.astro, robosect_v4.mp4, 90 s, no sound); Alessio Caporali, CEO & Co-Founder
 *   (gender-equality-diversity-policy.astro); legal line (landing/SiteFooter.astro).
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
		},

		nav: {
			links: [
				{ id: 'problem', label: 'Why cables' },
				{ id: 'how-it-works', label: 'How it works' },
				{ id: 'applications', label: 'Applications' },
				{ id: 'technology', label: 'Technology' },
				{ id: 'team', label: 'Team' },
			],
			blog: 'News',
			// Label and ariaLabel are in the TARGET language: render the link with lang="it" / lang="en".
			langSwitch: {
				label: 'Italiano',
				short: 'IT',
				ariaLabel: 'Leggi il sito in italiano',
			},
			cta: 'Let’s talk',
		},

		cta: {
			label: 'Send us a switchboard',
			promise: 'We will tell you plainly whether a robot can test it, and how.',
		},

		hero: {
			eyebrow: 'Robotics for cables, wiring harnesses and switchboards',
			headline: 'Automation stops at the cable. Ours doesn’t.',
			subheadline:
				'ROBOSECT builds AI-driven robotic systems that see, plan around and work on cables, wiring harnesses and other deformable parts, starting from your EPLAN and CAD data.',
			primaryCta: { label: 'Discuss your application', href: '#contact' },
			secondaryCta: { label: 'Watch the prototype (1:30)', href: '#video' },
			proofChips: [
				'University of Bologna spin-off',
				'AIRISE.eu-funded project',
				'Dual-arm prototype for switchboard testing',
			],
			imageAlt:
				'ROBOSECT prototype: two collaborative robots with red custom probe end-effectors working on an electrical switchboard',
		},

		problem: {
			id: 'problem',
			eyebrow: 'The problem',
			title: 'Rigid parts got automated. Cables didn’t.',
			intro:
				'Robots excel when a part has the same shape, in the same place, every time. A cable never does. That is why wiring, testing and harness handling are still done by hand by skilled operators, even in plants that have automated almost everything else.',
			points: [
				{
					title: 'Never in the same place twice',
					body: 'A wire sags, twists and settles differently on every panel and every harness. Fixed coordinates and taught points break at the first variant.',
				},
				{
					title: 'Crowded and half-hidden',
					body: 'Terminals, labels and connectors sit between ducts and DIN rails, often covered by the very cables you need to reach. Conventional vision struggles to find them.',
				},
				{
					title: 'The robot has cables too',
					body: 'Dress packs and tool cables move with the arm. Most motion planners treat them as invisible, until they snag.',
				},
				{
					title: 'Every product is a variant',
					body: 'Switchboards are often built to order and harnesses come in many versions. Reprogramming a robot by hand for each one does not pay off.',
				},
			],
			closing: 'ROBOSECT works on exactly this part of the process: the part that bends.',
		},

		process: {
			id: 'how-it-works',
			eyebrow: 'How it works',
			title: 'From your design data to a robot that works on cables',
			intro:
				'One pipeline, four steps. The same digital model of the product runs through all of them, so the robot knows what it should find before it starts looking.',
			steps: [
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
		},

		applications: {
			id: 'applications',
			eyebrow: 'Applications',
			title: 'Four applications, one common thread: the cable',
			intro:
				'From testing finished switchboards to planning robot motion around cables, every application runs on the same perception, planning and execution stack.',
			statusLabel: 'Status',
			items: [
				{
					id: 'switchboard-testing',
					title: 'Automatic switchboard testing',
					oneLiner:
						'Continuity testing of electrical panels, generated from your wiring data and carried out by robots.',
					body: 'The system recognises the components on the panel, builds the test sequence from the CAD/EPLAN connection list and has the robots check each connection with probes mounted on custom end-effectors. Results go straight into a digital report, so every panel has its own traceable test record.',
					bullets: [
						'AI recognition of panel components',
						'Test sequence generated from CAD/EPLAN data',
						'Automatic electrical continuity verification',
						'Digital test report and full traceability',
						'In development within the AIRISE.eu project: visual inspection of assembly defects and cable-marker reading',
					],
					status: 'Prototype',
					project: 'funded by AIRISE.eu [TBD: confirm project name, CONTENT or CONTEST]',
				},
				{
					id: 'wiring-harness',
					title: 'Wiring harness automation',
					oneLiner:
						'Robotic handling, assembly and remanufacturing of automotive wiring harnesses.',
					body: 'A harness is long, branched and floppy: the opposite of what a gripper likes. We combine multimodal perception, AI planning and collaborative robots to grasp, route and connect it, including in remanufacturing, where every harness comes back in a different condition.',
					bullets: [
						'Multimodal perception of cables, branches and connectors',
						'Grasping and routing of flexible cables',
						'Connector insertion',
						'Assembly and remanufacturing workflows',
					],
					status: 'Open to collaboration',
					project: '',
				},
				{
					id: 'motion-planning',
					title: 'Cable-aware motion planning',
					oneLiner:
						'Collision-free trajectories that account for cables, dress packs and deformable objects.',
					body: 'Standard planners model the robot as a chain of rigid links and ignore everything hanging off it. Ours plans in real time with cables, dress packs and deformable objects in the model, wherever a robot works in a cluttered cell or carries its own cables.',
					bullets: [
						'Real-time collision-free trajectory planning',
						'Robot dress packs and tool cables included in the model',
						'Deformable objects in the workspace',
						'Digital twin and physics-based simulation',
					],
					status: 'Open to collaboration',
					project: '',
				},
				{
					id: 'custom-robotics',
					title: 'Custom robotics for deformable parts',
					oneLiner:
						'Tailored robotic systems for processes with flexible parts, inspection tasks or high product variability.',
					body: 'If your process involves something that bends, tangles or changes from piece to piece, we start from your parts and your current process, and design the robotic system around them: perception, end-effector, planning and integration.',
					bullets: [
						'Deformable object manipulation',
						'Robotic inspection',
						'Industrial AI and computer vision',
						'Collaborative robotics, with the operator in control',
					],
					status: 'On request',
					project: '',
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
			video: {
				id: 'video',
				eyebrow: 'Prototype',
				title: 'Connection-testing platform in action',
				caption:
					'Prototype connection-testing platform: a camera on one arm locates the components of a switchboard, then two collaborative arms probe its wires. The corner of the frame shows when the footage is sped up or slowed down (×0.5 to ×8).',
				description:
					'Video, 90 seconds, no sound, English captions: a camera on one collaborative robot locates the 25 components of a switchboard, then two arms probe its wires one by one.',
				posterAlt:
					'Still frame from above: two collaborative robot arms over an open switchboard',
			},
			back: 'Back to home',
		},

		proof: {
			id: 'proof',
			eyebrow: 'Facts',
			title: 'Where we stand today',
			intro:
				'A working prototype, a funded European project and a team rooted in university research. The figures below are published only once they have been measured.',
			metrics: [
				{
					value: '[TBD: test points per hour]',
					label: 'Test points checked per hour on the prototype',
				},
				{
					value: '[TBD: minutes per panel]',
					label: 'Test cycle time per switchboard',
				},
				{
					value: '[TBD: %]',
					label: 'Share of test points reached automatically',
				},
				{
					value: '[TBD: %]',
					label: 'Component recognition accuracy',
				},
			],
			metricsNote: '[TBD: test conditions, e.g. panel type, number of test points, date of measurement]',
			programmesTitle: 'Ecosystem and programmes',
			programmes: [
				{
					name: 'University of Bologna',
					role: 'ROBOSECT is a spin-off of the Alma Mater Studiorum – Università di Bologna.',
					logoAlt: 'Alma Mater Studiorum – Università di Bologna',
				},
				{
					name: 'AIRISE.eu',
					role: 'Funding to develop an AI-based robotic platform for control-panel quality control.',
					logoAlt: 'AIRISE.eu',
				},
				{
					name: 'EIT Manufacturing',
					role: '[TBD: programme name and type of support]',
					logoAlt: 'EIT Manufacturing, co-funded by the European Union',
				},
				{
					name: 'CTE COBO',
					role: '[TBD: programme name and type of support]',
					logoAlt: 'CTE COBO',
				},
			],
			eventsTitle: 'Events',
			events: [
				{
					name: 'IEEE/ASME AIM 2026',
					detail: 'Sponsor and exhibitor, Genoa, 7–10 July 2026',
				},
			],
		},

		team: {
			id: 'team',
			eyebrow: 'Team',
			title: 'From the lab to the factory floor',
			intro:
				'ROBOSECT is a multidisciplinary team of robotics engineers, AI researchers and industrial automation specialists with roots at the University of Bologna. Four competences, one goal: robots that work on real products, not only in the lab.',
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
			title: 'Got a process with cables in it? Let’s look at it together.',
			body: 'Tell us what you build, in what volumes and how you do it today. We will tell you plainly whether, and how, a robot can take on the work.',
			responseTime: 'We reply within [TBD: response time, e.g. 2 working days].',
			form: {
				name: { label: 'Name and surname', placeholder: '' },
				company: { label: 'Company', placeholder: '' },
				email: { label: 'Work email', placeholder: 'name@company.com' },
				partType: {
					label: 'What do you want to automate?',
					placeholder: 'Choose one',
					options: [
						'Electrical panels / switchboards',
						'Wiring harnesses',
						'Robot cell with cables or dress packs',
						'Other deformable parts',
						'Something else',
					],
				},
				volumes: {
					label: 'Volumes',
					placeholder: 'Choose one',
					options: ['One-off / built to order', 'Small batches', 'Series production', 'Not sure yet'],
					hint: 'Add numbers in the message if you have them, e.g. panels per month or harness variants.',
				},
				currentProcess: {
					label: 'How do you do it today?',
					placeholder: 'e.g. tester + wiring list',
				},
				message: {
					label: 'Anything else we should know?',
					placeholder: 'Part size, number of variants, constraints, timing…',
				},
				required: 'required',
				optional: 'optional',
				consent: {
					prefix: 'I have read the',
					linkLabel: 'Privacy Policy',
					suffix: 'and agree that ROBOSECT SRL may use my data to reply to this request.',
				},
				submit: 'Send request',
				sending: 'Sending…',
				success: {
					title: 'Request received.',
					body: 'Thank you. We will get back to you within [TBD: response time].',
				},
				error: 'Something went wrong. Please try again, or write to info@robosect.it.',
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
					'The gripper combs that end straight and grips it: Work email. It inserts it in the breaker’s screw clamp: What do you want to automate.',
					'The screwdriver tightens the clamp: Volumes. The gripper gives the wire a pull test: How do you do it today.',
					'The gripper takes the wire’s other end: Anything else we should know. The opener holds a spring cage open, the end goes in and the cage snaps shut: the consent box.',
					'The gripper switches the breaker on: the current runs through every box built so far.',
					'Two probes test the circuit from end to end: Send request. The robots park.',
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
				reply: 'We reply within [TBD: response time].',
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
				subject: 'Request from the website',
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
		},

		nav: {
			links: [
				{ id: 'problem', label: 'Perché i cavi' },
				{ id: 'how-it-works', label: 'Come funziona' },
				{ id: 'applications', label: 'Applicazioni' },
				{ id: 'technology', label: 'Tecnologia' },
				{ id: 'team', label: 'Team' },
			],
			blog: 'News',
			langSwitch: {
				label: 'English',
				short: 'EN',
				ariaLabel: 'Read the site in English',
			},
			cta: 'Parliamone',
		},

		cta: {
			label: 'Proponeteci un quadro',
			promise: 'Vi diciamo con franchezza se un robot può collaudarlo, e come.',
		},

		hero: {
			eyebrow: 'Robotica per cavi, cablaggi e quadri elettrici',
			headline: 'L’automazione si ferma al cavo. La nostra no.',
			subheadline:
				'ROBOSECT sviluppa sistemi robotici con intelligenza artificiale che riconoscono i cavi, pianificano i movimenti tenendone conto e ci lavorano sopra: su cablaggi, quadri elettrici e altre parti deformabili, a partire dai vostri dati EPLAN e CAD.',
			primaryCta: { label: 'Parliamo della vostra applicazione', href: '#contact' },
			secondaryCta: { label: 'Il prototipo in azione (1:30)', href: '#video' },
			proofChips: [
				'Spin-off dell’Università di Bologna',
				'Progetto finanziato da AIRISE.eu',
				'Prototipo a due bracci per il collaudo quadri',
			],
			imageAlt:
				'Prototipo ROBOSECT: due robot collaborativi con end-effector rossi a puntale, progettati su misura, al lavoro su un quadro elettrico',
		},

		problem: {
			id: 'problem',
			eyebrow: 'Il problema',
			title: 'Le parti rigide sono automatizzate da anni. I cavi no.',
			intro:
				'Un robot lavora bene quando il pezzo ha sempre la stessa forma e sta sempre nello stesso punto. Un cavo, mai. Per questo cablaggio, collaudo e gestione dei fasci cavi sono ancora affidati alle mani di operatori esperti, anche in stabilimenti che hanno automatizzato quasi tutto il resto.',
			points: [
				{
					title: 'Mai due volte nello stesso punto',
					body: 'Un filo si flette, si torce e si assesta in modo diverso su ogni quadro e su ogni cablaggio. Coordinate fisse e punti appresi non reggono alla prima variante.',
				},
				{
					title: 'Spazi stretti, punti nascosti',
					body: 'Morsetti, siglature e connettori stanno tra canaline e guide DIN, spesso coperti proprio dai cavi da raggiungere. La visione artificiale tradizionale fatica a individuarli.',
				},
				{
					title: 'Anche il robot ha i suoi cavi',
					body: 'Dress pack e cavi dell’utensile si muovono con il braccio. La maggior parte dei pianificatori di traiettoria li ignora, finché non si impigliano.',
				},
				{
					title: 'Ogni prodotto è una variante',
					body: 'I quadri sono spesso realizzati su commessa e i cablaggi esistono in molte versioni. Riprogrammare a mano il robot per ciascuno non conviene.',
				},
			],
			closing: 'ROBOSECT lavora proprio su questa parte del processo: quella che si piega.',
		},

		process: {
			id: 'how-it-works',
			eyebrow: 'Come funziona',
			title: 'Dai vostri dati di progetto a un robot che lavora sui cavi',
			intro:
				'Un unico flusso, quattro passaggi. Lo stesso modello digitale del prodotto li attraversa tutti: il robot sa già cosa deve trovare prima ancora di guardare.',
			steps: [
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
		},

		applications: {
			id: 'applications',
			eyebrow: 'Applicazioni',
			title: 'Quattro applicazioni, un filo conduttore: il cavo',
			intro:
				'Dal collaudo dei quadri finiti alla pianificazione dei movimenti attorno ai cavi: ogni applicazione poggia sulla stessa base di percezione, pianificazione ed esecuzione.',
			statusLabel: 'Stato',
			items: [
				{
					id: 'switchboard-testing',
					title: 'Collaudo automatico dei quadri elettrici',
					oneLiner:
						'Prova di continuità dei quadri, generata dai vostri dati di cablaggio ed eseguita dai robot.',
					body: 'Il sistema riconosce i componenti sul quadro, costruisce la sequenza di prova dalla lista collegamenti CAD/EPLAN e fa verificare ai robot ogni collegamento con puntali montati su end-effector progettati ad hoc. I risultati confluiscono in un report digitale: ogni quadro ha il suo verbale di collaudo, tracciabile.',
					bullets: [
						'Riconoscimento AI dei componenti del quadro',
						'Sequenza di prova generata dai dati CAD/EPLAN',
						'Verifica automatica della continuità elettrica',
						'Report di collaudo digitale e tracciabilità completa',
						'In sviluppo nel progetto AIRISE.eu: ispezione visiva dei difetti di montaggio e lettura delle siglature dei cavi',
					],
					status: 'Prototipo',
					project: 'finanziato da AIRISE.eu [TBD: confermare il nome, CONTENT o CONTEST]',
				},
				{
					id: 'wiring-harness',
					title: 'Automazione dei cablaggi',
					oneLiner:
						'Manipolazione, assemblaggio e rigenerazione robotizzati dei cablaggi automotive.',
					body: 'Un cablaggio è lungo, ramificato e cedevole: l’esatto contrario di ciò che una pinza gestisce bene. Combiniamo percezione multimodale, pianificazione AI e robot collaborativi per afferrarlo, instradarlo e collegarlo, anche nella rigenerazione, dove ogni cablaggio rientra in condizioni diverse.',
					bullets: [
						'Percezione multimodale di cavi, diramazioni e connettori',
						'Presa e instradamento di cavi flessibili',
						'Inserimento dei connettori',
						'Processi di assemblaggio e rigenerazione (remanufacturing)',
					],
					status: 'Aperto a collaborazioni',
					project: '',
				},
				{
					id: 'motion-planning',
					title: 'Pianificazione del movimento attenta ai cavi',
					oneLiner:
						'Traiettorie senza collisioni che tengono conto di cavi, dress pack e oggetti deformabili.',
					body: 'I pianificatori standard trattano il robot come una catena di corpi rigidi e ignorano tutto ciò che gli pende addosso. Il nostro pianifica in tempo reale con cavi, dress pack e oggetti deformabili dentro il modello, ovunque un robot lavori in una cella affollata o si porti dietro i propri cavi.',
					bullets: [
						'Pianificazione di traiettorie senza collisioni in tempo reale',
						'Dress pack e cavi dell’utensile inclusi nel modello',
						'Oggetti deformabili nello spazio di lavoro',
						'Digital twin e simulazione basata sulla fisica',
					],
					status: 'Aperto a collaborazioni',
					project: '',
				},
				{
					id: 'custom-robotics',
					title: 'Robotica su misura per parti deformabili',
					oneLiner:
						'Sistemi robotici dedicati per processi con parti flessibili, attività di ispezione o forte variabilità di prodotto.',
					body: 'Se il vostro processo ha a che fare con qualcosa che si piega, si aggroviglia o cambia da un pezzo all’altro, partiamo dai vostri pezzi e da come lavorate oggi, e progettiamo il sistema robotico intorno a loro: percezione, end-effector, pianificazione e integrazione.',
					bullets: [
						'Manipolazione di oggetti deformabili',
						'Ispezione robotizzata',
						'AI industriale e visione artificiale',
						'Robotica collaborativa, con l’operatore al comando',
					],
					status: 'Su progetto',
					project: '',
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
			video: {
				id: 'video',
				eyebrow: 'Prototipo',
				title: 'La piattaforma di collaudo dei collegamenti in azione',
				caption:
					'Prototipo della piattaforma di collaudo dei collegamenti: una telecamera su un braccio trova i componenti di un quadro elettrico, poi due bracci collaborativi ne verificano i fili. Nell’angolo del video compare la velocità quando le riprese sono accelerate o rallentate (da ×0,5 a ×8).',
				description:
					'Video di 90 secondi, senza audio, con didascalie in inglese: una telecamera su un robot collaborativo trova i 25 componenti di un quadro elettrico, poi due bracci ne verificano i fili uno per uno.',
				posterAlt:
					'Fotogramma dall’alto: due bracci robotici collaborativi sopra un quadro elettrico aperto',
			},
			back: 'Torna alla home',
		},

		proof: {
			id: 'proof',
			eyebrow: 'Fatti',
			title: 'A che punto siamo',
			intro:
				'Un prototipo funzionante, un progetto europeo finanziato e un team che viene dalla ricerca universitaria. Pubblichiamo i numeri qui sotto solo dopo averli misurati.',
			metrics: [
				{
					value: '[TBD: punti di prova all’ora]',
					label: 'Punti di prova verificati all’ora sul prototipo',
				},
				{
					value: '[TBD: minuti per quadro]',
					label: 'Tempo ciclo di collaudo per quadro',
				},
				{
					value: '[TBD: %]',
					label: 'Quota di punti di prova raggiunti in automatico',
				},
				{
					value: '[TBD: %]',
					label: 'Accuratezza nel riconoscimento dei componenti',
				},
			],
			metricsNote: '[TBD: condizioni di prova, es. tipo di quadro, numero di punti, data della misura]',
			programmesTitle: 'Ecosistema e programmi',
			programmes: [
				{
					name: 'Università di Bologna',
					role: 'ROBOSECT è uno spin-off dell’Alma Mater Studiorum – Università di Bologna.',
					logoAlt: 'Alma Mater Studiorum – Università di Bologna',
				},
				{
					name: 'AIRISE.eu',
					role: 'Finanziamento per lo sviluppo di una piattaforma robotica basata su AI per il controllo qualità dei quadri elettrici.',
					logoAlt: 'AIRISE.eu',
				},
				{
					name: 'EIT Manufacturing',
					role: '[TBD: nome del programma e tipo di supporto]',
					logoAlt: 'EIT Manufacturing, cofinanziato dall’Unione Europea',
				},
				{
					name: 'CTE COBO',
					role: '[TBD: nome del programma e tipo di supporto]',
					logoAlt: 'CTE COBO',
				},
			],
			eventsTitle: 'Eventi',
			events: [
				{
					name: 'IEEE/ASME AIM 2026',
					detail: 'Sponsor ed espositore, Genova, 7–10 luglio 2026',
				},
			],
		},

		team: {
			id: 'team',
			eyebrow: 'Team',
			title: 'Dal laboratorio alla linea di produzione',
			intro:
				'ROBOSECT è un team multidisciplinare di ingegneri robotici, ricercatori di intelligenza artificiale e specialisti di automazione industriale, con radici all’Università di Bologna. Quattro competenze, un obiettivo: robot che lavorano su prodotti veri, non solo in laboratorio.',
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
			title: 'Nel vostro processo ci sono dei cavi? Analizziamolo insieme.',
			body: 'Raccontateci cosa producete, in che volumi e come lo fate oggi. Vi diremo con franchezza se, e come, un robot può farsene carico.',
			responseTime: 'Rispondiamo entro [TBD: tempo di risposta, es. 2 giorni lavorativi].',
			form: {
				name: { label: 'Nome e cognome', placeholder: '' },
				company: { label: 'Azienda', placeholder: '' },
				email: { label: 'Email aziendale', placeholder: 'nome@azienda.it' },
				partType: {
					label: 'Cosa volete automatizzare?',
					placeholder: 'Selezionate un’opzione',
					options: [
						'Quadri elettrici',
						'Cablaggi',
						'Cella robotizzata con cavi o dress pack',
						'Altre parti deformabili',
						'Altro',
					],
				},
				volumes: {
					label: 'Volumi',
					placeholder: 'Selezionate un’opzione',
					options: ['Pezzo unico / su commessa', 'Piccoli lotti', 'Produzione di serie', 'Ancora da definire'],
					hint: 'Se avete dei numeri, indicateli nel messaggio: ad esempio quadri al mese o varianti di cablaggio.',
				},
				currentProcess: {
					label: 'Come lo fate oggi?',
					placeholder: 'es. tester e lista fili',
				},
				message: {
					label: 'Altro da segnalarci?',
					placeholder: 'Dimensioni del pezzo, numero di varianti, vincoli, tempistiche…',
				},
				required: 'obbligatorio',
				optional: 'facoltativo',
				consent: {
					prefix: 'Ho letto',
					linkLabel: 'l’informativa privacy',
					suffix: 'e acconsento al trattamento dei miei dati da parte di ROBOSECT SRL per ricevere risposta a questa richiesta.',
				},
				submit: 'Invia la richiesta',
				sending: 'Invio in corso…',
				success: {
					title: 'Richiesta ricevuta.',
					body: 'Grazie. Vi risponderemo entro [TBD: tempo di risposta].',
				},
				error: 'Qualcosa non ha funzionato. Riprovate o scriveteci a info@robosect.it.',
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
					'La pinza raddrizza quel capo e lo afferra: Email aziendale. Lo inserisce nel morsetto a vite dell’interruttore: Cosa volete automatizzare.',
					'L’avvitatore serra il morsetto: Volumi. La pinza fa la prova di trazione sul filo: Come lo fate oggi.',
					'La pinza prende l’altro capo del filo: Altro da segnalarci. La leva tiene aperto il morsetto a molla, il capo entra e la molla si richiude: la casella del consenso.',
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
				reply: 'Rispondiamo entro [TBD: tempo di risposta].',
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
				subject: 'Richiesta dal sito',
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
