
import {
  Component, Input, Output, EventEmitter,
  AfterViewInit, OnChanges, SimpleChanges,
  OnDestroy, ElementRef, ViewChild, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


import cytoscape from 'cytoscape';
import {ParsedGraph} from '../../Models/parsed-graph';

type ToolId = 'select' | 'move' | 'add-node' | 'add-branch' | 'set-gain';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  zoomPercent = 100;

  get isEmpty(): boolean { return this.graph.nodes.length === 0; }
  get nodeIds(): string[] { return this.graph.nodes.map(n => n.id); }

  private pendingBranchSource: string | null = null;
  private undoStack: ParsedGraph[] = [];
  private redoStack: ParsedGraph[] = [];
  private cy!: cytoscape.Core;
  private nodeCounter = 1;

  // Keyboard handler ref so we can remove it on destroy
  private keydownHandler = (e: KeyboardEvent) => this.onKeydown(e);

  constructor(private ngZone: NgZone) {}

  // ── Lifecycle ─────────────────────────────────────────────
  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.initCytoscape();
    });
    // Listen for Delete / Backspace globally
    document.addEventListener('keydown', this.keydownHandler);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['graph'] && this.cy) {
      // Only full re-render when graph comes from OUTSIDE (TXT load)
      // Not when we emit graphChanged ourselves (would cause loop)
      const isExternalChange = changes['graph'].previousValue !== changes['graph'].currentValue;
      if (isExternalChange) {
        this.renderGraph();
      }
    }
    if (changes['activeTool'] && this.cy) {
      this.updateCursor();
      // Clear pending branch when tool changes
      this.clearPendingSource();
    }
  }

  ngOnDestroy(): void {
    this.cy?.destroy();
    document.removeEventListener('keydown', this.keydownHandler);
  }

  // ── Keyboard Handler ──────────────────────────────────────
  private onKeydown(e: KeyboardEvent): void {
    // Don't fire if user is typing in an input/textarea
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

  // ── Cytoscape Init ────────────────────────────────────────
  private initCytoscape(): void {
    this.cy = cytoscape({
      container: this.cyContainer.nativeElement,
      elements: [],
      style: this.buildStylesheet(),
      layout: { name: 'preset' },

      // ── FIX 4: disable double-tap zoom so clicks are instant ──
      userZoomingEnabled:  true,
      userPanningEnabled:  true,
      boxSelectionEnabled: false,   // box select causes square artifact
      selectionType:       'single',
      minZoom: 0.15,
      maxZoom: 4,

      // These two kill the 300ms tap delay completely
      // Cytoscape checks for double-tap by default; setting this low removes delay
      // (actual fix is using 'click' event below, not 'tap')
    });

    this.cy.on('zoom', () => {
      this.ngZone.run(() => {
        this.zoomPercent = Math.round(this.cy.zoom() * 100);
      });
    });

    this.attachToolHandlers();
  }

  // ── Cytoscape Stylesheet ──────────────────────────────────
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
          'width':              44,
          'height':             44,
          'shape':              'ellipse',
          // ── FIX 3: remove the selection square ──
          'overlay-opacity':    0,
          'overlay-padding':    0,
        } as any,
      },
      {
        // Selected node: change border color only — NO box/overlay
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
          // ── FIX 3: remove edge selection overlay too ──
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

  // ── Tool Handlers ─────────────────────────────────────────
  private attachToolHandlers(): void {

    // ── FIX 4: use 'click' instead of 'tap' — zero delay ──

    // Click on background
    this.cy.on('click', (evt) => {
      if (evt.target !== this.cy) return;

      if (this.activeTool === 'add-node') {
        this.ngZone.run(() => this.addNodeAt(evt.position));
      }
      if (this.activeTool === 'add-branch') {
        this.clearPendingSource();
      }
    });

    // Click on node
    this.cy.on('click', 'node', (evt) => {
      const nodeId = evt.target.id() as string;
      if (this.activeTool === 'add-branch') {
        this.ngZone.run(() => this.handleBranchNodeTap(nodeId));
      }
    });

    // Click on edge
    this.cy.on('click', 'edge', (evt) => {
      if (this.activeTool === 'set-gain') {
        const currentGain = evt.target.data('gain') as string;
        this.ngZone.run(() => {
          const gain = prompt(`Gain for this branch:`, currentGain || '1');
          if (gain !== null && gain.trim() !== '') {
            this.pushUndo();
            evt.target.data('gain', gain.trim());
            // Sync to graph model
            const edge = this.graph.edges.find(e => e.id === evt.target.id());
            if (edge) edge.gain = gain.trim();
            this.emitGraphChanged();
          }
        });
      }
    });

    // Sync positions after drag
    this.cy.on('dragfree', 'node', () => {
      this.ngZone.run(() => this.emitGraphChanged());
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

    // Allow node dragging only in select/move modes
    if (this.activeTool === 'select' || this.activeTool === 'move') {
      this.cy.nodes().grabify();
      this.cy.panningEnabled(true);
    } else {
      this.cy.nodes().ungrabify();
      // Keep panning enabled in all modes so user can navigate
      this.cy.panningEnabled(true);
    }
  }

  // ── FIX 2: Add Node — NO fit(), NO renderGraph() ──────────
  private addNodeAt(position: { x: number; y: number }): void {
    this.pushUndo();

    // Find next available id (skip if already exists)
    let id = `x${this.nodeCounter}`;
    const existingIds = new Set(this.graph.nodes.map(n => n.id));
    while (existingIds.has(id)) {
      this.nodeCounter++;
      id = `x${this.nodeCounter}`;
    }
    this.nodeCounter++;

    const label = id;

    // Add directly to cytoscape — do NOT call renderGraph() or fit()
    this.cy.add({
      group: 'nodes',
      data: { id, label },
      position: { x: position.x, y: position.y },
    });

    this.graph.nodes.push({ id, label, x: position.x, y: position.y });
    this.emitGraphChanged();
  }

  // ── Add Branch ────────────────────────────────────────────
  private handleBranchNodeTap(nodeId: string): void {
    if (!this.pendingBranchSource) {
      this.pendingBranchSource = nodeId;
      this.cy.$(`#${nodeId}`).addClass('pending-source');
    } else {
      const source = this.pendingBranchSource;
      const target = nodeId;
      this.clearPendingSource();

      const gain = (prompt(`Gain for branch ${source} → ${target}:`, '1') ?? '').trim() || '1';
      this.pushUndo();

      const edgeId  = `e_${source}_${target}_${Date.now()}`;
      const isSelf  = source === target;

      // Add directly to cytoscape — no renderGraph()
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

  // ── Render Graph from @Input (TXT load / undo / redo) ────
  // This is ONLY called when an external graph is pushed in.
  // It does NOT call fit() so zoom is preserved unless it's the first load.
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

    // Only fit on first load (when nodes have no saved positions)
    if (fitView || !hasPositions) {
      this.cy.fit(undefined, 60);
    }

    this.nodeCounter = Math.max(...this.graph.nodes.map(n => {
      const num = parseInt(n.id.replace(/\D/g, ''), 10);
      return isNaN(num) ? 0 : num;
    }), 0) + 1;
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

  // ── FIX 1: Delete Selected ────────────────────────────────
  deleteSelected(): void {
    const selected = this.cy.$(':selected');
    if (selected.length === 0) return;

    this.pushUndo();

    // Collect IDs to remove
    const nodeIdsToRemove = new Set<string>();
    const edgeIdsToRemove = new Set<string>();

    selected.forEach(el => {
      if (el.isNode()) nodeIdsToRemove.add(el.id());
      if (el.isEdge()) edgeIdsToRemove.add(el.id());
    });

    // When a node is removed, also remove all its connected edges
    nodeIdsToRemove.forEach(nid => {
      this.cy.$(`#${nid}`).connectedEdges().forEach(e => {
        edgeIdsToRemove.add(e.id());
      });
    });

    // Remove from cytoscape first (handles connected edges automatically)
    selected.remove();
    // Also remove dangling edges that were connected to deleted nodes
    edgeIdsToRemove.forEach(eid => {
      this.cy.$(`#${eid}`).remove();
    });

    // Sync graph model
    this.graph.nodes = this.graph.nodes.filter(n => !nodeIdsToRemove.has(n.id));
    this.graph.edges = this.graph.edges.filter(e =>
      !edgeIdsToRemove.has(e.id) &&
      !nodeIdsToRemove.has(e.from) &&
      !nodeIdsToRemove.has(e.to)
    );

    this.emitGraphChanged();
  }

  // ── Undo / Redo ───────────────────────────────────────────
  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  private pushUndo(): void {
    this.undoStack.push(this.cloneGraph());
    this.redoStack = [];           // any new action clears redo
  }

  undo(): void {
    if (!this.canUndo) return;
    this.redoStack.push(this.cloneGraph());
    this.graph = this.undoStack.pop()!;
    // Re-render from graph snapshot — preserve current zoom
    this.renderGraph(false);
    this.emitGraphChanged();
  }

  redo(): void {
    if (!this.canRedo) return;
    this.undoStack.push(this.cloneGraph());
    this.graph = this.redoStack.pop()!;
    this.renderGraph(false);
    this.emitGraphChanged();
  }

  private cloneGraph(): ParsedGraph {
    return JSON.parse(JSON.stringify(this.graph));
  }

  // ── Zoom Controls ─────────────────────────────────────────
  zoomIn():      void { this.cy.zoom({ level: this.cy.zoom() * 1.2, renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 } }); }
  zoomOut():     void { this.cy.zoom({ level: this.cy.zoom() / 1.2, renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 } }); }
  fitToScreen(): void { this.cy.fit(undefined, 60); }

  // ── Export PNG ────────────────────────────────────────────
  exportAsPng(): void {
    const png64 = this.cy.png({ full: true, scale: 2, bg: '#f0f2f8' });
    const link  = document.createElement('a');
    link.href   = png64;
    link.download = 'signal-flow-graph.png';
    link.click();
  }

  // ── Emit graph state upward ───────────────────────────────
  private emitGraphChanged(): void {
    // Capture live positions from cytoscape
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
