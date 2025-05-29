export const APP_NAME = "Wendler Wizard";
export const APP_DESCRIPTION = "Your guide to the Wendler 5/3/1 program.";

export const MAIN_LIFTS = [
  { id: "squat", name: "Squat" },
  { id: "benchPress", name: "Bench Press" },
  { id: "deadlift", name: "Deadlift" },
  { id: "overheadPress", name: "Overhead Press" },
] as const;

export type MainLiftId = typeof MAIN_LIFTS[number]["id"];

export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type DayOfWeek = typeof DAYS_OF_WEEK[number];

export const DEFAULT_TRAINING_MAX_PERCENTAGE = 0.9;

export const WENDLER_CYCLE_WEEKS = 4;

export interface WendlerWeekConfig {
  name: string;
  sets: { percentage: number; reps: string; amrap: boolean }[];
}

export const WENDLER_WEEK_CONFIGS: WendlerWeekConfig[] = [
  { // Week 1: 3x5
    name: "Week 1 (3x5)",
    sets: [
      { percentage: 0.65, reps: "5", amrap: false },
      { percentage: 0.75, reps: "5", amrap: false },
      { percentage: 0.85, reps: "5+", amrap: true },
    ],
  },
  { // Week 2: 3x3
    name: "Week 2 (3x3)",
    sets: [
      { percentage: 0.70, reps: "3", amrap: false },
      { percentage: 0.80, reps: "3", amrap: false },
      { percentage: 0.90, reps: "3+", amrap: true },
    ],
  },
  { // Week 3: 5/3/1
    name: "Week 3 (5/3/1)",
    sets: [
      { percentage: 0.75, reps: "5", amrap: false },
      { percentage: 0.85, reps: "3", amrap: false },
      { percentage: 0.95, reps: "1+", amrap: true },
    ],
  },
  { // Week 4: Deload
    name: "Week 4 (Deload)",
    sets: [
      { percentage: 0.40, reps: "5", amrap: false },
      { percentage: 0.50, reps: "5", amrap: false },
      { percentage: 0.60, reps: "5", amrap: false },
    ],
  },
];

// For assigning main lifts to workout days
export const DEFAULT_LIFT_ORDER: MainLiftId[] = ["squat", "benchPress", "deadlift", "overheadPress"];
