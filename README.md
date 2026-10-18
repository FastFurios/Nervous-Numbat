# NervousNumbat

## The idea
The idea for this project came to me during a team exercise at a company offsite. Called "The Systemic Triangle Exercise", it aims to show team members that a team is a dynamic system made up of its individual members and the relationships and dependencies between them. I was intrigued by the evolving dynamics and by how unpredictable the final result is when the motion gradually comes to a halt.

Here is a concise description of the exercise, taken from https://www.ihrprojekt.at/de/blog/erfahrungsschatz/84-teambuilding-spiele-systemische-dreiecksuebung:

```
Team-Building Exercise: The Systemic Triangle Exercise

Systems are shaped by invisible relationships and marked by dependencies and interdependencies. The systemic triangle exercise is one way to make these concepts tangible for a project team.

The exercise needs no materials. It is particularly useful for showing how the elements of a system are connected.

- Participants spread out across a room. Each one secretly picks two other members of the group.
- Each participant's task is to form an equilateral triangle with these two people, without telling them and without anyone speaking.
- All participants then move through the room to find their position relative to the two people they chose.
- Over time, movement in the room decreases until every participant has found a position and keeps the required distances. The participants then reveal whom they chose as their reference points.

This exercise is easy to run and shows clearly the relationships at work within a system. Each participant tries to find their own position, but can only do so in response to the movements of everyone else. A system creates dependencies and interdependencies. The exercise shows that a team cannot succeed if its members think only about their own tasks; they must also take the activities of others into account.
```

I asked the facilitator how long it typically takes for the exercise to come to a standstill. She said 5 to 10 minutes. After thinking about it for a while, I began to wonder whether that could really be true. I suspected that a standstill is only reached because people neglect precision in forming equilateral triangles; after all, humans have a limited ability to measure distances and angles exactly without tools. In fact, it quickly became clear that, in most cases, the chosen structure of hidden relationships between participants makes it impossible for all triangles to reach a perfect equilateral shape at the same time.

Driven by my fascination with dynamic systems and the emergent behaviour they sometimes produce, I developed "Nervous Numbat", an app that simulates the systemic triangle exercise. I hope you have fun playing around with it and trying out randomized or self-defined structures (via JSON file input).

## The app
Here is a short description of the app and how to use it.

## General Terminology
| Term | Description | Aliases |
| :------| :------------------------ | :---------------------|
| Actor | A member of the team taking part in the exercise. Alternative interpretation: an active node in the system structure whose evolution is being simulated. | Team member |
| Actor Group | A team taking part in the exercise. Alternative interpretation: a system structure whose evolution is being simulated. | Team |
| Barrier | A vertical or horizontal line that Actors cannot cross. |  |
| Barrier Set | A set of connected Barriers that form a closed rectilinear polygon. |  |
| Boundary | A rectangle within which the Actors move during the Simulation. |  |
| Canvas | The display area on which the Simulation is visualized. |  |
| Widget | An additional display, e.g. a second Canvas that shows the System evolving or shows statistics. |  |
| Configuration | One or more Actor Groups, with the relationship structure among their Actors, plus any Barrier Sets. It represents the static aspects of a Nervous Numbat System. |  |
| Nervous Numbat System | A Configuration that evolves through the motion of its Actors during the Simulation. | System |
| Iteration | The calculation of the System's next state from its current state. |  |
| Simulation | A sequence of Iterations. |  |
| Start Box | The Boundary at the start of the Simulation. |  |
| Quality | A measure of how close a triangle is to being perfectly equilateral (100%). Quality can also mean the average triangle quality of an Actor Group. |  |
| Expanse | An approximate measure of the area covered by an Actor Group. |  |
| Performance | An approximate measure for an Actor Group: Quality × Expanse. |  |

## UI - Configuration
| Term | Description | Aliases |
| :------| :------------------------ | :---------------------|
| Upload | Loads a JSON file with one or more self-defined Actor Groups and Barrier Sets into the app. |  |
| Randomize | The app generates one or more Actor Groups at random. |  |
| Start Box Margin | Defines how much margin is left on the Canvas outside the Start Box. |  |
| Clustering | A factor that influences how evenly the relationships between Actors are randomly established. 0 = the most even distribution, i.e. every Actor is used as a reference by approximately the same number of other Actors. A high value such as 2.00 connects most Actors to a few "dominant" Actors. |  |
| Setup System | Takes the Configuration and prepares the System for the Simulation. |  |
| Download | Downloads a JSON file with the Configuration, including the current positions of its Actors. |  |
| Discard | Discards the current Configuration. |  |

