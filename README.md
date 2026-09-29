# FitMemory

AI Wardrobe Assistant with Persistent Memory.

## Tech Stack

- **Monorepo**:
  - `/frontend`: Next.js 14 (App Router, TypeScript, Tailwind CSS)
  - `/backend`: FastAPI (Python 3.11+), Pydantic v2, Uvicorn, Groq LLM (`openai/gpt-oss-120b`), Hindsight (Vectorize) Memory SDK

---

## Getting Started

### 1. Backend Setup & Run

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python 3.11+ virtual environment:
   ```bash
   # Using uv (recommended)
   uv venv .venv --python 3.11
   .venv\Scripts\activate   # Windows
   # source .venv/bin/activate  # macOS / Linux

   # Install dependencies
   uv pip install -r requirements.txt
   ```

3. Ensure `.env` is configured (see `.env.example`):
   ```env
   HINDSIGHT_API_KEY=your_hindsight_api_key
   HINDSIGHT_API_URL=https://api.hindsight.vectorize.io
   GROQ_API_KEY=your_groq_api_key
   GROQ_MODEL=openai/gpt-oss-120b
   USER_BANK_PREFIX=user_
   ```

4. Start the backend server:
   ```bash
   # When testing, run without --reload
   uvicorn main:app --host 127.0.0.1 --port 8000
   ```
   On startup:
   - Placeholder PNG images are automatically generated in `backend/data/photos/` if missing and mounted at `/photos`.
   - The `fashion_kb` knowledge base bank is automatically and idempotently seeded in Hindsight.

5. Run test verification:
   ```bash
   python test_server.py
   python test_prompt2.py
   ```

