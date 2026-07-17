import os
import re
import datetime
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
import bcrypt
import jwt
from dotenv import load_dotenv

# Load environment using absolute path before importing RAG service
base_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(base_dir, ".env")
load_dotenv(dotenv_path=env_path)

# Import RAG services
from rag_service import ingest_document, query_rag_pipeline

app = Flask(__name__)
CORS(app, resources={r"/api/*": {
    "origins": "*",
    "allow_headers": ["Content-Type", "Authorization"],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "expose_headers": ["Authorization"]
}})


# Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "smartcity_secret_key_2026_huebits")
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# MongoDB client (supports both local and Atlas SRV URIs)
mongo_uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/smartcity_db")
local_fallback_uri = "mongodb://127.0.0.1:27017/smartcity_db"
db = None

def _try_connect(uri, **kwargs):
    c = MongoClient(uri, serverSelectionTimeoutMS=2000, **kwargs)
    c.admin.command("ping")
    return c

# Verify connection on startup — try Atlas with TLS workarounds, then local
try:
    client = _try_connect(mongo_uri, tls=True, tlsAllowInvalidCertificates=True)
    print(f"[DB] Successfully connected to MongoDB Atlas.")
    db = client.get_database()
except Exception as e1:
    print(f"[DB] Atlas TLS attempt failed: {e1}")
    try:
        client = _try_connect(mongo_uri)
        print(f"[DB] Successfully connected to MongoDB Atlas (default TLS).")
        db = client.get_database()
    except Exception as e2:
        print(f"[DB] WARNING: Could not connect to Atlas: {e2}")
        try:
            print(f"[DB] Trying local MongoDB fallback at {local_fallback_uri}...")
            client = _try_connect(local_fallback_uri)
            print(f"[DB] Successfully connected to local MongoDB.")
            db = client.get_database()
        except Exception as e3:
            print(f"[DB] ERROR: Local MongoDB fallback also failed: {e3}")
            print("[DB] Falling back to mongomock in-memory MongoDB...")
            import mongomock
            client = mongomock.MongoClient()
            db = client.get_database("smartcity_db")

if db is None:
    raise SystemExit("[DB] No MongoDB connection available. Set MONGO_URI or start local MongoDB.")

# Helper: Seed default users and documents on startup
def seed_users():
    print("Checking users collection...")
    users_col = db.users
    
    # Check if admin user exists
    admin = users_col.find_one({"email": "admin@smartcity.gov"})
    if not admin:
        print("Seeding admin user...")
        hashed_password = bcrypt.hashpw("admin123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        users_col.insert_one({
            "name": "City Administrator",
            "email": "admin@smartcity.gov",
            "password": hashed_password,
            "role": "admin",
            "date_created": datetime.datetime.utcnow()
        })
        
    # Check if default citizen user exists
    citizen = users_col.find_one({"email": "citizen@smartcity.gov"})
    if not citizen:
        print("Seeding citizen user...")
        hashed_password = bcrypt.hashpw("citizen123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        users_col.insert_one({
            "name": "Jane Doe (Citizen)",
            "email": "citizen@smartcity.gov",
            "password": hashed_password,
            "role": "citizen",
            "date_created": datetime.datetime.utcnow()
        })
        
    # Initialize stats if not present
    stats_col = db.system_stats
    if not stats_col.find_one({"type": "counters"}):
        stats_col.insert_one({
            "type": "counters",
            "query_count": 0,
            "satisfaction_rate": 98.2
        })

    # Seed default documents if none exist
    docs_col = db.documents
    if docs_col.count_documents({}) == 0:
        print("Seeding default documents...")
        import shutil
        seed_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_docs")
        if os.path.exists(seed_dir):
            for filename in os.listdir(seed_dir):
                src_path = os.path.join(seed_dir, filename)
                dest_path = os.path.join(UPLOAD_FOLDER, filename)
                try:
                    shutil.copy(src_path, dest_path)
                    doc_meta = {
                        "name": filename,
                        "path": dest_path,
                        "status": "Processing",
                        "size": os.path.getsize(dest_path),
                        "vectorCount": 0,
                        "date": datetime.datetime.utcnow().strftime("%b %d, %I:%M %p")
                    }
                    doc_id = docs_col.insert_one(doc_meta).inserted_id
                    
                    # Ingest and index
                    chunks_indexed = ingest_document(str(doc_id), filename, dest_path)
                    if chunks_indexed > 0:
                        docs_col.update_one(
                            {"_id": doc_id},
                            {"$set": {"status": "Indexed", "vectorCount": chunks_indexed}}
                        )
                        print(f"Successfully seeded and indexed {filename} ({chunks_indexed} vectors)")
                    else:
                        docs_col.update_one(
                            {"_id": doc_id},
                            {"$set": {"status": "Error", "error_message": "No indexable content found"}}
                        )
                except Exception as e:
                    print(f"Failed to seed document {filename}: {e}")

