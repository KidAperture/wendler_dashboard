
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
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
import { CalendarIcon, AlertTriangle, InfoIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useAppContext } from "@/hooks/use-app-context";
import type { UserProfile, UnitSystem } from "@/lib/types";
import { MAIN_LIFTS, MainLiftId, DAYS_OF_WEEK, DayOfWeek, DEFAULT_TRAINING_MAX_PERCENTAGE } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateTrainingMax, roundToNearestPlate } from "@/lib/wendler";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from 'react';
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
import { Separator } from "./ui/separator";

const mainLiftIds = MAIN_LIFTS.map(lift => lift.id) as [MainLiftId, ...MainLiftId[]];
const unitSystems = ['metric', 'imperial'] as [UnitSystem, ...UnitSystem[]];

const profileFormSchema = z.object({
  name: z.string().optional(),
  startDate: z.date({
    required_error: "A start date is required.",
  }),
  unitSystem: z.enum(unitSystems, {
    required_error: "Please select a unit system (kg or lb)."
  }),
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
    path: ["workoutSelections"], 
  })
  .refine(selections => selections.filter(s => s.selected).every(s => s.lift !== null), {
    message: "Each selected day must have an assigned lift.",
    path: ["workoutSelections"],
  })
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const initialWorkoutSelections = DAYS_OF_WEEK.map(day => ({
  day,
  selected: false,
  lift: null as MainLiftId | null,
}));


