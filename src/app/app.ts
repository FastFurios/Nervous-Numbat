import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MainCanvas } from "./main-canvas/main-canvas";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MainCanvas],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Nervous-Numbat');
}
