import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-left-bar',
  imports: [],
  templateUrl: './left-bar.html',
  styleUrl: './left-bar.css',
})
export class LeftBar {
  @Output() calculateRequested = new EventEmitter<void>();

  onCalculate(): void {
    this.calculateRequested.emit();
  }
}
