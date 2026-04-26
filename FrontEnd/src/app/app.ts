import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {LeftBar} from './Components/left-bar/left-bar';
import {Canvas} from './Components/canvas/canvas';
import {Footer} from './Components/footer/footer';
import {Rightbar} from './Components/rightbar/rightbar';
import {ResultsPopUp} from './Components/results-pop-up/results-pop-up';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LeftBar, Canvas, Footer, Rightbar, ResultsPopUp],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('FrontEnd');
}
