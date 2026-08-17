"""
Generates lightweight duotone placeholder photographs in the invitation palette.
Replace the output files in assets/img/ with real wedding photographs of the
same names, dimensions and aspect ratios — no HTML or CSS changes needed.
"""
import math, random
from PIL import Image, ImageDraw, ImageFilter

OUT = "assets/img"
random.seed(19122026)

# Palette: narra wood, pina paper, capiz shell, pine ink, brass
PALETTES = [
    ((28, 51, 48), (247, 244, 236)),   # pine -> pina
    ((43, 30, 25), (226, 224, 213)),   # narra -> capiz
    ((31, 58, 52), (233, 225, 205)),   # deep pine -> warm shell
    ((58, 46, 38), (245, 240, 230)),   # cocoa -> paper
    ((22, 44, 44), (214, 216, 205)),   # teal -> sage shell
]


def blob_field(w, h, seed, blobs=7):
    rnd = random.Random(seed)
    img = Image.new("L", (w // 6, h // 6), 0)
    d = ImageDraw.Draw(img)
    sw, sh = img.size
    for i in range(blobs):
        cx = rnd.uniform(-0.1, 1.1) * sw
        cy = rnd.uniform(-0.1, 1.1) * sh
        r = rnd.uniform(0.18, 0.55) * max(sw, sh)
        val = rnd.randint(90, 255)
        d.ellipse([cx - r, cy - r * rnd.uniform(0.6, 1.4), cx + r, cy + r], fill=val)
    img = img.filter(ImageFilter.GaussianBlur(radius=max(sw, sh) * 0.09))
    return img.resize((w, h), Image.BICUBIC)


def gradient(w, h, angle_deg, seed):
    a = math.radians(angle_deg)
    base = Image.new("L", (w, h))
    px = base.load()
    ca, sa = math.cos(a), math.sin(a)
    denom = abs(w * ca) + abs(h * sa) or 1
    for y in range(h):
        ys = y * sa
        for x in range(w):
            t = (x * ca + ys) / denom
            px[x, y] = int(max(0, min(255, (t + 0.02) * 235)))
    return base


def make(name, w, h, pal_idx, seed, vignette=True):
    dark, light = PALETTES[pal_idx]
    mask = gradient(w, h, 22 + (seed % 40), seed)
    field = blob_field(w, h, seed)
    mask = Image.blend(mask, field, 0.55)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=w * 0.012))

    img = Image.new("RGB", (w, h))
    p = img.load()
    m = mask.load()
    for y in range(h):
        for x in range(w):
            t = m[x, y] / 255.0
            t = t * t * (3 - 2 * t)
            t = t ** 1.75  # weight toward shadow so the tone reads photographic
            p[x, y] = (
                int(dark[0] + (light[0] - dark[0]) * t),
                int(dark[1] + (light[1] - dark[1]) * t),
                int(dark[2] + (light[2] - dark[2]) * t),
            )

    if vignette:
        vg = Image.new("L", (w, h), 0)
        ImageDraw.Draw(vg).ellipse(
            [-w * 0.08, -h * 0.08, w * 1.08, h * 1.08], fill=255
        )
        vg = vg.filter(ImageFilter.GaussianBlur(radius=w * 0.13))
        img = Image.composite(img, Image.new("RGB", (w, h), (24, 20, 17)), vg)

    # fine grain so it reads as photographic paper rather than flat CSS
    grain = Image.effect_noise((w, h), 12).convert("L")
    img = Image.blend(img, Image.merge("RGB", (grain, grain, grain)), 0.045)

    img.save(f"{OUT}/{name}.webp", "WEBP", quality=74, method=6)
    tw = 640
    th = round(h * tw / w)
    img.resize((tw, th), Image.LANCZOS).save(
        f"{OUT}/{name}-640.webp", "WEBP", quality=70, method=6
    )
    print(name, w, h)


# primary photograph (loaded eagerly) + gallery set
make("photo-01", 1200, 1600, 0, 11)   # large portrait
make("photo-02", 900, 1125, 1, 22)
make("photo-03", 900, 1125, 2, 33)
make("photo-04", 1600, 1067, 3, 44)   # large landscape
make("photo-05", 900, 1200, 4, 55)
make("photo-06", 1200, 900, 0, 66)
make("photo-07", 900, 1125, 2, 77)
make("photo-08", 1400, 1050, 1, 88)
