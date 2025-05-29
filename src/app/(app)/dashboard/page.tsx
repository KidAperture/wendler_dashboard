
"use client";

import { useAppContext } from "@/hooks/use-app-context";
import { WorkoutCard } from "@/components/WorkoutCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, isToday as fnsIsToday, addWeeks, subWeeks, getYear, getTime } from "date-fns";
import { useState, useEffect } from "react";
import type { DailyWorkout } from "@/lib/types";

export default function DashboardPage() {
  const { profile, isLoading, currentCycleData, activeCycleNumber, setActiveCycleNumber, recalculateCycle } = useAppContext();
  const [currentDisplayDate, setCurrentDisplayDate] = useState<Date | null>(null);
  const [workoutsForWeek, setWorkoutsForWeek] = useState<DailyWorkout[]>([]);

  useEffect(() => {
    // Set initial display date only on client side to prevent hydration mismatch
    setCurrentDisplayDate(new Date());
  }, []);

  useEffect(() => {
    if (!currentDisplayDate || !currentCycleData) {
      setWorkoutsForWeek([]);
      return;
    }

    // Find the week that contains currentDisplayDate
    const displayWeekStart = parseISO(currentCycleData.startDate); // This is cycle start
    const weekOffset = Math.floor(
      (currentDisplayDate.getTime() - displayWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    
    const targetWeekIndex = weekOffset % 4; // week index within the cycle (0-3)
    
    if (currentCycleData.weeks && currentCycleData.weeks[targetWeekIndex]) {
       setWorkoutsForWeek(currentCycleData.weeks[targetWeekIndex].days);
    } else {
       // If currentDisplayDate is outside the current cycle's range, try to adjust cycle or show empty
       const newCycleNum = Math.floor(weekOffset / 4) + 1;
       if(newCycleNum !== activeCycleNumber) {
          setActiveCycleNumber(newCycleNum); // This will trigger re-fetch of cycle data
       } else {
          setWorkoutsForWeek([]); // Default to empty if week not found
       }
    }
  }, [currentCycleData, currentDisplayDate, activeCycleNumber, setActiveCycleNumber]);
  
  // This effect runs when activeCycleNumber changes, ensuring currentDisplayDate aligns with the new cycle's start.
  useEffect(() => {
    if (profile?.startDate) {
      const cycleStartDate = addWeeks(parseISO(profile.startDate), (activeCycleNumber - 1) * 4);
      setCurrentDisplayDate(cycleStartDate);
      // recalculateCycle is called from useAppContext when activeCycleNumber changes, 
      // or can be explicitly called if needed after state updates.
      // For now, relying on its dependency on activeCycleNumber in AppContext.
      // If direct call needed: recalculateCycle(); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCycleNumber, profile?.startDate]);
  // Note: `recalculateCycle` is stable from context or depends on profile/activeCycleNumber, 
  // so direct inclusion here might cause issues if not memoized perfectly.


  const handlePreviousWeek = () => {
    if (!currentDisplayDate || !profile?.startDate) return;
    const newDate = subWeeks(currentDisplayDate, 1);
    const cycleStartDate = parseISO(profile.startDate);
    
    // Calculate what cycle newDate would fall into
    const absoluteWeekOffset = Math.floor((newDate.getTime() - cycleStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const newPotentialCycleNum = Math.floor(absoluteWeekOffset / 4) + 1;

    // Prevent going to a cycle before cycle 1
    if (newPotentialCycleNum < 1 && activeCycleNumber === 1) {
        // If already in cycle 1 and trying to go to a week before cycle 1 starts, clamp to cycle 1 start.
        // This check might need adjustment based on exact definition of "before cycle 1"
        if (newDate < cycleStartDate) {
            setCurrentDisplayDate(cycleStartDate); // Go to start of cycle 1
            if (activeCycleNumber !== 1) setActiveCycleNumber(1);
            return;
        }
    }
    
    setCurrentDisplayDate(newDate);
    if (newPotentialCycleNum !== activeCycleNumber && newPotentialCycleNum > 0) {
      setActiveCycleNumber(newPotentialCycleNum);
    }
  };

  const handleNextWeek = () => {
    if (!currentDisplayDate || !profile?.startDate) return;
    const newDate = addWeeks(currentDisplayDate, 1);
    setCurrentDisplayDate(newDate);

    const cycleStartDate = parseISO(profile.startDate);
    const weekOffset = Math.floor((newDate.getTime() - cycleStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const newCycleNum = Math.floor(weekOffset / 4) + 1;
    if (newCycleNum !== activeCycleNumber) {
      setActiveCycleNumber(newCycleNum);
    }
  };

  if (isLoading || !currentDisplayDate) { // Added !currentDisplayDate check
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
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
  
  const weekName = currentDisplayDate && currentCycleData?.weeks.find(w => 
    w.days.some(d => {
      const dayDate = parseISO(d.date);
      // Check if dayDate is in the same week as currentDisplayDate
      return getYear(dayDate) === getYear(currentDisplayDate) &&
             Math.floor((getTime(dayDate) - new Date(getYear(currentDisplayDate), 0, 1).getTime()) / (7*24*60*60*1000)) === 
             Math.floor((getTime(currentDisplayDate) - new Date(getYear(currentDisplayDate), 0, 1).getTime()) / (7*24*60*60*1000));
    })
  )?.weekName || "";

  let displayWeekStartDateString = "Loading date...";
  if (workoutsForWeek.length > 0 && workoutsForWeek[0].date) {
      displayWeekStartDateString = format(parseISO(workoutsForWeek[0].date), "MMMM d, yyyy");
  } else if (currentDisplayDate) {
      displayWeekStartDateString = format(currentDisplayDate, "MMMM d, yyyy");
  }
  
  const isPreviousButtonDisabled = !currentDisplayDate || !profile?.startDate ||
    (activeCycleNumber === 1 && currentDisplayDate && parseISO(profile.startDate) >= currentDisplayDate);


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
          <Button variant="outline" onClick={handleNextWeek} disabled={!currentDisplayDate}>
            Next Week <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {currentCycleData && workoutsForWeek.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {workoutsForWeek.map((workout) => (
            <WorkoutCard 
              key={`${workout.date}-${workout.mainLift}`} 
              dailyWorkout={workout}
              isToday={currentDisplayDate ? fnsIsToday(parseISO(workout.date)) : false}
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
              There are no workouts scheduled for this week in the current cycle, or your profile might need adjustment.
            </p>
            {(!profile.workoutDays || profile.workoutDays.length === 0) && (
                 <Button asChild variant="link" className="p-0 h-auto mt-2">
                    <Link href="/profile">Please configure your workout days in your profile.</Link>
                 </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
