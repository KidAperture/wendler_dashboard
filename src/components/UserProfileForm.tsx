
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, AlertTriangle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useAppContext } from "@/hooks/use-app-context";
import type { UserProfile } from "@/lib/types";
import { MAIN_LIFTS, MainLiftId, DAYS_OF_WEEK, DayOfWeek } from "@/lib/constants";
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

const mainLiftIds = MAIN_LIFTS.map(lift => lift.id) as [MainLiftId, ...MainLiftId[]];

const profileFormSchema = z.object({
  name: z.string().optional(),
  startDate: z.date({
    required_error: "A start date is required.",
  }).optional(),
  oneRepMaxes: z.object(
    MAIN_LIFTS.reduce((acc, lift) => {
      acc[lift.id] = z.coerce.number().min(0, `${lift.name} max can be 0 if unknown, but not negative.`);
      return acc;
    }, {} as Record<MainLiftId, z.ZodNumber>)
  ),
  workoutSelections: z.array(z.object({
    day: z.custom<DayOfWeek>((val) => DAYS_OF_WEEK.includes(val as DayOfWeek)),
    selected: z.boolean(),
    lift: z.enum(mainLiftIds).nullable(),
  }))
  .refine(selections => selections.some(s => s.selected), {
    message: "You must select at least one workout day.",
    path: ["workoutSelections"], // General path for the array
  })
  .refine(selections => selections.filter(s => s.selected).every(s => s.lift !== null), {
    message: "Each selected day must have an assigned lift.",
    path: ["workoutSelections"],
  })
  // Optional: Add validation for unique lifts if needed
  // .refine(selections => {
  //   const selectedLifts = selections.filter(s => s.selected && s.lift).map(s => s.lift);
  //   return new Set(selectedLifts).size === selectedLifts.length;
  // }, {
  //   message: "Each main lift should only be assigned to one day.",
  //   path: ["workoutSelections"],
  // })
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const initialWorkoutSelections = DAYS_OF_WEEK.map(day => ({
  day,
  selected: false,
  lift: null as MainLiftId | null,
}));

const initialFormValues: ProfileFormValues = {
  name: "",
  oneRepMaxes: MAIN_LIFTS.reduce((acc, lift) => {
    acc[lift.id] = 0;
    return acc;
  }, {} as Record<MainLiftId, number>),
  startDate: undefined,
  workoutSelections: initialWorkoutSelections,
};

export function UserProfileForm() {
  const { profile, setProfile, resetProgress: resetAppContextProgress } = useAppContext();
  const { toast } = useToast();
  const router = useRouter();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [initialStartDate, setInitialStartDate] = useState<Date | undefined>(new Date());


  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: initialFormValues,
  });

  useEffect(() => {
    if (profile) {
      const loadedSelections = DAYS_OF_WEEK.map(dayOfWeek => {
        const assignment = profile.workoutSchedule?.find(ws => ws.day === dayOfWeek);
        return {
          day: dayOfWeek,
          selected: !!assignment,
          lift: assignment ? assignment.lift : null,
        };
      });

      const loadedValues = {
        name: profile.name ?? "",
        oneRepMaxes: MAIN_LIFTS.reduce((acc, lift) => {
          acc[lift.id] = profile.oneRepMaxes?.[lift.id] ?? 0;
          return acc;
        }, {} as Record<MainLiftId, number>),
        startDate: profile.startDate ? parseISO(profile.startDate) : new Date(),
        workoutSelections: loadedSelections.length > 0 ? loadedSelections : initialWorkoutSelections,
      };
      form.reset(loadedValues);
      setInitialStartDate(loadedValues.startDate);
    } else {
      form.reset({...initialFormValues, startDate: new Date() }); // Ensure startDate is set for new profile
      setInitialStartDate(new Date());
    }
  }, [profile, form]);

   useEffect(() => {
    // This effect ensures that if `startDate` is initially undefined in the form (e.g. after a reset or on first load with no profile),
    // it gets populated with `initialStartDate` (which defaults to `new Date()` or loaded profile's start date).
    if (!form.getValues('startDate') && initialStartDate) {
      form.setValue('startDate', initialStartDate, { shouldValidate: true });
    }
  }, [form, initialStartDate]);


  function onSubmit(data: ProfileFormValues) {
    if (!data.startDate) {
        toast({
            title: "Missing Start Date",
            description: "Please select a start date for your cycle.",
            variant: "destructive",
        });
        return;
    }

    const trainingMaxes = MAIN_LIFTS.reduce((acc, lift) => {
        acc[lift.id] = calculateTrainingMax(data.oneRepMaxes[lift.id]);
        return acc;
    }, {} as Record<MainLiftId, number>);

    const workoutSchedule = data.workoutSelections
      .filter(selection => selection.selected && selection.lift)
      .map(selection => ({
        day: selection.day,
        lift: selection.lift!, // Lift is guaranteed by schema refinement
      }));

    const newProfile: UserProfile = {
      id: profile?.id || "currentUser",
      name: data.name ?? "",
      startDate: format(data.startDate, "yyyy-MM-dd"),
      oneRepMaxes: data.oneRepMaxes,
      trainingMaxes: trainingMaxes,
      workoutSchedule: workoutSchedule,
    };
    setProfile(newProfile);

    toast({
      title: "Profile Saved",
      description: "Your Wendler 5/3/1 profile has been updated.",
    });
    router.push("/dashboard");
  }

  const handleResetProgress = async () => {
    setIsResetting(true);
    try {
      await resetAppContextProgress();
      // Form will be reset by useEffect watching `profile`
      setInitialStartDate(new Date()); // Ensure calendar defaults to today after reset
      toast({
        title: "Progress Reset",
        description: "Your workout history and maxes have been cleared. You can now start over.",
      });
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
  
  const watchedSelections = form.watch("workoutSelections");

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
                          value={field.value === undefined ? '' : field.value}
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
                        disabled={(date) => date < new Date("1900-01-01")}
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

            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Workout Days & Lifts</FormLabel>
                <FormDescription>
                  Select workout days and assign a main lift to each.
                </FormDescription>
              </div>
              <div className="space-y-4">
                {DAYS_OF_WEEK.map((day, index) => (
                  <div key={day} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 border rounded-md">
                    <FormField
                      control={form.control}
                      name={`workoutSelections.${index}.selected`}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 sm:w-1/3">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                if (!checked) {
                                  // If unselected, clear the lift for that day
                                  form.setValue(`workoutSelections.${index}.lift`, null);
                                }
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal text-base">
                            {day}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    {watchedSelections && watchedSelections[index]?.selected && (
                      <FormField
                        control={form.control}
                        name={`workoutSelections.${index}.lift`}
                        render={({ field }) => (
                          <FormItem className="flex-1 min-w-[180px]">
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value ?? undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Assign a lift" />
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
                    )}
                  </div>
                ))}
              </div>
              {/* Display general error for workoutSelections array if any */}
              <FormMessage>{form.formState.errors.workoutSelections?.message || form.formState.errors.workoutSelections?.root?.message}</FormMessage>
            </FormItem>

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
