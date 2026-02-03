import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_home(client):
    response = client.get('/')
    assert response.status_code == 200
    assert b'Python Flask Application' in response.data

def test_health(client):
    response = client.get('/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'healthy'
    assert data['service'] == 'python-app'

def test_items_get(client):
    response = client.get('/items')
    assert response.status_code == 200

def test_items_post(client):
    response = client.post('/items', json={'name': 'test', 'description': 'test item'})
    assert response.status_code == 201
