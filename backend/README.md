# Backend

Node's own http server, SQLite and crypto. No npm install, no dependencies,
nothing to build — the same rule the front end follows.

    node backend/server.js

Then open http://localhost:4174. It serves `frontend/` and the API together, so
there is no second port and no CORS to think about.

The backend sits outside the folder being served, so none of these files are
reachable over http — there is no rule to forget, the path simply is not there.

## Endpoints

    POST /api/register   {email, password}  -> sets session cookie
    POST /api/login      {email, password}  -> sets session cookie
    POST /api/logout                        -> clears it
    GET  /api/me                            -> {user} or {user: null}
    GET  /api/state                         -> your saved workouts
    PUT  /api/state      {state}            -> replaces them

## How the passwords are kept

`scrypt` with a random 16 byte salt per account, compared with
`timingSafeEqual`. A login for an address that does not exist still runs the
hash, so you cannot learn which emails are registered by timing the response.
Ten bad attempts against the same address from the same IP earns a fifteen
minute pause.

## How the sessions work

A 32 byte random token goes to the browser in an HttpOnly, SameSite=Lax cookie
and only its SHA-256 lands in the database. Script on the page cannot read it,
so an XSS bug cannot walk off with a session, and a stolen database still does
not hand anyone a usable token. Sessions last 30 days and expired rows are
swept on each new sign-in.

## The data

`backend/data/reps.db`, created on first run. One row per account holding the
same document the browser keeps, so `store.js` stays the only thing that
understands the shape. Delete the file to start clean.
