
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, AlertTriangle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useAppContext } from "@/hooks/use-app-context";
import type { UserProfile } from "@/lib/types";
import { MAIN_LIFTS, MainLiftId, DAYS_OF_WEEK, DEFAULT_TRAINING_MAX_PERCENTAGE, DayOfWeek } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateTrainingMax } from "@/lib/wendler";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const profileFormSchema = z.object({
  name: z.string().optional(),
  startDate: z.date({
    required_error: "A start date is required.",
  }),
  oneRepMaxes: z.object(
    MAIN_LIFTS.reduce((acc, lift) => {
      acc[lift.id] = z.coerce.number().min(0, `${lift.name} max can be 0 if unknown, but not negative.`); // Allow 0
      return acc;
    }, {} as Record<MainLiftId, z.ZodNumber>)
  ),
  workoutDays: z.array(z.string()).refine((value) => value.some((day) => day), {
    message: "You have to select at least one workout day.",
  }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

// Base default values for a new/empty form
const initialFormValues: ProfileFormValues = {
  name: "",
  oneRepMaxes: MAIN_LIFTS.reduce((acc, lift) => {
    acc[lift.id] = 0;
    return acc;
  }, {} as Record<MainLiftId, number>),
  workoutDays: [],
  startDate: new Date(), 
};

export function UserProfileForm() {
  const { profile, setProfile, recalculateCycle, resetProgress: resetAppContextProgress } = useAppContext();
  const { toast } = useToast();
  const router = useRouter();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: profile
      ? {
          name: profile.name ?? "",
          oneRepMaxes: MAIN_LIFTS.reduce((acc, lift) => {
            acc[lift.id] = profile.oneRepMaxes?.[lift.id] ?? 0;
            return acc;
          }, {} as Record<MainLiftId, number>),
          startDate: profile.startDate ? parseISO(profile.startDate) : new Date(),
          workoutDays: profile.workoutDays || [],
        }
      : initialFormValues,
  });

  useEffect(() => {
    // Sync form with profile data from context when it changes (e.g., after reset)
    if (profile) {
      form.reset({
        name: profile.name ?? "",
        oneRepMaxes: MAIN_LIFTS.reduce((acc, lift) => {
          acc[lift.id] = profile.oneRepMaxes?.[lift.id] ?? 0;
          return acc;
        }, {} as Record<MainLiftId, number>),
        startDate: profile.startDate ? parseISO(profile.startDate) : new Date(),
        workoutDays: profile.workoutDays || [],
      });
    } else {
      form.reset(initialFormValues);
    }
  }, [profile, form]);


  function onSubmit(data: ProfileFormValues) {
    const trainingMaxes = MAIN_LIFTS.reduce((acc, lift) => {
        acc[lift.id] = calculateTrainingMax(data.oneRepMaxes[lift.id]);
        return acc;
    }, {} as Record<MainLiftId, number>);

    const newProfile: UserProfile = {
      id: profile?.id || "currentUser", 
      name: data.name,
      startDate: format(data.startDate, "yyyy-MM-dd"),
      oneRepMaxes: data.oneRepMaxes,
      trainingMaxes: trainingMaxes,
      workoutDays: data.workoutDays as DayOfWeek[],
    };
    setProfile(newProfile);
    recalculateCycle(); 
    
    toast({
      title: "Profile Saved",
      description: "Your Wendler 5/3/1 profile has been updated.",
    });
    router.push("/dashboard");
  }

  const handleResetProgress = async () => {
    setIsResetting(true);
    try {
      await resetAppContextProgress(); // Assuming resetAppContextProgress could be async if it involved API calls, though here it's sync
      toast({
        title: "Progress Reset",
        description: "Your workout history and maxes have been cleared. You can now start over.",
      });
      // The useEffect listening to `profile` will update the form.
    } catch (error) {
      toast({
        title: "Reset Failed",
        description: "Could not reset progress. Please try again.",
        variant: "destructive",
      });
      console.error("Reset progress error:", error);
    } finally {
      setIsResetting(false);
      setIsResetDialogOpen(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Your Wendler Profile</CardTitle>
        <CardDescription>Set up your lifts, schedule, and start date to begin the program.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Your Name" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {MAIN_LIFTS.map((lift) => (
                <FormField
                  key={lift.id}
                  control={form.control}
                  name={`oneRepMaxes.${lift.id}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{lift.name} 1RM (kg/lb)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder={`Enter ${lift.name} 1RM`} 
                          {...field} 
                          value={field.value ?? 0}
                          onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          min="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Cycle Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[240px] pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Select the date you want to start your first cycle.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="workoutDays"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Workout Days</FormLabel>
                    <FormDescription>
                      Select the days of the week you plan to work out.
                    </FormDescription>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {DAYS_OF_WEEK.map((day) => (
                    <FormField
                      key={day}
                      control={form.control}
                      name="workoutDays"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={day}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(day)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), day])
                                    : field.onChange(
                                        (field.value || []).filter(
                                          (value) => value !== day
                                        )
                                      );
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {day}
                            </FormLabel>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <Button type="submit" className="w-full sm:w-auto">Save Profile</Button>
            <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" type="button" className="w-full sm:w-auto">
                  <AlertTriangle className="mr-2 h-4 w-4" /> Reset Progress & Start Over
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all your workout logs and reset your current maxes and cycle start date.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetProgress}
                    disabled={isResetting}
                    className={buttonVariants({variant: "destructive"})}
                  >
                    {isResetting ? "Resetting..." : "Yes, Reset My Progress"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
