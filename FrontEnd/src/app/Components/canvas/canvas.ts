import {Component, ElementRef, EventEmitter, Input, NgZone, Output, SimpleChanges, ViewChild} from '@angular/core';

import cytoscape from 'cytoscape';
import {ParsedGraph} from '../../Models/parsed-graph';
import {FormsModule} from '@angular/forms';

type ToolId = 'select' | 'move' | 'add-node' | 'add-branch' | 'set-gain';
@Component({
  selector: 'app-canvas',
  imports: [
    FormsModule
  ],
  templateUrl: './canvas.html',
  styleUrl: './canvas.css',
})
export class Canvas {
  @ViewChild('cyContainer') cyContainer!: ElementRef<HTMLDivElement>;

  /** Set by parent when a TXT file is loaded or nodes/edges change */
  @Input() graph: ParsedGraph = { nodes: [], edges: [], inputNode: '', outputNode: '' };
  /** Active tool set by the footer toolbar */
  @Input() activeTool: ToolId = 'select';

  /** Emitted whenever the graph changes on canvas (add node/edge, move, delete) */
  @Output() graphChanged       = new EventEmitter<ParsedGraph>();
  @Output() inputNodeChange    = new EventEmitter<string>();
  @Output() outputNodeChange   = new EventEmitter<string>();

  zoomPercent = 100;
  selectedInput = '';
  selectedOutput = '';
   private pendingBranchSource: string | null = null;

  // Undo/redo stacks (simple snapshot-based)
  private undoStack: ParsedGraph[] = [];
  private redoStack: ParsedGraph[] = [];

  private cy!: cytoscape.Core;
  private nodeCounter = 1;

  constructor(private ngZone: NgZone) {}


  get isEmpty(): boolean {
    return this.graph.nodes.length === 0;
  }

