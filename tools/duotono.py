"""Le tre foto delle card «Also for you» in duotono inchiostro -> blu -> carta (scelta C di Alex, 18/11/2026).

Stesso trattamento del filtro SVG `#duo` della lavagna (my-work-history, projects/brand-sito/disegno/tre-foto/carte.mjs):
grigio = media di R, G, B; poi per ogni canale una tabella lineare a tre punti (0 -> 0.5 -> 1), in sRGB.
Ogni foto è tagliata al centro a 16:9, come la mostra la card. Da lanciare dalla radice della repo:
    python tools/duotono.py
"""
from pathlib import Path

from PIL import Image

IMG = Path('src/assets/images')
OUT = IMG / 'home'
TAB = {  # inchiostro, blu, carta
    'R': (0.051, 0.141, 0.957),
    'G': (0.106, 0.314, 0.945),
    'B': (0.180, 0.561, 0.925),
}
FOTO = {
    'img_intro.png': 'duo-harness.jpg',
    'home/demo-dresspack.jpg': 'duo-cell.jpg',
    'home/demo-two-probes.jpg': 'duo-other.jpg',
}


def lut(t: tuple[float, float, float]) -> list[int]:
    out = []
    for v in range(256):
        x = v / 255
        a, b, k = (t[0], t[1], x / 0.5) if x <= 0.5 else (t[1], t[2], (x - 0.5) / 0.5)
        out.append(round((a + (b - a) * k) * 255))
    return out


def taglio_16_9(im: Image.Image) -> Image.Image:
    w, h = im.size
    if w / h > 16 / 9:
        nw = round(h * 16 / 9)
        return im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    nh = round(w * 9 / 16)
    return im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))


for src, dst in FOTO.items():
    im = taglio_16_9(Image.open(IMG / src).convert('RGB'))
    # media semplice dei tre canali, come la matrice .33 .33 .33 del filtro
    gr = im.convert('L', (1 / 3, 1 / 3, 1 / 3, 0))
    duo = Image.merge('RGB', tuple(gr.point(lut(TAB[c])) for c in 'RGB'))
    duo.save(OUT / dst, quality=88, optimize=True, progressive=True)
    print(dst, duo.size)
