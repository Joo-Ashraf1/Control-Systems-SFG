import { Component, EventEmitter, Input, Output } from '@angular/core';
import {FormsModule} from '@angular/forms';

type ToolId = 'select' | 'move' | 'add-node' | 'add-branch' | 'set-gain';
@Component({
  selector: 'app-footer',
  imports: [
    FormsModule
  ],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {

  @Input() activeTool: ToolId = 'select';
  @Input() canRedo = false;
  @Input() canUndo = false;
  @Output() toolChanged    = new EventEmitter<ToolId>();
  @Output() gainApplied    = new EventEmitter<string>();
  @Output() undoRequested  = new EventEmitter<void>();
  @Output() redoRequested  = new EventEmitter<void>();
  @Output() deleteRequested = new EventEmitter<void>();

  gainValue = '';

  get showGainInput(): boolean {
    return this.activeTool === 'set-gain';
  }

  selectTool(tool: ToolId): void {
    this.toolChanged.emit(tool);
  }

  applyGain(): void {
    const trimmed = this.gainValue.trim();
    if (trimmed) {
      this.gainApplied.emit(trimmed);
      // Don't clear — user may want to apply same gain to multiple edges
    }
  }

  onGainKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.applyGain();
  }

  onUndo():   void { this.undoRequested.emit(); }
  onRedo():   void { this.redoRequested.emit(); }
  onDelete(): void { this.deleteRequested.emit(); }


}