# Call seeding
seed_users()

# JWT Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Look for authorization header
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                
        if not token:
            return jsonify({"message": "Token is missing"}), 401
            
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            # Fetch user from db
            current_user = db.users.find_one({"_id": ObjectId(data["user_id"])})
            if not current_user:
                return jsonify({"message": "User not found"}), 401
            if current_user.get("banned"):
                return jsonify({"message": "Your account has been suspended"}), 403
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token has expired"}), 401
        except Exception as e:
            return jsonify({"message": f"Token is invalid: {e}"}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

# Admin Decorator
def admin_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if current_user.get("role") != "admin":
            return jsonify({"message": "Admin access required"}), 403
        return f(current_user, *args, **kwargs)
    return decorated

# Login attempt tracking (in-memory)
login_attempts = {}
LOCKOUT_THRESHOLD = 5
LOCKOUT_DURATION = 30  # seconds

# --- AUTH ROUTES ---

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password") or not data.get("name"):
        return jsonify({"message": "Missing required fields"}), 400

    email = data["email"].strip().lower()
    name = data["name"].strip()
    password = data["password"]

    if len(name) < 2:
        return jsonify({"message": "Name must be at least 2 characters"}), 400
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        return jsonify({"message": "Invalid email address"}), 400
    if len(password) < 8:
        return jsonify({"message": "Password must be at least 8 characters"}), 400

    if db.users.find_one({"email": email}):
        return jsonify({"message": "User already exists"}), 400

    hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db.users.insert_one({
        "name": name,
        "email": email,
        "password": hashed_password,
        "role": "citizen",
        "date_created": datetime.datetime.utcnow()
    })
    return jsonify({"message": "User registered successfully"}), 201

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"message": "Missing email or password"}), 400

    email = data["email"].strip().lower()
    ip = request.remote_addr
    key = f"{ip}:{email}"
    now = datetime.datetime.utcnow()

    # Check lockout
    if key in login_attempts:
        attempts, last_time = login_attempts[key]
        if attempts >= LOCKOUT_THRESHOLD:
            elapsed = (now - last_time).total_seconds()
            if elapsed < LOCKOUT_DURATION:
                wait = int(LOCKOUT_DURATION - elapsed)
                return jsonify({"message": f"Too many failed attempts. Try again in {wait}s."}), 429
            else:
                login_attempts.pop(key, None)

    user = db.users.find_one({"email": email})
    if not user or not bcrypt.checkpw(data["password"].encode("utf-8"), user["password"].encode("utf-8")):
        attempts = login_attempts.get(key, (0, now))[0] + 1
        login_attempts[key] = (attempts, now)
        return jsonify({"message": "Invalid email or password"}), 401

    login_attempts.pop(key, None)
    token = jwt.encode({
        "user_id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }, JWT_SECRET, algorithm="HS256")

    return jsonify({
        "token": token,
        "user": {"name": user["name"], "email": user["email"], "role": user["role"]}
    }), 200

# --- CITIZEN & GENERAL RAG ROUTES ---

@app.route("/api/citizen/query", methods=["POST"])
@token_required
def query(current_user):
    data = request.get_json()
    if not data or not data.get("query"):
        return jsonify({"message": "Missing query field"}), 400
        
    query_text = data["query"]
    conversation_history = data.get("conversation_history", [])
    user_language = data.get("language", "en")
    print(f"[QUERY API] Received query: {query_text} in language: {user_language}", flush=True)
    
    db.system_stats.update_one({"type": "counters"}, {"$inc": {"query_count": 1}})
    
    try:
        from rag_service import groq_key, genai_key, groq_model
        print(f"[QUERY API] Keys status - Groq Key configured: {groq_key is not None}, Gemini Key configured: {genai_key is not None}", flush=True)
        result = query_rag_pipeline(query_text, conversation_history, user_language)
        print(f"[QUERY API] Result answer preview: {result.get('answer')[:100]}...", flush=True)
    except Exception as e:
        print(f"[QUERY API] Error executing query pipeline: {e}", flush=True)
        return jsonify({"message": f"Pipeline error: {e}"}), 500
    
    db.query_activity.insert_one({
        "user_id": str(current_user["_id"]),
        "query": query_text,
        "confidence": result["confidence"],
        "timestamp": datetime.datetime.utcnow()
    })
    
    return jsonify(result), 200

# --- CITIZEN HISTORY ROUTE ---

@app.route("/api/citizen/history", methods=["GET"])
@token_required
def get_citizen_history(current_user):
    limit = int(request.args.get("limit", 20))
    records = list(
        db.query_activity.find(
            {"user_id": str(current_user["_id"])},
            {"_id": 0, "query": 1, "confidence": 1, "timestamp": 1}
        ).sort("timestamp", -1).limit(limit)
    )
    for r in records:
        if "timestamp" in r:
            r["timestamp"] = r["timestamp"].strftime("%b %d, %I:%M %p")
    return jsonify(records), 200

@app.route("/api/citizen/saved-queries", methods=["POST"])
@token_required
def save_query(current_user):
    data = request.get_json()
    if not data or not data.get("query"):
        return jsonify({"message": "Missing query field"}), 400
    
    db.saved_queries.insert_one({
        "user_id": str(current_user["_id"]),
        "query": data["query"],
        "timestamp": datetime.datetime.utcnow()
    })
    return jsonify({"message": "Query saved successfully"}), 201

@app.route("/api/citizen/saved-queries", methods=["GET"])
@token_required
def get_saved_queries(current_user):
    queries = list(db.saved_queries.find(
        {"user_id": str(current_user["_id"])},
        {"_id": 1, "query": 1, "timestamp": 1}
    ).sort("timestamp", -1))
    for q in queries:
        q["_id"] = str(q["_id"])
    return jsonify(queries), 200

@app.route("/api/citizen/saved-queries/<query_id>", methods=["DELETE"])
@token_required
def delete_saved_query(current_user, query_id):
    db.saved_queries.delete_one({"_id": ObjectId(query_id), "user_id": str(current_user["_id"])})
    return jsonify({"message": "Query deleted successfully"}), 200

@app.route("/api/citizen/feedback", methods=["POST"])
@token_required
def submit_feedback(current_user):
    data = request.get_json()
    if not data or not data.get("message_id"):
        return jsonify({"message": "Missing message_id field"}), 400
    
    db.feedback.insert_one({
        "user_id": str(current_user["_id"]),
        "message_id": data["message_id"],
        "rating": data.get("rating", 0),
        "feedback": data.get("feedback", ""),
        "timestamp": datetime.datetime.utcnow()
    })
    return jsonify({"message": "Feedback submitted successfully"}), 201

@app.route("/api/admin/documents", methods=["GET"])
@token_required
@admin_required
def list_documents(current_user):
    docs = list(db.documents.find({}))
    for doc in docs:
        doc["_id"] = str(doc["_id"])
    return jsonify(docs), 200

@app.route("/api/admin/upload", methods=["POST"])
@token_required
@admin_required
def upload_document(current_user):
    if "file" not in request.files:
        return jsonify({"message": "No file uploaded"}), 400
        
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"message": "No selected file"}), 400
        
    filename = file.filename
    file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(file_path)
    
    # Register document metadata
    doc_meta = {
        "name": filename,
        "path": file_path,
        "status": "Processing",
        "size": os.path.getsize(file_path),
        "vectorCount": 0,
        "date": datetime.datetime.utcnow().strftime("%b %d, %I:%M %p")
    }
    
    doc_id = db.documents.insert_one(doc_meta).inserted_id
    
    # Run RAG ingestion
    try:
        chunks_indexed = ingest_document(str(doc_id), filename, file_path)
        if chunks_indexed > 0:
            db.documents.update_one(
                {"_id": doc_id},
                {"$set": {"status": "Indexed", "vectorCount": chunks_indexed}}
            )
        else:
            db.documents.update_one(
                {"_id": doc_id},
                {"$set": {"status": "Error", "error_message": "No indexable content found"}}
            )
    except Exception as e:
        print(f"Ingestion failed: {e}")
        db.documents.update_one(
            {"_id": doc_id},
            {"$set": {"status": "Error", "error_message": str(e)}}
        )
        return jsonify({"message": f"File uploaded but indexing failed: {e}"}), 500
        
    return jsonify({"message": "Document uploaded and indexed successfully", "doc_id": str(doc_id)}), 201

