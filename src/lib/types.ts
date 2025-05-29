
import type { DayOfWeek, MainLiftId } from "./constants";

export type UnitSystem = 'metric' | 'imperial';

export interface UserProfile {
  id: string; // Typically a unique ID, can be a constant for single-user context
  name?: string;
  startDate: string; // ISO Date string
  unitSystem: UnitSystem; // 'metric' or 'imperial'
  workoutSchedule: Array<{ day: DayOfWeek; lift: MainLiftId }>;
  trainingMaxes: Record<MainLiftId, number>;
  // Represents 1RMs
  oneRepMaxes: Record<MainLiftId, number>;
}

export interface WorkoutSet {
  percentage: number;
  targetReps: string;
  targetWeight: number;
  completedReps?: number;
  isAmrap: boolean;
}

export interface DailyWorkout {
  date: string; // ISO Date string
  dayOfWeek: DayOfWeek;
  mainLift: MainLiftId;
  sets: WorkoutSet[];
  isCompleted: boolean;
  warmupSets?: { weight: number; reps: string }[]; // Optional: Add warmup calculation later
}

export interface WeeklyWorkout {
  weekNumber: number; // 1-4
  weekName: string;
  days: DailyWorkout[];
}

export interface WorkoutCycle {
  cycleNumber: number; // Starts at 1
  startDate: string; // ISO Date string
  endDate: string; // ISO Date string
  weeks: WeeklyWorkout[];
}

export interface WorkoutLogEntry {
  logId: string; // Unique ID for the log entry
  date: string; // ISO Date string
  exercise: MainLiftId; // Main lift performed
  // Store details of each set performed, especially the AMRAP set
  completedSets: Array<{
    prescribedWeight: number;
    prescribedReps: string;
    actualReps: number;
    isAmrap: boolean;
  }>;
  trainingMaxUsed: number; // TM for that lift at the time of workout
}

// Schema for the GenAI weight adjustment input
export interface WeightAdjustmentAIInput {
  workoutHistory: string; // JSON string of WorkoutLogEntry[]
  currentMax: number; // Current 1RM for the exercise
  exercise: string; // Name of the exercise (e.g., "Squat")
}
