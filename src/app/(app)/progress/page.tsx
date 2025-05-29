"use client";

import { useAppContext } from "@/hooks/use-app-context";
import { WeightAdjustmentForm } from "@/components/WeightAdjustmentForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";
import { MAIN_LIFTS } from "@/lib/constants";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ProgressPage() {
  const { workoutLogs, profile, isLoading } = useAppContext();

  if (isLoading) {
    return <div className="text-center py-10">Loading progress data...</div>;
  }
  
  if (!profile) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Profile Not Found</CardTitle>
            <CardDescription>Please set up your profile to track and view progress.</CardDescription>
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


  const sortedLogs = [...workoutLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-6">Your Progress</h1>
        <WeightAdjustmentForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workout History</CardTitle>
          <CardDescription>A log of your completed workouts.</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedLogs.length > 0 ? (
            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Exercise</TableHead>
                    <TableHead>Top Set</TableHead>
                    <TableHead>TM Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLogs.map((log) => {
                    const exerciseName = MAIN_LIFTS.find(l => l.id === log.exercise)?.name || log.exercise;
                    const topSet = log.completedSets.find(s => s.isAmrap) || log.completedSets[log.completedSets.length - 1];
                    return (
                      <TableRow key={log.logId}>
                        <TableCell>{format(parseISO(log.date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{exerciseName}</TableCell>
                        <TableCell>
                          {topSet ? `${topSet.prescribedWeight} kg/lb x ${topSet.actualReps} reps` : 'N/A'}
                        </TableCell>
                        <TableCell>{log.trainingMaxUsed} kg/lb</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-muted-foreground">No workouts logged yet. Complete some workouts on the Dashboard page to see your history here.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