@app.route("/api/admin/documents/<doc_id>", methods=["DELETE"])
@token_required
@admin_required
def delete_document(current_user, doc_id):
    # Retrieve file path
    doc = db.documents.find_one({"_id": ObjectId(doc_id)})
    if not doc:
        return jsonify({"message": "Document not found"}), 404
        
    # Delete uploaded file from storage
    if os.path.exists(doc["path"]):
        try:
            os.remove(doc["path"])
        except Exception as e:
            print(f"Failed to remove file from disk: {e}")
            
    # Delete from documents database and chunks database
    db.documents.delete_one({"_id": ObjectId(doc_id)})
    db.chunks.delete_many({"document_id": doc_id})
    
    return jsonify({"message": "Document and associated vectors deleted successfully"}), 200

# --- ADMIN ANALYTICS ROUTE ---

@app.route("/api/admin/analytics", methods=["GET"])
@token_required
@admin_required
def get_analytics(current_user):
    # Top queries
    pipeline = [
        {"$group": {"_id": "$query", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    top_queries = [{
        "query": r["_id"], "count": r["count"]
    } for r in db.query_activity.aggregate(pipeline)]

    # Queries per hour (last 24h)
    since = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
    hourly_pipeline = [
        {"$match": {"timestamp": {"$gte": since}}},
        {"$group": {"_id": {"$hour": "$timestamp"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    hourly = {r["_id"]: r["count"] for r in db.query_activity.aggregate(hourly_pipeline)}
    peak_hours = [hourly.get(h, 0) for h in range(24)]

    # Topic distribution
    all_queries = [r["query"] for r in db.query_activity.find({}, {"query": 1})]
    topics = {"Waste": 0, "Transport": 0, "Utilities": 0, "Regulations": 0, "Other": 0}
    for q in all_queries:
        q_lower = q.lower()
        if any(w in q_lower for w in ["waste", "garbage", "trash"]):
            topics["Waste"] += 1
        elif any(w in q_lower for w in ["transport", "bus", "vehicle", "traffic"]):
            topics["Transport"] += 1
        elif any(w in q_lower for w in ["water", "electricity", "utility"]):
            topics["Utilities"] += 1
        elif any(w in q_lower for w in ["regulation", "rule", "law", "fee", "certificate"]):
            topics["Regulations"] += 1
        else:
            topics["Other"] += 1

    return jsonify({"top_queries": top_queries, "peak_hours": peak_hours, "topics": topics}), 200

# --- ADMIN USER MANAGEMENT ROUTES ---

@app.route("/api/admin/users", methods=["GET"])
@token_required
@admin_required
def get_users(current_user):
    users = list(db.users.find({}, {"password": 0}))
    for u in users:
        u["_id"] = str(u["_id"])
        if "date_created" in u:
            u["date_created"] = u["date_created"].strftime("%b %d, %Y")
        u["banned"] = u.get("banned", False)
    return jsonify(users), 200

@app.route("/api/admin/users/<user_id>/ban", methods=["POST"])
@token_required
@admin_required
def toggle_ban_user(current_user, user_id):
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"message": "User not found"}), 404
    if user.get("role") == "admin":
        return jsonify({"message": "Cannot ban admin users"}), 403
    new_status = not user.get("banned", False)
    db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"banned": new_status}})
    return jsonify({"message": "User banned" if new_status else "User unbanned", "banned": new_status}), 200

@app.route("/api/admin/users/<user_id>", methods=["DELETE"])
@token_required
@admin_required
def delete_user(current_user, user_id):
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"message": "User not found"}), 404
    if user.get("role") == "admin":
        return jsonify({"message": "Cannot delete admin users"}), 403
    db.users.delete_one({"_id": ObjectId(user_id)})
    return jsonify({"message": "User deleted"}), 200

