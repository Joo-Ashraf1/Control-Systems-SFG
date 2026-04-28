import { Component, EventEmitter, Input, Output } from '@angular/core';
import {FormsModule} from '@angular/forms';

type ToolId = 'select' | 'move' | 'add-node' | 'add-branch';
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
  @Output() undoRequested  = new EventEmitter<void>();
  @Output() redoRequested  = new EventEmitter<void>();
  @Output() deleteRequested = new EventEmitter<void>();

  selectTool(tool: ToolId): void {
    this.toolChanged.emit(tool);
  }

  onUndo():   void { this.undoRequested.emit(); }
  onRedo():   void { this.redoRequested.emit(); }
  onDelete(): void { this.deleteRequested.emit(); }


}
