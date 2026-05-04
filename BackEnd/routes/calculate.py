from flask import Blueprint, request, jsonify
from models.graph import build_graph
from models.mason import find_non_touching_loops, compute_delta, compute_delta_k , mason_rule
calculate_bp = Blueprint("calculate", __name__)

@calculate_bp.route("/calculate", methods=["POST"])
def calculate():
    payload = request.get_json()
    if not payload:
        return jsonify({"error": "No data received"}), 400

    g = build_graph(payload)

    forward_paths = find_forward_paths(g)
    loops = find_loops(g)

    non_touching_loops_dict = find_non_touching_loops(loops)
    delta = compute_delta(loops, non_touching_loops_dict)
    delta_k = compute_delta_k(forward_paths, loops)

    transfer_function = mason_rule(forward_paths , delta , delta_k)

    formatted_non_touching = []
    for size, combos in non_touching_loops_dict.items():
        for combo in combos:
            formatted_non_touching.append({
                "order": size,
                "loops": [loop for loop in combo],
                "gain": "*".join([loop["gain"] for loop in combo])
            })

    return jsonify({
        "forwardPaths": forward_paths,
        "loops": loops,
        "nonTouchingLoops": formatted_non_touching,
        "delta": delta,
        "deltaK": delta_k,
        "tfSymbolic": transfer_function
    })


def find_forward_paths(g):
    paths=[]

    def _find_forward_paths_helper(g,current_node,visited,path_gain):
        """
        DFS helper to find all forward paths from input to output node.
        - node: current node being visited
        - visited: list of nodes visited so far (also represents current path)
        - path_gain: accumulated gain string along the current path
        """
        # base case: reached the sink node
        if current_node==g.output_node:
            visited.append(current_node)
            paths.append(_build_dict(len(paths)+1,path_gain,list(visited)))
            return

        # mark current node as visited
        visited.append(current_node)

        for edge in g.adj[current_node]:
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
    seen = set()

    def _find_loops_helper(g,start_node,current_node,visited,path_gain):
        """
           DFS helper to find all individual loops in the graph.
           - start_node: the node we started from (to detect when we loop back)
           - current_node: the node we're currently visiting
           - visited: list of nodes visited so far
           - path_gain: accumulated gain string along the current path
           """
        # base case: we came back to the start node — loop found
        if start_node==current_node:
            visited.append(start_node)
            loop_path=[start_node]+list(visited)
            key=frozenset(loop_path)
            # only add if not a duplicate loop
            if key not in seen:
                seen.add(key)
                loops.append(_build_dict(len(loops)+1,path_gain,loop_path))
            return

        # mark current node as visited
        visited.append(current_node)

        for edge in g.adj[current_node]:
            if edge.to not in visited:
                # build gain without modifying parent's gain
                new_gain=path_gain+"*"+edge.gain if path_gain!= "" else edge.gain
                _find_loops_helper(g,start_node,edge.to,visited,new_gain)
                # backtrack (don't remove start_node — it was never added)
                if edge.to != start_node:
                    visited.remove(edge.to)

    # start a DFS from every node's neighbors to find all possible loops
    for node in g.nodes:
        for edge in g.adj[node]:
            _find_loops_helper(g,node,edge.to,[],edge.gain)
    return loops



def _build_dict(index,forward_paths_gain,path)->dict:
    evaluated_gain=_clean_gain(forward_paths_gain)
    dict_path = {"index": index, "gain": evaluated_gain, "nodesPath": path}
    return dict_path

def _clean_gain(gain) -> str:
    try:
        return str(eval(gain))
    except:
        parts=gain.split("*")
        parts=[p for p in parts if p.strip()!="1"]
        return "*".join(parts)