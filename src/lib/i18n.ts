import { copy, type Lang } from '../i18n/copy';

export type { Lang };
export const LANGS: Lang[] = ['en', 'it'];

/** Home path for a language: / (English, default) and /it/ */
export const homePath = (lang: Lang) => (lang === 'it' ? '/it/' : '/');

/** Link to a homepage section, in page when we are on that home */
export const sectionHref = (lang: Lang, id: string, onHome: boolean) =>
	onHome ? `#${id}` : `${homePath(lang)}#${id}`;

export const t = (lang: Lang) => copy[lang];

/** "[TBD: …]" strings are placeholders, not real values */
export const isTbd = (s: string) => s.trim().startsWith('[TBD:');

/** The technology page: /technology/ (English) and /it/tecnologia/ */
export const techPath = (lang: Lang) => (lang === 'it' ? '/it/tecnologia/' : '/technology/');
