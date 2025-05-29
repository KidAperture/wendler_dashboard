
"use client";

import React from "react";
import { useAppContext } from "@/hooks/use-app-context";
import { WeightAdjustmentForm } from "@/components/WeightAdjustmentForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { MAIN_LIFTS, MainLiftId } from "@/lib/constants";
import { calculateE1RM } from "@/lib/wendler";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";

interface ChartDataPoint {
  originalDate: string;
  e1RM: number;
  weight: number;
  reps: number;
  prescribedRepsTarget: string;
}

export default function ProgressPage() {
  const { workoutLogs, profile, isLoading } = useAppContext();

  const chartDataByLift = React.useMemo(() => {
    const data: Record<MainLiftId, Array<ChartDataPoint>> = {
      squat: [],
      benchPress: [],
      deadlift: [],
      overheadPress: [],
    };

    if (!workoutLogs || workoutLogs.length === 0) {
      return data;
    }

    const logsForCharts = [...workoutLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    logsForCharts.forEach(log => {
      const topSet = log.completedSets.find(s => s.isAmrap) || (log.completedSets.length > 0 ? log.completedSets[log.completedSets.length - 1] : null);
      if (topSet && topSet.actualReps > 0) {
        const e1RM = calculateE1RM(topSet.prescribedWeight, topSet.actualReps);
        if (e1RM > 0 || topSet.isAmrap) { // Include if it's an AMRAP set even if e1RM is 0 (e.g. 0 reps on AMRAP)
          data[log.exercise].push({
            originalDate: log.date,
            e1RM: e1RM,
            weight: topSet.prescribedWeight,
            reps: topSet.actualReps,
            prescribedRepsTarget: topSet.prescribedReps,
          });
        }
      }
    });
    return data;
  }, [workoutLogs]);

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

  const e1RMChartConfig = {
    e1RM: {
      label: "Est. 1RM",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  const amrapRepsChartConfig = {
    reps: {
      label: "AMRAP Reps",
      color: "hsl(var(--chart-2))",
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
          const dataForLift = chartDataByLift[lift.id];
          const notEnoughData = !dataForLift || dataForLift.length < 2;

          return (
            <React.Fragment key={lift.id}>
              {/* AMRAP Reps Chart Card */}
              <Card>
                <CardHeader>
                  <CardTitle>{lift.name} - AMRAP Reps Progress</CardTitle>
                  <CardDescription>Actual repetitions achieved in your AMRAP sets over time.</CardDescription>
                </CardHeader>
                <CardContent>
                  {notEnoughData ? (
                    <p className="text-muted-foreground">
                      Not enough data to display an AMRAP reps chart for {lift.name}. Complete at least two workouts with AMRAP sets for this lift.
                    </p>
                  ) : (
                    <ChartContainer config={amrapRepsChartConfig} className="h-[300px] w-full">
                      <LineChart
                        accessibilityLayer
                        data={dataForLift}
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
                          domain={['dataMin - 1', 'dataMax + 1']}
                          allowDecimals={false}
                          tickFormatter={(value) => `${value}`}
                        />
                        <ChartTooltip
                          cursor={true}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length && label) {
                              const dataPoint = payload[0].payload as ChartDataPoint;
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
                                      <span>(Set: {dataPoint.weight} kg/lb x {dataPoint.prescribedRepsTarget})</span>
                                    </div>
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
                        />
                      </LineChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Estimated 1RM Chart Card */}
              <Card>
                <CardHeader>
                  <CardTitle>{lift.name} - Est. 1RM Progress</CardTitle>
                  <CardDescription>Estimated 1 Rep Max trend over time based on your AMRAP sets.</CardDescription>
                </CardHeader>
                <CardContent>
                  {notEnoughData ? (
                     <p className="text-muted-foreground">
                       Not enough data to display an e1RM chart for {lift.name}. Complete at least two workouts with AMRAP sets for this lift.
                     </p>
                  ) : (
                    <ChartContainer config={e1RMChartConfig} className="h-[300px] w-full">
                      <LineChart
                        accessibilityLayer
                        data={dataForLift.filter(d => d.e1RM > 0)} // Only plot if e1RM is valid
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
                          dataKey="e1RM"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          domain={['dataMin - 5', 'dataMax + 5']}
                          tickFormatter={(value) => `${value}`}
                        />
                        <ChartTooltip
                          cursor={true}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length && label) {
                              const dataPoint = payload[0].payload as ChartDataPoint;
                              return (
                                <div className="rounded-lg border bg-background p-2.5 shadow-sm text-sm">
                                  <div className="grid gap-1.5">
                                    <div className="font-medium">
                                      {format(parseISO(dataPoint.originalDate), "MMMM d, yyyy")}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span style={{ backgroundColor: e1RMChartConfig.e1RM.color }} className="h-2.5 w-2.5 shrink-0 rounded-[2px]" />
                                      <div className="flex flex-1 justify-between">
                                        <span className="text-muted-foreground">{e1RMChartConfig.e1RM.label}:</span>
                                        <span className="font-medium">{dataPoint.e1RM.toFixed(1)}</span>
                                      </div>
                                    </div>
                                    <div className="flex flex-1 justify-between text-xs text-muted-foreground/80 pl-[18px]">
                                      <span>(Set: {dataPoint.weight} kg/lb x {dataPoint.reps} reps)</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line
                          dataKey="e1RM"
                          type="monotone"
                          stroke="var(--color-e1RM)"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: "var(--color-e1RM)", strokeWidth: 0 }}
                          activeDot={{ r: 6, strokeWidth: 1, fill: "var(--background)", stroke: "var(--color-e1RM)" }}
                        />
                      </LineChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </React.Fragment>
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
                    const topSet = log.completedSets.find(s => s.isAmrap) || log.completedSets[log.completedSets.length - 1];
                    return (
                      <TableRow key={log.logId}>
                        <TableCell>{format(parseISO(log.date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{exerciseName}</TableCell>
                        <TableCell>
                          {topSet ? `${topSet.prescribedWeight} kg/lb x ${topSet.actualReps} reps (Target: ${topSet.prescribedReps})` : 'N/A'}
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
