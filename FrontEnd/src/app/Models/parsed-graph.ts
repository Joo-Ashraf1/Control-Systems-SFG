import { Edge } from "./edge";
import { Node } from "./node";
export interface ParsedGraph {
    nodes: Node[];
    edges: Edge[];
    inputNode: string;
    outputNode: string;
}
