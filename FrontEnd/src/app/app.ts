import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {LeftBar} from './Components/left-bar/left-bar';
import {Canvas} from './Components/canvas/canvas';
import {Footer} from './Components/footer/footer';
import {Rightbar} from './Components/rightbar/rightbar';
import {ResultsPopUp} from './Components/results-pop-up/results-pop-up';
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
 
  // Reference to canvas for undo/redo/delete/export
  
  canvasRef!:Canvas;
 
  constructor(private parsing:Parsing) {}
 
  /**
   * Called when right-sidebar successfully parses a TXT file.
   * Store the new graph and pass it to the canvas (which re-renders).
   */
  onGraphLoaded(graph: ParsedGraph): void {
    this.graph  = graph;
    this.result = null;        // clear old analysis — graph changed
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
    this.result = null;   // invalidate stale result
  }
 
 
  onToolChanged(tool: ToolId): void {
    this.activeTool = tool;
  }
 
  /**
   * When the user applies a gain from the toolbar while an edge is selected
   * on canvas, the canvas component handles it internally via its set-gain tool.
   * This handler is kept here for any additional app-level logic if needed.
   */
  onGainApplied(_gain: string): void {
    // Canvas handles this internally; nothing needed at app level.
  }
 
  onUndoRequested():  void { this.canvasRef?.undo(); }
  onRedoRequested():  void { this.canvasRef?.redo(); }
  onDeleteRequested():void { this.canvasRef?.deleteSelected(); }
}
