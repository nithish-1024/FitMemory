import json
import urllib.error
import urllib.request

base = "http://127.0.0.1:8000"

# 1. /health
with urllib.request.urlopen(f"{base}/health") as res:
    data = json.loads(res.read().decode())
    print("1. /health ->", data)
    assert data == {"status": "ok"}

# 2. /kb/search?q=how%20to%20pair%20colors
with urllib.request.urlopen(f"{base}/kb/search?q=how%20to%20pair%20colors") as res:
    data = json.loads(res.read().decode())
    print(f"2. /kb/search returned {len(data)} results:")
    for r in data:
        print(f"   - {r['doc_id']} (score: {r.get('score'):.4f})")
    doc_ids = [r["doc_id"] for r in data]
    assert "kb_color_theory" in doc_ids, "kb_color_theory missing from search results!"

# 3. /wardrobe/arjun
with urllib.request.urlopen(f"{base}/wardrobe/arjun") as res:
    data = json.loads(res.read().decode())
    print(f"3. /wardrobe/arjun returned {len(data)} items")
    assert len(data) == 12

# 4. /wardrobe/sara
with urllib.request.urlopen(f"{base}/wardrobe/sara") as res:
    data = json.loads(res.read().decode())
    print(f"4. /wardrobe/sara returned {len(data)} items")
    assert len(data) == 12

# 5. /photos/arjun_w1.png
with urllib.request.urlopen(f"{base}/photos/arjun_w1.png") as res:
    ct = res.headers.get("content-type")
    body = res.read()
    print(f"5. /photos/arjun_w1.png -> status={res.status}, content-type={ct}, size={len(body)} bytes")
    assert res.status == 200
    assert "image/png" in ct

# 6. /photos/sara_w1.png
with urllib.request.urlopen(f"{base}/photos/sara_w1.png") as res:
    ct = res.headers.get("content-type")
    body = res.read()
    print(f"6. /photos/sara_w1.png -> status={res.status}, content-type={ct}, size={len(body)} bytes")
    assert res.status == 200
    assert "image/png" in ct

# 7. /wardrobe/unknown -> 404
try:
    urllib.request.urlopen(f"{base}/wardrobe/unknown")
    assert False, "Expected 404 for unknown user"
except urllib.error.HTTPError as e:
    print("7. /wardrobe/unknown ->", e.code)
    assert e.code == 404

print("\n=== ALL LIVE HTTP TESTS PASSED 100% ===")
