from flask import Flask, jsonify, request
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import redis
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Database setup
Base = declarative_base()

class Item(Base):
    __tablename__ = 'items'
    id = Column(Integer, primary_key=True)
    name = Column(String(100))
    description = Column(String(500))

# Redis cache setup
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'localhost'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    decode_responses=True
)

@app.route('/')
def home():
    return dependencies()

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'python-app'})

@app.route('/dependencies')
def dependencies():
    try:
        with open('requirements.txt', 'r') as f:
            deps = [line.strip() for line in f.readlines() if line.strip() and not line.startswith('#')]

        html = '''
        <!DOCTYPE html>
        <html>
        <head>
            <title>Python Dependencies</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 1200px;
                    margin: 50px auto;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                h1 {
                    color: #306998;
                    border-bottom: 3px solid #FFD43B;
                    padding-bottom: 10px;
                }
                .info {
                    background-color: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                }
                .deps-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 15px;
                }
                .dep-card {
                    background-color: white;
                    padding: 15px;
                    border-radius: 8px;
                    border-left: 4px solid #306998;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .dep-name {
                    font-weight: bold;
                    color: #306998;
                    font-size: 16px;
                }
                .dep-version {
                    color: #666;
                    font-size: 14px;
                    margin-top: 5px;
                }
                .count {
                    color: #FFD43B;
                    font-weight: bold;
                    font-size: 24px;
                }
            </style>
        </head>
        <body>
            <h1>🐍 Python Flask Application Dependencies</h1>
            <div class="info">
                <p><strong>Framework:</strong> Flask 3.1.2</p>
                <p><strong>Total Dependencies:</strong> <span class="count">''' + str(len(deps)) + '''</span></p>
                <p><strong>Package Manager:</strong> pip</p>
            </div>
            <div class="deps-grid">
        '''

        for dep in deps:
            parts = dep.replace('==', ' ').split()
            name = parts[0] if parts else dep
            version = parts[1] if len(parts) > 1 else 'latest'
            html += f'''
                <div class="dep-card">
                    <div class="dep-name">{name}</div>
                    <div class="dep-version">Version: {version}</div>
                </div>
            '''

        html += '''
            </div>
        </body>
        </html>
        '''
        return html
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/items', methods=['GET', 'POST'])
def items():
    if request.method == 'POST':
        data = request.get_json()
        return jsonify({'message': 'Item created', 'data': data}), 201
    return jsonify({'items': []})

@app.route('/cache/<key>', methods=['GET', 'POST'])
def cache(key):
    if request.method == 'POST':
        data = request.get_json()
        redis_client.set(key, data.get('value'))
        return jsonify({'message': f'Cached {key}'})

    value = redis_client.get(key)
    return jsonify({'key': key, 'value': value})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
