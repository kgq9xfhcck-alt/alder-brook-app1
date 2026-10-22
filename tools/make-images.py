"""Make the art-directed, optimised image set for each animal.

For each photo in images/<id>.jpg (the original download) this writes:
  <id>-square-{480,960}.webp  tight crop for phones (animal page)
  <id>-wide-{800,1200}.webp   3:2 crop with more habitat for tablets (animal page)
  <id>-card-{400,800}.webp    4:3 crop for the animal cards
  <id>.jpg                    re-saved at 1200px wide as the fallback for old browsers
Run from the project folder: python3 tools/make-images.py
"""
from pathlib import Path
from PIL import Image

# Where the animal sits in each photo, as fractions of width and height.
FOCUS = {
    "hedgehog": (0.45, 0.55),
    "red-squirrel": (0.45, 0.50),
    "barn-owl": (0.50, 0.45),
    "otter": (0.55, 0.50),
    "badger": (0.50, 0.50),
    "kingfisher": (0.50, 0.53),
}

def crop(img, ratio, focus):
    """Largest crop of the given width/height ratio, centred on the focus point."""
    w, h = img.size
    cw, ch = (w, round(w / ratio)) if w / h < ratio else (round(h * ratio), h)
    cw, ch = min(cw, w), min(ch, h)
    left = min(max(round(focus[0] * w - cw / 2), 0), w - cw)
    top = min(max(round(focus[1] * h - ch / 2), 0), h - ch)
    return img.crop((left, top, left + cw, top + ch))

def save(img, path, width):
    img = img.resize((width, round(width * img.height / img.width)), Image.LANCZOS)
    img.save(path, "WEBP", quality=72, method=6)

images = Path("images")
for animal, focus in FOCUS.items():
    original = images / f"{animal}.jpg"
    img = Image.open(original).convert("RGB")
    for name, ratio, widths in (("square", 1, (480, 960)), ("wide", 3 / 2, (800, 1200)), ("card", 4 / 3, (400, 800))):
        cropped = crop(img, ratio, focus)
        for width in widths:
            save(cropped, images / f"{animal}-{name}-{width}.webp", min(width, cropped.width))
    if img.width > 1200:
        img = img.resize((1200, round(1200 * img.height / img.width)), Image.LANCZOS)
        img.save(original, "JPEG", quality=78, optimize=True, progressive=True)
    print(animal, "done")
