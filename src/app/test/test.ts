import { Component } from '@angular/core'
import { AsyncPipe } from '@angular/common' 
import { interval, Subscription, Observable } from 'rxjs';


@Component({
  selector: 'test',
  imports: [AsyncPipe],
  template: `
            <h1>Test Bed</h1>
            <p> counter: {{ counter$ | async  }} </p>
            <button type="button" (click)="start()"> Run  </button>
            <button type="button" (click)="stop()">  Stop </button>
            `,
  styleUrl: './test.css',
})
export class Test {

  ctr = 0;
  sub?: Subscription;
  counter$?: Observable<number>
//iterating: boolean = false

  start() {
    console.group("start()")
    if (this.sub) return; // already running
    console.group("\t\tstarting intervals... ")
    this.counter$ = interval(100)    
    this.sub = this.counter$.subscribe(() => this.ctr++);
  }

  stop() {
    console.group("stop()")
    this.counter$ = undefined 
    this.sub?.unsubscribe();
    this.sub = undefined;
  }
}