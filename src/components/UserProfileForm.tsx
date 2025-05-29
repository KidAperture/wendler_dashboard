
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
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useAppContext } from "@/hooks/use-app-context";
import type { UserProfile } from "@/lib/types";
import { MAIN_LIFTS, DAYS_OF_WEEK, DEFAULT_TRAINING_MAX_PERCENTAGE, DayOfWeek } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateTrainingMax } from "@/lib/wendler";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect } from 'react';


const profileFormSchema = z.object({
  name: z.string().optional(),
  startDate: z.date({
    required_error: "A start date is required.",
  }),
  oneRepMaxes: z.object(
    MAIN_LIFTS.reduce((acc, lift) => {
      acc[lift.id] = z.coerce.number().min(1, `${lift.name} max must be greater than 0.`);
      return acc;
    }, {} as Record<typeof MAIN_LIFTS[number]["id"], z.ZodNumber>)
  ),
  workoutDays: z.array(z.string()).refine((value) => value.some((day) => day), {
    message: "You have to select at least one workout day.",
  }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const defaultValues: Partial<ProfileFormValues> = {
  name: "", // Ensure name is initialized to empty string for controlled input
  oneRepMaxes: MAIN_LIFTS.reduce((acc, lift) => {
    acc[lift.id] = 0;
    return acc;
  }, {} as Record<typeof MAIN_LIFTS[number]["id"], number>),
  workoutDays: [],
  startDate: undefined, 
};

export function UserProfileForm() {
  const { profile, setProfile, recalculateCycle } = useAppContext();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: profile ? {
      ...profile,
      name: profile.name ?? "", // Ensure name is empty string if null/undefined from profile
      oneRepMaxes: MAIN_LIFTS.reduce((acc, lift) => {
        acc[lift.id] = profile.oneRepMaxes?.[lift.id] ?? 0; // Default to 0 if specific lift max is missing
        return acc;
      }, {} as Record<MainLiftId, number>),
      startDate: profile.startDate ? parseISO(profile.startDate) : undefined, 
    } : defaultValues,
  });

  const { setValue, getValues } = form;

  useEffect(() => {
    if (!getValues('startDate') && !profile?.startDate) { // Only set if no date is present at all
      setValue('startDate', new Date(), { shouldValidate: true, shouldDirty: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.startDate, getValues, setValue]); // Depend on profile.startDate to re-evaluate if profile loads later

  function onSubmit(data: ProfileFormValues) {
    const trainingMaxes = MAIN_LIFTS.reduce((acc, lift) => {
        acc[lift.id] = calculateTrainingMax(data.oneRepMaxes[lift.id]);
        return acc;
    }, {} as Record<typeof MAIN_LIFTS[number]["id"], number>);

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
                        disabled={(date) =>
                          date < new Date(new Date().setDate(new Date().getDate() - 1)) 
                        }
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
          <CardFooter>
            <Button type="submit" className="w-full md:w-auto">Save Profile</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
