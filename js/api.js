const Api = (() => {
  const KEY = "reps.session.v1";

  let session = load();

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || null;
    } catch {
      return null;
    }
  }

  function save(next) {
    session = next;
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  }

  const base = () => CONFIG.supabaseUrl.replace(/\/+$/, "");

  function headers(auth) {
    const h = {
      apikey: CONFIG.supabaseAnonKey,
      "Content-Type": "application/json",
    };
    if (auth && session) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  }

  async function unwrap(res) {
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (res.ok) return body;
    const message =
      (body && (body.error_description || body.msg || body.message || body.error)) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }

  function stamp(token) {
    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: Date.now() + (token.expires_in || 3600) * 1000,
      user: token.user ? { id: token.user.id, email: token.user.email } : session && session.user,
    };
  }

  async function signUp(email, password) {
    const body = await unwrap(
      await fetch(`${base()}/auth/v1/signup`, {
        method: "POST",
        headers: headers(false),
        body: JSON.stringify({ email, password }),
      }),
    );
    // with email confirmation on, Supabase returns a user but no token yet
    if (!body.access_token) return { pending: true, email };
    save(stamp(body));
    return { pending: false, user: session.user };
  }

  async function signIn(email, password) {
    const body = await unwrap(
      await fetch(`${base()}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: headers(false),
        body: JSON.stringify({ email, password }),
      }),
    );
    save(stamp(body));
    return session.user;
  }

  async function refresh() {
    if (!session || !session.refresh_token) throw new Error("No session to refresh");
    const body = await unwrap(
      await fetch(`${base()}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: headers(false),
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      }),
    );
    save(stamp(body));
    return session;
  }

  async function fresh() {
    if (!session) throw new Error("Not signed in");
    if (Date.now() > session.expires_at - 60000) await refresh();
    return session;
  }

  async function signOut() {
    if (session) {
      try {
        await fetch(`${base()}/auth/v1/logout`, { method: "POST", headers: headers(true) });
      } catch {
        // the local session goes either way
      }
    }
    save(null);
  }

  async function pull() {
    await fresh();
    const rows = await unwrap(
      await fetch(
        `${base()}/rest/v1/workout_state?user_id=eq.${session.user.id}&select=state,updated_at`,
        { headers: headers(true) },
      ),
    );
    return rows && rows.length ? rows[0] : null;
  }

  async function push(state) {
    await fresh();
    await unwrap(
      await fetch(`${base()}/rest/v1/workout_state`, {
        method: "POST",
        headers: Object.assign(headers(true), {
          Prefer: "resolution=merge-duplicates,return=minimal",
        }),
        body: JSON.stringify({
          user_id: session.user.id,
          state,
          updated_at: new Date().toISOString(),
        }),
      }),
    );
  }

  return {
    get user() {
      return session && session.user;
    },
    signedIn: () => Boolean(session),
    signUp,
    signIn,
    signOut,
    refresh,
    pull,
    push,
  };
})();
