from flask import Blueprint, request, jsonify
from models.graph import build_graph

calculate_bp = Blueprint("calculate", __name__)

@calculate_bp.route("/calculate", methods=["POST"])
def calculate():
    payload = request.get_json()
    if not payload:
        return jsonify({"error": "No data received"}), 400

    g = build_graph(payload)

    forward_paths = find_forward_paths(g)
    loops = find_loops(g)

    return jsonify({
        "forwardPaths": forward_paths,
        "loops": loops,
        "nonTouchingLoops": [],
        "delta": "",
        "deltaK": [],
        "tfSymbolic": ""
    })


def find_forward_paths(g):
    paths = []
    # TODO: your implementation
    return paths


def find_loops(g):
    loops = []
    # TODO: your implementation
    return loops