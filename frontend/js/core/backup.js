const Backup = (() => {
  const stamp = () => new Date().toISOString().slice(0, 10);

  function download() {
    const payload = JSON.stringify(
      { app: "reps", exported: new Date().toISOString(), state: Store.state },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `reps-backup-${stamp()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function read(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("That file could not be read"));
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const state = parsed.state || parsed;
          if (!state || typeof state !== "object" || !Array.isArray(state.history)) {
            throw new Error("This does not look like a reps backup");
          }
          resolve(state);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }

  function summarise(state) {
    return {
      workouts: (state.workouts || []).length,
      history: (state.history || []).length,
      favorites: (state.favorites || []).length,
    };
  }

  return { download, read, summarise };
})();
