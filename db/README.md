# Database

One table, one row per account, holding the same document the app keeps in
localStorage. That keeps the client honest: `store.js` stays the only thing
that understands the shape, and sync is a single read and a single write.

## Setting it up

1. Create a free project at supabase.com.
2. Open the SQL editor and run `schema.sql`.
3. Settings → API, copy the Project URL and the `anon` public key.
4. Paste both into `js/config.js`.

Until step 4 the app runs exactly as before, entirely on the device.

## Why the anon key is safe in client code

It only identifies the project. Every policy in `schema.sql` compares
`auth.uid()` against `user_id`, so the key alone reads nothing — a request
without a valid session token matches no rows.

## If you outgrow one JSON blob

Split `state` into real tables (`workouts`, `sessions`, `sets`, `records`),
give each a `user_id uuid references auth.users(id)`, and repeat the same four
policies per table. Worth doing once you want to query across users — leaderboards,
"most trained lift this month" — which a single blob cannot answer.
