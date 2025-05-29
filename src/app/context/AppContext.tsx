
"use client";

import type React from 'react';
import { createContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile, WorkoutLogEntry, WorkoutCycle, UnitSystem } from '@/lib/types';
import { calculateWendlerCycle } from '@/lib/wendler';
import { MAIN_LIFTS, MainLiftId } from '@/lib/constants';
import { format } from 'date-fns';

const LOCAL_STORAGE_PROFILE_KEY = 'wendlerWizardProfile';
const LOCAL_STORAGE_LOGS_KEY = 'wendlerWizardLogs';

export interface AppContextType {
  profile: UserProfile | null;
  setProfile: (profile: UserProfile | null) => void;
  workoutLogs: WorkoutLogEntry[];
  addWorkoutLog: (logEntry: WorkoutLogEntry) => void;
  updateWorkoutLogInCycle: (date: string, mainLiftId: MainLiftId, completedSets: WorkoutLogEntry['completedSets']) => void;
  currentCycleData: WorkoutCycle | null;
  isLoading: boolean;
  activeCycleNumber: number;
  setActiveCycleNumber: (cycleNum: number) => void;
  recalculateCycle: () => void;
  resetProgress: () => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [workoutLogs, setWorkoutLogsState] = useState<WorkoutLogEntry[]>([]);
  const [currentCycleData, setCurrentCycleData] = useState<WorkoutCycle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCycleNumber, setActiveCycleNumberState] = useState(1);

  // Effect for initial data loading from localStorage
  useEffect(() => {
    setIsLoading(true);
    try {
      const storedProfile = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
      if (storedProfile) {
        const parsedProfile = JSON.parse(storedProfile) as UserProfile;
        // Ensure workoutSchedule exists, default to empty array if not (for backward compatibility)
        if (!parsedProfile.workoutSchedule) {
            parsedProfile.workoutSchedule = [];
        }
        // Ensure unitSystem exists, default to metric if not
        if (!parsedProfile.unitSystem) {
            parsedProfile.unitSystem = 'metric';
        }
        setProfileState(parsedProfile);
      }
      const storedLogs = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
      if (storedLogs) {
        setWorkoutLogsState(JSON.parse(storedLogs) as WorkoutLogEntry[]);
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
      localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
      localStorage.removeItem(LOCAL_STORAGE_LOGS_KEY);
      setProfileState(null);
      setWorkoutLogsState([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Centralized effect to calculate/recalculate Wendler cycle
  useEffect(() => {
    if (profile && profile.startDate && profile.workoutSchedule && profile.workoutSchedule.length > 0) {
      setCurrentCycleData(calculateWendlerCycle(profile, activeCycleNumber));
    } else {
      setCurrentCycleData(null); // Clear cycle data if profile is incomplete or null
    }
  }, [profile, activeCycleNumber]);

  const setProfile = useCallback((newProfile: UserProfile | null) => {
    setProfileState(newProfile);
    if (newProfile) {
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(newProfile));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
    }
  }, []);

  const addWorkoutLog = useCallback((logEntry: WorkoutLogEntry) => {
    setWorkoutLogsState(prevLogs => {
      const updatedLogs = [...prevLogs, logEntry];
      localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(updatedLogs));
      return updatedLogs;
    });
  }, []);

  const setActiveCycleNumber = useCallback((cycleNum: number) => {
    setActiveCycleNumberState(cycleNum);
  }, []);

  const recalculateCycle = useCallback(() => {
    if (profile && profile.startDate && profile.workoutSchedule && profile.workoutSchedule.length > 0) {
      setCurrentCycleData(calculateWendlerCycle(profile, activeCycleNumber));
    } else {
      setCurrentCycleData(null);
    }
  }, [profile, activeCycleNumber]);

  const updateWorkoutLogInCycle = useCallback((date: string, mainLiftId: MainLiftId, completedSetsData: WorkoutLogEntry['completedSets']) => {
    let workoutFoundAndUpdated = false;
    // Step 1: Update the currentCycleData state (purely)
    setCurrentCycleData(prevCycle => {
      if (!prevCycle) return null;

      const newCycle = JSON.parse(JSON.stringify(prevCycle)) as WorkoutCycle; // Deep copy
      
      for (const week of newCycle.weeks) {
        for (const day of week.days) {
          if (day.date === date && day.mainLift === mainLiftId) {
            day.isCompleted = true;
            day.sets = day.sets.map((set) => {
              const completedSetInfo = completedSetsData.find(
                cs => cs.prescribedWeight === set.targetWeight &&
                      cs.prescribedReps === set.targetReps &&
                      cs.isAmrap === set.isAmrap
              );
              return completedSetInfo ? { ...set, completedReps: completedSetInfo.actualReps } : set;
            });
            workoutFoundAndUpdated = true; // Mark that we found and updated the workout
            break;
          }
        }
        if (workoutFoundAndUpdated) break;
      }
      return workoutFoundAndUpdated ? newCycle : prevCycle;
    });

    // Step 2: Log the workout (side effect), only if the workout was part of the current cycle data.
    if (profile && workoutFoundAndUpdated) { // Check workoutFoundAndUpdated
        const logId = `${date}-${mainLiftId}-${new Date().getTime()}`;
        const trainingMaxUsed = profile.trainingMaxes[mainLiftId];

        addWorkoutLog({
          logId,
          date,
          exercise: mainLiftId,
          completedSets: completedSetsData,
          trainingMaxUsed,
        });
    } else if (profile && !workoutFoundAndUpdated) {
        // This case could happen if logging a workout not in the currently displayed cycle (e.g., past/future)
        // For now, we'll still log it if the profile exists.
        // A more sophisticated system might handle this differently.
        const logId = `${date}-${mainLiftId}-${new Date().getTime()}`;
        const trainingMaxUsed = profile.trainingMaxes[mainLiftId];
         addWorkoutLog({
          logId,
          date,
          exercise: mainLiftId,
          completedSets: completedSetsData,
          trainingMaxUsed,
        });
        console.warn("Workout logged but not found in current cycle data display. This might be okay for off-cycle logging.");
    } else if (!profile) {
        console.error("Cannot log workout: Profile not available.");
    }
  }, [profile, addWorkoutLog]);

  const resetProgress = useCallback(() => {
    setIsLoading(true);

    const initialOneRepMaxes = MAIN_LIFTS.reduce((acc, lift) => {
      acc[lift.id] = 0;
      return acc;
    }, {} as Record<MainLiftId, number>);

    const initialTrainingMaxes = MAIN_LIFTS.reduce((acc, lift) => {
      acc[lift.id] = 0;
      return acc;
    }, {} as Record<MainLiftId, number>);

    const resetProfileData: UserProfile = {
        id: profile?.id || "currentUser",
        name: profile?.name ?? "",
        unitSystem: 'metric', // Default to metric on reset
        workoutSchedule: [], // Reset schedule
        oneRepMaxes: initialOneRepMaxes,
        trainingMaxes: initialTrainingMaxes,
        startDate: format(new Date(), "yyyy-MM-dd"),
    };

    setProfile(resetProfileData); 

    setWorkoutLogsState([]);
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify([]));

    setActiveCycleNumberState(1); 
    setIsLoading(false);
  }, [profile, setProfile]);


  return (
    <AppContext.Provider value={{ profile, setProfile, workoutLogs, addWorkoutLog, updateWorkoutLogInCycle, currentCycleData, isLoading, activeCycleNumber, setActiveCycleNumber, recalculateCycle, resetProgress }}>
      {children}
    </AppContext.Provider>
  );
};
