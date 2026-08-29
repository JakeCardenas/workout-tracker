const Art = (() => {
  const FRAMES = [1, 2, 3];

  // Masks rather than <img>, so the figure takes the page's text colour instead
  // of whatever the file was drawn in. The cost is that a mask has no native
  // lazy loading, so an observer holds them back until the card is near view.
  function render(exId, extraClass = "") {
    const ex = EXERCISE_BY_ID[exId];
    if (!ex) return "";
    if (!ex.art) return blank(ex, extraClass);
    const layers = FRAMES.map(
      (n) => `<span class="art-frame" data-src="assets/exercises/${ex.art}/${n}.svg"></span>`,
    ).join("");
    return `<figure class="art is-idle ${extraClass}" role="img" aria-label="${esc(ex.name)}">${layers}</figure>`;
  }

  // A handful of movements have no drawing yet. An equipment glyph keeps the
  // card the same shape and weight instead of leaving a hole in the grid.
  function blank(ex, extraClass) {
    return `<figure class="art art-blank ${extraClass}" role="img" aria-label="${esc(ex.name)}">
      ${Icons.equipment(ex.equipment) || ""}
    </figure>`;
  }

  function paint(figure) {
    if (!figure || !figure.classList.contains("is-idle")) return;
    figure.querySelectorAll("[data-src]").forEach((frame) => {
      const src = `url('${frame.dataset.src}')`;
      frame.style.webkitMaskImage = src;
      frame.style.maskImage = src;
      frame.removeAttribute("data-src");
    });
    figure.classList.remove("is-idle");
  }

  const watcher =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries, obs) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              paint(entry.target);
              obs.unobserve(entry.target);
            });
          },
          { rootMargin: "300px" },
        )
      : null;

  const NEAR = 400;

  // A rect check runs first so anything on or near screen paints synchronously.
  // The observer only handles what is further down. Relying on the observer
  // alone leaves every figure blank in a backgrounded tab, where it never fires.
  function scan(root = document) {
    const idle = [...root.querySelectorAll(".art.is-idle")];
    if (!idle.length) return;

    const height = window.innerHeight || 800;
    const rest = [];
    idle.forEach((fig) => {
      const r = fig.getBoundingClientRect();
      const near = r.bottom > -NEAR && r.top < height + NEAR;
      if (near || (r.width === 0 && r.height === 0)) paint(fig);
      else rest.push(fig);
    });

    if (!watcher) return rest.forEach(paint);
    rest.forEach((fig) => watcher.observe(fig));
  }

  return { render, scan, paint, frames: FRAMES.length };
})();
