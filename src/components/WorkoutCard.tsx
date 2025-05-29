
"use client";

import type { DailyWorkout } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MAIN_LIFTS } from "@/lib/constants";
import { WorkoutLogForm } from "./WorkoutLogForm";
import { CheckCircle, CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils"; // Added this import

interface WorkoutCardProps {
  dailyWorkout: DailyWorkout;
  isToday?: boolean;
}

export function WorkoutCard({ dailyWorkout, isToday = false }: WorkoutCardProps) {
  const liftName = MAIN_LIFTS.find(l => l.id === dailyWorkout.mainLift)?.name || dailyWorkout.mainLift;

  return (
    <Card className={cn("w-full shadow-lg", isToday && "border-primary border-2")}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-2xl">{liftName}</CardTitle>
            <CardDescription className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              {format(parseISO(dailyWorkout.date), "EEEE, MMMM d, yyyy")} ({dailyWorkout.dayOfWeek})
            </CardDescription>
          </div>
          {isToday && <Badge variant="default">Today</Badge>}
        </div>
        {dailyWorkout.isCompleted && (
           <div className="mt-2 p-2 border border-green-500 bg-green-50 rounded-md text-green-700 flex items-center text-sm">
             <CheckCircle className="h-4 w-4 mr-2" />
             Completed
           </div>
         )}
      </CardHeader>
      <CardContent>
        <h4 className="font-semibold mb-2 text-lg">Main Lift:</h4>
        <ul className="space-y-1 list-disc list-inside mb-4">
          {dailyWorkout.sets.map((set, index) => (
            <li key={index} className="text-sm">
              Set {index + 1}: <span className="font-medium">{set.targetWeight} kg/lb</span> x <span className="font-medium">{set.targetReps} reps</span>
              {set.isAmrap && <Badge variant="outline" className="ml-2 text-xs">AMRAP</Badge>}
              {dailyWorkout.isCompleted && set.completedReps !== undefined && <span className="ml-2 text-primary font-semibold">(Completed: {set.completedReps} reps)</span>}
            </li>
          ))}
        </ul>
        
        {/* Placeholder for accessory work if added later */}
        {/* <h4 className="font-semibold mb-2 text-lg">Accessory Work:</h4>
        <p className="text-sm text-muted-foreground">Accessory exercises will be listed here.</p> */}
      </CardContent>
      {!dailyWorkout.isCompleted && (
        <CardFooter>
          <WorkoutLogForm dailyWorkout={dailyWorkout} />
        </CardFooter>
      )}
    </Card>
  );
}