# --- ADMIN DOCUMENT SEARCH ROUTE ---

@app.route("/api/admin/search", methods=["GET"])
@token_required
@admin_required
def search_documents(current_user):
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([]), 200
    results = list(db.chunks.find(
        {"text": {"$regex": q, "$options": "i"}},
        {"text": 1, "filename": 1, "metadata": 1}
    ).limit(10))
    for r in results:
        r["_id"] = str(r["_id"])
        r["excerpt"] = r["text"][:200] + "..." if len(r["text"]) > 200 else r["text"]
        del r["text"]
    return jsonify(results), 200

# --- ADMIN BROADCAST ROUTES ---

@app.route("/api/admin/broadcast", methods=["POST"])
@token_required
@admin_required
def send_broadcast(current_user):
    data = request.get_json()
    if not data or not data.get("title") or not data.get("message"):
        return jsonify({"message": "Title and message are required"}), 400
    db.broadcasts.insert_one({
        "title": data["title"],
        "message": data["message"],
        "priority": data.get("priority", "normal"),
        "created_by": str(current_user["_id"]),
        "timestamp": datetime.datetime.utcnow()
    })
    return jsonify({"message": "Broadcast sent successfully"}), 201

@app.route("/api/admin/broadcast", methods=["GET"])
@token_required
def get_broadcasts(current_user):
    broadcasts = list(db.broadcasts.find().sort("timestamp", -1).limit(20))
    for b in broadcasts:
        b["_id"] = str(b["_id"])
        b["timestamp"] = b["timestamp"].strftime("%b %d, %I:%M %p")
    return jsonify(broadcasts), 200

