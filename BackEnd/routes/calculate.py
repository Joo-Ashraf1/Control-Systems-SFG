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
    paths=[]

    def _find_forward_paths_helper(g,node,visited,path_gain):
        """
        DFS helper to find all forward paths from input to output node.
        - node: current node being visited
        - visited: list of nodes visited so far (also represents current path)
        - path_gain: accumulated gain string along the current path
        """
        # base case: reached the sink node
        if node==g.output_node:
            visited.append(node)
            paths.append(_build_dict(len(paths)+1,path_gain,list(visited)))
            return

        # mark current node as visited
        visited.append(node)

        for edge in g.adj[node]:
            if edge.to not in visited:
                # build gain for this edge without modifying parent's gain
                new_gain=path_gain+"*"+edge.gain if path_gain!= "" else edge.gain
                _find_forward_paths_helper(g,edge.to,visited,new_gain)
                # backtrack
                visited.remove(edge.to)

    _find_forward_paths_helper(g,g.input_node,[],"")
    return paths


def find_loops(g):
    loops = []
    # TODO: your implementation
    return loops



def _build_dict(index,forward_paths_gain,path)->dict:
    dict_path = {"index": index, "gain": forward_paths_gain, "nodesPath": path}
    return dict_path