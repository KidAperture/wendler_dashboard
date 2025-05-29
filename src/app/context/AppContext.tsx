
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


  useEffect(() => {
    setIsLoading(true);
    try {
      const storedProfile = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
      if (storedProfile) {
        const parsedProfile = JSON.parse(storedProfile) as UserProfile;
        setProfileState(parsedProfile);
        if (parsedProfile) {
            setCurrentCycleData(calculateWendlerCycle(parsedProfile, activeCycleNumber));
        }
      }
      const storedLogs = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
      if (storedLogs) {
        setWorkoutLogsState(JSON.parse(storedLogs) as WorkoutLogEntry[]);
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
      localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
      localStorage.removeItem(LOCAL_STORAGE_LOGS_KEY);
    } finally {
      setIsLoading(false);
    }
  }, [activeCycleNumber]); 

  const setProfile = useCallback((newProfile: UserProfile | null) => {
    setProfileState(newProfile);
    if (newProfile) {
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(newProfile));
      setCurrentCycleData(calculateWendlerCycle(newProfile, activeCycleNumber));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
      setCurrentCycleData(null);
    }
  }, [activeCycleNumber]);

  const addWorkoutLog = useCallback((logEntry: WorkoutLogEntry) => {
    setWorkoutLogsState(prevLogs => {
      const updatedLogs = [...prevLogs, logEntry];
      localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(updatedLogs));
      return updatedLogs;
    });
  }, []);
  
  const setActiveCycleNumber = useCallback((cycleNum: number) => {
    setActiveCycleNumberState(cycleNum);
    if (profile) {
        setCurrentCycleData(calculateWendlerCycle(profile, cycleNum));
    }
  },[profile]);

  const recalculateCycle = useCallback(() => {
    if (profile) {
      setCurrentCycleData(calculateWendlerCycle(profile, activeCycleNumber));
    }
  }, [profile, activeCycleNumber]);

  const updateWorkoutLogInCycle = useCallback((date: string, mainLiftId: MainLiftId, completedSetsData: WorkoutLogEntry['completedSets']) => {
    if (!profile) {
      console.error("Cannot update workout log: Profile is not available.");
      // Consider showing a toast message to the user here
      return;
    }

    // Update currentCycleData state (pure updater)
    setCurrentCycleData(prevCycle => {
      if (!prevCycle) return null; // Or handle as appropriate for your app's logic

      // Deep copy to avoid mutating the existing state directly
      const newCycle = JSON.parse(JSON.stringify(prevCycle)) as WorkoutCycle;
      let workoutUpdatedInThisCycle = false;

      for (const week of newCycle.weeks) {
        for (const day of week.days) {
          if (day.date === date && day.mainLift === mainLiftId) {
            day.isCompleted = true;
            // Map completed sets data to the sets in the cycle
            day.sets = day.sets.map((set, index) => {
              // Try to find matching completed set by structure (weight, reps, amrap)
              const completedSetData = completedSetsData.find(
                cs => cs.prescribedWeight === set.targetWeight && 
                      cs.prescribedReps === set.targetReps && 
                      cs.isAmrap === set.isAmrap
              );
              if (completedSetData) {
                return { ...set, completedReps: completedSetData.actualReps };
              }
              // Fallback: match by index if no structural match (use with caution)
              // This assumes completedSetsData is ordered exactly like day.sets
              if (completedSetsData[index]) {
                 return { ...set, completedReps: completedSetsData[index].actualReps };
              }
              return set; // Return original set if no match
            });
            workoutUpdatedInThisCycle = true;
            break; // Exit day loop
          }
        }
        if (workoutUpdatedInThisCycle) break; // Exit week loop
      }
      return newCycle;
    });

    // Add the workout log entry (this has side effects like localStorage)
    // This is now called once, after setCurrentCycleData
    const logId = `${date}-${mainLiftId}-${new Date().getTime()}`; // Generate unique ID
    const trainingMaxUsed = profile.trainingMaxes[mainLiftId];
    
    addWorkoutLog({
      logId,
      date,
      exercise: mainLiftId,
      completedSets: completedSetsData,
      trainingMaxUsed,
    });

  }, [profile, addWorkoutLog]); // setCurrentCycleData is stable, no need to list if not using its direct return

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

    let newProfileState: UserProfile;
    if (profile) {
        newProfileState = {
            ...profile, 
            oneRepMaxes: initialOneRepMaxes,
            trainingMaxes: initialTrainingMaxes,
            startDate: format(new Date(), "yyyy-MM-dd"), 
        };
    } else {
        newProfileState = {
            id: "currentUser",
            name: "",
            workoutDays: [], 
            oneRepMaxes: initialOneRepMaxes,
            trainingMaxes: initialTrainingMaxes,
            startDate: format(new Date(), "yyyy-MM-dd"), 
        };
    }
    
    setProfile(newProfileState); 

    setWorkoutLogsState([]);
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify([]));

    setActiveCycleNumberState(1); 
    
    if (newProfileState) {
      setCurrentCycleData(calculateWendlerCycle(newProfileState, 1));
    }

    setIsLoading(false);
  }, [profile, setProfile, setIsLoading, setActiveCycleNumberState, setWorkoutLogsState]);


  return (
    <AppContext.Provider value={{ profile, setProfile, workoutLogs, addWorkoutLog, updateWorkoutLogInCycle, currentCycleData, isLoading, activeCycleNumber, setActiveCycleNumber, recalculateCycle, resetProgress }}>
      {children}
    </AppContext.Provider>
  );
};

