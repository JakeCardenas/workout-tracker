const Art = (() => {
  const FRAMES = [1, 2, 3];

  // drawn as masks rather than <img>, so the figure takes the page's text
  // colour instead of being stuck on whatever the file was authored in
  function render(exId, extraClass = "") {
    const ex = EXERCISE_BY_ID[exId];
    if (!ex || !ex.art) return "";
    // the mask goes inline: a url() inside a custom property resolves against
    // the stylesheet's folder, not the page, and silently 404s
    const layers = FRAMES.map((n) => {
      const src = `url('assets/exercises/${ex.art}/${n}.svg')`;
      return `<span class="art-frame" style="-webkit-mask-image:${src};mask-image:${src}"></span>`;
    }).join("");
    return `<figure class="art ${extraClass}" role="img" aria-label="${esc(ex.name)}">${layers}</figure>`;
  }

  return { render, frames: FRAMES.length };
})();
