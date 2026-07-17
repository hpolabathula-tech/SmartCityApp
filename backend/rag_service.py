import os
import re
import math
import pypdf
import docx
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

base_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(base_dir, ".env"))

genai_key = os.getenv("GEMINI_API_KEY")
groq_key = os.getenv("GROQ_API_KEY")
groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

mongo_uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/smartcity_db")
local_fallback_uri = "mongodb://127.0.0.1:27017/smartcity_db"

try:
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000, tls=True, tlsAllowInvalidCertificates=True)
    client.admin.command("ping")
    db = client.get_database()
    print("[DB-RAG] Connected to MongoDB Atlas")
except Exception:
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
        client.admin.command("ping")
        db = client.get_database()
        print("[DB-RAG] Connected to MongoDB Atlas (default TLS)")
    except Exception:
        try:
            client = MongoClient(local_fallback_uri, serverSelectionTimeoutMS=2000)
            client.admin.command("ping")
            db = client.get_database()
            print("[DB-RAG] Connected to local MongoDB fallback")
        except Exception:
            print("[DB-RAG] MongoDB not available. Falling back to mongomock...")
            import mongomock
            client = mongomock.MongoClient()
            db = client.get_database("smartcity_db")


def extract_text_from_pdf(file_path):
    pages_text = []
    try:
        reader = pypdf.PdfReader(file_path)
        for idx, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                pages_text.append({"text": text, "page_num": idx + 1})
    except Exception as e:
        print(f"Error reading PDF {file_path}: {e}")
    return pages_text


def extract_text_from_docx(file_path):
    paragraphs_text = []
    try:
        doc = docx.Document(file_path)
        for idx, para in enumerate(doc.paragraphs):
            text = para.text.strip()
            if text:
                paragraphs_text.append({"text": text, "para_num": idx + 1})
    except Exception as e:
        print(f"Error reading DOCX {file_path}: {e}")
    return paragraphs_text


def extract_text_from_txt(file_path):
    lines_text = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            for idx, line in enumerate(f):
                text = line.strip()
                if text:
                    lines_text.append({"text": text, "line_num": idx + 1})
    except Exception as e:
        print(f"Error reading text file {file_path}: {e}")
    return lines_text


def chunk_extracted_content(extracted_content, file_type, chunk_size=800, chunk_overlap=120):
    chunks = []
    for item in extracted_content:
        text = item["text"]
        meta_key = "page" if file_type == "pdf" else ("paragraph" if file_type == "docx" else "line")
        meta_val = item.get("page_num") or item.get("para_num") or item.get("line_num")
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunks.append({"text": text[start:end], "metadata": {meta_key: meta_val}})
            if end >= len(text):
                break
            start = end - chunk_overlap
            if start <= 0 or start >= end:
                start = end
    return chunks


def generate_embedding(text):
    if not genai_key:
        return None
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={genai_key}"
        res = requests.post(url, json={"content": {"parts": [{"text": text}]}}, timeout=15)
        if res.status_code == 200:
            return res.json()["embedding"]["values"]
        print(f"Embedding API error {res.status_code}: {res.text[:100]}")
        return None
    except Exception as e:
        print(f"Embedding exception: {e}")
        return None


def generate_query_embedding(query_text):
    return generate_embedding(query_text)


def keyword_search(query, top_k=5):
    """Fallback: score chunks by keyword overlap when embeddings are unavailable."""
    query_words = set(re.sub(r'[^\w\s]', '', query.lower()).split())
    stopwords = {'what', 'is', 'the', 'a', 'an', 'of', 'in', 'are', 'for', 'to', 'how', 'do', 'i', 'can', 'me', 'tell', 'about'}
    query_words -= stopwords
    if not query_words:
        return []
    all_chunks = list(db.chunks.find({}, {"text": 1, "filename": 1, "metadata": 1}))
    scored = []
    for c in all_chunks:
        chunk_words = set(re.sub(r'[^\w\s]', '', c["text"].lower()).split())
        overlap = len(query_words & chunk_words)
        if overlap > 0:
            scored.append({"filename": c["filename"], "text": c["text"], "metadata": c["metadata"], "score": overlap / len(query_words)})
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


def cosine_similarity(v1, v2):
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    na = math.sqrt(sum(a * a for a in v1))
    nb = math.sqrt(sum(b * b for b in v2))
    return dot / (na * nb) if na and nb else 0.0


