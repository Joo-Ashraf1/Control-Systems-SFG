import {
  Component, Input, Output, EventEmitter,
  AfterViewInit, OnChanges, SimpleChanges,
  OnDestroy, ElementRef, ViewChild, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GainModal } from '../gainmenu/gain-modal.component';

import cytoscape from 'cytoscape';
import { ParsedGraph } from '../../Models/parsed-graph';

type ToolId = 'select' | 'move' | 'add-node' | 'add-branch';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule, GainModal],
  templateUrl: './canvas.html',
  styleUrls: ['./canvas.css'],
})
export class Canvas implements AfterViewInit, OnChanges, OnDestroy {

  @ViewChild('cyContainer') cyContainer!: ElementRef<HTMLDivElement>;

  @Input() graph: ParsedGraph = { nodes: [], edges: [], inputNode: '', outputNode: '' };
  @Input() activeTool: ToolId = 'select';
  @Output() graphChanged     = new EventEmitter<ParsedGraph>();
  @Output() inputNodeChange  = new EventEmitter<string>();
  @Output() outputNodeChange = new EventEmitter<string>();
  @Output() selectionChanged = new EventEmitter<any>();

  zoomPercent = 100;

  get isEmpty(): boolean { return this.graph.nodes.length === 0; }
  get nodeIds(): string[] { return this.graph.nodes.map(n => n.id); }

  showGainModal    = false;
  pendingSource2   = '';
  pendingTarget2   = '';
  gainModalInitialValue = '1';
  gainModalMode: 'add-branch' | 'set-gain' = 'add-branch';

  private pendingEdgeId: string | null = null;

  private pendingBranchSource: string | null = null;
  private undoStack: ParsedGraph[] = [];
  private redoStack: ParsedGraph[] = [];
  private cy!: cytoscape.Core;
  private nodeCounter = 1;

