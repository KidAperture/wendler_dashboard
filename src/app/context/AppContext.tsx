
"use client";

import type React from 'react';
import { createContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile, WorkoutLogEntry, WorkoutCycle, UnitSystem, WeightDisplayPreference } from '@/lib/types';
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
  recalculateCycle: () => void; // This might be redundant now with the useEffect for profile
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
        if (!parsedProfile.workoutSchedule) {
            parsedProfile.workoutSchedule = [];
        }
        if (!parsedProfile.unitSystem) {
            parsedProfile.unitSystem = 'metric';
        }
        if (!parsedProfile.weightDisplayPreference) {
            parsedProfile.weightDisplayPreference = 'total'; // Default for older profiles
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
      // Set to a default initial state rather than null to avoid issues with form defaults
      const initialOneRepMaxes = MAIN_LIFTS.reduce((acc, lift) => {
          acc[lift.id] = 0;
          return acc;
        }, {} as Record<MainLiftId, number>);
      const initialTrainingMaxes = MAIN_LIFTS.reduce((acc, lift) => {
        acc[lift.id] = 0;
        return acc;
      }, {} as Record<MainLiftId, number>);
      setProfileState({
        id: "currentUser",
        name: "",
        startDate: format(new Date(), "yyyy-MM-dd"),
        unitSystem: 'metric',
        weightDisplayPreference: 'total',
        workoutSchedule: [],
        oneRepMaxes: initialOneRepMaxes,
        trainingMaxes: initialTrainingMaxes,
      });
      setWorkoutLogsState([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Centralized effect to calculate/recalculate Wendler cycle whenever profile or activeCycleNumber changes
  useEffect(() => {
    if (profile && profile.startDate && profile.workoutSchedule && profile.workoutSchedule.length > 0) {
      setCurrentCycleData(calculateWendlerCycle(profile, activeCycleNumber));
    } else {
      setCurrentCycleData(null); // Clear cycle data if profile is incomplete or null
    }
  }, [profile, activeCycleNumber]);

  const setProfile = useCallback((newProfile: UserProfile | null) => {
    setProfileState(newProfile); // This will trigger the useEffect above to recalculate the cycle
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
    setActiveCycleNumberState(cycleNum); // This will trigger the useEffect above to recalculate cycle for new active number
  }, []);
  
  const recalculateCycle = useCallback(() => {
    // This function is now effectively handled by the useEffect that listens to profile and activeCycleNumber.
    // It can be kept for explicit calls if needed elsewhere, but its primary role is covered.
    if (profile && profile.startDate && profile.workoutSchedule && profile.workoutSchedule.length > 0) {
      setCurrentCycleData(calculateWendlerCycle(profile, activeCycleNumber));
    } else {
      setCurrentCycleData(null);
    }
  }, [profile, activeCycleNumber]);


  const updateWorkoutLogInCycle = useCallback((date: string, mainLiftId: MainLiftId, completedSetsData: WorkoutLogEntry['completedSets']) => {
    let workoutFoundAndUpdated = false;
    
    setCurrentCycleData(prevCycle => {
      if (!prevCycle) return null;
      const newCycle = JSON.parse(JSON.stringify(prevCycle)) as WorkoutCycle;
      
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
            workoutFoundAndUpdated = true;
            break;
          }
        }
        if (workoutFoundAndUpdated) break;
      }
      return workoutFoundAndUpdated ? newCycle : prevCycle;
    });

    if (profile && workoutFoundAndUpdated) {
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
        unitSystem: 'metric', 
        weightDisplayPreference: 'total', // Default on reset
        workoutSchedule: [], 
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