def ingest_document(doc_id, filename, file_path):
    ext = filename.split(".")[-1].lower()
    if ext == "pdf":
        extracted, file_type = extract_text_from_pdf(file_path), "pdf"
    elif ext in ["docx", "doc"]:
        extracted, file_type = extract_text_from_docx(file_path), "docx"
    else:
        extracted, file_type = extract_text_from_txt(file_path), "txt"

    if not extracted:
        return 0

    chunks = chunk_extracted_content(extracted, file_type)
    chunk_docs = []
    for idx, c in enumerate(chunks):
        emb = generate_embedding(c["text"])
        chunk_docs.append({
            "document_id": doc_id,
            "filename": filename,
            "chunk_index": idx,
            "text": c["text"],
            "metadata": c["metadata"],
            "embedding": emb if emb is not None else [0.0] * 768
        })
    if chunk_docs:
        db.chunks.insert_many(chunk_docs)
    return len(chunk_docs)


def _clean_answer(text):
    text = re.sub(r'\*{1,3}(.*?)\*{1,3}', r'\1', text)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'`([^`]*)`', r'\1', text)
    text = re.sub(r'^[-*_]{3,}\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^[\-\*]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _build_fallback_answer(query, valid_chunks):
    lines = [
        "Based on official municipal documents, here is the relevant information:",
        f"Query: {query}",
    ]
    for c in valid_chunks[:3]:
        meta_str = ""
        if "page" in c["metadata"]:
            meta_str = f"Page {c['metadata']['page']}"
        elif "paragraph" in c["metadata"]:
            meta_str = f"Paragraph {c['metadata']['paragraph']}"
        elif "line" in c["metadata"]:
            meta_str = f"Line {c['metadata']['line']}"
        lines.append(f"From {c['filename']} ({meta_str}):")
        lines.append(c['text'].strip())
    lines.append("Note: Please consult the cited source documents for full details.")
    return "\n\n".join(lines)


def generate_groq_completion(prompt):
    if not groq_key:
        return None
    try:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}
        payload = {
            "model": groq_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2
        }
        res = requests.post(url, headers=headers, json=payload, timeout=30)
        if res.status_code == 200:
            return res.json()["choices"][0]["message"]["content"].strip()
        print(f"Groq API error ({res.status_code}): {res.text}")
        return None
    except Exception as e:
        print(f"Groq exception: {e}")
        return None


def translate_answer(text, target_language):
    """Translates answer to target language using Groq."""
    language_names = {
        'hi': 'Hindi',
        'te': 'Telugu',
        'ta': 'Tamil',
        'kn': 'Kannada',
        'es': 'Spanish',
    }
    target_lang_name = language_names.get(target_language)
    if not target_lang_name or not groq_key:
        return text
    try:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}
        payload = {
            "model": groq_model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a professional translator. Translate the given text accurately without adding or removing information. Preserve all citations and source references exactly as they appear."
                },
                {
                    "role": "user",
                    "content": f"Translate the following text to {target_lang_name}:\n\n{text}"
                }
            ],
            "temperature": 0.3
        }
        res = requests.post(url, headers=headers, json=payload, timeout=30)
        if res.status_code == 200:
            translated = res.json()["choices"][0]["message"]["content"].strip()
            print(f"[TRANSLATE] Successfully translated to {target_lang_name}")
            return translated
        print(f"[TRANSLATE] Failed ({res.status_code}): {res.text}")
        return text
    except Exception as e:
        print(f"[TRANSLATE] Exception: {e}")
        return text


def analyze_sentiment(text):
    text_lower = text.lower()
    if any(w in text_lower for w in ['frustrated', 'angry', 'upset', 'annoyed', 'disappointed']):
        return 'frustrated'
    neg = sum(1 for w in ['sorry', 'error', 'failed', 'cannot', 'unable', 'problem', 'unfortunately'] if w in text_lower)
    pos = sum(1 for w in ['great', 'excellent', 'helpful', 'successfully', 'good', 'perfect', 'wonderful'] if w in text_lower)
    if neg > pos:
        return 'negative'
    elif pos > neg:
        return 'positive'
    return 'neutral'


def generate_follow_up_suggestions(query, answer):
    suggestions = []
    q = query.lower()
    a = answer.lower()
    if 'waste' in q or 'waste' in a:
        suggestions += ['What are the waste collection timings?', 'How do I report improper waste disposal?']
    if 'transport' in q or 'traffic' in q or 'vehicle' in a:
        suggestions += ['What are the traffic rules in my area?', 'How do I apply for a vehicle permit?']
    if 'utility' in q or 'water' in q or 'electricity' in q:
        suggestions += ['How do I report a utility issue?', 'What are the utility payment methods?']
    if 'regulation' in q or 'rule' in q:
        suggestions += ['Where can I find the complete regulations?', 'How do I file a complaint?']
    if not suggestions:
        suggestions = ['Can you provide more details?', 'Are there any related regulations?']
    return suggestions[:2]


