import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {Results} from '../../Models/results';

@Component({
  selector: 'app-left-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './left-bar.html',
  styleUrl: './left-bar.css',
})
export class LeftBar implements OnChanges {
  @Output() calculateRequested = new EventEmitter<void>();
  @Input() results: Results | null = null;
  @Input() loading = false;

  // ── Accordion state ───────────────────────────────────────────────────────
  open: Record<string, boolean> = {
    tf: false,
    paths: false,
    loops: false,
    nonTouching: false,
    delta: false,
  };

  toggle(panel: string): void {
    this.open[panel] = !this.open[panel];
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['results'] && this.results) {
      this.open['tf'] = true; // auto-open TF panel when results arrive
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  onCalculate(): void {
    this.calculateRequested.emit();
  }

  // ── Template helpers ──────────────────────────────────────────────────────
  formatPath(nodes: string[]): string {
    return nodes.join(' → ');
  }
}
