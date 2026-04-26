import { Injectable } from '@angular/core';
import { TxtParseResult } from '../Models/txt-parse-result';
import { ParsedGraph } from '../Models/parsed-graph';

@Injectable({
  providedIn: 'root',
})
export class Parsing {
  //  Expected TXT format:
  //    nodes: x1,x2,x3,x4
  //    edges:
  //    x1->x2: G1
  //    x2->x3: G2
  //    x3->x4: G3
  //    x3->x2: -H1
  //    input: x1
  //    output: x4
  parseTxtFile(content:string): TxtParseResult {
    const errors: string[] = [];
    const graph: ParsedGraph = { 
      nodes: [],
      edges: [],
      inputNode: '',
      outputNode: '' };
      const lines=content.split('\n')
      .map(line=>line.trim())
      .filter(line=>line.length>0 && !line.startsWith('//')); // ignore empty and comment lines
      let inEdgesSection=false;
      for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
 
      // ── nodes: x1,x2,x3,x4
      if (line.toLowerCase().startsWith('nodes:')) {
        const raw = line.slice('nodes:'.length).trim();
        if (!raw) {
          errors.push(`Line ${i + 1}: "nodes:" is empty.`);
          continue;
        }
        const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
        graph.nodes = ids.map(id => ({ id, label: id } as any));
        inEdgesSection = false;
        continue;
      }
 
      // ── edges:  (section marker)
      if (line.toLowerCase() === 'edges:') {
        inEdgesSection = true;
        continue;
      }
 
      // ── input: x1
      if (line.toLowerCase().startsWith('input:')) {
        graph.inputNode = line.slice('input:'.length).trim();
        inEdgesSection = false;
        continue;
      }
 
      // ── output: x4
      if (line.toLowerCase().startsWith('output:')) {
        graph.outputNode = line.slice('output:'.length).trim();
        inEdgesSection = false;
        continue;
      }
 
      // ── edge line: x1->x2: G1
      if (inEdgesSection) {
        if (!line.includes('->')) {
          errors.push(`Line ${i + 1}: Expected edge format "from->to: gain", got "${line}"`);
          continue;
        }
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) {
          errors.push(`Line ${i + 1}: Missing ":" gain separator in "${line}"`);
          continue;
        }
        const arrowPart = line.slice(0, colonIdx).trim();
        const gain      = line.slice(colonIdx + 1).trim();
        const [from, to] = arrowPart.split('->').map(s => s.trim());
 
        if (!from || !to) {
          errors.push(`Line ${i + 1}: Invalid edge "${line}"`);
          continue;
        }
        if (!gain) {
          errors.push(`Line ${i + 1}: Missing gain for edge ${from}->${to}`);
          continue;
        }
 
        graph.edges.push({
          id: `e_${from}_${to}_${graph.edges.length}`,
          from,
          to,
          gain,
        });
        continue;
      }
 
      // Unknown line
      errors.push(`Line ${i + 1}: Unrecognized line "${line}"`);
    }
 
    // ── Semantic validation ──
    if (graph.nodes.length === 0) {
      errors.push('No nodes defined. Add a "nodes:" line.');
    }
    if (graph.edges.length === 0) {
      errors.push('No edges defined. Add an "edges:" section.');
    }
    if (!graph.inputNode) {
      errors.push('No input node defined. Add "input: <nodeId>".');
    }
    if (!graph.outputNode) {
      errors.push('No output node defined. Add "output: <nodeId>".');
    }
 
    const nodeIds = new Set(graph.nodes.map(n => n.id));
 
    if (graph.inputNode && !nodeIds.has(graph.inputNode)) {
      errors.push(`Input node "${graph.inputNode}" not found in nodes list.`);
    }
    if (graph.outputNode && !nodeIds.has(graph.outputNode)) {
      errors.push(`Output node "${graph.outputNode}" not found in nodes list.`);
    }
 
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.from)) {
        errors.push(`Edge "${edge.from}->${edge.to}": source node "${edge.from}" not in nodes.`);
      }
      if (!nodeIds.has(edge.to)) {
        errors.push(`Edge "${edge.from}->${edge.to}": target node "${edge.to}" not in nodes.`);
      }
    }
 
    return {
      success: errors.length === 0,
      graph: errors.length === 0 ? graph : undefined,
      errors,
    };


}
}