def query_rag_pipeline(query, conversation_history=None, user_language="en", top_k=5):
    if conversation_history is None:
        conversation_history = []

    query_emb = generate_query_embedding(query)
    
    # If embedding failed (API key invalid/expired), fall back to keyword search
    if query_emb is None:
        print("[RAG] Embedding unavailable, using keyword search fallback")
        valid_chunks = keyword_search(query, top_k)
        best_score = valid_chunks[0]["score"] if valid_chunks else 0
    else:
        all_chunks = list(db.chunks.find({}, {"embedding": 1, "text": 1, "filename": 1, "metadata": 1}))

        if not all_chunks:
            return {
                "answer": "No city documents have been uploaded yet. Please contact the administrator.",
                "citations": [], "confidence": 0, "sentiment": "neutral", "follow_up_suggestions": []
            }

        scored_chunks = sorted([
            {"filename": c["filename"], "text": c["text"], "metadata": c["metadata"],
             "score": cosine_similarity(query_emb, c["embedding"])}
            for c in all_chunks
        ], key=lambda x: x["score"], reverse=True)

        valid_chunks = [c for c in scored_chunks[:top_k] if c["score"] > 0.2]
        best_score = valid_chunks[0]["score"] if valid_chunks else 0

    casual_keywords = ['ok', 'thanks', 'thank you', 'hi', 'hello', 'hey', 'bye', 'goodbye',
                       'yes', 'no', 'sure', 'cool', 'nice', 'good', 'great', 'awesome', 'lol', 'haha']
    is_casual = query.lower().strip() in casual_keywords or len(query.split()) <= 2

    if not valid_chunks and not is_casual:
        return {
            "answer": "I cannot find any relevant information in the uploaded official documents to answer your question.",
            "citations": [], "confidence": 0, "sentiment": "neutral", "follow_up_suggestions": []
        }

    confidence_percentage = int(min(max(best_score * 100, 10), 99)) if valid_chunks else 0

    context_str = ""
    for c in valid_chunks:
        meta = c["metadata"]
        meta_str = f"Page {meta['page']}" if "page" in meta else f"Paragraph {meta['paragraph']}" if "paragraph" in meta else f"Line {meta['line']}" if "line" in meta else ""
        context_str += f"Source: {c['filename']} ({meta_str})\nContent: {c['text']}\n\n"

    conversation_context = ""
    if conversation_history:
        conversation_context = "\nPrevious conversation:\n"
        for msg in conversation_history[-5:]:
            conversation_context += f"{msg.get('role','user').capitalize()}: {msg.get('content','')}\n"

    prompt = f"""You are the official Smart City AI Knowledge Assistant. Answer citizen queries about city regulations, civic services, waste management, transportation, and public utilities.

Rules:
1. Answer ONLY from the provided Context below.
2. Write in plain prose. No markdown.
3. Use numbered lists only for steps or items.
4. Cite sources inline: (source: filename, page X)
5. If context lacks the answer, say: I cannot find the answer in the uploaded official documents.
6. Keep answers concise, factual, and professional.
7. For casual greetings, respond naturally.
8. Use conversation history for context.

Context:
{context_str if context_str else "No specific documents found for this query."}
{conversation_context}

Question: {query}

Answer:"""

    try:
        answer = generate_groq_completion(prompt) if groq_key else None

        if answer is None:
            if not genai_key:
                answer = "Error: No API keys configured."
            else:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={genai_key}"
                res = requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=30)
                if res.status_code == 200:
                    answer = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                else:
                    answer = _build_fallback_answer(query, valid_chunks) if valid_chunks else "I'm here to help!"
    except Exception as e:
        print(f"LLM exception: {e}")
        answer = _build_fallback_answer(query, valid_chunks) if valid_chunks else "I'm here to help!"

    answer = _clean_answer(answer)

    if user_language and user_language != 'en':
        print(f"[RAG] Translating answer to {user_language}")
        answer = translate_answer(answer, user_language)

    citations = []
    if best_score > 0.5 and valid_chunks:
        for c in valid_chunks:
            meta = c["metadata"]
            meta_label = f"p. {meta['page']}" if "page" in meta else f"para. {meta['paragraph']}" if "paragraph" in meta else f"line {meta['line']}" if "line" in meta else ""
            citations.append({
                "filename": c["filename"],
                "meta": meta_label,
                "text_excerpt": c["text"][:150] + "..." if len(c["text"]) > 150 else c["text"]
            })

    return {
        "answer": answer,
        "citations": citations,
        "confidence": confidence_percentage,
        "sentiment": analyze_sentiment(answer),
        "follow_up_suggestions": generate_follow_up_suggestions(query, answer)
    }
