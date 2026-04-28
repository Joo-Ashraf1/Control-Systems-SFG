import { Component, signal, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LeftBar } from './Components/left-bar/left-bar';
import { Canvas } from './Components/canvas/canvas';
import { Footer } from './Components/footer/footer';
import { Rightbar } from './Components/rightbar/rightbar';
import { ResultsPopUp } from './Components/results-pop-up/results-pop-up';
import { ParsedGraph } from './Models/parsed-graph';
import { Results } from './Models/results';
import { Parsing } from './Services/parsing';

type ToolId = 'select' | 'move' | 'add-node' | 'add-branch' | 'set-gain';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LeftBar, Canvas, Footer, Rightbar, ResultsPopUp],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('FrontEnd');

  graph: ParsedGraph = { nodes: [], edges: [], inputNode: '', outputNode: '' };
  result: Results | null = null;

  // Canvas / toolbar state
  activeTool: ToolId = 'select';
  isCalculating = false;
  calculateError = '';

  /**
   * The gain value typed in the footer toolbar.
   * Passed to the canvas so the modal can pre-fill it.
   */
  pendingGain = '1';

  @ViewChild('canvasRef') canvasRef!: Canvas;

  constructor(private parsing: Parsing) {}

  /** Called when right-sidebar successfully parses a TXT file. */
  onGraphLoaded(graph: ParsedGraph): void {
    this.graph  = graph;
    this.result = null;
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
  }

  onToolChanged(tool: ToolId): void {
    this.activeTool = tool;
  }

  /**
   * Footer emits the gain value the user typed.
   * We store it and forward it to the canvas as [pendingGainValue].
   * The canvas will pre-fill this into the modal when it opens.
   */
  onGainApplied(gain: string): void {
    this.pendingGain = gain;
  }

  onUndoRequested():   void { this.canvasRef?.undo(); }
  onRedoRequested():   void { this.canvasRef?.redo(); }
  onDeleteRequested(): void { this.canvasRef?.deleteSelected(); }
}