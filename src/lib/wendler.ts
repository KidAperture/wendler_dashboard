
import { addDays, addWeeks, format, parseISO, getDay, differenceInCalendarWeeks } from 'date-fns';
import type { UserProfile, WorkoutCycle, WeeklyWorkout, DailyWorkout, WorkoutSet } from './types';
import { DEFAULT_TRAINING_MAX_PERCENTAGE, MAIN_LIFTS, WENDLER_WEEK_CONFIGS, DAYS_OF_WEEK, DayOfWeek } from './constants';

// Helper to round to nearest 2.5 (common for weight plates)
export function roundToNearestPlate(weight: number, plateIncrement: number = 2.5): number {
  return Math.round(weight / plateIncrement) * plateIncrement;
}

export function calculateTrainingMax(oneRepMax: number, percentage: number = DEFAULT_TRAINING_MAX_PERCENTAGE): number {
  return oneRepMax * percentage;
}

export function calculateWendlerCycle(profile: UserProfile, cycleNumber: number = 1): WorkoutCycle {
  const cycleStartDate = parseISO(profile.startDate);
  const currentCycleStartDate = addWeeks(cycleStartDate, (cycleNumber - 1) * 4);

  // Sort user's workout schedule by the order in DAYS_OF_WEEK for consistent processing
  const sortedSchedule = [...profile.workoutSchedule].sort(
    (a, b) => DAYS_OF_WEEK.indexOf(a.day) - DAYS_OF_WEEK.indexOf(b.day)
  );

  const weeks: WeeklyWorkout[] = WENDLER_WEEK_CONFIGS.map((weekConfig, weekIndex) => {
    const dailyWorkouts: DailyWorkout[] = [];
    const weekStartDateForCalc = addWeeks(currentCycleStartDate, weekIndex);

    for (const assignment of sortedSchedule) {
      const mainLiftId = assignment.lift;
      const trainingMax = profile.trainingMaxes[mainLiftId];
      const workoutDayOfWeek = assignment.day;
      const dayOfWeekIndex = DAYS_OF_WEEK.indexOf(workoutDayOfWeek); // 0 for Sunday, 1 for Monday, etc.

      // Calculate the date for this workout within the current week of the cycle
      const dayOffset = (dayOfWeekIndex - getDay(weekStartDateForCalc) + 7) % 7;
      const workoutDate = addDays(weekStartDateForCalc, dayOffset);

      const sets: WorkoutSet[] = weekConfig.sets.map(setConf => ({
        percentage: setConf.percentage,
        targetReps: setConf.reps,
        targetWeight: roundToNearestPlate(trainingMax * setConf.percentage),
        isAmrap: setConf.amrap,
      }));

      dailyWorkouts.push({
        date: format(workoutDate, 'yyyy-MM-dd'),
        dayOfWeek: workoutDayOfWeek,
        mainLift: mainLiftId,
        sets: sets,
        isCompleted: false,
      });
    }

    // Sort daily workouts by date within the week (important if schedule wasn't perfectly sorted or for other reasons)
    dailyWorkouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      weekNumber: weekIndex + 1,
      weekName: weekConfig.name,
      days: dailyWorkouts,
    };
  });

  const cycleEndDate = addDays(addWeeks(currentCycleStartDate, 4), -1); // End of 4th week

  return {
    cycleNumber,
    startDate: format(currentCycleStartDate, 'yyyy-MM-dd'),
    endDate: format(cycleEndDate, 'yyyy-MM-dd'),
    weeks,
  };
}


export function getCurrentCycleAndWeek(profile: UserProfile, currentDate: Date = new Date()): { cycleNumber: number; weekNumber: number; dayWorkout: DailyWorkout | null } | null {
  if (!profile.startDate || !profile.workoutSchedule || profile.workoutSchedule.length === 0) return null;

  const startDate = parseISO(profile.startDate);
  // Ensure weekStartsOn aligns with how getDay() works (Sunday as 0)
  // If your profile.startDate can be any day, and you want weeks to "start" on that day of week for calculation:
  const weekStartsOn = getDay(startDate) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const totalWeeksPassed = differenceInCalendarWeeks(currentDate, startDate, { weekStartsOn });


  if (totalWeeksPassed < 0) return null; // Current date is before start date

  const cycleNumber = Math.floor(totalWeeksPassed / WENDLER_WEEK_CONFIGS.length) + 1; // WENDLER_CYCLE_WEEKS is 4
  const weekIndexInCycle = totalWeeksPassed % WENDLER_WEEK_CONFIGS.length; // 0-indexed

  const cycle = calculateWendlerCycle(profile, cycleNumber);
  if (!cycle || weekIndexInCycle >= cycle.weeks.length) return null;

  const currentWeekData = cycle.weeks[weekIndexInCycle];
  const formattedCurrentDate = format(currentDate, 'yyyy-MM-dd');
  const dayWorkout = currentWeekData.days.find(d => d.date === formattedCurrentDate) || null;

  return {
    cycleNumber,
    weekNumber: currentWeekData.weekNumber,
    dayWorkout,
  };
}

export function getWeekWorkouts(profile: UserProfile, cycleNumber: number, weekNumber: number): DailyWorkout[] | null {
  const cycle = calculateWendlerCycle(profile, cycleNumber);
  if(!cycle) return null;
  const weekData = cycle.weeks.find(w => w.weekNumber === weekNumber);
  return weekData ? weekData.days : null;
}

/**
 * Calculates Estimated 1 Rep Max (e1RM) using the Brzycki formula.
 * @param weight The weight lifted.
 * @param reps The number of repetitions performed.
 * @returns The calculated e1RM, rounded to the nearest plate increment, or 0 if reps are invalid.
 */
export function calculateE1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0; // Invalid input for Brzycki
  if (reps === 1) return roundToNearestPlate(weight);

  // Brzycki formula: Weight / (1.0278 - 0.0278 * Reps)
  const denominator = 1.0278 - 0.0278 * reps;

  if (denominator <= 0) {
    return 0;
  }

  const estimatedMax = weight / denominator;
  return roundToNearestPlate(estimatedMax);
}
