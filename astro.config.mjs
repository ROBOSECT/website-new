// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Build switches (environment):
// - PANEL_EXTERNAL_JS=1  production: page scripts as hashed external modules (cacheable between / and /it/, no
//                        'unsafe-inline' needed under a Content-Security-Policy). Default: inlined, so the static preview
//                        (file://) runs without a server.
// - PANEL_NO_MINIFY=1    QA only: readable bundles for CPU profiles.
const external = process.env.PANEL_EXTERNAL_JS === '1';

// https://astro.build/config
export default defineConfig({
	site: 'https://www.robosect.it',
	integrations: [sitemap()],
	// The site is one page per language: the old inner pages (still linked from outside) land on the place of the home
	// page that took them over. Static output: each one becomes a small page with a meta refresh and a canonical link,
	// which any static host (FTP included) serves as it is.
	redirects: {
		'/technology': '/#how-it-works',
		'/products': '/#products',
		'/packaging': '/#products',
		'/work-with-us': '/#work',
		'/it/tecnologia': '/it/#how-it-works',
		'/it/prodotti': '/it/#products',
		'/it/packaging': '/it/#products',
		'/it/lavora-con-noi': '/it/#work',
	},
	vite: {
		build: {
			// The page scripts inline in the HTML by default, which saves a request and lets the static preview run from
			// file://. Other assets keep Vite's default 4 kB rule.
			assetsInlineLimit: external ? undefined : (filePath) => (filePath.endsWith('.js') ? true : undefined),
			minify: process.env.PANEL_NO_MINIFY === '1' ? false : undefined,
		},
	},
});
