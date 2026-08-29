const DAY_PLANS = {
  push: {
    name: "Push",
    focus: "Chest, shoulders, triceps",
    exercises: ["bench-press", "incline-dumbbell-press", "dumbbell-shoulder-press", "lateral-raises", "tricep-pushdown", "overhead-tricep-extension"],
  },
  pull: {
    name: "Pull",
    focus: "Back and biceps",
    exercises: ["pull-ups", "barbell-row", "lat-pulldown", "face-pulls", "barbell-curl", "hammer-curl"],
  },
  legs: {
    name: "Legs",
    focus: "Quads, hamstrings, calves, core",
    exercises: ["squat", "romanian-deadlift", "leg-press", "leg-curl", "calf-raises", "plank"],
  },
  upper: {
    name: "Upper",
    focus: "Everything above the waist",
    exercises: ["bench-press", "barbell-row", "overhead-press", "lat-pulldown", "dumbbell-curl", "tricep-pushdown"],
  },
  lower: {
    name: "Lower",
    focus: "Legs and core",
    exercises: ["squat", "romanian-deadlift", "leg-extension", "leg-curl", "calf-raises", "hanging-leg-raise"],
  },
  full: {
    name: "Full Body",
    focus: "One session, everything",
    exercises: ["squat", "bench-press", "barbell-row", "overhead-press", "romanian-deadlift", "plank"],
  },
  chest: {
    name: "Chest",
    focus: "Chest only",
    exercises: ["bench-press", "incline-bench-press", "dumbbell-bench-press", "chest-fly", "pec-deck", "push-ups"],
  },
  back: {
    name: "Back",
    focus: "Back only",
    exercises: ["deadlift", "pull-ups", "barbell-row", "lat-pulldown", "seated-cable-row", "straight-arm-pulldown"],
  },
  shoulders: {
    name: "Shoulders",
    focus: "Delts and traps",
    exercises: ["overhead-press", "dumbbell-shoulder-press", "lateral-raises", "cable-lateral-raise", "rear-delt-fly", "shrug"],
  },
  arms: {
    name: "Arms",
    focus: "Biceps and triceps",
    exercises: ["barbell-curl", "hammer-curl", "preacher-curl", "close-grip-bench-press", "tricep-pushdown", "skull-crushers"],
  },
  anterior: {
    name: "Anterior",
    focus: "Everything on the front",
    exercises: ["bench-press", "overhead-press", "squat", "leg-extension", "tricep-pushdown", "cable-crunch"],
  },
  posterior: {
    name: "Posterior",
    focus: "Everything on the back",
    exercises: ["deadlift", "barbell-row", "pull-ups", "romanian-deadlift", "leg-curl", "face-pulls"],
  },
};

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SPLITS = [
  {
    id: "ppl-ul",
    name: "PPL / Upper Lower",
    short: "PPL/UL",
    rating: 5,
    days: 5,
    note: "Five days, everything hit twice, and the week still has room to recover. Hard to beat.",
    week: ["push", "pull", "legs", "upper", "lower", null, null],
  },
  {
    id: "upper-lower-x2",
    name: "Upper / Lower ×2",
    short: "UL ×2",
    rating: 4.5,
    days: 4,
    note: "Four sessions, everything twice a week. The best return for the least time in the gym.",
    week: ["upper", "lower", null, "upper", "lower", null, null],
  },
  {
    id: "anterior-posterior",
    name: "Anterior / Posterior",
    short: "Ant/Post",
    rating: 4,
    days: 4,
    note: "Splits the body front and back, so leg work is spread across the week instead of dreaded in one block.",
    week: ["anterior", "posterior", null, "anterior", "posterior", null, null],
  },
  {
    id: "ppl-arnold",
    name: "PPL / Arnold",
    short: "PPL/Arnold",
    rating: 3.5,
    days: 6,
    note: "Push, pull and legs with a dedicated arm day bolted on. Enjoyable, but six days is a lot of fatigue.",
    week: ["push", "pull", "legs", "arms", "pull", "legs", null],
  },
  {
    id: "ppl-x2",
    name: "PPL ×2",
    short: "PPL ×2",
    rating: 3,
    days: 6,
    note: "The classic six-day rotation. Everything twice a week, but easy to overreach and feel permanently tired.",
    week: ["push", "pull", "legs", "push", "pull", "legs", null],
  },
  {
    id: "fbeod",
    name: "Full Body Every Other Day",
    short: "FBEOD",
    rating: 2,
    days: 3,
    note: "Every muscle three times a week off only three sessions. Effective, but the sessions run long and repetitive.",
    week: ["full", null, "full", null, "full", null, null],
  },
  {
    id: "bro-split",
    name: "Bro Split",
    short: "Bro Split",
    rating: 1,
    days: 5,
    note: "One muscle per day. Popular and enjoyable, but each muscle only gets trained once a week, so progress is slow.",
    week: ["chest", "back", "shoulders", "arms", "legs", null, null],
  },
];

const SPLIT_BY_ID = Object.fromEntries(SPLITS.map((s) => [s.id, s]));

const EXPERIENCE = [
  { id: "New to Training", note: "Just starting and learning the basics." },
  { id: "Beginner", note: "Some experience but looking for structure." },
  { id: "Intermediate", note: "Training consistently and comfortable with common lifts." },
  { id: "Advanced", note: "Years of structured training behind you." },
];

const GOALS = [
  { id: "Build Muscle", note: "Hypertrophy work, moderate reps, plenty of volume." },
  { id: "Get Stronger", note: "Heavier compound lifts, lower reps, longer rests." },
  { id: "Improve Fitness", note: "Full body sessions that keep you moving." },
  { id: "General Health", note: "Sustainable training you can keep up." },
];

const PLACES = [
  { id: "Gym", note: "Full racks, machines and cables." },
  { id: "Home", note: "Whatever you own, however little." },
  { id: "Both", note: "Gym most weeks, home when life gets busy." },
];

// what each place can actually be expected to have, used to filter exercises
const KIT = {
  Gym: ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Band"],
  Home: ["Bodyweight", "Dumbbell", "Band"],
  Both: ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Band"],
};
