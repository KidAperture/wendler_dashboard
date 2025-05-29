"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppContext } from "@/hooks/use-app-context";
import { getWeightAdjustmentSuggestion } from "@/lib/actions";
import { MAIN_LIFTS, MainLiftId } from "@/lib/constants";
import type { WorkoutLogEntry } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const weightAdjustmentSchema = z.object({
  exercise: z.custom<MainLiftId>((val) => MAIN_LIFTS.some(lift => lift.id === val), {
    message: "Please select a valid exercise.",
  }),
});

type WeightAdjustmentFormValues = z.infer<typeof weightAdjustmentSchema>;

export function WeightAdjustmentForm() {
  const { profile, workoutLogs } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<WeightAdjustmentFormValues>({
    resolver: zodResolver(weightAdjustmentSchema),
  });

  const onSubmit = async (data: WeightAdjustmentFormValues) => {
    if (!profile) {
      setError("User profile not found. Please set up your profile first.");
      return;
    }

    setIsLoading(true);
    setSuggestion(null);
    setError(null);

    const exerciseId = data.exercise;
    const currentMax = profile.oneRepMaxes[exerciseId];
    const exerciseName = MAIN_LIFTS.find(l => l.id === exerciseId)?.name || exerciseId;

    // Filter workout logs for the selected exercise from the most recent cycle.
    // This is a simplified filter; a real app might need more sophisticated cycle tracking.
    const relevantLogs = workoutLogs
      .filter(log => log.exercise === exerciseId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Sort by most recent
      .slice(0, 4); // Typically 4 weeks in a cycle, take most recent 4 sessions for that lift

    if (relevantLogs.length === 0) {
      setError(`No workout history found for ${exerciseName}. Log some workouts first.`);
      setIsLoading(false);
      return;
    }
    
    // Prepare input for GenAI flow
    const aiInput = {
      workoutHistory: JSON.stringify(relevantLogs.map(log => ({
        date: log.date,
        exercise: exerciseName, // Genkit flow might expect name
        prescribedWeight: log.completedSets[log.completedSets.length-1]?.prescribedWeight, // Example: taking last set's weight
        actualRepsCompleted: log.completedSets[log.completedSets.length-1]?.actualReps, // AMRAP reps
        targetReps: log.completedSets[log.completedSets.length-1]?.prescribedReps.replace('+', ''), // Target reps for AMRAP
        notes: `TM used: ${log.trainingMaxUsed}`
      }))),
      currentMax: currentMax,
      exercise: exerciseName,
    };

    try {
      const result = await getWeightAdjustmentSuggestion(aiInput);
      if ('error' in result) {
        setError(result.error);
      } else {
        setSuggestion(result.adjustmentRecommendation);
      }
    } catch (e) {
      setError("Failed to get suggestion. Please try again.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weight Adjustment Guidance</CardTitle>
        <CardDescription>
          Get AI-powered advice on how to adjust your training maxes for the next cycle based on your recent performance.
          It's recommended to use this after completing a full 4-week cycle.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="exercise"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Exercise</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an exercise" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MAIN_LIFTS.map(lift => (
                        <SelectItem key={lift.id} value={lift.id}>
                          {lift.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {suggestion && !isLoading && (
              <Alert variant="default">
                <AlertTitle>AI Recommendation</AlertTitle>
                <AlertDescription>
                  <Textarea value={suggestion} readOnly rows={5} className="mt-2 bg-muted/50" />
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading || !profile}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting Suggestion...
                </>
              ) : (
                "Get Suggestion"
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
