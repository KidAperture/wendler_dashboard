
"use client";

import { useAppContext } from "@/hooks/use-app-context";
import { WorkoutCard } from "@/components/WorkoutCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, isToday as fnsIsToday, addWeeks, subWeeks, getYear, getTime, startOfWeek, endOfWeek, eachDayOfInterval, getDay } from "date-fns";
import { useState, useEffect } from "react";
import type { DailyWorkout } from "@/lib/types";

export default function DashboardPage() {
  const { profile, isLoading, currentCycleData, activeCycleNumber, setActiveCycleNumber } = useAppContext();
  const [currentDisplayDate, setCurrentDisplayDate] = useState<Date | null>(null);
  const [workoutsForWeek, setWorkoutsForWeek] = useState<DailyWorkout[]>([]);

  useEffect(() => {
    setCurrentDisplayDate(new Date());
  }, []);

  useEffect(() => {
    if (!currentDisplayDate || !currentCycleData || !profile?.startDate) {
      setWorkoutsForWeek([]);
      return;
    }
  
    // Determine the start of the week for currentDisplayDate, respecting profile's cycle start day of week
    const cycleStartDateObj = parseISO(profile.startDate);
    const weekOptions = { weekStartsOn: getDay(cycleStartDateObj) as 0 | 1 | 2 | 3 | 4 | 5 | 6 };
    
    const displayWeekStart = startOfWeek(currentDisplayDate, weekOptions);
    const displayWeekEnd = endOfWeek(currentDisplayDate, weekOptions);

    // Filter workouts from currentCycleData that fall within this display week
    const allCycleWorkouts = currentCycleData.weeks.flatMap(w => w.days);
    const relevantWorkouts = allCycleWorkouts.filter(workout => {
        const workoutDate = parseISO(workout.date);
        return workoutDate >= displayWeekStart && workoutDate <= displayWeekEnd;
    });
    
    setWorkoutsForWeek(relevantWorkouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

    // Adjust activeCycleNumber if currentDisplayDate falls outside the active cycle's range
    const cycleDurationWeeks = currentCycleData.weeks.length; // Should be 4 for Wendler
    const firstDayOfCurrentCycle = parseISO(currentCycleData.startDate);
    const lastDayOfCurrentCycle = addWeeks(firstDayOfCurrentCycle, cycleDurationWeeks-1); // Approx end, could be more precise
    
    if (currentDisplayDate < firstDayOfCurrentCycle) {
        const diffWeeks = Math.ceil((firstDayOfCurrentCycle.getTime() - currentDisplayDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const cyclesToGoBack = Math.ceil(diffWeeks / cycleDurationWeeks);
        if (activeCycleNumber - cyclesToGoBack >= 1) {
            setActiveCycleNumber(activeCycleNumber - cyclesToGoBack);
        } else if (activeCycleNumber !== 1) {
            setActiveCycleNumber(1);
        }
    } else if (currentDisplayDate > endOfWeek(lastDayOfCurrentCycle, weekOptions)) { // Check if display date is beyond the current cycle
        const diffWeeks = Math.floor((currentDisplayDate.getTime() - firstDayOfCurrentCycle.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const cyclesToAdvance = Math.floor(diffWeeks / cycleDurationWeeks);
        setActiveCycleNumber(activeCycleNumber + cyclesToAdvance);
    }

  }, [currentCycleData, currentDisplayDate, profile?.startDate, activeCycleNumber, setActiveCycleNumber]);
  

  const handlePreviousWeek = () => {
    if (!currentDisplayDate || !profile?.startDate) return;
    const newDate = subWeeks(currentDisplayDate, 1);
    
    // Prevent going to a cycle before cycle 1 effectively.
    // The cycle adjustment logic in useEffect should handle clamping to cycle 1.
    const cycleStartDate = parseISO(profile.startDate);
    if (newDate < startOfWeek(cycleStartDate, { weekStartsOn: getDay(cycleStartDate) as 0 | 1 | 2 | 3 | 4 | 5 | 6 }) && activeCycleNumber === 1) {
      setCurrentDisplayDate(cycleStartDate); // Go to start of cycle 1
    } else {
      setCurrentDisplayDate(newDate);
    }
  };

  const handleNextWeek = () => {
    if (!currentDisplayDate) return;
    setCurrentDisplayDate(addWeeks(currentDisplayDate, 1));
  };

  if (isLoading || !currentDisplayDate) {
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
  
  let weekName = "";
  let displayWeekStartDateString = "Loading date...";

  if (workoutsForWeek.length > 0 && workoutsForWeek[0].date) {
      const firstWorkoutDate = parseISO(workoutsForWeek[0].date);
      displayWeekStartDateString = format(startOfWeek(firstWorkoutDate, { weekStartsOn: getDay(parseISO(profile.startDate)) as 0|1|2|3|4|5|6 }), "MMMM d, yyyy");
      
      // Try to get week name from the currentCycleData based on one of the workouts in workoutsForWeek
      const sampleWorkout = workoutsForWeek[0];
      const cycleWeek = currentCycleData?.weeks.find(w => w.days.some(d => d.date === sampleWorkout.date && d.mainLift === sampleWorkout.mainLift));
      if (cycleWeek) {
          weekName = cycleWeek.weekName;
      }
  } else if (currentDisplayDate && profile.startDate) {
       displayWeekStartDateString = format(startOfWeek(currentDisplayDate, { weekStartsOn: getDay(parseISO(profile.startDate)) as 0|1|2|3|4|5|6 }), "MMMM d, yyyy");
       // Attempt to find week name based on currentDisplayDate relative to cycle start
       if (currentCycleData) {
         const diffWeeks = Math.floor((currentDisplayDate.getTime() - parseISO(currentCycleData.startDate).getTime()) / (7*24*60*60*1000));
         const weekIndexInCycle = diffWeeks % currentCycleData.weeks.length;
         if (weekIndexInCycle >= 0 && weekIndexInCycle < currentCycleData.weeks.length) {
           weekName = currentCycleData.weeks[weekIndexInCycle].weekName;
         }
       }
  }
  
  const isPreviousButtonDisabled = !currentDisplayDate || !profile?.startDate ||
    (activeCycleNumber === 1 && currentDisplayDate && parseISO(profile.startDate) >= currentDisplayDate &&
     startOfWeek(currentDisplayDate, { weekStartsOn: getDay(parseISO(profile.startDate)) as 0|1|2|3|4|5|6 }) <= startOfWeek(parseISO(profile.startDate), { weekStartsOn: getDay(parseISO(profile.startDate)) as 0|1|2|3|4|5|6 }));


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

      {workoutsForWeek.length > 0 ? (
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
              There are no workouts scheduled for this week in the current cycle. This might be a rest week, or your profile may need configuration.
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