@app.route("/api/admin/broadcast/<broadcast_id>", methods=["DELETE"])
@token_required
@admin_required
def delete_broadcast(current_user, broadcast_id):
    db.broadcasts.delete_one({"_id": ObjectId(broadcast_id)})
    return jsonify({"message": "Broadcast deleted"}), 200

# --- ADMIN STATS ROUTE ---

@app.route("/api/admin/stats", methods=["GET"])
@token_required
@admin_required
def get_stats(current_user):
    # Total documents
    doc_count = db.documents.count_documents({})
    
    # Total query count from counter
    stats = db.system_stats.find_one({"type": "counters"})
    query_count = stats["query_count"] if stats else 0
    
    # Recent document activity
    recent_docs = list(db.documents.find().sort("_id", -1).limit(5))
    for r in recent_docs:
        r["_id"] = str(r["_id"])
        
    # Recent query confidence levels
    recent_queries = list(db.query_activity.find().sort("_id", -1).limit(7))
    accuracy_trend = []
    for q in reversed(recent_queries):
        accuracy_trend.append(q["confidence"])
        
    # Standard values if empty
    if not accuracy_trend:
        accuracy_trend = [84, 88, 91, 89, 94, 96, 98]
        
    # System confidence (average of recent queries or default)
    avg_confidence = int(sum(accuracy_trend) / len(accuracy_trend)) if accuracy_trend else 98
    
    return jsonify({
        "doc_count": doc_count,
        "query_count": query_count,
        "avg_confidence": avg_confidence,
        "recent_docs": recent_docs,
        "accuracy_trend": accuracy_trend
    }), 200

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
