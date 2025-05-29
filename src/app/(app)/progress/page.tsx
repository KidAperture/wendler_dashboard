
"use client";

import React from "react";
import { useAppContext } from "@/hooks/use-app-context";
import { WeightAdjustmentForm } from "@/components/WeightAdjustmentForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { MAIN_LIFTS, MainLiftId } from "@/lib/constants";
import { calculateE1RM, formatDisplayWeight } from "@/lib/wendler";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface ChartDataPoint {
  originalDate: string;
  e1RM: number;
  weight: number; // This is total weight
  reps: number;
  prescribedRepsTarget: string;
}

export default function ProgressPage() {
  const { workoutLogs, profile, isLoading } = useAppContext();
  
  const unitSuffix = React.useMemo(() => profile?.unitSystem === 'metric' ? 'kg' : 'lb', [profile]);

  const chartDataByLift = React.useMemo(() => {
    const data: Record<MainLiftId, Array<ChartDataPoint>> = {
      squat: [],
      benchPress: [],
      deadlift: [],
      overheadPress: [],
    };

    if (!workoutLogs || workoutLogs.length === 0 || !profile) {
      return data;
    }

    const logsForCharts = [...workoutLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    logsForCharts.forEach(log => {
      const topSet = log.completedSets.find(s => s.isAmrap) || (log.completedSets.length > 0 ? log.completedSets[log.completedSets.length - 1] : null);
      if (topSet && topSet.actualReps > 0) {
        const e1RM = calculateE1RM(topSet.prescribedWeight, topSet.actualReps);
        data[log.exercise].push({
          originalDate: log.date,
          e1RM: e1RM,
          weight: topSet.prescribedWeight,
          reps: topSet.actualReps,
          prescribedRepsTarget: topSet.prescribedReps,
        });
      } else if (topSet) {
         data[log.exercise].push({
          originalDate: log.date,
          e1RM: 0, // Will be filtered out for e1RM specific calculations if needed
          weight: topSet.prescribedWeight,
          reps: 0,
          prescribedRepsTarget: topSet.prescribedReps,
        });
      }
    });
    return data;
  }, [workoutLogs, profile]);

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

  const amrapRepsChartConfig = {
    reps: {
      label: "AMRAP Reps",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  const sortedLogsForTable = [...workoutLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Your Progress</h1>
        <p className="text-muted-foreground mb-6">Track your strength gains and get AI-powered advice for adjustments.</p>
      </div>

      <div className="space-y-6">
        {MAIN_LIFTS.map((lift) => {
          const allDataForLift = chartDataByLift[lift.id];
          const validE1RMDataForLift = allDataForLift.filter(d => d.e1RM > 0);
          const notEnoughDataForChart = !allDataForLift || allDataForLift.length < 2;

          let latestE1RMDisplay: string | null = null;
          let e1RMChangeInfo: { text: string; variant: "default" | "destructive" | "secondary"; icon: React.ReactNode } | null = null;

          if (validE1RMDataForLift.length > 0) {
            const latestDataPoint = validE1RMDataForLift[validE1RMDataForLift.length - 1];
            latestE1RMDisplay = latestDataPoint.e1RM.toFixed(1);

            if (validE1RMDataForLift.length > 1) {
              const previousDataPoint = validE1RMDataForLift[validE1RMDataForLift.length - 2];
              if (previousDataPoint.e1RM > 0) { // Ensure previous e1RM is valid for percentage calculation
                const change = ((latestDataPoint.e1RM - previousDataPoint.e1RM) / previousDataPoint.e1RM) * 100;
                const Icon = change > 0 ? ArrowUp : change < 0 ? ArrowDown : Minus;
                e1RMChangeInfo = {
                  text: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
                  variant: change > 0 ? "default" : change < 0 ? "destructive" : "secondary",
                  icon: <Icon className="h-3 w-3" />
                };
              }
            }
          }
          
          return (
            <Card key={lift.id}>
              <CardHeader>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <CardTitle>{lift.name} - AMRAP Reps Progress</CardTitle>
                    <CardDescription>Actual repetitions achieved in your AMRAP sets over time.</CardDescription>
                  </div>
                  {latestE1RMDisplay && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-muted-foreground">Latest Est. 1RM</p>
                      <p className="text-xl font-bold text-primary">{latestE1RMDisplay} <span className="text-xs text-muted-foreground">{unitSuffix}</span></p>
                      {e1RMChangeInfo && (
                        <Badge variant={e1RMChangeInfo.variant} className="mt-1 text-xs py-0.5 px-1.5 h-auto">
                          <span className="mr-1">{e1RMChangeInfo.icon}</span>
                          {e1RMChangeInfo.text}
                        </Badge>
                      )}
                       {!e1RMChangeInfo && validE1RMDataForLift.length === 1 && (
                         <Badge variant="secondary" className="mt-1 text-xs py-0.5 px-1.5 h-auto">
                           First e1RM logged
                         </Badge>
                       )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {notEnoughDataForChart ? (
                  <p className="text-muted-foreground">
                    Not enough data to display an AMRAP reps chart for {lift.name}. Complete at least two workouts with AMRAP sets for this lift.
                  </p>
                ) : (
                  <ChartContainer config={amrapRepsChartConfig} className="h-[300px] w-full">
                    <LineChart
                      accessibilityLayer
                      data={allDataForLift} // Use allDataForLift to plot all reps, even if e1RM is 0
                      margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                      padding={{ top: 10, bottom: 10 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="originalDate"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => format(parseISO(value), "MMM d")}
                      />
                      <YAxis
                        dataKey="reps"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        domain={[0, 'dataMax + 1']} // Ensure Y-axis starts at 0 for reps
                        allowDecimals={false}
                        tickFormatter={(value) => `${value}`}
                      />
                      <ChartTooltip
                        cursor={true}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length && label && profile) {
                            const dataPoint = payload[0].payload as ChartDataPoint;
                            const displayWeightString = formatDisplayWeight(dataPoint.weight, profile);
                            return (
                              <div className="rounded-lg border bg-background p-2.5 shadow-sm text-sm">
                                <div className="grid gap-1.5">
                                  <div className="font-medium">
                                    {format(parseISO(dataPoint.originalDate), "MMMM d, yyyy")}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span style={{ backgroundColor: amrapRepsChartConfig.reps.color }} className="h-2.5 w-2.5 shrink-0 rounded-[2px]" />
                                    <div className="flex flex-1 justify-between">
                                      <span className="text-muted-foreground">{amrapRepsChartConfig.reps.label}:</span>
                                      <span className="font-medium">{dataPoint.reps}</span>
                                    </div>
                                  </div>
                                  <div className="flex flex-1 justify-between text-xs text-muted-foreground/80 pl-[18px]">
                                    <span>(Set: {displayWeightString} x {dataPoint.prescribedRepsTarget})</span>
                                  </div>
                                  {dataPoint.e1RM > 0 && (
                                    <div className="flex flex-1 justify-between text-xs text-muted-foreground/80 pl-[18px] mt-1 pt-1 border-t border-dashed">
                                      <span>Est. 1RM:</span>
                                      <span className="font-medium">{dataPoint.e1RM.toFixed(1)} {unitSuffix}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        dataKey="reps"
                        type="monotone"
                        stroke="var(--color-reps)"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "var(--color-reps)", strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 1, fill: "var(--background)", stroke: "var(--color-reps)" }}
                        connectNulls={false} // If actualReps can be 0 and we want to show breaks for non-AMRAP or no-data
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      <WeightAdjustmentForm />

      <Card>
        <CardHeader>
          <CardTitle>Workout History</CardTitle>
          <CardDescription>A log of your completed workouts (most recent first).</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedLogsForTable.length > 0 ? (
            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Exercise</TableHead>
                    <TableHead>Top Set (Actual)</TableHead>
                    <TableHead>TM Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLogsForTable.map((log) => {
                    const exerciseName = MAIN_LIFTS.find(l => l.id === log.exercise)?.name || log.exercise;
                    const topSet = log.completedSets.find(s => s.isAmrap) || (log.completedSets.length > 0 ? log.completedSets[log.completedSets.length - 1] : null);
                    const displayWeight = topSet ? formatDisplayWeight(topSet.prescribedWeight, profile) : 'N/A';
                    return (
                      <TableRow key={log.logId}>
                        <TableCell>{format(parseISO(log.date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{exerciseName}</TableCell>
                        <TableCell>
                          {topSet ? `${displayWeight} x ${topSet.actualReps} reps (Target: ${topSet.prescribedReps})` : 'N/A'}
                        </TableCell>
                        <TableCell>{log.trainingMaxUsed} {unitSuffix}</TableCell>
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

