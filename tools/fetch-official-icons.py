import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

SRC = "tools/official-master.json"
DEST = "public/img/official"
UA = {"User-Agent": "Mozilla/5.0 (pgplus icon fetcher)"}

data = json.load(io.open(SRC, encoding="utf-8"))
chars = [c for c in data if c.get("id") != "_meta"]

plan = []
for c in chars:
    nid = re.sub(r"\d+$", "", c["id"])
    img = c.get("image")
    urls = img if isinstance(img, list) else [img]
    for i, url in enumerate([u for u in urls if u]):
        ext = url.rsplit(".", 1)[-1].split("?")[0].lower()
        plan.append(("%s_%d.%s" % (nid, i, ext), url))

os.makedirs(DEST, exist_ok=True)
total = len(plan)
saved = skipped = failed = 0
errors = []

print("대상 %d개 -> %s" % (total, DEST))

for n, (name, url) in enumerate(plan, 1):
    path = os.path.join(DEST, name)

    if os.path.exists(path) and os.path.getsize(path) > 0:
        skipped += 1
        continue

    body = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as res:
                body = res.read()
            break
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as err:
            if attempt == 2:
                errors.append("%s <- %s (%s)" % (name, url, err))
            else:
                time.sleep(1.5)

    if not body:
        failed += 1
        continue

    with io.open(path, "wb") as handle:
        handle.write(body)

    saved += 1

    if n % 40 == 0 or n == total:
        print("  %d/%d (저장 %d / 건너뜀 %d / 실패 %d)" % (n, total, saved, skipped, failed))

print("")
print("완료: 저장 %d / 건너뜀 %d / 실패 %d" % (saved, skipped, failed))

for line in errors[:10]:
    print("  실패: " + line)

sys.exit(1 if failed else 0)