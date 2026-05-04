import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ChangeDetectorRef,
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

  
  open: Record<string, boolean> = {
    tf: false,
    paths: false,
    loops: false,
    nonTouching: false,
    delta: false,
  };

  constructor(private cdr: ChangeDetectorRef) {}

  toggle(panel: string): void {
    this.open[panel] = !this.open[panel];
    this.cdr.detectChanges();
  }

  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['results'] && this.results) {
      
      this.open['tf'] = true;
      this.cdr.detectChanges();
    }
    if (changes['loading']) {
      this.cdr.detectChanges();
    }
  }

  
  onCalculate(): void {
    this.calculateRequested.emit();
  }

  
  formatPath(nodes: string[]): string {
    return nodes.join(' → ');
  }
}