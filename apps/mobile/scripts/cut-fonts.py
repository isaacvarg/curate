"""Cuts the app's static font files from the OFL variable fonts in google/fonts.

React Native can't set variable-font axes, so DESIGN.md's Fraunces at "SOFT" 50, "WONK" 0 is baked
into static instances here, along with the weights DESIGN.md's type styles use. Each instance gets its
own family and PostScript name so iOS and Android register them separately.

Run it again only when DESIGN.md changes Fraunces' axes or the type styles' weights:

    python3 -m venv /tmp/fonts && /tmp/fonts/bin/pip install fonttools
    /tmp/fonts/bin/python apps/mobile/scripts/cut-fonts.py <dir with the three variable fonts>

The variable fonts come from google/fonts at the commit below: ofl/fraunces/Fraunces[SOFT,WONK,opsz,wght].ttf,
ofl/fraunces/Fraunces-Italic[SOFT,WONK,opsz,wght].ttf and ofl/figtree/Figtree[wght].ttf.
"""

import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

GOOGLE_FONTS_COMMIT = "e7db6ca603fd4862010383ff17ffd6cc4ffac1c0"

# Fraunces' optical size is fixed per file: 24 suits the upright styles (16 to 40pt) and 14 the
# italic ones (12 to 20pt).
INSTANCES = [
    ("Fraunces.ttf", "Fraunces-Regular", {"wght": 400, "opsz": 24, "SOFT": 50, "WONK": 0}),
    ("Fraunces.ttf", "Fraunces-Book", {"wght": 450, "opsz": 24, "SOFT": 50, "WONK": 0}),
    ("Fraunces.ttf", "Fraunces-Medium", {"wght": 500, "opsz": 24, "SOFT": 50, "WONK": 0}),
    ("Fraunces-Italic.ttf", "Fraunces-Italic", {"wght": 400, "opsz": 14, "SOFT": 50, "WONK": 0}),
    ("Figtree.ttf", "Figtree-Regular", {"wght": 400}),
    ("Figtree.ttf", "Figtree-SemiBold", {"wght": 600}),
]


def rename(font: TTFont, name: str) -> None:
    family = name.replace("-", " ")
    table = font["name"]
    for record in list(table.names):
        if record.nameID in (16, 17, 21, 22, 25):
            table.removeNames(nameID=record.nameID)
    for name_id, value in ((1, family), (2, "Regular"), (3, f"{name};{GOOGLE_FONTS_COMMIT[:7]}"), (4, family), (6, name)):
        table.setName(value, name_id, 3, 1, 0x409)
        table.setName(value, name_id, 1, 0, 0)


def main(source: Path) -> None:
    out = Path(__file__).resolve().parent.parent / "assets" / "fonts"
    out.mkdir(parents=True, exist_ok=True)
    for file, name, axes in INSTANCES:
        font = instantiateVariableFont(TTFont(source / file), axes, updateFontNames=False)
        if "DSIG" in font:
            del font["DSIG"]
        rename(font, name)
        font.save(out / f"{name}.ttf")
        print(f"{name}.ttf")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
