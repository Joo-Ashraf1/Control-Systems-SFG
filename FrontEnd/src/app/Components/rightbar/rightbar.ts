import {Component, EventEmitter, Input, Output} from '@angular/core';
import {NgClass} from '@angular/common';
import {ParsedGraph} from '../../Models/parsed-graph';
import { Results } from '../../Models/results';
import {Parsing} from '../../Services/parsing';
import { TxtParseResult } from '../../Models/txt-parse-result';

@Component({
  selector: 'app-rightbar',
  imports: [
    NgClass
  ],
  templateUrl: './rightbar.html',
  styleUrl: './rightbar.css',
})
export class Rightbar {
  @Input() graph:ParsedGraph={
    nodes: [],
    edges: [],
    inputNode: '',
    outputNode: ''
  };
  @Input() result:Results|null=null;

  @Output() graphLoaded = new EventEmitter<ParsedGraph>();
  @Output() exportRequest= new EventEmitter<void>();
   parseErrors: string[] = [];
  parseSuccess = false;

  constructor(private p: Parsing) {}
  get nodeCount(): number {
    return this.graph.nodes.length;
  }

  get edgeCount(): number {
    return this.graph.edges.length;
  }
  get loopCount(): number {
    return this.result?.loops.length ?? 0;
  }
  get pathCount(): number {
    return this.result?.forwardPaths.length ?? 0;
  }
  get statusClass(): string {
    if (!this.nodeCount)  return 'status-indicator--idle';
    if (this.result)      return 'status-indicator--ready';
    return 'status-indicator--idle';
  }
 
  get statusLabel(): string {
    if (!this.nodeCount)  return 'Graph empty';
    if (this.result)      return 'Analysis complete';
    return 'Ready to calculate';
  }
  //File loading logic
    onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
 
    // Reset previous state
    this.parseErrors  = [];
    this.parseSuccess = false;
 
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed: TxtParseResult = this.p.parseTxtFile(content);
 
      if (parsed.success && parsed.graph) {
        this.parseSuccess = true;
        this.parseErrors  = [];
        this.graphLoaded.emit(parsed.graph);
      } else {
        this.parseSuccess = false;
        this.parseErrors  = parsed.errors;
      }
    };
 
    reader.onerror = () => {
      this.parseErrors = ['Failed to read the file. Please try again.'];
    };
 
    reader.readAsText(file);
    // Reset so the same file can be re-loaded if needed
    input.value = '';
  }
 
  /** Trigger the hidden file input */
  openFilePicker(inputEl: HTMLInputElement): void {
    inputEl.click();
  }
 
  // ── Export ────────────────────────────────────────────────
  onExport(): void {
    this.exportRequest.emit();
  }
 
  clearErrors(): void {
    this.parseErrors  = [];
    this.parseSuccess = false;
  }

}
