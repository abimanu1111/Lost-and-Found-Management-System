from flask import Flask, render_template, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime
import os
from database import init_db, get_db

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'findit-dev-secret')
app.config['UPLOAD_FOLDER'] = os.path.join('static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Admin@FindIt2024')


def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id, name, email FROM users WHERE id = ?', (user_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return {"id": row[0], "name": row[1], "email": row[2]}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()

    if not name or not email or not password:
        return jsonify({'error': 'All fields are required'}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id FROM users WHERE email = ?', (email,))
    if cur.fetchone():
        conn.close()
        return jsonify({'error': 'Email already registered'}), 400

    password_hash = generate_password_hash(password)
    cur.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
                (name, email, password_hash))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id, name, email, password_hash FROM users WHERE email = ?', (email,))
    row = cur.fetchone()
    conn.close()

    if not row or not check_password_hash(row[3], password):
        return jsonify({'error': 'Invalid email or password'}), 401

    session['user_id'] = row[0]
    session['is_admin'] = False
    return jsonify({'success': True, 'user': {'id': row[0], 'name': row[1], 'email': row[2]}})


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})


@app.route('/api/me', methods=['GET'])
def me():
    user = current_user()
    return jsonify({'user': user, 'isAdmin': bool(session.get('is_admin'))})


@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json(silent=True) or {}
    password = (data.get('password') or '').strip()
    if password != ADMIN_PASSWORD:
        return jsonify({'error': 'Invalid admin password'}), 401
    session['is_admin'] = True
    return jsonify({'success': True})


@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    session['is_admin'] = False
    return jsonify({'success': True})


@app.route('/api/items', methods=['GET'])
def get_items():
    item_type = request.args.get('type', '')
    search = request.args.get('search', '')
    category = request.args.get('category', '')
    is_admin = bool(session.get('is_admin'))

    conn = get_db()
    cur = conn.cursor()

    query = 'SELECT items.*, users.name AS user_name, users.email AS user_email FROM items JOIN users ON items.user_id = users.id WHERE 1=1'
    params = []

    if item_type and item_type != 'all':
        query += ' AND type = ?'
        params.append(item_type)
    if category and category != 'all':
        query += ' AND category = ?'
        params.append(category)
    if search:
        query += ' AND (title LIKE ? OR description LIKE ? OR location LIKE ?)'
        search_param = f'%{search}%'
        params.extend([search_param, search_param, search_param])

    query += ' ORDER BY created_at DESC'
    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()

    items = []
    for row in rows:
        item = {
            'id': row['id'],
            'type': row['type'],
            'title': row['title'],
            'description': row['description'],
            'category': row['category'],
            'location': row['location'],
            'locationCoords': row['location_coords'],
            'date': row['date'],
            'imageUrl': row['image_path'],
            'userName': row['user_name'],
            'userEmail': row['user_email'],
            'createdAt': row['created_at']
        }
        if is_admin:
            item['contactInfo'] = row['contact_info']
            item['foundPersonName'] = row['found_person_name']
            item['foundPersonPhone'] = row['found_person_phone']
        items.append(item)

    return jsonify({'items': items})


@app.route('/api/items', methods=['POST'])
def create_item():
    user = current_user()
    if not user:
        return jsonify({'error': 'Login required'}), 401

    data = request.form if request.form else (request.get_json(silent=True) or {})

    item_type = (data.get('type') or '').strip()
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    category = (data.get('category') or '').strip()
    location = (data.get('location') or '').strip()
    location_coords = (data.get('locationCoords') or '').strip()
    date = (data.get('date') or '').strip()
    contact_info = (data.get('contactInfo') or '').strip()
    found_person_name = (data.get('foundPersonName') or '').strip()
    found_person_phone = (data.get('foundPersonPhone') or '').strip()

    if not all([item_type, title, description, category, location, date, contact_info]):
        return jsonify({'error': 'Missing required fields'}), 400

    image_path = ''
    if 'imageFile' in request.files:
        file = request.files['imageFile']
        if file and file.filename and allowed_file(file.filename):
            safe_name = secure_filename(file.filename)
            timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
            filename = f"{timestamp}_{safe_name}"
            os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            image_path = f"/{app.config['UPLOAD_FOLDER'].replace('\\', '/')}/{filename}"

    if not image_path:
        image_url = (data.get('imageUrl') or '').strip()
        image_path = image_url

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        'INSERT INTO items (type, title, description, category, location, location_coords, date, contact_info, found_person_name, found_person_phone, image_path, user_id, created_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (
            item_type, title, description, category, location, location_coords,
            date, contact_info, found_person_name, found_person_phone,
            image_path, user['id'], datetime.utcnow().isoformat()
        )
    )
    conn.commit()
    conn.close()

    return jsonify({'success': True})


@app.route('/api/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403

    conn = get_db()
    cur = conn.cursor()
    cur.execute('DELETE FROM items WHERE id = ?', (item_id,))
    conn.commit()
    conn.close()

    return jsonify({'success': True})


@app.route('/api/stats', methods=['GET'])
def stats():
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403

    conn = get_db()
    cur = conn.cursor()

    cur.execute('SELECT COUNT(*) FROM items')
    total_items = cur.fetchone()[0]

    cur.execute('SELECT COUNT(*) FROM items WHERE type = "lost"')
    lost_items = cur.fetchone()[0]

    cur.execute('SELECT COUNT(*) FROM items WHERE type = "found"')
    found_items = cur.fetchone()[0]

    cur.execute('SELECT category, COUNT(*) FROM items GROUP BY category')
    category_counts = {row[0]: row[1] for row in cur.fetchall()}

    cur.execute(
        'SELECT items.*, users.name AS user_name FROM items '
        'JOIN users ON items.user_id = users.id '
        'ORDER BY created_at DESC LIMIT 5'
    )
    recent_rows = cur.fetchall()
    recent_items = []
    for row in recent_rows:
        recent_items.append({
            'id': row['id'],
            'type': row['type'],
            'title': row['title'],
            'description': row['description'],
            'category': row['category'],
            'location': row['location'],
            'locationCoords': row['location_coords'],
            'date': row['date'],
            'imageUrl': row['image_path'],
            'userName': row['user_name'],
            'createdAt': row['created_at']
        })

    conn.close()

    return jsonify({
        'stats': {
            'totalItems': total_items,
            'lostItems': lost_items,
            'foundItems': found_items,
            'categoryCounts': category_counts,
            'recentItems': recent_items
        }
    })


if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
