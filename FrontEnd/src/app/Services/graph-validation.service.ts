import { Injectable } from '@angular/core';
import { ParsedGraph } from '../Models/parsed-graph';

@Injectable({
  providedIn: 'root'
})
export class GraphValidationService {

  validateGraph(graph: ParsedGraph): string[] {
    const errors: string[] = [];

    if (!graph.nodes || graph.nodes.length === 0) {
      errors.push('Graph is empty. Add nodes and branches to begin.');
      return errors;
    }

    if (!graph.inputNode) {
      errors.push('Explicit Start: Input Node (Source) is not selected.');
    }
    
    if (!graph.outputNode) {
      errors.push('Explicit End: Output Node (Sink) is not selected.');
    }

    for (const node of graph.nodes) {
      const inEdges = graph.edges.filter(e => e.to === node.id).length;
      const outEdges = graph.edges.filter(e => e.from === node.id).length;
      const displayLabel = node.label || node.id;

      if (inEdges === 0 && outEdges === 0) {
        errors.push(`Orphan Node: '${displayLabel}' has no connections.`);
      } else if (inEdges > 0 && outEdges === 0 && node.id !== graph.outputNode) {
        errors.push(`Dead End: '${displayLabel}' has incoming branches but no outgoing branches, and is not designated as the Output Node.`);
      } else if (outEdges > 0 && inEdges === 0 && node.id !== graph.inputNode) {
        errors.push(`Unreachable Node: '${displayLabel}' has outgoing branches but no incoming branches, and is not designated as the Input Node.`);
      }
    }

    return errors;
  }
}
