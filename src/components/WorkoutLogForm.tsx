
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { DailyWorkout, WorkoutSet } from "@/lib/types";
import { useAppContext } from "@/hooks/use-app-context";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle } from "lucide-react";
import { formatDisplayWeight } from "@/lib/wendler";


interface WorkoutLogFormProps {
  dailyWorkout: DailyWorkout;
}

const createLogFormSchema = (sets: WorkoutSet[]) => z.object({
  completedSets: z.array(z.object({
    prescribedWeight: z.number(),
    prescribedReps: z.string(),
    actualReps: z.coerce.number().min(0, "Reps cannot be negative"),
    isAmrap: z.boolean(),
  })).length(sets.length, "Must log all sets."),
});


export function WorkoutLogForm({ dailyWorkout }: WorkoutLogFormProps) {
  const { updateWorkoutLogInCycle, profile } = useAppContext(); 
  const { toast } = useToast();

  const logFormSchema = createLogFormSchema(dailyWorkout.sets);
  type LogFormValues = z.infer<typeof logFormSchema>;

  const form = useForm<LogFormValues>({
    resolver: zodResolver(logFormSchema),
    defaultValues: {
      completedSets: dailyWorkout.sets.map(s => ({
        prescribedWeight: s.targetWeight,
        prescribedReps: s.targetReps,
        actualReps: s.completedReps ?? (s.isAmrap ? 0 : parseInt(s.targetReps.replace('+', ''))),
        isAmrap: s.isAmrap,
      })),
    },
  });
  
  const {formState: {isSubmitting}} = form;

  function onSubmit(data: LogFormValues) {
    updateWorkoutLogInCycle(dailyWorkout.date, dailyWorkout.mainLift, data.completedSets);
    toast({
      title: "Workout Logged!",
      description: `${dailyWorkout.mainLift} on ${dailyWorkout.date} marked as complete.`,
      variant: "default",
    });
  }

  if (dailyWorkout.isCompleted) {
    return (
      <div className="mt-4 p-4 border border-green-500 bg-green-50 rounded-md text-green-700 flex items-center">
        <CheckCircle className="h-5 w-5 mr-2" />
        Workout completed!
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        {dailyWorkout.sets.map((set, index) => (
          <FormField
            key={index}
            control={form.control}
            name={`completedSets.${index}.actualReps`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between gap-2">
                <FormLabel className="w-2/3">
                  Set {index + 1}: {formatDisplayWeight(set.targetWeight, profile)} x {set.targetReps}
                  {set.isAmrap && <span className="text-xs text-primary font-semibold ml-1">(AMRAP)</span>}
                </FormLabel>
                <div className="w-1/3">
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Reps" 
                    {...field}
                    className="text-right"
                    min="0"
                   />
                </FormControl>
                <FormMessage className="text-xs"/>
                </div>
              </FormItem>
            )}
          />
        ))}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Logging..." : "Log Workout & Mark Complete"}
        </Button>
      </form>
    </Form>
  );
}
