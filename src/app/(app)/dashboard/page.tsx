
"use client";

import { useAppContext } from "@/hooks/use-app-context";
import { WorkoutCard } from "@/components/WorkoutCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, isToday as fnsIsToday, addWeeks, subWeeks, startOfWeek, endOfWeek, getDay, differenceInCalendarWeeks, isSameDay, getTime } from "date-fns";
import { useState, useEffect } from "react";
import type { DailyWorkout } from "@/lib/types";
import { WENDLER_WEEK_CONFIGS } from "@/lib/constants";

export default function DashboardPage() {
  const { profile, isLoading, currentCycleData, activeCycleNumber, setActiveCycleNumber } = useAppContext();
  const [currentDisplayDate, setCurrentDisplayDate] = useState<Date | null>(null);
  const [workoutsForWeek, setWorkoutsForWeek] = useState<DailyWorkout[]>([]);

  useEffect(() => {
    // Initialize currentDisplayDate on client-side to avoid hydration issues with new Date()
    setCurrentDisplayDate(new Date());
  }, []);

  useEffect(() => {
    if (!currentDisplayDate || !profile || !profile.startDate) {
      setWorkoutsForWeek([]);
      return;
    }

    const startDateObj = parseISO(profile.startDate);
    const weekOptions = { weekStartsOn: getDay(startDateObj) as 0 | 1 | 2 | 3 | 4 | 5 | 6 };
    
    let totalWeeksPassed = differenceInCalendarWeeks(currentDisplayDate, startDateObj, weekOptions);
    
    // Clamp to Cycle 1 / Week 1 if currentDisplayDate is before profile.startDate effectively
    if (getTime(currentDisplayDate) < getTime(startOfWeek(startDateObj, weekOptions))) {
         totalWeeksPassed = 0; // Treat as first week of first cycle
    }


    const calculatedCycleNumber = Math.floor(totalWeeksPassed / WENDLER_WEEK_CONFIGS.length) + 1;
    const weekIndexInCycle = totalWeeksPassed % WENDLER_WEEK_CONFIGS.length;

    if (activeCycleNumber !== calculatedCycleNumber) {
      setActiveCycleNumber(calculatedCycleNumber);
      // currentCycleData will update from AppContext in a subsequent render.
      // Return here to wait for the correct currentCycleData.
      return;
    }

    if (!currentCycleData || currentCycleData.cycleNumber !== activeCycleNumber) {
      // Waiting for the correct cycle data from context or it's out of sync.
      setWorkoutsForWeek([]); // Clear potentially stale workouts
      return;
    }
    
    // Filter workouts for the specific week of the current cycle
    const displayWeekStart = startOfWeek(currentDisplayDate, weekOptions);
    const displayWeekEnd = endOfWeek(currentDisplayDate, weekOptions);

    const targetCycleWeek = currentCycleData.weeks[weekIndexInCycle];

    if (targetCycleWeek) {
        const relevantWorkouts = targetCycleWeek.days.filter(workout => {
            const workoutDate = parseISO(workout.date);
            return workoutDate >= displayWeekStart && workoutDate <= displayWeekEnd;
        });
         setWorkoutsForWeek(relevantWorkouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } else {
        setWorkoutsForWeek([]);
    }

  }, [currentDisplayDate, profile, activeCycleNumber, setActiveCycleNumber, currentCycleData]);
  

  const handlePreviousWeek = () => {
    if (!currentDisplayDate || !profile?.startDate) return;
    const newDate = subWeeks(currentDisplayDate, 1);
    
    const profileStartDateObj = parseISO(profile.startDate);
    const weekOptions = { weekStartsOn: getDay(profileStartDateObj) as 0 | 1 | 2 | 3 | 4 | 5 | 6 };

    // Prevent going to a week before the actual start week of cycle 1
    if (getTime(newDate) < getTime(startOfWeek(profileStartDateObj, weekOptions))) {
      setCurrentDisplayDate(startOfWeek(profileStartDateObj, weekOptions));
    } else {
      setCurrentDisplayDate(newDate);
    }
  };

  const handleNextWeek = () => {
    if (!currentDisplayDate) return;
    setCurrentDisplayDate(addWeeks(currentDisplayDate, 1));
  };

  if (isLoading || !currentDisplayDate || !profile) { // Added !profile check for initial load consistency
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // This check should happen after isLoading and before main content
  if (!profile.startDate || !profile.oneRepMaxes.squat) { // Example check for a configured profile
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to Wendler Wizard!</CardTitle>
            <CardDescription>Please set up your profile to generate your workout plan.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/profile">Go to Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  let weekName = "";
  let displayWeekStartDateString = "Loading date...";
  let weekIndexInCycleForDisplay = 0;
  let calculatedWeekOptions: { weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 } | undefined = undefined;

  if (profile && profile.startDate && currentDisplayDate) {
    const startDateObj = parseISO(profile.startDate);
    calculatedWeekOptions = { weekStartsOn: getDay(startDateObj) as 0 | 1 | 2 | 3 | 4 | 5 | 6 };
    
    // Recalculate totalWeeksPassed for display purposes, ensuring it's not negative for display logic
    let totalWeeksPassedForDisplay = differenceInCalendarWeeks(currentDisplayDate, startDateObj, calculatedWeekOptions);
     if (getTime(currentDisplayDate) < getTime(startOfWeek(startDateObj, calculatedWeekOptions))) {
        totalWeeksPassedForDisplay = 0; 
    }
    weekIndexInCycleForDisplay = totalWeeksPassedForDisplay % WENDLER_WEEK_CONFIGS.length;

    if (currentCycleData && currentCycleData.weeks[weekIndexInCycleForDisplay]) {
      weekName = currentCycleData.weeks[weekIndexInCycleForDisplay].weekName;
    }
    const actualDisplayWeekStart = startOfWeek(currentDisplayDate, calculatedWeekOptions);
    displayWeekStartDateString = format(actualDisplayWeekStart, "MMMM d, yyyy");
  }
  
  const isPreviousButtonDisabled = !currentDisplayDate || !profile?.startDate || !calculatedWeekOptions ||
    (activeCycleNumber === 1 && weekIndexInCycleForDisplay === 0 && 
     isSameDay(startOfWeek(currentDisplayDate, calculatedWeekOptions), startOfWeek(parseISO(profile.startDate), calculatedWeekOptions)));


  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-3xl font-bold">Cycle {activeCycleNumber} {weekName ? `- ${weekName}` : ""}</h1>
            <p className="text-muted-foreground">
                Week starting: {displayWeekStartDateString}
            </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreviousWeek} disabled={isPreviousButtonDisabled}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous Week
          </Button>
          <Button variant="outline" onClick={handleNextWeek}>
            Next Week <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {workoutsForWeek.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {workoutsForWeek.map((workout) => (
            <WorkoutCard 
              key={`${workout.date}-${workout.mainLift}`} 
              dailyWorkout={workout}
              isToday={currentDisplayDate ? fnsIsToday(parseISO(workout.date)) : false} // isToday based on actual workout date
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Workouts Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              There are no workouts scheduled for this week. This might be a rest week, the cycle hasn't started, or your profile may need (re)configuration for these dates.
            </p>
            {(!profile.workoutSchedule || profile.workoutSchedule.length === 0) && (
                 <Button asChild variant="link" className="p-0 h-auto mt-2">
                    <Link href="/profile">Please configure your workout days and lifts in your profile.</Link>
                 </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
