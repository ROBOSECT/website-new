# Il sito ROBOSECT · consegna al team web

Per chi porta online il nuovo robosect.it. Il sito è fatto con Astro: pagine statiche, in inglese e in italiano. Il logo è il D3 «Capocorda», approvato il 27/10/2026.

- **Codice:** questo repository, ramo `latest-version` (prima `claude/tender-maxwell-z4z8p9`). Il prototipo è costruito sopra `master` al commit `42db8e8` del 27/10/2026, con il video nuovo della sezione Tecnologia.
- **Anteprima online:** un link privato di claude.ai, con il video di prima; è nella repo del marchio, in `ROBOSECT-Il-Cavo/07-Sito`.
- **Riferimenti tecnici** (in inglese): `STORY.md`, `MOTION-SPEC.md`, `BUILD-NOTES.md`, nella repo del marchio (privata) in `ROBOSECT-Il-Cavo/07-Sito/riferimenti/`. Stanno lì perché riportano le note del cliente e il lavoro interno, e questa repo è pubblica.
- **Marchio:** kit del logo, linee guida e storia sono nella repo `ROBOSECT/ROBOSECT-Brand`.

## In breve

- Una home in due lingue (`/` e `/it/`), una pagina Tecnologia in due lingue (`/technology/` e `/it/tecnologia/`), un blog, quattro pagine legali, una pagina 404: 12 pagine.
- **A chi parla (versione 4, 04/11/2026):** prima di tutto ai costruttori di quadri elettrici (titolare, responsabile di produzione e qualità, ufficio tecnico EPLAN), ma il messaggio è più largo: ROBOSECT fa manipolazione robotica fino al caso più difficile, cavi e parti deformabili. Cablaggi, celle robotizzate e «altra manipolazione» sono «anche per te». Le azioni: «Proponici un quadro» dove si parla di quadri (apertura, Cosa ottieni), «Scrivici» nella barra, «Parlaci del tuo processo» per tutti gli altri (riga sotto l'apertura, Anche per te, pagina Tecnologia). L'italiano dà del tu; i testi legali restano formali.
- Nessun codice sul server, nessun database, nessun cookie di tracciamento, nessuna statistica. Il modulo contatti apre il programma di posta del visitatore.
- La home è un quadro elettrico: un solo cavo parte dalla R del logo e attraversa la pagina; in ogni sezione un piccolo robot racconta con un lavoro vero quello che dice la sezione; alla fine i robot piegano il cavo fino a farne la R del logo, accanto al modulo contatti.
- Per lavorarci servono Node 22.23.4 o più recente, `npm ci`, `npm run dev`, `npm run build`.
- I testi stanno tutti in `src/i18n/copy.ts`, inglese e italiano con le stesse chiavi.
- Prima di andare online: contenuti `[TBD]`, informativa privacy, prova su Safari e iPhone, ricerca di anteriorità del marchio, hosting e dominio (capitolo 8).

## 1. Che cos'è il sito e come racconta

ROBOSECT è uno spin-off dell'Università di Bologna. Costruisce robot con intelligenza artificiale che lavorano su cavi, cablaggi e quadri elettrici. Il sito lo racconta con quello che i robot fanno, non con slogan.

**Il cavo.** In alto c'è la fotografia del prototipo vero: due bracci collaborativi con puntali di prova su un quadro. La R del logo è un cavo che finisce in un capocorda di rame. Al primo scatto della rotella il capocorda si sfila e il cavo scende lungo la pagina. È lo stesso cavo fino al modulo contatti.

**Sei sezioni, sei lavori.** Ogni sezione è uno scomparto del quadro. Mentre il visitatore scorre, un robot fa un lavoro con un attrezzo; poi il componente si apre nel contenuto della sezione. L'ordine segue chi compra: prima il problema, poi la soluzione, poi le prove, poi la richiesta.

| Sezione (ancora) | Contenuto | Lavoro del robot | Attrezzo |
|---|---|---|---|
| Apertura (hero) | «L'automazione si ferma al cavo. La nostra no.»; robot che collaudano i quadri partendo dal progetto EPLAN, poi la manipolazione fino a cavi e parti deformabili; fotogramma della demo con il pulsante «Guarda la demo» (il video si apre sopra la pagina, dove sei, il file si scarica solo allora); «Proponici un quadro» e, sotto, «Non costruisci quadri? Parlaci del tuo processo» | il capocorda si sfila dalla R | – |
| Il problema (`#problem`) | collaudo a mano filo per filo: ore di persone esperte, ogni quadro è una variante, nessuna traccia di cosa è stato provato | un quadro «variante»: i morsetti non sono dove dice il disegno (tratteggio); il puntale atterra sul punto insegnato (✕), esita da un morsetto all'altro, ne prova uno che si accende e si spegne; accanto il verbale resta bianco | puntale |
| Come funziona (`#how-it-works`) | tre passi (vede il quadro vero · parte dalla lista collegamenti EPLAN · lascia il verbale) e un disegno animato: i punti di prova si accendono uno alla volta mentre il verbale si compila; una riga e un link alla pagina Tecnologia | la telecamera sul polso guarda il quadro (cono e parentesi), la lista collegamenti esce dal suo alimentatore, il puntale prova i morsetti nell'ordine della lista: ogni morsetto verificato diventa rame, la sua riga riceve la spunta | puntale con telecamera |
| Cosa ottieni (`#what-you-get`) | meno ore di collaudo, ogni collegamento verificato, un verbale per il cliente, persone esperte libere; i numeri sono `[TBD]` | il puntale prova gli ultimi due morsetti (ora tutti in rame) e la stampante fa uscire il verbale, ogni riga spuntata, davanti ai verbali dei quadri precedenti | puntale |
| Prototipo (`#proof`, video `#video`) | video del prototipo (si guarda lì, con i suoi comandi), i due bracci a pochi centimetri sulla stessa morsettiera (fotogramma), spin-off UniBo, AIRISE.eu, IEEE/ASME AIM 2026; «Stato: prototipo funzionante» | due bracci con puntale su un quadro (due piastre, una canalina): i due aghi sui due capi dello stesso filo, nello stesso istante, due volte; il filo verificato si accende in rame | puntali di prova |
| Anche per te (`#also-for-you`) | cablaggi; celle robotizzate e integratori (invitati a collaborare); altra manipolazione (su progetto) | la pinza prende il connettore di un cablaggio, lo fa passare sulla forcella e lo innesta; lungo il braccio corre il suo dress pack | pinza |
| Team (`#team`) | come prima | calma: la pinza solleva una matassa di cavo in disordine e la posa ordinata; poi si parcheggia | pinza |
| Contatti (`#contact`) | la tagline «Automazione, fino all'ultimo filo.», poi «Proponici un quadro, o parlaci del tuo processo.» e il modulo | il cavo della pagina esce dal banco, dritto; i due robot lo posano passo dopo passo nella R del logo e crimpano il puntale di rame | due pinze |

Dopo il pannello c'è **News** (`#news`, `src/components/home/HomeNews.astro`): una sezione normale, senza robot né apertura, con le ultime tre notizie (l'intera scheda è il link) e «Tutte le news». Prima le news erano dentro il modulo del Prototipo e si aprivano con lui.