  get nodeIds(): string[] {
    return this.graph.nodes.map(n => n.id);
  }


  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.initCytoscape();
    });
  }

   ngOnChanges(changes: SimpleChanges): void {
    // Re-render whenever the parent pushes a new graph (e.g. from TXT load)
    if (changes['graph'] && this.cy) {
      this.renderGraph();
    }
    // Sync activeTool cursor
    if (changes['activeTool'] && this.cy) {
      this.updateCursor();
    }
  }

  ngOnDestroy(): void {
    this.cy?.destroy();
  }

  private initCytoscape(): void {
    this.cy = cytoscape({
      container: this.cyContainer.nativeElement,
      elements: [],
      style: this.buildStylesheet(),
      layout: { name: 'preset' },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: true,
      selectionType: 'single',
      minZoom: 0.2,
      maxZoom: 4,
    });
    this.cy.on('zoom', () => {
      this.ngZone.run(() => {
        this.zoomPercent = Math.round(this.cy.zoom() * 100);
      });
    });

    this.attachToolHandlers();
    this.renderGraph();
  }

  // @ts-ignore
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
          'width':              42,
          'height':             42,
          'shape':              'ellipse',
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-color': '#00b894',
          'border-width': 3,
          'box-shadow':   '0 0 0 3px rgba(0,184,148,0.3)',
        },
      },
      {
        selector: 'node.input-node',
        style: {
          'border-color': '#00b894',
          'border-width': 3,
        },
      },
      {
        selector: 'node.output-node',
        style: {
          'border-color': '#f5c542',
          'border-width': 3,
        },
      },
      {
        selector: 'node.pending-source',
        style: {
          'border-color': '#6c63ff',
          'border-width': 4,
          'background-color': '#2a2660',
        },
      },
      {
        selector: 'edge',
        style: {
          'width':              2,
          'line-color':         '#6c63ff',
          'target-arrow-color': '#6c63ff',
          'target-arrow-shape': 'triangle',
          'curve-style':        'bezier',
          'label':              'data(gain)',
          'color':              '#4a5068',
          'font-family':        'JetBrains Mono, monospace',
          'font-size':          11,
          'font-weight':        500,
          'text-background-color':   '#f7f8fc',
          'text-background-opacity': 0.85,
          'text-background-padding': '2px',
          'text-rotation':      'autorotate',
        },
      },
      {
        selector: 'edge[?selfLoop]',
        style: {
          'curve-style':    'loop',
          'loop-direction': '-45deg',
          'loop-sweep':     '45deg',
          'line-color':     '#00b894',
          'target-arrow-color': '#00b894',
        },
      },
      {
        selector: 'edge:selected',
        style: {
          'line-color':         '#f5c542',
          'target-arrow-color': '#f5c542',
          'width':              3,
        },
      },
    ];
  }
  // ── Tool Handlers ─────────────────────────────────────────
  private attachToolHandlers(): void {
    // Tap on background → add node (if add-node tool active)
    this.cy.on('tap', (evt) => {
      if (evt.target === this.cy && this.activeTool === 'add-node') {
        this.ngZone.run(() => this.addNodeAt(evt.position));
      }
      // Cancel pending branch source if background tapped
      if (evt.target === this.cy && this.activeTool === 'add-branch') {
        this.clearPendingSource();
      }
    });

    // Tap on node
    this.cy.on('tap', 'node', (evt) => {
      const nodeId = evt.target.id() as string;
      this.ngZone.run(() => {
        if (this.activeTool === 'add-branch') {
          this.handleBranchNodeTap(nodeId);
        }
      });
    });

    // Tap on edge → set gain if set-gain tool active
    this.cy.on('tap', 'edge', (evt) => {
      if (this.activeTool === 'set-gain') {
        const currentGain = evt.target.data('gain') as string;
        this.ngZone.run(() => {
          const gain = prompt('Enter gain for this branch:', currentGain || '1');
          if (gain !== null) {
            this.pushUndo();
            evt.target.data('gain', gain);
            this.emitGraphChanged();
          }
        });
      }
    });

    // Enable/disable panning/dragging based on tool
    this.cy.on('grab', 'node', () => {
      if (this.activeTool !== 'move' && this.activeTool !== 'select') {
        // Prevent dragging in add modes
      }
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
      'set-gain':   'pointer',
    };
    container.style.cursor = cursors[this.activeTool] ?? 'default';

    // Enable node dragging only for select/move
    this.cy.nodes().ungrabify();
    if (this.activeTool === 'select' || this.activeTool === 'move') {
      this.cy.nodes().grabify();
    }
  }

  // ── Add Node ──────────────────────────────────────────────
  private addNodeAt(position: { x: number; y: number }): void {
    this.pushUndo();
    const id    = `x${this.nodeCounter++}`;
    const label = id;
    this.cy.add({ group: 'nodes', data: { id, label }, position });

    // Update internal graph model
    this.graph.nodes.push({ id, label });
    this.emitGraphChanged();
  }

  // ── Add Branch ────────────────────────────────────────────
  private handleBranchNodeTap(nodeId: string): void {
    if (!this.pendingBranchSource) {
      // First tap: set source
      this.pendingBranchSource = nodeId;
      this.cy.$(`#${nodeId}`).addClass('pending-source');
    } else {
      // Second tap: set target, prompt for gain
      const source = this.pendingBranchSource;
      const target = nodeId;
      this.clearPendingSource();

      const gain = prompt(`Gain for branch ${source} → ${target}:`, '1') ?? '1';
      this.pushUndo();

      const edgeId = `e_${source}_${target}_${Date.now()}`;
      const isSelf = source === target;
      this.cy.add({
        group: 'edges',
        data: { id: edgeId, source, target, gain, selfLoop: isSelf || undefined },
      });

      this.graph.edges.push({ id: edgeId, from: source, to: target, gain });
      this.emitGraphChanged();
    }
  }

  private clearPendingSource(): void {
    if (this.pendingBranchSource) {
      this.cy.$(`#${this.pendingBranchSource}`).removeClass('pending-source');
      this.pendingBranchSource = null;
    }
  }

  // ── Render Graph from @Input ──────────────────────────────
  renderGraph(): void {
    if (!this.cy) return;
    this.cy.elements().remove();

    // Auto-layout nodes without positions
    const hasPositions = this.graph.nodes.some(n => n.x !== undefined);

    const cyNodes = this.graph.nodes.map((n, i) => ({
      group: 'nodes' as const,
      data: { id: n.id, label: n.label },
      position: n.x !== undefined
        ? { x: n.x, y: n.y! }
        : { x: 120 + i * 130, y: 200 },  // auto horizontal layout
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

    if (!hasPositions) {
      this.cy.layout({ name: 'preset' }).run();
    }

    this.cy.fit(undefined, 60);
    this.nodeCounter = this.graph.nodes.length + 1;
    this.updateCursor();
  }

  // ── Mark Input / Output Nodes ─────────────────────────────
  private markIONodes(): void {
    this.cy.nodes().removeClass('input-node output-node');
    if (this.graph.inputNode)  this.cy.$(`#${this.graph.inputNode}`).addClass('input-node');
    if (this.graph.outputNode) this.cy.$(`#${this.graph.outputNode}`).addClass('output-node');
  }

  // ── I/O Dropdowns ─────────────────────────────────────────
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

  // ── Delete Selected ───────────────────────────────────────
  deleteSelected(): void {
    const selected = this.cy.$(':selected');
    if (selected.length === 0) return;
    this.pushUndo();

    selected.forEach(el => {
      if (el.isNode()) {
        this.graph.nodes  = this.graph.nodes.filter(n => n.id !== el.id());
        this.graph.edges  = this.graph.edges.filter(e => e.from !== el.id() && e.to !== el.id());
      } else { // @ts-ignore
        if (el.isEdge()) {
                // @ts-ignore
          this.graph.edges = this.graph.edges.filter(e => e.id !== el.id());
              }
      }
    });

    selected.remove();
    this.emitGraphChanged();
  }

  // ── Undo / Redo ───────────────────────────────────────────
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
    this.renderGraph();
    this.emitGraphChanged();
  }

  redo(): void {
    if (!this.canRedo) return;
    this.undoStack.push(this.cloneGraph());
    this.graph = this.redoStack.pop()!;
    this.renderGraph();
    this.emitGraphChanged();
  }

  private cloneGraph(): ParsedGraph {
    return JSON.parse(JSON.stringify(this.graph));
  }

  // ── Zoom ──────────────────────────────────────────────────
  zoomIn():     void { this.cy.zoom(this.cy.zoom() * 1.2); this.cy.center(); }
  zoomOut():    void { this.cy.zoom(this.cy.zoom() / 1.2); this.cy.center(); }
  fitToScreen():void { this.cy.fit(undefined, 60); }

  // ── Export PNG ────────────────────────────────────────────
  exportAsPng(): void {
    const png64 = this.cy.png({ full: true, scale: 2, bg: '#f0f2f8' });
    const link  = document.createElement('a');
    link.href   = png64;
    link.download = 'signal-flow-graph.png';
    link.click();
  }

  // ── Emit current graph state upward ──────────────────────
  private emitGraphChanged(): void {
    // Capture current Cytoscape node positions into graph model
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




}
