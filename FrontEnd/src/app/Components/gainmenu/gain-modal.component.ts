import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-gain-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gain-modal.html',
  styleUrl: './gain-modal.css',
})
export class GainModal implements OnChanges {
  @Input() visible = false;
  @Input() sourceNode = '';
  @Input() targetNode = '';
  @Input() initialValue = '1';
  @Input() mode: 'add-branch' | 'set-gain' = 'add-branch';

  @Output() confirmed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  gainValue = '1';

  ngOnChanges(changes: SimpleChanges): void {
    // Every time the modal opens, reset gainValue to the initialValue
    if (changes['visible'] && this.visible) {
      this.gainValue = this.initialValue || '1';
    }
    if (changes['initialValue'] && this.visible) {
      this.gainValue = this.initialValue || '1';
    }
  }

  setQuick(val: string): void {
    this.gainValue = val;
  }

  onConfirm(): void {
    const v = this.gainValue.trim();
    if (!v) return;
    this.confirmed.emit(v);
    this.gainValue = '1';
  }

  onCancel(): void {
    this.cancelled.emit();
    this.gainValue = '1';
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.onConfirm();
    if (e.key === 'Escape') this.onCancel();
  }

  get modalTitle(): string {
    return this.mode === 'set-gain' ? 'Edit Branch Gain' : 'Set Branch Gain';
  }

  get confirmLabel(): string {
    return this.mode === 'set-gain' ? 'Update Gain' : 'Apply Gain';
  }
}