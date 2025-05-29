
import { addDays, addWeeks, format, parseISO, getDay, differenceInCalendarWeeks } from 'date-fns';
import type { UserProfile, WorkoutCycle, WeeklyWorkout, DailyWorkout, WorkoutSet } from './types';
import { DEFAULT_TRAINING_MAX_PERCENTAGE, MAIN_LIFTS, WENDLER_WEEK_CONFIGS, DAYS_OF_WEEK, DayOfWeek } from './constants';

// Helper to round to nearest 2.5 (common for weight plates)
export function roundToNearestPlate(weight: number, increment: number = 2.5): number {
  return Math.round(weight / increment) * increment;
}

export function calculateTrainingMax(oneRepMax: number, percentage: number = DEFAULT_TRAINING_MAX_PERCENTAGE): number {
  return oneRepMax * percentage;
}

export function calculateWendlerCycle(profile: UserProfile, cycleNumber: number = 1): WorkoutCycle {
  const cycleStartDate = parseISO(profile.startDate);
  const currentCycleStartDate = addWeeks(cycleStartDate, (cycleNumber - 1) * 4);

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
      const dayOfWeekIndex = DAYS_OF_WEEK.indexOf(workoutDayOfWeek); 

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

    dailyWorkouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      weekNumber: weekIndex + 1,
      weekName: weekConfig.name,
      days: dailyWorkouts,
    };
  });

  const cycleEndDate = addDays(addWeeks(currentCycleStartDate, 4), -1); 

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
  const weekStartsOn = getDay(startDate) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const totalWeeksPassed = differenceInCalendarWeeks(currentDate, startDate, { weekStartsOn });


  if (totalWeeksPassed < 0) return null; 

  const cycleNumber = Math.floor(totalWeeksPassed / WENDLER_WEEK_CONFIGS.length) + 1; 
  const weekIndexInCycle = totalWeeksPassed % WENDLER_WEEK_CONFIGS.length; 

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

export function calculateE1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0; 
  if (reps === 1) return roundToNearestPlate(weight);
  const denominator = 1.0278 - 0.0278 * reps;
  if (denominator <= 0) return 0;
  const estimatedMax = weight / denominator;
  return roundToNearestPlate(estimatedMax);
}

const BARBELL_REFERENCE_LB = 45;
const LB_TO_KG_CONVERSION_FACTOR = 2.20462;

export function formatDisplayWeight(
  totalWeightInput: number, // This is the actual target weight, already in the user's chosen unit system and rounded by roundToNearestPlate
  profile: UserProfile | null
): string {
  if (!profile) return `${totalWeightInput} units`; // Fallback, totalWeightInput is already rounded

  const unitSuffix = profile.unitSystem === 'metric' ? 'kg' : 'lb';

  if (profile.weightDisplayPreference === 'platesPerSide') {
    let barbellWeightInCurrentUnit: number;

    if (profile.unitSystem === 'metric') {
      // Convert the 45lb reference bar to kg for calculation
      barbellWeightInCurrentUnit = roundToNearestPlate(BARBELL_REFERENCE_LB / LB_TO_KG_CONVERSION_FACTOR, 0.5); // e.g. 20.5 kg
    } else {
      // User is in imperial, bar reference is 45lb
      barbellWeightInCurrentUnit = BARBELL_REFERENCE_LB; // 45 lb
    }

    // totalWeightInput is already rounded (e.g. to 2.5 increments)
    if (totalWeightInput <= barbellWeightInCurrentUnit) {
      return `${totalWeightInput} ${unitSuffix} (Barbell)`;
    } else {
      const platesTotalWeight = totalWeightInput - barbellWeightInCurrentUnit;
      // Plates per side value should also be rounded to a sensible number, e.g., 0.25 for lbs, 0.125 for kgs, or just use roundToNearestPlate with its default
      const platesPerSideValue = roundToNearestPlate(platesTotalWeight / 2); 
      
      if (platesPerSideValue <= 0) { 
          return `${totalWeightInput} ${unitSuffix} (Barbell)`;
      }
      return `${platesPerSideValue} ${unitSuffix} per side`;
    }
  } else { // 'total'
    return `${totalWeightInput} ${unitSuffix}`;
  }
}
