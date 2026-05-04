import { Component, signal, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgIf, NgFor } from '@angular/common';
import { LeftBar } from './Components/left-bar/left-bar';
import { Canvas } from './Components/canvas/canvas';
import { Footer } from './Components/footer/footer';
import { Rightbar } from './Components/rightbar/rightbar';
import { ResultsPopUp } from './Components/results-pop-up/results-pop-up';
import { ParsedGraph } from './Models/parsed-graph';
import { Results } from './Models/results';
import { Parsing } from './Services/parsing';
import { API } from './Services/api';
import { GraphValidationService } from './Services/graph-validation.service';

type ToolId = 'select' | 'move' | 'add-node' | 'add-branch';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgIf, NgFor, LeftBar, Canvas, Footer, Rightbar, ResultsPopUp],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('FrontEnd');

  graph: ParsedGraph = { nodes: [], edges: [], inputNode: '', outputNode: '' };
  result: Results | null = null;
  selectedItem: any = null;

  currentErrors: string[] = [];
  showErrorModal = false;

  // Canvas / toolbar state
  activeTool: ToolId = 'select';
  isCalculating = false;
  calculateError = '';

  @ViewChild('canvasRef') canvasRef!: Canvas;

  constructor(private parsing: Parsing, private api: API, private validation: GraphValidationService) {}

  closeErrorModal(): void {
    this.showErrorModal = false;
  }

  onCalculate(): void {
    this.currentErrors = this.validation.validateGraph(this.graph);
    if (this.currentErrors.length > 0) {
      this.showErrorModal = true;
      return;
    }

    this.isCalculating = true;
    this.calculateError = '';

    this.api.calculate(this.graph).subscribe({
      next: (res) => {
        this.result = res;
        this.isCalculating = false;
      },
      error: (err) => {
        this.isCalculating = false;
        this.calculateError = err.message || 'Calculation failed';
        alert(`Error: ${this.calculateError}`);
        console.error('API Error:', err);
      }
    });
  }

  /** Called when right-sidebar successfully parses a TXT file. */
  onGraphLoaded(graph: ParsedGraph): void {
    this.graph  = graph;
    this.result = null;
    this.selectedItem = null;
    this.currentErrors = this.validation.validateGraph(this.graph);
  }

  /** Delegate PNG export to canvas component */
  onExportRequest(): void {
    this.canvasRef?.exportAsPng();
  }

  /**
   * Canvas emits this whenever nodes/edges change (add, move, delete).
   * Keep app.graph in sync so the backend receives the latest graph.
   */
  onGraphChanged(graph: ParsedGraph): void {
    this.graph  = graph;
    this.result = null;
    this.currentErrors = this.validation.validateGraph(this.graph);
  }

  onSelectionChanged(item: any): void {
    this.selectedItem = item;
  }

  onEditGainRequested(edgeId: string): void {
    this.canvasRef?.openGainModalForEdge(edgeId);
  }

  onNodeLabelChanged(event: {id: string, label: string}): void {
    this.canvasRef?.updateNodeLabel(event.id, event.label);
  }

  onToolChanged(tool: ToolId): void {
    this.activeTool = tool;
  }

  onUndoRequested():   void { this.canvasRef?.undo(); }
  onRedoRequested():   void { this.canvasRef?.redo(); }
  onDeleteRequested(): void { this.canvasRef?.deleteSelected(); }
}
