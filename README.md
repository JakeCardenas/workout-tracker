# reps

An interactive workout guide and tracker. Browse an exercise library, turn any
movement into a configured workout, run it set by set with a rest timer, and
watch the numbers move over time.

Static site. No build step, no dependencies, no framework.

## Running it

    node backend/server.js

Then open http://localhost:4174. That one command serves the site and the API
together — no npm install, no build step, nothing to configure.

You can still serve the files with anything static (`python3 -m http.server
4174`) or open `index.html` off the disk. Accounts need the backend, so without
it the app offers to carry on without one and keeps everything on the device.

## Accounts

The first thing you see is a sign in / create account screen, or a note that
the server is not running with the option to carry on without an account.

Passwords are hashed with `scrypt` and a per-account salt, compared with
`timingSafeEqual`. Signing in with an address that does not exist still runs the
hash, so response timing gives nothing away, and both failures say the same
thing. Ten bad attempts on an address buys a fifteen minute pause.

The session is a random token in an HttpOnly, SameSite=Lax cookie, and only its
SHA-256 is stored. Page scripts cannot read it, so an XSS bug cannot steal a
session, and a copied database still contains no usable tokens.

Your workouts are written to SQLite about a second after any change and read
back when you sign in. Clearing the browser entirely and reloading gets
everything back from the server.

Signing in on a device that already has workouts does not overwrite them
silently — the local copy is stashed first and the toast offers to keep it
instead.

## Installing it

It is a proper PWA, so on a phone you can open it in the browser and use
Add to Home Screen. It launches standalone, keeps its own icon, and a service
worker precaches the shell so it runs with no signal at all — which suits a
basement gym.

The icons are generated, not drawn by hand:

    python3 tools/make-icons.py

Bump `CACHE` in `sw.js` whenever you bump the `?v=` numbers in `index.html`,
or a returning visitor keeps the old shell.

## Structure

    frontend/                 everything the browser loads
      index.html              markup, and the script order
      sw.js                   offline precache
      site.webmanifest
      css/style.css           design tokens and all styling
      assets/icons/           generated app icons
      js/
        app.js                boot, router, home screen
        data/                 exercises.js, templates.js
        core/                 store.js, units.js, plates.js, backup.js
        ui/                   ui.js, icons.js, figures.js, sound.js
        account/              config.js, api.js, sync.js, gate.js
        views/                library.js, builder.js, workout.js, progress.js

    backend/                  node built-ins only, nothing to install
      server.js               http, routing, static files, the API
      auth.js                 scrypt hashing, sessions, rate limiting
      db.js                   sqlite schema and queries
      data/                   reps.db, created on first run

    tools/make-icons.py       writes the icon set with no dependencies

The split is by job, not by file type. `core` is logic, `ui` is the pieces that
draw, `views` are the screens, `account` is everything to do with signing in.
Nothing in `data` knows the rest of the app exists.

Two names had to move out of each other's way: the browser's sync module is
`Sync` in `account/sync.js`, because `backend/auth.js` already owns auth, and
workout mode is `Workout` in `views/workout.js`, because a session now means a
signed-in session.

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
