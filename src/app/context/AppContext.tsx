
"use client";

import type React from 'react';
import { createContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile, WorkoutLogEntry, WorkoutCycle } from '@/lib/types';
import { calculateTrainingMax, calculateWendlerCycle } from '@/lib/wendler';
import { DEFAULT_TRAINING_MAX_PERCENTAGE, MAIN_LIFTS, MainLiftId } from '@/lib/constants';
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
  }, []); // Runs only on mount

  // Effect to calculate/recalculate Wendler cycle when profile or activeCycleNumber changes
  useEffect(() => {
    if (profile && profile.startDate && profile.workoutDays && profile.workoutDays.length > 0) {
      setCurrentCycleData(calculateWendlerCycle(profile, activeCycleNumber));
    } else {
      setCurrentCycleData(null); // Clear cycle data if profile is incomplete or null
    }
  }, [profile, activeCycleNumber]); // Dependencies: profile object and activeCycleNumber

  const setProfile = useCallback((newProfile: UserProfile | null) => {
    setProfileState(newProfile); // This will trigger the useEffect above to recalculate cycle
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
    // The useEffect depending on [profile, activeCycleNumber] will recalculate.
  },[]);

  // recalculateCycle can be kept if there's a need for an explicit trigger elsewhere,
  // but the useEffect should cover most cases.
  const recalculateCycle = useCallback(() => {
    if (profile && profile.startDate && profile.workoutDays && profile.workoutDays.length > 0) {
      setCurrentCycleData(calculateWendlerCycle(profile, activeCycleNumber));
    } else {
      setCurrentCycleData(null);
    }
  }, [profile, activeCycleNumber]);

  const updateWorkoutLogInCycle = useCallback((date: string, mainLiftId: MainLiftId, completedSetsData: WorkoutLogEntry['completedSets']) => {
    setCurrentCycleData(prevCycle => {
      if (!prevCycle) return null; 

      const newCycle = JSON.parse(JSON.stringify(prevCycle)) as WorkoutCycle;
      let workoutUpdatedInThisCycle = false;

      for (const week of newCycle.weeks) {
        for (const day of week.days) {
          if (day.date === date && day.mainLift === mainLiftId) {
            day.isCompleted = true;
            day.sets = day.sets.map((set, index) => {
              const completedSetData = completedSetsData.find(
                cs => cs.prescribedWeight === set.targetWeight && 
                      cs.prescribedReps === set.targetReps && 
                      cs.isAmrap === set.isAmrap
              );
              if (completedSetData) {
                return { ...set, completedReps: completedSetData.actualReps };
              }
              // Fallback: match by index if structure is guaranteed
              if (completedSetsData[index] && 
                  completedSetsData[index].prescribedWeight === set.targetWeight &&
                  completedSetsData[index].prescribedReps === set.targetReps) {
                 return { ...set, completedReps: completedSetsData[index].actualReps };
              }
              return set; 
            });
            workoutUpdatedInThisCycle = true;
            break; 
          }
        }
        if (workoutUpdatedInThisCycle) break; 
      }
      return workoutUpdatedInThisCycle ? newCycle : prevCycle;
    });

    if (profile) {
        const logId = `${date}-${mainLiftId}-${new Date().getTime()}`; 
        const trainingMaxUsed = profile.trainingMaxes[mainLiftId];
        
        addWorkoutLog({
          logId,
          date,
          exercise: mainLiftId,
          completedSets: completedSetsData,
          trainingMaxUsed,
        });
    } else {
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
        workoutDays: profile?.workoutDays || [], // Or reset to [] if preferred
        oneRepMaxes: initialOneRepMaxes,
        trainingMaxes: initialTrainingMaxes,
        startDate: format(new Date(), "yyyy-MM-dd"), 
    };
    
    setProfile(resetProfileData); // This will save to localStorage and trigger the effect for cycle recalc

    setWorkoutLogsState([]);
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify([]));

    setActiveCycleNumberState(1); // This will also trigger the effect if profile is already set
    
    setIsLoading(false);
  }, [profile, setProfile]);


  return (
    <AppContext.Provider value={{ profile, setProfile, workoutLogs, addWorkoutLog, updateWorkoutLogInCycle, currentCycleData, isLoading, activeCycleNumber, setActiveCycleNumber, recalculateCycle, resetProgress }}>
      {children}
    </AppContext.Provider>
  );
};