  private keydownHandler = (e: KeyboardEvent) => this.onKeydown(e);

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.initCytoscape();
    });
    document.addEventListener('keydown', this.keydownHandler);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['graph'] && this.cy) {
      const isExternalChange = changes['graph'].previousValue !== changes['graph'].currentValue;
      if (isExternalChange) {
        this.renderGraph();
      }
    }
    if (changes['activeTool'] && this.cy) {
      this.updateCursor();
      this.clearPendingSource();
    }
  }

  ngOnDestroy(): void {
    this.cy?.destroy();
    document.removeEventListener('keydown', this.keydownHandler);
  }

  private onKeydown(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      this.ngZone.run(() => this.deleteSelected());
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      this.ngZone.run(() => this.undo());
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
      e.preventDefault();
      this.ngZone.run(() => this.redo());
    }
  }

  private initCytoscape(): void {
    this.cy = cytoscape({
      container: this.cyContainer.nativeElement,
      elements: [],
      style: this.buildStylesheet(),
      layout: { name: 'preset' },
      userZoomingEnabled:  true,
      userPanningEnabled:  true,
      boxSelectionEnabled: false,
      selectionType:       'single',
      minZoom: 0.15,
      maxZoom: 4,
    });

    this.cy.on('zoom', () => {
      this.ngZone.run(() => {
        this.zoomPercent = Math.round(this.cy.zoom() * 100);
      });
    });

    this.attachToolHandlers();
  }

  
  
  private buildStylesheet(): cytoscape.Stylesheet[] {
    return [
      {
        selector: 'node',
        style: {
          'background-color':   '#1a1d2e',
          'border-color':       '#6c63ff',
          'border-width':       2,
          'label':              'data(label)',
          'color':              '#ffffff',
          'font-family':        'JetBrains Mono, monospace',
          'font-size':          13,
          'font-weight':        600,
          'text-valign':        'center',
          'text-halign':        'center',
          'width':              44,
          'height':             44,
          'shape':              'ellipse',
          'overlay-opacity':    0,
          'overlay-padding':    0,
        } as any,
      },
      {
        selector: 'node:selected',
        style: {
          'border-color':    '#E31BDC',
          'border-width':    3,
          'overlay-opacity': 0,
        } as any,
      },
      {
        selector: 'node.input-node',
        style: {
          'border-color': '#10E349',
          'border-width': 3,
        },
      },
      {
        selector: 'node.output-node',
        style: {
          'border-color': '#F2170C',
          'border-width': 3,
        },
      },
      {
        selector: 'node.pending-source',
        style: {
          'border-color':     '#6c63ff',
          'border-width':     4,
          'background-color': '#2d2a6e',
          'overlay-opacity':  0,
        } as any,
      },
      {
        selector: 'edge',
        style: {
          'width':                   2,
          'line-color':              '#6c63ff',
          'target-arrow-color':      '#6c63ff',
          'target-arrow-shape':      'triangle',
          'curve-style':             'bezier',
          'label':                   'data(gain)',
          'color':                   '#4a5068',
          'font-family':             'JetBrains Mono, monospace',
          'font-size':               11,
          'font-weight':             500,
          'text-background-color':   '#f7f8fc',
          'text-background-opacity': 0.9,
          'text-background-padding': '3px',
          'text-rotation':           'autorotate',
          'overlay-opacity':         0,
        } as any,
      },
      {
        selector: 'edge[?selfLoop]',
        style: {
          'curve-style':        'loop',
          'loop-direction':     '-45deg',
          'loop-sweep':         '45deg',
          'line-color':         '#00b894',
          'target-arrow-color': '#00b894',
          'overlay-opacity':    0,
        } as any,
      },
      {
        selector: 'edge:selected',
        style: {
          'line-color':         '#f5c542',
          'target-arrow-color': '#f5c542',
          'width':              3,
          'overlay-opacity':    0,
        } as any,
      },
    ];
  }

  private attachToolHandlers(): void {

    
    this.cy.on('click', (evt) => {
      if (evt.target !== this.cy) return;

      if (this.activeTool === 'add-node') {
        this.ngZone.run(() => this.addNodeAt(evt.position));
      }
      if (this.activeTool === 'add-branch') {
        this.clearPendingSource();
      }
    });

    
    this.cy.on('click', 'node', (evt) => {
      const nodeId = evt.target.id() as string;
      if (this.activeTool === 'add-branch') {
        this.ngZone.run(() => this.handleBranchNodeTap(nodeId));
      }
    });

    
    this.cy.on('click', 'edge', (evt) => {
      if (this.activeTool === 'add-branch') {
        const currentGain = evt.target.data('gain') as string;
        const source      = evt.target.data('source') as string;
        const target      = evt.target.data('target') as string;
        this.ngZone.run(() => {
          this.pendingEdgeId         = evt.target.id();
          this.pendingSource2        = source;
          this.pendingTarget2        = target;
          
          this.gainModalInitialValue = currentGain || '1';
          this.gainModalMode         = 'set-gain';
          this.showGainModal         = true;
        });
      }
    });

    
    this.cy.on('select unselect', 'node, edge', () => {
      this.ngZone.run(() => this.emitSelection());
    });

    
    this.cy.on('dragfree', 'node', () => {
      this.ngZone.run(() => {
        this.emitGraphChanged();
        this.emitSelection();
      });
    });
  }

  private updateCursor(): void {
    const container = this.cyContainer?.nativeElement;
    if (!container) return;
    const cursors: Record<ToolId, string> = {
      'select':     'default',
      'move':       'grab',
      'add-node':   'crosshair',
      'add-branch': 'cell',
    };
    container.style.cursor = cursors[this.activeTool] ?? 'default';

    if (this.activeTool === 'select' || this.activeTool === 'move') {
      this.cy.nodes().grabify();
      this.cy.panningEnabled(true);
    } else {
      this.cy.nodes().ungrabify();
      this.cy.panningEnabled(true);
    }
  }

  
  private addNodeAt(position: { x: number; y: number }): void {
    this.pushUndo();

    let id = `x${this.nodeCounter}`;
    const existingIds = new Set(this.graph.nodes.map(n => n.id));
    while (existingIds.has(id)) {
      this.nodeCounter++;
      id = `x${this.nodeCounter}`;
    }
    this.nodeCounter++;

    const label = id;

    this.cy.add({
      group: 'nodes',
      data: { id, label },
      position: { x: position.x, y: position.y },
    });

    this.graph.nodes.push({ id, label, x: position.x, y: position.y });
    this.emitGraphChanged();
  }

  
  private handleBranchNodeTap(nodeId: string): void {
    if (!this.pendingBranchSource) {
      
      this.pendingBranchSource = nodeId;
      this.cy.$(`#${nodeId}`).addClass('pending-source');
    } else {
      
      this.pendingSource2 = this.pendingBranchSource;
      this.pendingTarget2 = nodeId;
      this.clearPendingSource();

      
      this.gainModalInitialValue = '1';
      this.gainModalMode         = 'add-branch';
      this.pendingEdgeId         = null;

      this.ngZone.run(() => { this.showGainModal = true; });
    }
  }

  
  onGainConfirmed(gain: string): void {
    this.showGainModal = false;

    
    const numGain = parseFloat(gain);
    if (gain === '0' || numGain === 0) {
      alert('Zero Gain Block: A branch with gain 0 is mathematically equivalent to no connection and is rejected.');
      this.pendingEdgeId = null;
      return;
    }

    if (this.gainModalMode === 'set-gain' && this.pendingEdgeId) {
      
      this.pushUndo();
      const cyEdge = this.cy.$(`#${this.pendingEdgeId}`);
      cyEdge.data('gain', gain);
      const edge = this.graph.edges.find(e => e.id === this.pendingEdgeId);
      if (edge) edge.gain = gain;
      this.pendingEdgeId = null;
      this.emitGraphChanged();
      this.emitSelection();

    } else {
      
      const existingEdge = this.graph.edges.find(e => e.from === this.pendingSource2 && e.to === this.pendingTarget2);
      
      if (existingEdge) {
        this.pushUndo();
        
        const newGain = `(${existingEdge.gain}) + (${gain})`;
        existingEdge.gain = newGain;
        this.cy.$(`#${existingEdge.id}`).data('gain', newGain);
        this.emitGraphChanged();
        this.emitSelection();
        return;
      }

      this.pushUndo();
      const edgeId = `e_${this.pendingSource2}_${this.pendingTarget2}_${Date.now()}`;
      const isSelf = this.pendingSource2 === this.pendingTarget2;

      this.cy.add({
        group: 'edges',
        data: {
          id:       edgeId,
          source:   this.pendingSource2,
          target:   this.pendingTarget2,
          gain,
          selfLoop: isSelf || undefined,
        },
      });

      this.graph.edges.push({
        id:   edgeId,
        from: this.pendingSource2,
        to:   this.pendingTarget2,
        gain,
      });
      this.emitGraphChanged();
    }
  }

  onGainCancelled(): void {
    this.showGainModal = false;
    this.pendingEdgeId = null;
  }

  private clearPendingSource(): void {
    if (this.pendingBranchSource) {
      this.cy.$(`#${this.pendingBranchSource}`).removeClass('pending-source');
      this.pendingBranchSource = null;
    }
  }

  
  renderGraph(fitView = false): void {
    if (!this.cy) return;

    this.cy.elements().remove();

    const hasPositions = this.graph.nodes.some(n => n.x !== undefined);

    const cyNodes = this.graph.nodes.map((n, i) => ({
      group: 'nodes' as const,
      data: { id: n.id, label: n.label },
      position: n.x !== undefined
        ? { x: n.x, y: n.y! }
        : { x: 120 + i * 130, y: 220 },
    }));

    const cyEdges = this.graph.edges.map(e => ({
      group: 'edges' as const,
      data: {
        id:       e.id,
        source:   e.from,
        target:   e.to,
        gain:     e.gain,
        selfLoop: e.from === e.to ? true : undefined,
      },
    }));

    this.cy.add([...cyNodes, ...cyEdges]);
    this.markIONodes();
    this.updateCursor();

    if (fitView || !hasPositions) {
      this.cy.fit(undefined, 60);
    }

    this.nodeCounter = Math.max(...this.graph.nodes.map(n => {
      const num = parseInt(n.id.replace(/\D/g, ''), 10);
      return isNaN(num) ? 0 : num;
    }), 0) + 1;
  }

  
  private markIONodes(): void {
    this.cy.nodes().removeClass('input-node output-node');
    if (this.graph.inputNode)  this.cy.$(`#${this.graph.inputNode}`).addClass('input-node');
    if (this.graph.outputNode) this.cy.$(`#${this.graph.outputNode}`).addClass('output-node');
  }

  
  onInputNodeChange(id: string): void {
    this.graph.inputNode = id;
    this.markIONodes();
    this.inputNodeChange.emit(id);
    this.emitGraphChanged();
  }

  onOutputNodeChange(id: string): void {
    this.graph.outputNode = id;
    this.markIONodes();
    this.outputNodeChange.emit(id);
    this.emitGraphChanged();
  }

  
  deleteSelected(): void {
    const selected = this.cy.$(':selected');
    if (selected.length === 0) return;

    this.pushUndo();

    const nodeIdsToRemove = new Set<string>();
    const edgeIdsToRemove = new Set<string>();

    selected.forEach(el => {
      if (el.isNode()) nodeIdsToRemove.add(el.id());
      if (el.isEdge()) edgeIdsToRemove.add(el.id());
    });

    nodeIdsToRemove.forEach(nid => {
      this.cy.$(`#${nid}`).connectedEdges().forEach(e => {
        edgeIdsToRemove.add(e.id());
      });
    });

    selected.remove();
    edgeIdsToRemove.forEach(eid => {
      this.cy.$(`#${eid}`).remove();
    });

    this.graph.nodes = this.graph.nodes.filter(n => !nodeIdsToRemove.has(n.id));
    this.graph.edges = this.graph.edges.filter(e =>
      !edgeIdsToRemove.has(e.id) &&
      !nodeIdsToRemove.has(e.from) &&
      !nodeIdsToRemove.has(e.to)
    );

    this.emitGraphChanged();
  }

  
  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  private pushUndo(): void {
    this.undoStack.push(this.cloneGraph());
    this.redoStack = [];
  }

  undo(): void {
    if (!this.canUndo) return;
    this.redoStack.push(this.cloneGraph());
    this.graph = this.undoStack.pop()!;
    this.renderGraph(false);
    this.emitGraphChanged();
    this.emitSelection();
  }

  redo(): void {
    if (!this.canRedo) return;
    this.undoStack.push(this.cloneGraph());
    this.graph = this.redoStack.pop()!;
    this.renderGraph(false);
    this.emitGraphChanged();
    this.emitSelection();
  }

  private cloneGraph(): ParsedGraph {
    return JSON.parse(JSON.stringify(this.graph));
  }

  
  zoomIn():      void { this.cy.zoom({ level: this.cy.zoom() * 1.2, renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 } }); }
  zoomOut():     void { this.cy.zoom({ level: this.cy.zoom() / 1.2, renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 } }); }
  fitToScreen(): void { this.cy.fit(undefined, 60); }

  
  exportAsPng(): void {
    const png64 = this.cy.png({ full: true, scale: 2, bg: '#f0f2f8' });
    const link  = document.createElement('a');
    link.href   = png64;
    link.download = 'signal-flow-graph.png';
    link.click();
  }

  
  private emitGraphChanged(): void {
    this.cy.nodes().forEach(n => {
      const node = this.graph.nodes.find(nd => nd.id === n.id());
      if (node) {
        const pos = n.position();
        node.x = pos.x;
        node.y = pos.y;
      }
    });
    this.graphChanged.emit(this.cloneGraph());
  }

  private emitSelection(): void {
    const selected = this.cy.$(':selected');
    if (selected.length !== 1) {
      this.selectionChanged.emit(null);
      return;
    }
    const el = selected.first();
    if (el.isNode()) {
      const id = el.id();
      const nodeData = this.graph.nodes.find(n => n.id === id);
      const incoming = el.incomers('edge').map(e => e.data('source'));
      const outgoing = el.outgoers('edge').map(e => e.data('target'));
      this.selectionChanged.emit({
        type: 'node',
        id: id,
        label: nodeData?.label || id,
        x: Math.round(el.position('x')),
        y: Math.round(el.position('y')),
        incoming: Array.from(new Set(incoming)),
        outgoing: Array.from(new Set(outgoing))
      });
    } else if (el.isEdge()) {
      this.selectionChanged.emit({
        type: 'edge',
        id: el.id(),
        source: el.data('source'),
        target: el.data('target'),
        gain: el.data('gain')
      });
    }
  }

  public openGainModalForEdge(edgeId: string): void {
    const cyEdge = this.cy.$(`#${edgeId}`);
    if (cyEdge.length === 0) return;
    this.pendingEdgeId = edgeId;
    this.pendingSource2 = cyEdge.data('source');
    this.pendingTarget2 = cyEdge.data('target');
    this.gainModalInitialValue = cyEdge.data('gain') || '1';
    this.gainModalMode = 'set-gain';
    this.showGainModal = true;
  }

  public updateNodeLabel(nodeId: string, newLabel: string): void {
    this.pushUndo();
    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (node) {
      node.label = newLabel;
      this.cy.$(`#${nodeId}`).data('label', newLabel);
      this.emitGraphChanged();
      this.emitSelection();
    }
  }
}