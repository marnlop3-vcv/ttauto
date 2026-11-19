"""ย่อภาพจาก raw/ (ถ่ายด้วย scripts/make-shots-quick.cjs) และ docs/shots/ ไปไว้ที่ img/ สำหรับใส่ในไฟล์ Word"""
from PIL import Image
import os
here = os.path.dirname(os.path.abspath(__file__))
def save(src, name, w=1000, box=None):
    im = Image.open(src).convert('RGB')
    if box: im = im.crop(box)
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(os.path.join(here, 'img', name + '.png'), optimize=True)
    print(name, im.size)
os.makedirs(os.path.join(here, 'img'), exist_ok=True)
for f in os.listdir(os.path.join(here, 'img')): os.remove(os.path.join(here, 'img', f))
raw = lambda n: os.path.join(here, 'raw', n + '.png')
shots = lambda n: os.path.join(here, '..', 'shots', n + '.png')
for n, w in [('q1-open', 760), ('q2-login', 760), ('q2-file', 760), ('q4-teachers', 1100), ('q4-buildings', 1100), ('q5-special', 900), ('q7-run', 1100), ('q8-publish', 1100), ('q9-share', 1100)]:
    save(raw(n), n, w)
save(shots('settings'), 'settings', 1000)
save(shots('assign'), 'assign', 900)
