import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def post(client, payload):
    return client.post("/calculate", json=payload)


# ─────────────────────────────────────────────
# Happy Path Tests
# ─────────────────────────────────────────────

def test_single_forward_path_no_loops(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}, {"id": "x3"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "a", "id": "e1"},
            {"from": "x2", "to": "x3", "gain": "b", "id": "e2"},
        ],
        "inputNode": "x1",
        "outputNode": "x3",
    }
    res = post(client, payload)
    data = res.get_json()

    assert res.status_code == 200
    assert len(data["forwardPaths"]) == 1
    assert data["loops"] == []
    assert data["delta"] == "1"
    # delta = 1, delta_k = 1, tf = a*b
    assert data["tfSymbolic"] == "a*b"


def test_single_forward_path_with_one_loop(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}, {"id": "x3"}, {"id": "x4"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "a",  "id": "e1"},
            {"from": "x2", "to": "x3", "gain": "b",  "id": "e2"},
            {"from": "x3", "to": "x4", "gain": "1",  "id": "e3"},
            {"from": "x3", "to": "x2", "gain": "-c", "id": "e4"},
        ],
        "inputNode": "x1",
        "outputNode": "x4",
    }
    res = post(client, payload)
    data = res.get_json()

    assert res.status_code == 200
    assert len(data["forwardPaths"]) == 1
    assert len(data["loops"]) == 1
    assert data["delta"] != "1"
    assert data["tfSymbolic"] != "0"


def test_multiple_forward_paths(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}, {"id": "x3"}, {"id": "x4"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "a", "id": "e1"},
            {"from": "x1", "to": "x3", "gain": "b", "id": "e2"},
            {"from": "x2", "to": "x4", "gain": "c", "id": "e3"},
            {"from": "x3", "to": "x4", "gain": "d", "id": "e4"},
        ],
        "inputNode": "x1",
        "outputNode": "x4",
    }
    res = post(client, payload)
    data = res.get_json()

    assert res.status_code == 200
    assert len(data["forwardPaths"]) == 2
    assert data["loops"] == []
    assert data["delta"] == "1"
    assert data["tfSymbolic"] != "0"


def test_non_touching_loops(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}, {"id": "x3"}, {"id": "x4"}, {"id": "x5"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "a",  "id": "e1"},
            {"from": "x2", "to": "x3", "gain": "b",  "id": "e2"},
            {"from": "x3", "to": "x4", "gain": "c",  "id": "e3"},
            {"from": "x4", "to": "x5", "gain": "d",  "id": "e4"},
            {"from": "x2", "to": "x2", "gain": "L1", "id": "e5"},
            {"from": "x4", "to": "x4", "gain": "L2", "id": "e6"},
        ],
        "inputNode": "x1",
        "outputNode": "x5",
    }
    res = post(client, payload)
    data = res.get_json()

    assert res.status_code == 200
    assert len(data["loops"]) == 2
    assert len(data["nonTouchingLoops"]) == 1
    assert data["nonTouchingLoops"][0]["size"] == 2


# ─────────────────────────────────────────────
# Edge Case Tests
# ─────────────────────────────────────────────

def test_no_forward_path(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}, {"id": "x3"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "a", "id": "e1"},
        ],
        "inputNode": "x1",
        "outputNode": "x3",
    }
    res = post(client, payload)
    data = res.get_json()

    assert res.status_code == 200
    assert data["forwardPaths"] == []
    assert data["tfSymbolic"] == "0"


def test_empty_payload(client):
    res = client.post("/calculate", data="", content_type="application/json")
    assert res.status_code == 400


def test_no_loops_delta_is_one(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "k", "id": "e1"},
        ],
        "inputNode": "x1",
        "outputNode": "x2",
    }
    res = post(client, payload)
    data = res.get_json()

    assert res.status_code == 200
    assert data["loops"] == []
    assert data["delta"] == "1"
    assert data["tfSymbolic"] == "k"


def test_response_has_required_keys(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "g", "id": "e1"},
        ],
        "inputNode": "x1",
        "outputNode": "x2",
    }
    res = post(client, payload)
    data = res.get_json()

    required_keys = {"forwardPaths", "loops", "nonTouchingLoops", "delta", "deltaK", "tfSymbolic"}
    assert required_keys.issubset(data.keys())