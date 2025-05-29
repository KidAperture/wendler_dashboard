"use client";

import { useAppContext } from "@/hooks/use-app-context";
import { WorkoutCard } from "@/components/WorkoutCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, isToday as fnsIsToday, addWeeks, subWeeks } from "date-fns";
import { useState, useEffect } from "react";
import type { DailyWorkout } from "@/lib/types";

export default function DashboardPage() {
  const { profile, isLoading, currentCycleData, activeCycleNumber, setActiveCycleNumber, recalculateCycle } = useAppContext();
  const [currentDisplayDate, setCurrentDisplayDate] = useState(new Date());
  const [workoutsForWeek, setWorkoutsForWeek] = useState<DailyWorkout[]>([]);

  useEffect(() => {
    if (currentCycleData) {
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
    }
  }, [currentCycleData, currentDisplayDate, activeCycleNumber, setActiveCycleNumber]);
  
  // This effect runs when activeCycleNumber changes, ensuring currentDisplayDate aligns with the new cycle's start.
  useEffect(() => {
    if (profile?.startDate) {
      const cycleStartDate = addWeeks(parseISO(profile.startDate), (activeCycleNumber - 1) * 4);
      setCurrentDisplayDate(cycleStartDate);
      recalculateCycle(); // Explicitly recalculate after cycle number change
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCycleNumber, profile?.startDate]);


  const handlePreviousWeek = () => {
    const newDate = subWeeks(currentDisplayDate, 1);
    const cycleStartDate = profile ? parseISO(profile.startDate) : new Date(0);
    // Prevent going to a cycle before cycle 1
    if (addWeeks(cycleStartDate, (activeCycleNumber - 2) * 4) >= cycleStartDate || activeCycleNumber > 1) {
       setCurrentDisplayDate(newDate);
       // Check if newDate falls into a different cycle
       const weekOffset = Math.floor((newDate.getTime() - cycleStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
       const newCycleNum = Math.floor(weekOffset / 4) + 1;
       if (newCycleNum !== activeCycleNumber && newCycleNum > 0) {
         setActiveCycleNumber(newCycleNum);
       }
    }
  };

  const handleNextWeek = () => {
    const newDate = addWeeks(currentDisplayDate, 1);
    setCurrentDisplayDate(newDate);
    // Check if newDate falls into a different cycle
    const cycleStartDate = profile ? parseISO(profile.startDate) : new Date(0);
    const weekOffset = Math.floor((newDate.getTime() - cycleStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const newCycleNum = Math.floor(weekOffset / 4) + 1;
    if (newCycleNum !== activeCycleNumber) {
      setActiveCycleNumber(newCycleNum);
    }
  };

  if (isLoading) {
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
  
  const weekName = currentCycleData?.weeks.find(w => w.days.some(d => parseISO(d.date).getFullYear() === currentDisplayDate.getFullYear() && Math.floor((parseISO(d.date).getTime() - new Date(currentDisplayDate.getFullYear(), 0, 1).getTime()) / (7*24*60*60*1000)) === Math.floor((currentDisplayDate.getTime() - new Date(currentDisplayDate.getFullYear(), 0, 1).getTime()) / (7*24*60*60*1000)) ))?.weekName || "";


  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-3xl font-bold">Cycle {activeCycleNumber} {weekName ? `- ${weekName}` : ""}</h1>
            <p className="text-muted-foreground">
                Week starting: {workoutsForWeek.length > 0 ? format(parseISO(workoutsForWeek[0].date), "MMMM d, yyyy") : format(currentDisplayDate, "MMMM d, yyyy")}
            </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreviousWeek} disabled={activeCycleNumber === 1 && currentDisplayDate <= parseISO(profile.startDate)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous Week
          </Button>
          <Button variant="outline" onClick={handleNextWeek}>
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
              isToday={fnsIsToday(parseISO(workout.date))}
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
