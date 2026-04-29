from dataclasses import dataclass, field
from typing import List, Dict

@dataclass
class EdgeEntry:
    to: str
    gain: str
    edge_id: str

@dataclass
class SFGraph:
    nodes: List[str] = field(default_factory=list)
    adj: Dict[str, List[EdgeEntry]] = field(default_factory=dict)
    input_node: str = ""
    output_node: str = ""

def build_graph(payload: dict) -> SFGraph:
    g = SFGraph()
    for n in payload.get("nodes", []):
        node_id = n["id"]
        g.nodes.append(node_id)
        g.adj[node_id] = []
    for e in payload.get("edges", []):
        src = e["from"]
        dst = e["to"]
        gain = e["gain"]
        eid = e.get("id", f"{src}_{dst}")
        if src not in g.adj:
            g.adj[src] = []
            g.nodes.append(src)
        g.adj[src].append(EdgeEntry(to=dst, gain=gain, edge_id=eid))
    g.input_node = payload.get("inputNode", "")
    g.output_node = payload.get("outputNode", "")
    return g