import { addDays, addWeeks, format, parseISO, getDay, differenceInCalendarWeeks } from 'date-fns';
import type { UserProfile, WorkoutCycle, WeeklyWorkout, DailyWorkout, WorkoutSet } from './types';
import { DEFAULT_LIFT_ORDER, DEFAULT_TRAINING_MAX_PERCENTAGE, MAIN_LIFTS, WENDLER_WEEK_CONFIGS, DAYS_OF_WEEK, DayOfWeek } from './constants';

// Helper to round to nearest 2.5 (common for weight plates)
export function roundToNearestPlate(weight: number, plateIncrement: number = 2.5): number {
  return Math.round(weight / plateIncrement) * plateIncrement;
}

export function calculateTrainingMax(oneRepMax: number, percentage: number = DEFAULT_TRAINING_MAX_PERCENTAGE): number {
  return oneRepMax * percentage;
}

export function calculateWendlerCycle(profile: UserProfile, cycleNumber: number = 1): WorkoutCycle {
  const cycleStartDate = parseISO(profile.startDate);
  // Adjust cycle start date based on cycle number (each cycle is 4 weeks)
  const currentCycleStartDate = addWeeks(cycleStartDate, (cycleNumber - 1) * 4);

  const weeks: WeeklyWorkout[] = WENDLER_WEEK_CONFIGS.map((weekConfig, weekIndex) => {
    const dailyWorkouts: DailyWorkout[] = [];
    let liftIndex = 0;

    // Create workouts for the 4 lifts across the selected workout days for this week
    for (let i = 0; i < DEFAULT_LIFT_ORDER.length && liftIndex < profile.workoutDays.length; i++) {
      const mainLiftId = DEFAULT_LIFT_ORDER[i % DEFAULT_LIFT_ORDER.length];
      const trainingMax = profile.trainingMaxes[mainLiftId];
      
      // Determine the date for this workout
      // This logic needs to be robust: find the Nth workout day of this week.
      // For simplicity, we'll assume workout days are sorted and we just pick them sequentially.
      // A more advanced version would map specific lifts to specific days if user desires.
      
      const workoutDayOfWeek = profile.workoutDays[liftIndex % profile.workoutDays.length];
      const dayOfWeekIndex = DAYS_OF_WEEK.indexOf(workoutDayOfWeek);
      
      let workoutDate = addDays(addWeeks(currentCycleStartDate, weekIndex), 0); // Start of the week
      while(getDay(workoutDate) !== dayOfWeekIndex) {
        workoutDate = addDays(workoutDate, 1);
      }
      // Ensure workoutDate is within the current week of the cycle
      if (getDay(workoutDate) < getDay(addWeeks(currentCycleStartDate, weekIndex))) {
         // If we picked a day from previous week (e.g. currentCycleStartDate is Wed, workoutDay is Mon)
         // This shouldn't happen if profile.workoutDays are correctly ordered relative to cycleStartDate,
         // or if we ensure workoutDate is advanced correctly.
         // The logic here might need refinement based on how workout days are distributed.
         // For now, let's assume it means the first occurrence of that day in or after the week's start.
      }


      const sets: WorkoutSet[] = weekConfig.sets.map(setConf => ({
        percentage: setConf.percentage,
        targetReps: setConf.reps,
        targetWeight: roundToNearestPlate(trainingMax * setConf.percentage),
        isAmrap: setConf.amrap,
      }));
      
      // Ensure we don't schedule more workouts than available workout days in a week.
      // This simple assignment might lead to uneven distribution if lift_order > workoutDays.length.
      // This loop structure assumes one main lift per available workout day in sequence.
      if (dailyWorkouts.find(d => format(parseISO(d.date), 'yyyy-MM-dd') === format(workoutDate, 'yyyy-MM-dd'))) {
        // Date already has a workout, try next available slot or handle error.
        // This indicates a potential issue in date calculation or profile setup.
        // For now, we skip to avoid duplicates, but this should be improved.
      } else {
        dailyWorkouts.push({
          date: format(workoutDate, 'yyyy-MM-dd'),
          dayOfWeek: workoutDayOfWeek,
          mainLift: mainLiftId,
          sets: sets,
          isCompleted: false,
        });
      }
      liftIndex++;
    }
    
    // Sort daily workouts by date
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
  if (!profile.startDate) return null;

  const startDate = parseISO(profile.startDate);
  const totalWeeksPassed = differenceInCalendarWeeks(currentDate, startDate, { weekStartsOn: getDay(startDate) as 0 | 1 | 2 | 3 | 4 | 5 | 6 });

  if (totalWeeksPassed < 0) return null; // Current date is before start date

  const cycleNumber = Math.floor(totalWeeksPassed / WENDLER_CYCLE_WEEKS) + 1;
  const weekIndexInCycle = totalWeeksPassed % WENDLER_CYCLE_WEEKS; // 0-indexed

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
