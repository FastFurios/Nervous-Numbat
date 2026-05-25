import { Component } from '@angular/core';
import { System } from "../services/system"

@Component({
  selector: 'app-statistics',
  imports: [],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css',
})
export class Statistics {

  constructor(public sys: System) { }

}
