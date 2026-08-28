const Api = (() => {
  let user = null;
  let reachable = false;

  const url = (path) => `${CONFIG.apiBase}${path}`;

  async function call(path, options = {}) {
    const res = await fetch(url(path), {
      credentials: "same-origin",
      headers: options.body ? { "Content-Type": "application/json" } : {},
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  // one call at boot tells us whether a backend is there at all
  async function probe() {
    try {
      const { user: who } = await call("/api/me");
      user = who;
      reachable = true;
    } catch {
      user = null;
      reachable = false;
    }
    return reachable;
  }

  async function register(email, password) {
    const { user: who } = await call("/api/register", {
      method: "POST",
      body: { email, password },
    });
    user = who;
    return who;
  }

  async function login(email, password) {
    const { user: who } = await call("/api/login", {
      method: "POST",
      body: { email, password },
    });
    user = who;
    return who;
  }

  async function logout() {
    try {
      await call("/api/logout", { method: "POST" });
    } finally {
      user = null;
    }
  }

  const pull = () => call("/api/state");
  const push = (state) => call("/api/state", { method: "PUT", body: { state } });

  return {
    probe,
    register,
    login,
    logout,
    pull,
    push,
    get user() {
      return user;
    },
    signedIn: () => Boolean(user),
    reachable: () => reachable,
  };
})();