### 2. Frontend Setup & Run

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   Visit [http://localhost:3000](http://localhost:3000) to view the scaffolded placeholder.

---

## API Endpoints

- `GET /health` → `{"status": "ok"}`
- `GET /kb/search?q=<query>` → `[{"doc_id": "...", "content": "...", "score": 0.47}]`
- `GET /wardrobe/{user_id}` → Full wardrobe JSON array for the specified user (e.g. `arjun`, `sara`), 404 for unknown user.
- `GET /photos/{id}.png` → Serves generated solid-color placeholder wardrobe item image (400x500 PNG).
- `GET /profile/{user_id}` → Returns user profile document `{"preferences": [], "mood_flags": 0}` from Hindsight.
- `POST /recommend` → Returns AI outfit recommendation with 2-4 items, 2-sentence reasoning, attributes used, fashion rules applied, and image URL.
- `POST /feedback` → Submits feedback (`accept` or `reject`). Supports 2-phase probe and clarification flow for multi-category rejections, updates running preference averages, and flags mood states.
- `GET /feedback-log/{user_id}?limit=20` → Returns recent feedback interaction logs, sorted newest first.
- `GET /memory/{user_id}` → Returns interpreted memory viewer profile (parsed preferences with strength buckets, recent activity, and summary sentence). 404 for unknown user.

---

## Fashion Knowledge Base

The fashion knowledge base (`fashion_kb` bank in Hindsight) powers outfit styling rationale and attribute pairing rules:
- **Foundational Styling Rules (6 docs)**: Color theory (60-30-10, neutral anchors), silhouettes & proportions, Japanese traditional color harmonies, texture mixing, formality scaling, and seasonal layering.
- **Extended Literature**: Fashion knowledge base includes 1 PDF document covering color theory and psychology, high/low fashion mixing, subcultures (beatniks, punks, grunge, normcore), military and utilitarian workwear origins, silhouettes, and enclothed cognition.
  - Chunked into 177 self-contained segments (~300–600 words each) with metadata (`source: dress_code`, `type: fashion_knowledge`, `chunk: <index>`) and seeded idempotently on server startup.

---

## Curl Examples for `/recommend`

### 1. Basic Recommendation (Arjun)
```bash
curl -X POST http://127.0.0.1:8000/recommend \
  -H "Content-Type: application/json" \
  -d '{"user_id": "arjun"}'
```

### 2. Recommendation with Excluded Outfits
```bash
curl -X POST http://127.0.0.1:8000/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "arjun",
    "exclude": [["arjun_w9", "arjun_w5", "arjun_w7"]]
  }'
```

### 3. Recommendation for Sara
```bash
curl -X POST http://127.0.0.1:8000/recommend \
  -H "Content-Type: application/json" \
  -d '{"user_id": "sara"}'
```

### Sample Response (`POST /recommend`)
```json
{
  "user_id": "arjun",
  "item_ids": ["arjun_w1", "arjun_w4", "arjun_w7"],
  "items": [
    {
      "id": "arjun_w1",
      "name": "Indigo crew-neck tee",
      "photo": "/photos/arjun_w1.png",
      "attributes": {
        "color": "indigo",
        "type": "tshirt",
        "fit": "regular",
        "texture": "cotton",
        "palette": "cool_neutral",
        "formality": 3
      }
    },
    {
      "id": "arjun_w4",
      "name": "Beige wide-leg trousers",
      "photo": "/photos/arjun_w4.png",
      "attributes": {
        "color": "beige",
        "type": "trousers",
        "fit": "wide_leg",
        "texture": "cotton_twill",
        "palette": "warm_neutral",
        "formality": 3
      }
    },
    {
      "id": "arjun_w7",
      "name": "Minimalist white sneakers",
      "photo": "/photos/arjun_w7.png",
      "attributes": {
        "color": "white",
        "type": "shoes",
        "fit": "regular",
        "texture": "leather",
        "palette": "neutral",
        "formality": 2
      }
    }
  ],
  "reasoning": "We applied the 60-30-10 color theory rule with beige as the neutral base, indigo as the secondary shade, and white as the accent. The silhouette balances fitted proportions with relaxed wide-leg trousers.",
  "attributes_used": {
    "color": ["indigo", "beige", "white"],
    "type": ["tshirt", "trousers", "shoes"],
    "fit": ["regular", "wide_leg"],
    "texture": ["cotton", "cotton_twill", "leather"]
  },
  "kb_rules_used": ["kb_color_theory", "kb_proportion", "kb_japanese_pairings"],
  "profile_applied": false,
  "image_prompt": "Editorial fashion photography of a model wearing an indigo crew-neck tee and beige wide-leg trousers with white sneakers in daylight.",
  "image_url": "https://image.pollinations.ai/prompt/Editorial%20fashion%20photography...?width=768&height=1024&nologo=true",
  "used_fallback": false
}
```

---

## Curl Examples for `/feedback` and `/feedback-log`

### 1. Accept Outfit
```bash
curl -X POST http://127.0.0.1:8000/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "arjun",
    "item_ids": ["arjun_w1", "arjun_w4", "arjun_w7"],
    "action": "accept",
    "attributes_used": {
      "color": ["indigo"],
      "type": ["tshirt"]
    }
  }'
```

### 2. Reject with Multi-Category Clarification Probe
```bash
curl -X POST http://127.0.0.1:8000/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "arjun",
    "item_ids": ["arjun_w1", "arjun_w4"],
    "action": "reject",
    "attributes_used": {
      "color": ["indigo"],
      "type": ["tshirt"]
    }
  }'
```

### 3. Reject with Clarification Option Selected
```bash
curl -X POST http://127.0.0.1:8000/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "arjun",
    "item_ids": ["arjun_w1", "arjun_w4"],
    "action": "reject",
    "attributes_used": {
      "color": ["indigo"],
      "type": ["tshirt"]
    },
    "clarification": "color"
  }'
```

### 4. Fetch User Feedback Log
```bash
curl http://127.0.0.1:8000/feedback-log/arjun?limit=20
```

---

## Curl Example for `/memory`

### Memory Viewer Profile (Arjun)
```bash
curl http://127.0.0.1:8000/memory/arjun
```

### Sample Response (`GET /memory/arjun`)
```json
{
  "user_id": "arjun",
  "preferences": [
    {
      "category": "type",
      "value": "tshirt",
      "direction": "likes",
      "label": "Likes tshirt (type)",
      "confidence": 0.33,
      "strength": "moderate",
      "evidence": 1
    },
    {
      "category": "color",
      "value": "crimson",
      "direction": "avoids",
      "label": "Avoids crimson (color)",
      "confidence": 0.33,
      "strength": "moderate",
      "evidence": 1
    }
  ],
  "mood_flags": 0,
  "recent_activity": [
    {
      "timestamp": "2026-09-29T03:36:45.123456+00:00",
      "item_ids": ["arjun_w2", "arjun_w3"],
      "action": "reject",
      "clarification": "color",
      "attributes_used": {
        "color": ["crimson"],
        "fit": ["regular"]
      },
      "reasoning": "Learned: dislikes color:crimson"
    }
  ],
  "summary": "2 learned preferences, 0 strong."
}
```
