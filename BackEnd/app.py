from flask import Flask
from flask_cors import CORS
from routes.calculate import calculate_bp

app = Flask(__name__)
CORS(app)
app.register_blueprint(calculate_bp)

if __name__ == '__main__':
    app.run(debug=True, port=5000)