export function UserProfileForm() {
  const { profile, setProfile, resetProgress: resetAppContextProgress } = useAppContext();
  const { toast } = useToast();
  const router = useRouter();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const initialFormValues: ProfileFormValues = useMemo(() => ({
    name: "",
    unitSystem: 'metric', // Default to metric
    oneRepMaxes: MAIN_LIFTS.reduce((acc, lift) => {
      acc[lift.id] = 0;
      return acc;
    }, {} as Record<MainLiftId, number>),
    startDate: undefined, // Initialize as undefined, will be set in useEffect
    workoutSelections: initialWorkoutSelections,
  }), []);


  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: initialFormValues,
  });
  
  useEffect(() => {
    // This effect runs when `profile` changes (e.g., loaded from localStorage or after reset)
    // or when the component mounts and `initialFormValues` are available.
    if (profile) {
        const loadedSelections = DAYS_OF_WEEK.map(dayOfWeek => {
            const assignment = profile.workoutSchedule?.find(ws => ws.day === dayOfWeek);
            return {
                day: dayOfWeek,
                selected: !!assignment,
                lift: assignment ? assignment.lift : null,
            };
        });
        form.reset({
            name: profile.name ?? "",
            unitSystem: profile.unitSystem || 'metric',
            oneRepMaxes: MAIN_LIFTS.reduce((acc, lift) => {
                acc[lift.id] = profile.oneRepMaxes?.[lift.id] ?? 0;
                return acc;
            }, {} as Record<MainLiftId, number>),
            startDate: profile.startDate ? parseISO(profile.startDate) : new Date(),
            workoutSelections: loadedSelections.length > 0 ? loadedSelections : initialWorkoutSelections,
        });
    } else {
        // No profile exists (e.g., first load and nothing in localStorage)
        // Reset to initialFormValues, but ensure startDate gets new Date()
        form.reset({
            ...initialFormValues,
            startDate: new Date(), // Ensure new profiles default to today
        });
    }
  }, [profile, form, initialFormValues]);


  const watchedOneRepMaxes = form.watch("oneRepMaxes");
  const watchedUnitSystem = form.watch("unitSystem");

  const unitSuffix = useMemo(() => (watchedUnitSystem === 'metric' ? 'kg' : 'lb'), [watchedUnitSystem]);

  const calculatedTrainingMaxes = useMemo(() => {
    return MAIN_LIFTS.reduce((acc, lift) => {
      const orm = watchedOneRepMaxes[lift.id];
      acc[lift.id] = roundToNearestPlate(calculateTrainingMax(orm));
      return acc;
    }, {} as Record<MainLiftId, number>);
  }, [watchedOneRepMaxes]);


  function onSubmit(data: ProfileFormValues) {
    if (!data.startDate) {
        toast({
            title: "Missing Start Date",
            description: "Please select a start date for your cycle.",
            variant: "destructive",
        });
        return;
    }

    const workoutSchedule = data.workoutSelections
      .filter(selection => selection.selected && selection.lift)
      .map(selection => ({
        day: selection.day,
        lift: selection.lift!, 
      }));

    const newProfile: UserProfile = {
      id: profile?.id || "currentUser",
      name: data.name ?? "",
      startDate: format(data.startDate, "yyyy-MM-dd"),
      unitSystem: data.unitSystem,
      oneRepMaxes: data.oneRepMaxes,
      trainingMaxes: calculatedTrainingMaxes, 
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
        <CardDescription>Set up your lifts, schedule, units and start date to begin the program.</CardDescription>
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
            
            <FormField
              control={form.control}
              name="unitSystem"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit System</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit system" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="metric">Metric (kg)</SelectItem>
                      <SelectItem value="imperial">Imperial (lb)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose the unit system for weights.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-6">
              <div>
                <FormLabel className="text-base font-semibold">One Rep Maxes (1RMs)</FormLabel>
                <FormDescription>
                  Enter your current estimated 1 Rep Max for each lift in {unitSuffix}. Your Training Max (TM) will be calculated from this (usually {DEFAULT_TRAINING_MAX_PERCENTAGE * 100}% of 1RM).
                </FormDescription>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {MAIN_LIFTS.map((lift) => (
                  <FormField
                    key={lift.id}
                    control={form.control}
                    name={`oneRepMaxes.${lift.id}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{lift.name} 1RM ({unitSuffix})</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder={`Enter ${lift.name} 1RM`}
                            {...field}
                            value={field.value === undefined ? '' : String(field.value)}
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.5"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
            
            <div className="space-y-3 p-4 border rounded-md bg-muted/30">
               <div className="flex items-center gap-2">
                  <InfoIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">Calculated Training Maxes (TMs)</h3>
                </div>
                <FormDescription>
                  These are your working TMs for the program, based on your 1RMs, shown in {unitSuffix}. Weights are rounded to the nearest common plate increment.
                </FormDescription>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mt-2">
                {MAIN_LIFTS.map((lift) => (
                  <div key={lift.id} className="text-sm">
                    <span className="font-medium">{lift.name} TM:</span> {calculatedTrainingMaxes[lift.id]} {unitSuffix}
                  </div>
                ))}
              </div>
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
                    Select the date you want to start your first (or current) cycle.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator />

            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base font-semibold">Workout Days & Lifts</FormLabel>
                <FormDescription>
                  Select workout days and assign a main lift to each. Ensure each main lift is assigned to at most one day if following a standard template.
                </FormDescription>
              </div>
              <div className="space-y-4">
                {DAYS_OF_WEEK.map((day, index) => (
                  <div key={day} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 border rounded-md">
                    <FormField
                      control={form.control}
                      name={`workoutSelections.${index}.selected`}
                      render={({ field: checkboxField }) => ( 
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 sm:w-1/3">
                          <FormControl>
                            <Checkbox
                              checked={checkboxField.value}
                              onCheckedChange={(checked) => {
                                checkboxField.onChange(checked);
                                if (!checked) {
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
                        render={({ field: selectField }) => ( 
                          <FormItem className="flex-1 min-w-[180px]">
                            <Select
                              onValueChange={selectField.onChange}
                              value={selectField.value ?? ""} 
                              defaultValue={selectField.value ?? undefined}
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
              <FormMessage>{form.formState.errors.workoutSelections?.message || form.formState.errors.workoutSelections?.root?.message}</FormMessage>
            </FormItem>

          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6">
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
                    This action cannot be undone. This will permanently delete all your workout logs and reset your current maxes and cycle start date to today.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetProgress}
                    disabled={isResetting}
                    className={cn(buttonVariants({variant: "destructive"}))}
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
