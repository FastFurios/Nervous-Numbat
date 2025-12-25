
// #########################################################################################
// Project: NERVOUS NUMBAT
// G.Lindorfer, from 2025-10 to ...
// #########################################################################################

// Exakte Flächenberechnung der Dreiecksgruppe: 
// $ npm install martinez-polygon-clipping (siehe ChatGPT für "Polygon Union")




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
