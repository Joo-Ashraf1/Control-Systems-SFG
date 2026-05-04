import pytest
import sympy
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


def sym_equal(expr1: str, expr2: str) -> bool:
    try:
        return sympy.simplify(f"({expr1}) - ({expr2})") == 0
    except Exception:
        return False






def test_tf_simple_gain(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}],
        "edges": [{"from": "x1", "to": "x2", "gain": "k", "id": "e1"}],
        "inputNode": "x1",
        "outputNode": "x2",
    }
    data = post(client, payload).get_json()
    assert sym_equal(data["tfSymbolic"], "k")


def test_tf_two_gains_in_series(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}, {"id": "x3"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "a", "id": "e1"},
            {"from": "x2", "to": "x3", "gain": "b", "id": "e2"},
        ],
        "inputNode": "x1",
        "outputNode": "x3",
    }
    data = post(client, payload).get_json()
    assert sym_equal(data["tfSymbolic"], "a*b")


def test_tf_self_loop(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}, {"id": "x3"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "a", "id": "e1"},
            {"from": "x2", "to": "x3", "gain": "b", "id": "e2"},
            {"from": "x2", "to": "x2", "gain": "L", "id": "e3"},
        ],
        "inputNode": "x1",
        "outputNode": "x3",
    }
    data = post(client, payload).get_json()
    assert sym_equal(data["tfSymbolic"], "a*b / (1 - L)")


def test_tf_two_paths_sum(client):
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
    data = post(client, payload).get_json()
    assert sym_equal(data["tfSymbolic"], "a*c + b*d")


def test_tf_negative_feedback(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}, {"id": "x3"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "G",  "id": "e1"},
            {"from": "x2", "to": "x3", "gain": "1",  "id": "e2"},
            {"from": "x2", "to": "x2", "gain": "-H", "id": "e3"},
        ],
        "inputNode": "x1",
        "outputNode": "x3",
    }
    data = post(client, payload).get_json()
    assert sym_equal(data["tfSymbolic"], "G / (1 + H)")


def test_tf_two_paths_with_shared_loop(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}, {"id": "x3"}, {"id": "x4"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "a", "id": "e1"},
            {"from": "x1", "to": "x3", "gain": "b", "id": "e2"},
            {"from": "x2", "to": "x4", "gain": "c", "id": "e3"},
            {"from": "x3", "to": "x4", "gain": "d", "id": "e4"},
            {"from": "x2", "to": "x2", "gain": "L", "id": "e5"},
        ],
        "inputNode": "x1",
        "outputNode": "x4",
    }
    data = post(client, payload).get_json()
    assert sym_equal(data["tfSymbolic"], "(a*c + b*d*(1-L)) / (1-L)")






def test_delta_one_loop(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}, {"id": "x3"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "a", "id": "e1"},
            {"from": "x2", "to": "x3", "gain": "b", "id": "e2"},
            {"from": "x2", "to": "x2", "gain": "L", "id": "e3"},
        ],
        "inputNode": "x1",
        "outputNode": "x3",
    }
    data = post(client, payload).get_json()
    assert sym_equal(data["delta"], "1 - L")


def test_delta_two_touching_loops(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}, {"id": "x3"}, {"id": "x4"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "a",  "id": "e1"},
            {"from": "x2", "to": "x3", "gain": "b",  "id": "e2"},
            {"from": "x3", "to": "x4", "gain": "c",  "id": "e3"},
            {"from": "x2", "to": "x2", "gain": "L1", "id": "e4"},
            {"from": "x3", "to": "x3", "gain": "L2", "id": "e5"},
        ],
        "inputNode": "x1",
        "outputNode": "x4",
    }
    data = post(client, payload).get_json()
    assert sym_equal(data["delta"], "1 - L1 - L2 + L1*L2")


def test_delta_two_non_touching_loops(client):
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
    data = post(client, payload).get_json()
    assert sym_equal(data["delta"], "1 - L1 - L2 + L1*L2")


def test_loop_count_is_correct(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}, {"id": "x3"}, {"id": "x4"}, {"id": "x5"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "a",  "id": "e1"},
            {"from": "x2", "to": "x3", "gain": "b",  "id": "e2"},
            {"from": "x3", "to": "x4", "gain": "c",  "id": "e3"},
            {"from": "x4", "to": "x5", "gain": "d",  "id": "e4"},
            {"from": "x2", "to": "x2", "gain": "L1", "id": "e5"},
            {"from": "x3", "to": "x3", "gain": "L2", "id": "e6"},
            {"from": "x4", "to": "x4", "gain": "L3", "id": "e7"},
        ],
        "inputNode": "x1",
        "outputNode": "x5",
    }
    data = post(client, payload).get_json()
    assert len(data["loops"]) == 3






