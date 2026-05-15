from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "store-assets" / "screenshot-1.png"
OUT.parent.mkdir(parents=True, exist_ok=True)

WIDTH, HEIGHT = 1280, 800
image = Image.new("RGB", (WIDTH, HEIGHT), "#dfe6ff")
draw = ImageDraw.Draw(image)

for y in range(HEIGHT):
    ratio = y / HEIGHT
    red = int(226 - 18 * ratio)
    green = int(226 - 12 * ratio)
    blue = int(242 + 8 * ratio)
    draw.line((0, y, WIDTH, y), fill=(red, green, blue))

draw.rounded_rectangle((60, 58, 1220, 742), radius=40, fill=(250, 251, 255), outline=(205, 214, 245))
draw.rounded_rectangle((90, 118, 1190, 712), radius=34, fill=(255, 255, 255), outline=(220, 227, 248))

font_candidates = [
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]
font_path = next((path for path in font_candidates if Path(path).exists()), None)

if font_path:
    title_font = ImageFont.truetype(font_path, 54)
    subtitle_font = ImageFont.truetype(font_path, 28)
    body_font = ImageFont.truetype(font_path, 24)
    small_font = ImageFont.truetype(font_path, 20)
else:
    title_font = ImageFont.load_default()
    subtitle_font = ImageFont.load_default()
    body_font = ImageFont.load_default()
    small_font = ImageFont.load_default()

logo_path = ROOT / "icon-128.png"
if logo_path.exists():
    logo = Image.open(logo_path).convert("RGBA").resize((100, 100))
    image.paste(logo, (118, 105), logo)

accent = "#7494ec"
draw.text((240, 114), "MMCP Connect", font=title_font, fill="#182033")
draw.text((240, 182), "Suivez vos sorties et notifications directement dans Chrome.", font=subtitle_font, fill=accent)
draw.text((120, 250), "Extension officielle MMCP pour consulter rapidement vos sorties, votre session et vos notifications.", font=body_font, fill="#41506f")

draw.rounded_rectangle((120, 320, 720, 690), radius=30, fill=(247, 249, 255), outline=(196, 207, 241), width=2)
draw.rounded_rectangle((146, 346, 694, 426), radius=20, fill=(255, 255, 255), outline=(210, 220, 245))
draw.text((176, 365), "MMCP Connect", font=subtitle_font, fill="#182033")
draw.text((176, 400), "Connecte en tant que artiste@mmcp.fr", font=small_font, fill="#5d6782")

cards = [
    ("Statut de tes sorties", "2 sorties actives", "Validee par MMCP - 26 avril 2026"),
    ("Notifications", "1 notification non lue", "Le statut de ta sortie a avance."),
]
current_y = 450
for title, line1, line2 in cards:
    draw.rounded_rectangle((146, current_y, 694, current_y + 96), radius=20, fill=(255, 255, 255), outline=(214, 223, 247))
    draw.text((170, current_y + 18), title, font=body_font, fill="#1d2740")
    draw.text((170, current_y + 48), line1, font=small_font, fill=accent)
    draw.text((170, current_y + 72), line2, font=small_font, fill="#5d6782")
    current_y += 114

right_x = 800
draw.text((right_x, 340), "Fonctions principales", font=subtitle_font, fill="#182033")
features = [
    "Connexion a votre compte MMCP",
    "Lecture des statuts de sorties",
    "Notifications navigateur automatiques",
    "Design aligne sur le site MMCP",
]
for index, feature in enumerate(features):
    bullet_y = 390 + index * 62
    draw.rounded_rectangle((right_x, bullet_y + 8, right_x + 18, bullet_y + 26), radius=9, fill=accent)
    draw.text((right_x + 32, bullet_y), feature, font=body_font, fill="#41506f")

draw.text((120, 730), "Capture marketing generee pour la fiche Chrome Web Store", font=small_font, fill="#6d7892")
image.save(OUT)
print(f"Generated {OUT}")