Il disegno animato di «Come funziona» parte quando è sullo schermo e la sezione è aperta (`initDemo` in `src/scripts/home.ts`); con il movimento ridotto e senza JavaScript si vede già finito.

**Il modulo** è aperto a tutti. Prima domanda: «Di cosa ti occupi?» (quadri elettrici, cablaggi, celle robotizzate e integrazione, altra manipolazione; obbligatoria). Poi nome, azienda, email (obbligatori), telefono (facoltativo). Le domande sui quadri (che quadri costruisci, quadri all'anno, usi EPLAN) compaiono solo a chi sceglie «Quadri elettrici» (CSS `:has`, senza JavaScript; dove `:has` manca restano visibili) e sono facoltative. Poi «Come lo fai oggi, e cosa vorresti affidare a un robot?» (testo libero) e il consenso privacy. Invio come prima: `mailto:` con conferma; l'oggetto è «Un quadro da collaudare» o «Un processo da automatizzare» secondo la scelta, e la mail porta le domande sui quadri solo per i quadri. La conferma prende il posto del modulo dall'alto. Risposta entro due giorni lavorativi (deciso con la proprietà). Il modulo è completo e usabile da subito, con o senza JavaScript: l'animazione non blocca mai la scrittura né l'invio.

**I segni.** Ogni segno vuol dire una cosa sola, ovunque:

- **cavo blu** (carta sui fondi scuri): il conduttore su cui lavora ROBOSECT;
- **rame**: il conduttore, la corrente, una prova superata, l'unica azione principale (Invia, i pulsanti). Mai decorazione;
- **tratteggio**: un disegno, oppure una parte che sta per essere fatta;
- **✕ acciaio**: un arresto di protezione, niente si è rotto;
- **parentesi e cono**: la telecamera ha visto, dove ha visto;
- **ROBOSECT sul braccio** (la R sui telefoni): sono i robot di ROBOSECT;
- **marcacavi**: il nome della sezione, stampato sul cavo come su un filo vero.

Sullo schermo non ci sono codici tecnici né ingrandimenti: è una scelta del cliente. Il racconto scena per scena è in `07-Sito/riferimenti/STORY.md` e, nella repo del marchio, in `ROBOSECT-Il-Cavo/01-Storia-e-strategia/racconti/storia-del-sito.pdf`.

## 2. Mappa delle pagine

| Indirizzo | Pagina | Lingua | File |
|---|---|---|---|
| `/` | home | inglese | `src/pages/index.astro` → `src/components/home/Home.astro` |
| `/it/` | home | italiano | `src/pages/it/index.astro` → stessa `Home.astro` |
| `/technology/` | tecnologia | inglese | `src/pages/technology.astro` → `src/components/tech/TechPage.astro` |
| `/it/tecnologia/` | tecnologia | italiano | `src/pages/it/tecnologia.astro` → stessa `TechPage.astro` |
| `/blog/` | notizie | inglese | `src/pages/blog/index.astro` |
| `/blog/aim-2026/` | articolo | inglese | `src/content/blog/aim-2026/index.md` |
| `/blog/2026-02-01_airise_kickoff/` | articolo | inglese | `src/content/blog/2026-02-01_AIRISE_KICKOFF/index.md` |
| `/privacy-policy/` | informativa privacy | inglese | `src/pages/privacy-policy.astro` |
| `/cookie-policy/` | cookie | inglese | `src/pages/cookie-policy.astro` |
| `/legal-notes/` | note legali | inglese | `src/pages/legal-notes.astro` |
| `/gender-equality-diversity-policy/` | parità di genere | inglese | `src/pages/gender-equality-diversity-policy.astro` |
| `/404.html` | pagina non trovata | inglese | `src/pages/404.astro` |

- **Ancore della home**, uguali in inglese e in italiano: `#problem`, `#how-it-works`, `#what-you-get`, `#proof`, `#video`, `#also-for-you`, `#team`, `#contact`, `#news`. Le vecchie `#applications` e `#technology` non esistono più (la tecnologia ha la sua pagina).
- **Menu:** Come funziona, Cosa ottieni, Prototipo, Tecnologia (pagina), Team, cambio lingua, «Scrivici» / «Write to us» (porta a `#contact`, sempre nella barra). News è nel footer e in fondo alla home.
- **File fissi** (`public/`): `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `site.webmanifest`, `og-logo.png` e `og-logo-it.png` (anteprime social), `avatar-400.png` (logo nei dati strutturati), `robots.txt`, `firma/robosect-firma-logo.png` (logo delle firme email).
- **Generati dal build:** `sitemap-index.xml` e `sitemap-0.xml`.
- Le pagine del sito attuale (home, blog, quattro pagine legali) restano agli stessi indirizzi. Nuove: `/it/` e la 404.

## 3. Avviarlo e compilarlo

**Versioni.** `package.json` chiede Node 22.12.0 o più recente, ma le dipendenze di `package-lock.json`, aggiornate su `master` il 27/10/2026 per chiudere delle vulnerabilità, vogliono **Node 22.23.4 o più recente**: con una versione più vecchia Astro 7.4.2 non parte. TypeScript 6.0.3.

| Comando | Cosa fa |
|---|---|
| `npm ci` | installa le dipendenze esatte di `package-lock.json` |
| `npm run dev` | il sito in locale, http://localhost:4321, si aggiorna a ogni modifica |
| `npm run build` | il sito statico in `dist/` (circa 20 secondi); fa anche il controllo dei robot |
| `npm run preview` | serve `dist/` in locale, con la pagina 404 |
| `npx astro check` | controlla tipi e modelli: oggi 0 errori, 0 avvisi, 16 suggerimenti |

**Due interruttori** (variabili d'ambiente, in `astro.config.mjs`):

- `PANEL_EXTERNAL_JS=1 npm run build` **è il build per la pubblicazione.** Gli script vanno in un file a parte: si mette in cache una volta per `/` e `/it/` e funziona con una Content-Security-Policy senza `'unsafe-inline'`. Senza la variabile gli script sono dentro l'HTML: serve per l'anteprima, che deve funzionare anche aperta da file.
- `PANEL_NO_MINIFY=1`: script leggibili, solo per i controlli di prestazione.

**Pubblicare.** Si carica il contenuto di `dist/` su un hosting statico qualsiasi. Gli indirizzi sconosciuti devono rispondere con `404.html`. L'indirizzo del sito è in `astro.config.mjs` (`site: 'https://www.robosect.it'`): lo usano sitemap, link canonici e anteprime social.

**Provato il 28/10/2026 su questo ramo**, con Node 22.22.0: non basta per le dipendenze nuove, quindi la prova è fatta con quelle di prima (Astro 7.1.1, le stesse usate per tutto il lavoro sul sito). `npm run build`: 10 pagine, nessun errore, controllo dei robot superato. `npx astro check`: 0 errori, 0 avvisi. La sezione Tecnologia con il video nuovo è stata guardata a 1440 e a 390 px, in inglese e in italiano, senza errori nella console. Rotella vera a 1440 e 1280 (inglese) e a 390 (italiano): nessuna immagine tagliata, ogni scena arriva alla fine, nessun errore. **Da rifare con Node 22.23.4 e `npm ci`.**

## 4. Dove si cambiano testi, immagini e logo

| Cosa | Dove | Note |
|---|---|---|
| Testi di home, menu, footer, indice del blog | `src/i18n/copy.ts` | inglese (`en`) e italiano (`it`) con le stesse chiavi e liste della stessa lunghezza; i testi stanno solo qui |
| Segnaposto | `[TBD: …]` in `copy.ts` | il sito li mostra in un riquadro tratteggiato (`src/components/ui/Rich.astro`); cercare `[TBD:` prima di pubblicare |
| Articoli del blog | `src/content/blog/<cartella>/index.md` | campi: `title`, `description`, `date`, `cover` (immagine nella stessa cartella), `coverAlt`, `tags`, `draft` (`true` = non pubblicato); il nome della cartella, in minuscolo, diventa l'indirizzo; schema in `src/content.config.ts`; solo inglese |
| Pagine legali | `src/pages/*.astro` | in inglese, il testo è nel file |
| Foto e video | `src/assets/images/home/demo-*.jpg`, `src/assets/videos/robosect_v4.mp4` | tutte le foto sono fotogrammi del video della demo (il prototipo vero), ritagliati fuori dalle scritte del video: `demo-hero` (70 s, apertura), `demo-poster` (79 s, dall'alto, immagine prima del play), `demo-two-probes` (58,5 s, Prototipo), `demo-tech` (15 s, pagina Tecnologia), `demo-board` (10 s) e `demo-located` (26,5 s, i 25 componenti trovati) per Il problema, `demo-dresspack` (61 s, Anche per te). Il build crea le versioni webp. Il video (90 secondi, 1920 × 1080, 68 MB, senza audio) viene copiato così com'è |
| Colori, spaziature | `src/styles/global.css`, `src/styles/panel.css` | per i designer: `04-Tema-e-token` |
| Caratteri | Inter e JetBrains Mono, dai pacchetti `@fontsource` | Space Grotesk serve solo per disegnare il logo e arriva già in tracciati |
| Logo, icone, anteprime social | `tools/gen-logo.py`, poi `tools/gen-og.mjs` | mai a mano: vedi sotto |
| Logo delle firme email | `public/firma/robosect-firma-logo.png` | le firme (`05-Template/03-Firma-email`) lo caricano da `https://www.robosect.it/firma/robosect-firma-logo.png`: l'indirizzo non va cambiato |

**Il logo.** `python3 tools/gen-logo.py` legge il kit del logo D3 e scrive: `src/lib/cable-geometry.ts` (la R dell'apertura come cavo), `src/scripts/panel/robot/logo.ts` (il logo sui bracci), `src/assets/brand/robosect-logotipo-negativo-stretto.svg` (menu e footer), le icone, il manifest e l'avatar in `public/`, la striscia AIRISE.EU + ROBOSECT dell'articolo AIRISE. Poi `node tools/gen-og.mjs` rifà `public/og-logo.png` e `og-logo-it.png`. Ogni forma è quella del kit, copiata, mai ridisegnata.

Da sapere:

- I file generati sono già nel repository. Non serve lanciare niente, a meno che il logo cambi.
- `gen-logo.py` cerca il kit nella repo del marchio (`ROBOSECT/ROBOSECT-Brand`) clonata accanto a questa nella cartella `robosect-brand`, cioè in `../robosect-brand/logo-D3` (un'altra copia con `LOGO_KIT=/percorso`). Usa `05-kit` e due file di sviluppo (`01-R/svg/R-A.svg`, `03-simbolo/svg/simbolo-piccolo.svg`) che **non** sono in `ROBOSECT-Il-Cavo/02-Logo`.
- `gen-og.mjs` carica Playwright da un percorso della macchina di lavoro (`/opt/node22/…`): va adattato prima di usarlo altrove.

**File vecchi.** In `src/assets/images` ci sono 11 immagini del sito precedente che nessuna pagina usa (circa 7 MB: `about_robosect.png`, `contact_us.png`, `icona_v2.png`, `img_intro.png`, `logo_scritta.png`, `logo_scritta_bianco.png`, `top.png` e le quattro `team_*.png`). Si possono togliere quando il nuovo sito entra in `master`.

## 5. Il motore del pannello, in una pagina

**Il principio.** Tutto quello che si muove nella home dipende da un solo numero: la posizione di scorrimento, resa morbida. Stessa posizione, stessa immagine, sia scendendo sia risalendo. La pagina segue sempre lo scorrimento nativo del browser.

**Lo scorrimento: la pagina rallenta, non si ferma.** Nessun blocco. Mentre un robot lavora, tutta la pagina scende più piano, almeno a 0,45 della velocità normale (0,35 sui telefoni orizzontali bassi), con rampe dolci. Il robot entra dal basso, sale mentre lavora e arriva in alto quando il lavoro è finito; poi la pagina riprende la velocità normale. A 1440 × 900 un lavoro dura 4–8 scatti di rotella.

- Il rallentamento è un'animazione CSS legata allo scorrimento (`animation-timeline: scroll()`): la fa il browser, senza JavaScript a ogni immagine.
- Nei browser che non la supportano (Firefox; Safari prima del supporto) non c'è rallentamento: i lavori si svolgono durante lo scorrimento normale.
- Morbidezza: un inseguitore smorzato (0,15 s; 0,13 s al tocco). La simulazione gira a 120 Hz e salva un'istantanea ogni 0,2 s di programma: tornare indietro è esatto e veloce. Quando la rotella si ferma i cavi si assestano (`relax.ts`).

**Le sei scene.** Sei programmi (`programs.ts`): un braccio (due bracci per il prototipo) e gli oggetti sul banco su cui lavora (`props.ts`: morsettiere su piastra con canalina, verbale, lista collegamenti, stampante, cablaggio con forcella, dress pack, matassa), disegnati in unità della cella, dal vivo e nei fotogrammi statici di inizio e fine. Il rame solo dove succede qualcosa di vero: un collegamento verificato, una spunta sul verbale, il puntale crimpato. Il controllo dei robot gira durante il build (`robot/buildqa.ts`): ogni programma su 13 impaginazioni. Una collisione, un limite superato o un contatto mancato fermano il build.

**Il gran finale (Contatti): la R.** Non segue lo scorrimento: parte da solo quando entra nello schermo, si ferma fuori schermo, con la scheda nascosta e mentre il visitatore scrive. Il cavo della pagina entra nella scheda, corre nella canalina sotto il banco ed esce dal banco dove starà l'asta della R; il resto è disteso dritto sul banco. Il braccio sinistro lo posa nell'asta, nell'angolo e nel tratto superiore; lo passa al destro, che posa l'occhiello, la gamba e il piede; poi il destro prende il puntale dal suo supporto, lo infila sull'estremità e lo crimpa (l'unico momento in rame). Il cavo non cambia mai lunghezza: la sua forma è la linea mediana della R del kit del logo (`lib/cable-geometry.ts`) fino al punto posato, poi un tratto fino alla pinza e il resto disteso. Il fotogramma finale è il tracciato del kit, con il suo puntale, sotto una sola trasformazione (scala 0,75): si sovrappone alla R del logo (verificato al pixel a 1440 e 390 px). Circa 15 secondi. RESET (blu, acceso a R finita) la rifà dal cavo dritto; STOP (rosso) ferma i robot, un secondo STOP li lascia ripartire. Invia apre il programma di posta (`mailto:info@robosect.it`), con una conferma e la possibilità di copiare il testo. File: `showpiece/rfilm.ts` (geometria, coreografia, forma del cavo), `rview.ts` (disegno), `player.ts` (orologio e pulsanti), `rqa.ts` (controllo dei robot del finale nel build).

**Movimento ridotto e senza JavaScript.**

- Con il movimento ridotto: niente rallentamenti, tutte le sezioni aperte, robot fermi, la R già finita; RESET e STOP disattivati.
- Senza JavaScript: una pagina statica normale; i robot sono disegnati durante il build; il modulo usa `mailto:`.
- Se gli script non partono entro 3,5 secondi, la pagina torna da sola allo stato statico.

**Il video della demo** si apre sopra la pagina, dove sei: «Guarda la demo» è un pulsante che lo script mostra solo quando la finestra funziona; la finestra copre lo schermo, quindi rotella e tocco non fanno scorrere la pagina dietro, e alla chiusura la posizione è la stessa (provato anche in un iframe con `sandbox`, con e senza `allow-same-origin`). Nessuna memoria del browser, cronologia o schermo intero in questo percorso; dove serve (cronologia delle ancore, `sessionStorage`, `mailto:`) le chiamate sono protette. Senza JavaScript il pulsante non c'è e il video si guarda nella sezione Prototipo.

**Il ridimensionamento.** Mentre la finestra cambia misura non si ricostruisce niente: il primo evento prende il posto del visitatore, le sezioni lontane dallo schermo smettono di disegnarsi (`content-visibility`, alla loro altezza), e una sola ricostruzione parte 180 ms dopo l'ultimo cambio, a pezzi (una sezione per volta), solo se è cambiato qualcosa da cui dipendono le zone. Il `ResizeObserver` usa lo stesso timer.

**Il visitatore non resta mai bloccato.** Scorrimento nativo, tastiera, ancore, ricerca nella pagina: un salto a un'ancora arriva sul titolo con la sezione già completa.

**I file** (`src/scripts/panel/`): `index.ts` (regia, misure, ridimensionamento, modalità), `scroll.ts` (morbidezza, rallentamento, ancore, tastiera), `stage.ts` (una sezione disegnata), `program.ts` e `programs.ts` (le sei scene), `sim.ts` (simulazione e istantanee), `robot/` (cinematica, disegno, controllo, logo), `devices.ts` (i componenti), `hero.ts` (il capocorda che si sfila), `sleeve.ts` (i marcacavi), `relax.ts`, `props.ts` (gli oggetti sul banco), `showpiece/` (il gran finale: la R), `svgpatch.ts`, `paint.ts`. Il modulo: `src/scripts/contact.ts`.

**Per guardarci dentro.** Nell'indirizzo: `?panel-debug=1` (pannello con i valori), `?panel-capture=1` (immagini ripetibili), `?panel-sda=0` (prova senza rallentamento). Nella console: `window.__panel`, `__scroll`, `__show`.

**Per approfondire.** `07-Sito/riferimenti/MOTION-SPEC.md`: §3 scorrimento, §5 robot, §9 movimento ridotto e senza JavaScript, §10 architettura, §11 strumenti di prova, §13 prestazioni. `07-Sito/riferimenti/BUILD-NOTES.md`: «Engine pass», «Review 3 pass» (paragrafo «For later passes»), «Independent verification v4», «Logo D3 «Capocorda» across the site».

## 6. Controlli (QA)

**Dentro il repository.**

- `npx astro check`: tipi e modelli.
- `npm run build`: oltre al sito, il controllo dei robot delle sei scene (anche la distanza dagli oggetti sul banco) e del gran finale (limiti e velocità dei giunti, distanza fra i bracci, banco e bordi, nessun braccio attraverso il cavo). Se un robot sbaglia, il build si ferma.

**Fuori dal repository.** Le prove automatiche con Playwright usate durante il lavoro sono nella cartella di lavoro della sessione in cui è nato il sito, `proposte/B2/qa/` (235 MB con i risultati). Non sono in nessun repository. Sono scritte per quella macchina: percorsi assoluti, solo Chromium. Si lanciano così: `npm run build`, poi `(cd dist && python3 -m http.server 8771)`, poi lo script.

| Script | Controlla |
|---|---|
| `qa/rb/run.sh` | i robot in Node, tutte le impaginazioni |
| `qa/v4/wheelmx.mjs 1440x900,390x844 en` | rotella vera dall'alto in fondo: nessun robot o componente tagliato, la pagina non si ferma mai, ogni scena arriva alla fine |
| `qa/v4/form.mjs` | Contatti: costruzione, intenzione di scrivere, STOP, RESET con testo, Invia (un solo `mailto:`), movimento ridotto, senza JavaScript |
| `qa/v4/logos.mjs` | il logo su ogni braccio |
| `qa/v4/codes.mjs` | nessun codice tecnico sullo schermo |
| `qa/bf/svgaudit.mjs`, `dump.mjs`, `novar.mjs` + `nvdiff.py` | ogni forma SVG ha il suo colore scritto (sicurezza per Safari e Firefox) |
| `qa/v4/perf.mjs` | tempo di JavaScript per immagine, con processore rallentato 4 volte |
| `qa/r3/ev.sh static` e `timed` | gli script dei revisori |

**Ultimi risultati.** Il 03/11/2026, scene raccontate e finale con la R: `npx astro build` 12 pagine, controllo dei robot superato (sei scene su 13 impaginazioni, finale); `npx astro check` 0 errori, 0 avvisi; Playwright con Chromium a 1440 × 900 e 390 × 844: strisce di fotogrammi di ogni scena guardate e corrette in due giri, la R finale sovrapposta alla R del logo (nessun pixel diverso oltre 1 px), movimento ridotto e senza JavaScript (R finita), nessun errore nella console, nessuno scorrimento orizzontale sui telefoni. Prima, il 03/11/2026, versione 3 (home per i costruttori di quadri): `npx astro build` 12 pagine, controllo dei robot superato (anche il modulo a 10 caselle); `npx astro check` 0 errori, 0 avvisi; Playwright con Chromium a 1440 × 900 e 390 × 844 (e 360 × 740), inglese e italiano, con movimento, con movimento ridotto e senza JavaScript: nessun errore nella console, nessuno scorrimento orizzontale sui telefoni; modulo: campi obbligatori, invio con `mailto:` e conferma provati; finestra del video provata (il file non si riproduce nel Chromium di prova, che non ha il codec H.264). Il 28/10/2026, su questo ramo: build, `astro check` e sezione Tecnologia come nel capitolo 3. Prima (verifica R1 del 27/10/2026 sul commit 93fd4dd del repository di lavoro, uguale a questo ramo tranne il video, il logo della firma e le dipendenze): build 10 pagine; `astro check` 0 errori e 0 avvisi; robot: tutto superato; colori SVG: superato su 10 pagine; logo su 9 bracci su 9; modulo: tutto come previsto; rotella vera a 1440, 1280 e 768 (inglese), 390 e 360 (italiano): nessuna immagine tagliata. La verifica completa precedente (v4) aveva provato 10 misure di schermo in due lingue: nessuna immagine tagliata.

**04/11/2026, versione 4** (foto dal video della demo, messaggio più largo, News, video sul posto, ridimensionamento): `npx astro build` 12 pagine, controllo dei robot superato; `npx astro check` 0 errori, 0 avvisi. Playwright con Chromium a 1440 × 900 e 390 × 844, italiano e inglese: il clic su «Guarda la demo» e sul video del Prototipo non sposta la pagina (`scrollY` uguale prima, durante, con la rotella e dopo la chiusura), anche dentro un iframe `sandbox="allow-scripts allow-same-origin allow-popups allow-forms"` e `sandbox="allow-scripts"`; menu e finestra del video coprono la pagina a ogni altezza; il Tab nella barra non sposta più la pagina; modulo per chi non costruisce quadri (domande sui quadri nascoste, una sola `mailto:` con l'oggetto giusto); dopo un ridimensionamento 1440 → 390 → 1440 il modello del pannello è identico a una pagina caricata a quella misura. Ridimensionamento continuo 1440 → 390 → 1440 a passi di 25 px, processore rallentato 4 volte: compiti lunghi oltre 50 ms da 74–85 a 5–19 (da 20–34 a 1–2 con il processore rallentato 2 volte; a velocità piena nessuno, prima e dopo). Resta un compito lungo quando la ricostruzione finale parte: è il browser che rifà l’impaginazione intera alla misura nuova.

Tutte le prove sono state fatte solo con Chromium. Safari, iPhone e Firefox non sono mai stati provati.

## 7. Accessibilità e prestazioni

**Accessibilità.**

- Rispetta la preferenza «riduci movimento», anche se cambia mentre la pagina è aperta.
- Funziona senza JavaScript: tutto leggibile, il modulo funziona.
- Tastiera: scorrimento nativo, collegamento «Vai al contenuto», RESET e STOP sono pulsanti veri, con nome in inglese e in italiano e bordo di focus visibile.
- Il movimento si può fermare (WCAG 2.2.2): STOP; il film si ferma fuori schermo, con la scheda nascosta e mentre il visitatore scrive.
- Lettori di schermo: il lavoro dei robot è descritto a parole (`contact.show.details` in `copy.ts`); le parti `[TBD]` dei testi alternativi non vengono lette.
- Lingua dichiarata in ogni pagina; le due home si indicano a vicenda (`hreflang`).
- **Non fatto:** una prova con un lettore di schermo vero e un controllo automatico (per esempio axe).

**Prestazioni.**

- Pagine statiche; immagini in webp in più misure, caricate quando servono.
- Peso della home misurato il 27/10/2026: con `PANEL_EXTERNAL_JS=1` HTML 212 KB (31 KB compresso) più un file JavaScript da 251 KB (93 KB compresso); senza, HTML 463 KB (122 KB compresso).
- Tutto il sito: circa 72 MB, di cui 68 MB il video del prototipo e 4,4 MB il resto. Il video si scarica solo quando il visitatore preme play (`preload="none"`); i dati per l'avvio sono all'inizio del file, quindi parte subito e si scarica mentre va.
- Un solo ciclo di animazione, attivo solo quando qualcosa si muove. Fermo il visitatore, il sito non lavora.
- Misure della verifica v4 (Chromium, processore rallentato 4 volte): JavaScript per immagine allo scorrimento 2,2–2,7 ms (obiettivo 2,5), nel gran finale 2,6–3,2 ms; disegno (paint) 33 ms al 95° percentile. Nessuno spostamento di layout mentre il modulo si costruisce.

## 8. Cosa resta aperto

| Punto | Cosa manca | Chi |
|---|---|---|
| Contenuti `[TBD]` | in `copy.ts` più l'indirizzo LinkedIn in `Team.astro`: quattro numeri di «Cosa ottieni» (minuti per quadro, % di punti raggiunti in automatico, verbale d'esempio anonimizzato, ore di tecnico liberate) e le condizioni di prova; nome del progetto AIRISE (CONTENT o CONTEST); il ruolo di EIT Manufacturing e CTE COBO (oggi solo loghi nel footer); una frase sulla nascita di ROBOSECT; bio, nome e ruolo del co-fondatore, ritratti; elenco delle pubblicazioni. Nessuno deve andare online | ROBOSECT |
| Informativa privacy | il paragrafo ora descrive il modulo (prepara un'email, il sito non salva nulla); il testo legale va approvato. Da valutare se citare che la home ricorda la posizione di scorrimento nella sessione del browser (`sessionStorage`, nessun dato personale). Se un giorno il modulo invierà a un server, il testo va rifatto | ROBOSECT |
| Safari e iPhone | mai provati (solo Chromium). Gli SVG sono controllati; il passaggio al programma di posta è pensato per Safari ma non verificato. Provare l'anteprima su un iPhone, su Safari desktop e su Firefox (lì senza rallentamento, per scelta) | team web |
| Logo della firma a `/firma/` | le firme email lo caricano da `www.robosect.it/firma/robosect-firma-logo.png`: finché il nuovo sito non è online a quell'indirizzo, nelle firme l'immagine non compare | team web |
| Pubblicazione e dominio | hosting da scegliere; dominio `www.robosect.it`: DNS, HTTPS, `robosect.it` → `www`, 404, intestazioni di cache, eventuale Content-Security-Policy | team web |
| Marchio | prova di lettura con i colleghi non ancora fatta; ricerca di anteriorità da un consulente (EUIPO, UIBM, WIPO; classi 7, 9 e 42) prima dell'uso pubblico: il sito online è uso pubblico | ROBOSECT |
| Prove automatiche | sono fuori dal repository e legate alla macchina di lavoro; per usarle in azienda vanno copiate (`qa/rb`, `qa/v4`, `qa/bf`, senza `out/`) e i percorsi adattati | team web |
| Modulo | solo `mailto:`, nessun invio a un server: è una scelta da confermare | ROBOSECT |
| Video del prototipo | mostra ancora il logo vecchio (in alto a sinistra all'inizio e nel cartello finale); le scritte sono solo in inglese, anche su `/it/` | ROBOSECT |
| Versione di Node | le dipendenze di `master` vogliono Node 22.23.4 o più recente, mentre `package.json` dice ancora 22.12.0: conviene allineare il campo `engines` | team web |

**Limiti noti, nessuno blocca** (da `BUILD-NOTES.md`, verifica v4):

- sui telefoni il gran finale è piccolo (la R è alta circa 70 px) e gli oggetti delle scene a due bracci (il prototipo) sono minuti;
- il tempo di JavaScript per immagine è poco sopra l'obiettivo;
- sui telefoni orizzontali bassi una scena dura 1–3 scatti;
- l'apertura (il capocorda) dura meno di 2 scatti sugli schermi da 1280 a 1536;
- il film va a 1,2 volte la velocità di progetto;
- una volta su cinque, ricaricare `/#video` dopo un salto interno è arrivato su «Fatti» (non riprodotto in seguito).

## 9. Dal ramo a `master`

Il nuovo sito è già in questo repository, sul ramo `claude/tender-maxwell-z4z8p9`, sopra `master` al commit `42db8e8` del 27/10/2026. Il 28/10/2026 sono stati fatti questi passi:

1. Tolto `src/components/landing/`: i 9 componenti della home vecchia, sostituiti da `src/components/home/` e `src/components/site/`.
2. Copiati i file del sito «Il Cavo» (repository di lavoro, commit `dcc6548`). Restano quelli di `master`: `CLAUDE.md`, `package-lock.json` e il video.
3. Riportate le novità di `master`:
   - il video `robosect_v4.mp4` (90 secondi) al posto di quello da 55 secondi, con anteprima, durata nel pulsante dell'apertura («Watch the prototype (1:30)») e testi del riquadro aggiornati;
   - il testo allineato a sinistra sui telefoni: il nuovo sito non giustifica mai il testo, quindi non serve altro;
   - il video più grande: nel nuovo sito ha già un riquadro suo, largo circa 820 px a 1440;
   - **non** riportato, per scelta del 28/10/2026: in `master` il video parte da solo, senza audio e in loop, quando è visibile per metà. Qui parte con un clic e non si scarica prima (`preload="none"`), come nel sito «Il Cavo»: con 68 MB non consuma dati a chi scorre soltanto;
   - le dipendenze aggiornate: `package.json` è identico, `package-lock.json` è quello di `master`.
4. Aggiunta questa cartella `docs/`, con questo testo.

Restano:

1. Rifare le prove con Node 22.23.4: `npm ci`, `npx astro check`, `npm run build`, `npm run preview`; guardare tutte le pagine in inglese e in italiano, anche con «riduci movimento».
2. Un commit che cita l'origine (sito «Il Cavo», commit `dcc6548` del repository di lavoro), push del ramo, pull request, revisione.
3. Completare i `[TBD]` e far approvare l'informativa privacy.
4. Pubblicare: `PANEL_EXTERNAL_JS=1 npm run build` e caricare `dist/` sull'hosting di `www.robosect.it`. Controllare `/firma/robosect-firma-logo.png`, la 404, `sitemap-index.xml`, le anteprime social; provare su iPhone e Safari.

La storia del lavoro sul sito (19 commit, dal 23 al 27/10/2026) è rimasta nel repository di lavoro e non serve per andare avanti: il racconto delle scelte è in `07-Sito/riferimenti/BUILD-NOTES.md`.

---

ROBOSECT SRL · spin-off dell'Università di Bologna · Via Lazio 2, 40139 Bologna · P.IVA 04228581205 · consegna del sito, versione 3, 03/11/2026
