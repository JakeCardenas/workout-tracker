const Icons = (() => {
  const wrap = (d, extra = "") =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

  const set = {
    search: wrap('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>'),
    close: wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
    plus: wrap('<path d="M12 5v14M5 12h14"/>'),
    minus: wrap('<path d="M5 12h14"/>'),
    check: wrap('<path d="M20 6L9 17l-5-5"/>'),
    play: wrap('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
    trash: wrap('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    copy: wrap('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h8"/>'),
    up: wrap('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    down: wrap('<path d="M12 5v14M18 13l-6 6-6-6"/>'),
    calendar: wrap('<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>'),
    back: wrap('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
    forward: wrap('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    skip: wrap('<path d="M5 5l9 7-9 7z" fill="currentColor"/><path d="M18 5v14"/>'),
    flip: wrap('<path d="M4 8a8 8 0 0113-3l3 3M20 16a8 8 0 01-13 3l-3-3"/><path d="M20 4v4h-4M4 20v-4h4"/>'),
    star: wrap('<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z"/>'),
    starFilled: wrap('<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z" fill="currentColor"/>'),
    library: wrap('<rect x="3.5" y="4" width="7" height="16" rx="1.5"/><rect x="13.5" y="4" width="7" height="7" rx="1.5"/><rect x="13.5" y="13" width="7" height="7" rx="1.5"/>'),
    sound: wrap('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5a4 4 0 010 5M18.5 7a7.5 7.5 0 010 10"/>'),
    muted: wrap('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16.5 10l4 4M20.5 10l-4 4"/>'),
    flame: wrap('<path d="M12 3s5 4.2 5 8.6a5 5 0 01-10 0C7 9.5 9 8 9 8s.3 2 1.6 2.6C11.4 8.6 12 6 12 3z"/>'),
    grip: wrap('<circle cx="9" cy="7" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="7" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="17" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="1.3" fill="currentColor" stroke="none"/>'),
    edit: wrap('<path d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17z"/>'),
  };

  const equipment = {
    Barbell: wrap('<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>'),
    Dumbbell: wrap('<path d="M4 8v8M7.5 6v12M16.5 6v12M20 8v8M7.5 12h9"/>'),
    Cable: wrap('<path d="M6 3v5a6 6 0 006 6 6 6 0 016 6v1"/><rect x="3" y="18" width="6" height="3" rx="1"/>'),
    Machine: wrap('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M8 9h8M8 13h5"/>'),
    Bodyweight: wrap('<circle cx="12" cy="5" r="2.2"/><path d="M12 8v6M12 10L8 8M12 10l4-2M12 14l-3 6M12 14l3 6"/>'),
  };

  return {
    get: (name) => set[name] || "",
    equipment: (name) => equipment[name] || set.build,
  };
})();
