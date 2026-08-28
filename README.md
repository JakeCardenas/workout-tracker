# reps

An interactive workout guide and tracker. Browse an exercise library, turn any
movement into a configured workout, run it set by set with a rest timer, and
watch the numbers move over time.

Static site. No build step, no dependencies, no framework.

## Running it

Any static server works:

    python3 -m http.server 4174

Then open http://localhost:4174

Opening `index.html` directly works too — there are no image files to load and
nothing is fetched at runtime.

## Structure

    index.html              app shell, nav and script order
    css/style.css           design tokens and all styling
    js/
      data/exercises.js     36 exercises: coaching notes, muscles, defaults
      data/templates.js     six starting workouts
      store.js              one localStorage document plus every mutation
      sound.js              synthesized cues for sets, rest and records
      units.js              kg / lb conversion, one canonical unit
      plates.js             bar loading, warm-up ramps, 1RM estimate
      backup.js             export and restore the whole state as JSON
      icons.js              icon set and the muscle map renderer
      figures.js            pose system that draws every exercise
      ui.js                 steppers, sheets, toasts, formatting
      library.js            library view, filtering, exercise detail sheet
      builder.js            workout builder, reordering, saved workouts
      session.js            workout mode, rest timer, completion summary
      progress.js           history log and per-exercise progress

## Notes

Every illustration is drawn in code, so there are no image files anywhere.
`figures.js` is a small pose system: a set of joint coordinates per exercise
plus equipment primitives (barbell, dumbbell, bench, rack, cable stack), drawn
as round-capped strokes on a 512 square. Each pose is auto-fitted to its tile
from its own bounding box, so all 36 sit at the same visual weight.

Each figure also carries its target muscles: soft discs sit under the strokes
on the worked areas, solid for primary and faint for secondary, so a card shows
both the movement and what it trains. The detail view adds a full **muscle
map** on top of that, with front and back views built from one part list.

All state lives in a single localStorage key (`reps.state.v1`) behind
`store.js`. Views never touch storage directly, so swapping in a real backend
means rewriting `load` and `persist` and leaving everything else alone.

For any barbell lift the config block shows what to actually load: the plates
per side and the bar underneath it, recalculated as you tap the stepper. Open
the warm-up ramp and it lays out the build to your working set. Workout mode
carries the same strip, so the numbers are there while you are at the rack.

Progress estimates a one-rep max with Epley, taken from the best real
weight-and-rep pair in a session rather than pairing the heaviest weight with
the highest reps from different sets.

Backups are plain JSON. Export writes a dated file, import validates the shape
before replacing anything, and a file that is not a backup is refused instead
of quietly wiping your history.

Weight is always stored in kilograms. `units.js` converts only at the edges —
on the way into a stepper and on the way back out — so switching to pounds
never rewrites your history, and the numbers snap to real plate increments
(2.5 kg or 5 lb) instead of showing 132.27.

The rest timer works off timestamps rather than a counter, so backgrounding the
tab does not drift it. `visibilitychange` restarts the animation loop the
moment you come back.

Cache busting is manual: `index.html` links CSS and JS with a `?v=` query. Bump
it when you edit either, or a browser may pair a new file with a stale one.

Sound is off-by-default-safe: no audio context exists until the first real
interaction, and the toggle in the sidebar persists the choice. Every cue is
synthesized — filtered noise bursts and sine tones through a limiter — so
hovering ticks, buttons click, panels swell, and banking a set, finishing a
rest, hitting a record and completing a workout each get their own tone.

Animations stay cheap: a stagger on the library grid, a stroke draw-on when a
figure first appears, a spring on the set dots and the rest ring counting down.
Everything collapses under `prefers-reduced-motion`, including the dash offsets
that would otherwise leave a figure invisible.

## Credit

The exercise-library concept was inspired by
[Bryl Lim's Workout Guide](https://github.com/bryllim/workout-guide), which
publishes 302 exercise illustrations as an npm package. None of those assets
are used here — the figures in this project are drawn from scratch in
`figures.js` so the app stays dependency-free. Code, design, data and the
tracking half of the app are original.