def test_long_chain_five_nodes(client):
    payload = {
        "nodes": [{"id": f"x{i}"} for i in range(1, 6)],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "a", "id": "e1"},
            {"from": "x2", "to": "x3", "gain": "b", "id": "e2"},
            {"from": "x3", "to": "x4", "gain": "c", "id": "e3"},
            {"from": "x4", "to": "x5", "gain": "d", "id": "e4"},
        ],
        "inputNode": "x1",
        "outputNode": "x5",
    }
    data = post(client, payload).get_json()
    assert res_ok(data)
    assert len(data["forwardPaths"]) == 1
    assert sym_equal(data["tfSymbolic"], "a*b*c*d")


def test_three_parallel_paths(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "a", "id": "e1"},
            {"from": "x1", "to": "x2", "gain": "b", "id": "e2"},
            {"from": "x1", "to": "x2", "gain": "c", "id": "e3"},
        ],
        "inputNode": "x1",
        "outputNode": "x2",
    }
    data = post(client, payload).get_json()
    assert res_ok(data)
    assert len(data["forwardPaths"]) == 3
    assert sym_equal(data["tfSymbolic"], "a + b + c")


def test_diamond_graph(client):
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
    data = post(client, payload).get_json()
    assert res_ok(data)
    assert len(data["forwardPaths"]) == 2
    assert sym_equal(data["tfSymbolic"], "a*c + b*d")


def test_complex_graph_three_loops(client):
    payload = {
        "nodes": [{"id": f"x{i}"} for i in range(1, 7)],
        "edges": [
            {"from": "x1", "to": "x2", "gain": "a",  "id": "e1"},
            {"from": "x2", "to": "x3", "gain": "b",  "id": "e2"},
            {"from": "x3", "to": "x4", "gain": "c",  "id": "e3"},
            {"from": "x4", "to": "x5", "gain": "d",  "id": "e4"},
            {"from": "x5", "to": "x6", "gain": "e",  "id": "e5"},
            {"from": "x2", "to": "x2", "gain": "L1", "id": "e6"},
            {"from": "x4", "to": "x4", "gain": "L2", "id": "e7"},
            {"from": "x6", "to": "x6", "gain": "L3", "id": "e8"},
        ],
        "inputNode": "x1",
        "outputNode": "x6",
    }
    data = post(client, payload).get_json()
    assert res_ok(data)
    assert len(data["loops"]) == 3
    expected_delta = "1 - L1 - L2 - L3 + L1*L2 + L1*L3 + L2*L3 - L1*L2*L3"
    assert sym_equal(data["delta"], expected_delta)






def test_stress_long_chain_ten_nodes(client):
    n = 10
    nodes = [{"id": f"x{i}"} for i in range(1, n + 1)]
    edges = [
        {"from": f"x{i}", "to": f"x{i+1}", "gain": f"g{i}", "id": f"e{i}"}
        for i in range(1, n)
    ]
    payload = {"nodes": nodes, "edges": edges, "inputNode": "x1", "outputNode": f"x{n}"}
    res = post(client, payload)
    data = res.get_json()

    assert res.status_code == 200
    assert len(data["forwardPaths"]) == 1
    assert data["loops"] == []
    assert data["tfSymbolic"] != "0"


def test_stress_many_self_loops(client):
    n = 8
    nodes = [{"id": f"x{i}"} for i in range(1, n + 1)]
    edges = [
        {"from": f"x{i}", "to": f"x{i+1}", "gain": f"g{i}", "id": f"e{i}"}
        for i in range(1, n)
    ]
    
    for i in range(2, n):
        edges.append({"from": f"x{i}", "to": f"x{i}", "gain": f"L{i}", "id": f"sl{i}"})

    payload = {"nodes": nodes, "edges": edges, "inputNode": "x1", "outputNode": f"x{n}"}
    res = post(client, payload)
    data = res.get_json()

    assert res.status_code == 200
    assert len(data["loops"]) == n - 2   
    assert data["tfSymbolic"] != "0"


def test_stress_many_parallel_paths(client):
    payload = {
        "nodes": [{"id": "x1"}, {"id": "x2"}],
        "edges": [
            {"from": "x1", "to": "x2", "gain": f"g{i}", "id": f"e{i}"}
            for i in range(10)
        ],
        "inputNode": "x1",
        "outputNode": "x2",
    }
    res = post(client, payload)
    data = res.get_json()

    assert res.status_code == 200
    assert len(data["forwardPaths"]) == 10
    assert data["tfSymbolic"] != "0"


def test_stress_response_time(client):
    import time
    n = 12
    nodes = [{"id": f"x{i}"} for i in range(1, n + 1)]
    edges = [
        {"from": f"x{i}", "to": f"x{i+1}", "gain": f"g{i}", "id": f"e{i}"}
        for i in range(1, n)
    ]
    payload = {"nodes": nodes, "edges": edges, "inputNode": "x1", "outputNode": f"x{n}"}

    start = time.time()
    res = post(client, payload)
    elapsed = time.time() - start

    assert res.status_code == 200
    assert elapsed < 10  






def res_ok(data: dict) -> bool:
    return all(k in data for k in ["forwardPaths", "loops", "delta", "tfSymbolic"])