## UI - Simulation
| Term | Description | Aliases |
| :------| :------------------------ | :---------------------|
| Run | Runs or resumes the Simulation. |  |
| Stop | Stops the Simulation. |  |
| Reset | Resets the Simulation to the Configuration at the start. |  |
| Iteration interval | The time between two Iterations (in milliseconds). |  |
| Maximum Move Distance | The maximum distance an Actor can move in a single Iteration. |  |
| Aim at alternative vertex on poor Quality | For every edge of a triangle there are two possible positions for the third vertex that form an equilateral triangle. If this toggle switch is on, Actors whose triangles are of poor Quality start moving towards the other vertex, in the hope of improving their triangle's Quality in the long run. |  |
| inelastic | When an Actor bumps into a Barrier, it stops at that point for this Iteration. |  |
| rebound | When an Actor hits a Barrier at an angle of incidence, it bounces off at the same angle of reflection. |  |
| unlimited | There is no Boundary for the Actors. |  |

## UI - Canvas Display
| Term | Description | Aliases |
| :------| :------------------------ | :---------------------|
| Home | While the Simulation is running, resizes and repositions the display so that the Start Box is visible on the Canvas. |  |
| Focus First | Centers the Canvas on the center of the first Actor Group. |  |
| Triangles | Shows the relationships between each Actor and the two Actors it observes, and visualizes the resulting triangle. |  |
| Actor Ids | Shows the Ids of the Actors. |  |
| Triangle quality | Shows the Quality of each Actor's triangle. |  |
| Observees | Shows the names of the observed Actors alongside each Actor's Id. |  |
| Group Info | Shows data about the Actor Group: name, Quality, Expanse and Performance. |  |
| Journeys | Keeps the display of previous Iterations instead of erasing it. If the toggle switch is on, -1 means all Actors; if an Actor is chosen, only that Actor's journey is displayed on the Canvas. Note: the number is the number in the Actor's Id. |  |

You can also scroll to zoom the display of a Canvas in and out.
In addition, you can pick up an Actor (mouse down) and drag it to another place (mouse up).

## Creating Your Own Configuration
A Configuration is a JSON file that you load with **Upload**. The `configurations/` folder contains examples you can start from. The simplest way to get a valid file is to set up a System in the app and use **Download**.

### Structure
```json
{
  "id": "My Configuration",
  "actor_groups": [ ... ],
  "barrier_set":  { ... }
}
```
`id` is the Configuration's name, `actor_groups` lists one or more Actor Groups, and `barrier_set` is optional.

### Coordinates
Every Actor Group and the Barrier Set can have a `coordinate_type`:
- `"relative"` (the default): `x` and `y` run from 0 to 100 as a percentage of the initial Canvas.
- `"real"`: absolute coordinates, as used in downloaded files.

### Actor Groups
Each Actor Group has an `id` and a `creation_mode`, which determines how the rest of the group is defined.

**`"explicit"`**: you define every Actor and its relationships yourself.
```json
{
  "id": "Group A",
  "creation_mode": "explicit",
  "coordinate_type": "relative",
  "iteration_mode": "dynamic",
  "topology": [
    { "id": "Bird-00", "x": 30, "y": 50,  "observee1": "Bird-01", "observee2": "Bird-02" },
    { "id": "Bird-01", "x": 70, "y": 40,  "observee1": "Bird-00", "observee2": "Bird-02" },
    { "id": "Bird-02", "x": 20, "y": 100, "observee1": "Bird-00", "observee2": "Bird-01" }
  ]
}
```
- Every Actor needs a unique `id` and two observees: the Ids of the two other Actors it forms its triangle with.
- `x` and `y` are optional. If you leave them out, the Actor is placed at random.
- `iteration_mode` is optional and defaults to `"dynamic"` (the Actors move during the Simulation).

**`"automatic"`**: the app generates the Actors and their relationships at random.
```json
{
  "id": "Group B",
  "creation_mode": "automatic",
  "topology": {
    "number_actors": 15,
    "clustering": 0,
    "start_box": {
      "lower_left":  { "x": 60, "y": 60 },
      "upper_right": { "x": 90, "y": 90 }
    }
  }
}
```
- `number_actors` is the size of the group.
- `clustering` works like the **Clustering** setting in the UI (0 to about 2.0).
- `start_box` is the rectangle in which the Actors are initially placed. Its coordinates are always relative.

**`"obstacle"`**: a rectangular box that does not move.
```json
{
  "id": "Obstacle",
  "creation_mode": "obstacle",
  "obstacle": {
    "lower_left":  { "x": 50, "y": 30 },
    "upper_right": { "x": 55, "y": 100 }
  }
}
```

### Barrier Set
A Barrier Set is a list of vertical or horizontal line segments that Actors cannot cross. Connect the segments end to end to form a closed rectilinear polygon. A single point can override the set's `coordinate_type` with its own `"coordType"`.
```json
"barrier_set": {
  "coordinate_type": "relative",
  "barriers": [
    { "from": { "x": 25, "y": 0  }, "to": { "x": 25, "y": 30 } },
    { "from": { "x": 25, "y": 30 }, "to": { "x": 40, "y": 30 } },
    { "from": { "x": 40, "y": 30 }, "to": { "x": 40, "y": 0  } },
    { "from": { "x": 40, "y": 0  }, "to": { "x": 25, "y": 0  } }
  ]
}
```
