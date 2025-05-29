"use client";

import type React from 'react';
import { createContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile, WorkoutLogEntry, WorkoutCycle } from '@/lib/types';
import { calculateTrainingMax, calculateWendlerCycle } from '@/lib/wendler';
import { DEFAULT_TRAINING_MAX_PERCENTAGE, MAIN_LIFTS } from '@/lib/constants';

const LOCAL_STORAGE_PROFILE_KEY = 'wendlerWizardProfile';
const LOCAL_STORAGE_LOGS_KEY = 'wendlerWizardLogs';

export interface AppContextType {
  profile: UserProfile | null;
  setProfile: (profile: UserProfile | null) => void;
  workoutLogs: WorkoutLogEntry[];
  addWorkoutLog: (logEntry: WorkoutLogEntry) => void;
  updateWorkoutLogInCycle: (date: string, mainLiftId: import('@/lib/constants').MainLiftId, completedSets: WorkoutLogEntry['completedSets']) => void;
  currentCycleData: WorkoutCycle | null;
  isLoading: boolean;
  activeCycleNumber: number;
  setActiveCycleNumber: (cycleNum: number) => void;
  recalculateCycle: () => void;
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
      // Clear corrupted data
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

  const updateWorkoutLogInCycle = useCallback((date: string, mainLiftId: import('@/lib/constants').MainLiftId, completedSetsData: WorkoutLogEntry['completedSets']) => {
    setCurrentCycleData(prevCycle => {
      if (!prevCycle || !profile) return prevCycle;

      const newCycle = JSON.parse(JSON.stringify(prevCycle)) as WorkoutCycle; // Deep clone
      let workoutUpdated = false;

      for (const week of newCycle.weeks) {
        for (const day of week.days) {
          if (day.date === date && day.mainLift === mainLiftId) {
            day.isCompleted = true;
            day.sets = day.sets.map((s, index) => {
              const completedSet = completedSetsData.find(cs => cs.prescribedReps === s.targetReps && cs.prescribedWeight === s.targetWeight && cs.isAmrap === s.isAmrap); // Simplistic match
              if (completedSet) {
                return { ...s, completedReps: completedSet.actualReps };
              }
              // For non-AMRAP or if not specifically logged, find based on index if needed
              if (completedSetsData[index]) {
                 return { ...s, completedReps: completedSetsData[index].actualReps };
              }
              return s;
            });
            workoutUpdated = true;
            break;
          }
        }
        if (workoutUpdated) break;
      }
      
      // Also add to workoutLogs
      const logId = `${date}-${mainLiftId}-${new Date().getTime()}`;
      const trainingMaxUsed = profile.trainingMaxes[mainLiftId];
      addWorkoutLog({
        logId,
        date,
        exercise: mainLiftId,
        completedSets: completedSetsData,
        trainingMaxUsed,
      });

      return newCycle;
    });
  }, [profile, addWorkoutLog]);


  return (
    <AppContext.Provider value={{ profile, setProfile, workoutLogs, addWorkoutLog, updateWorkoutLogInCycle, currentCycleData, isLoading, activeCycleNumber, setActiveCycleNumber, recalculateCycle }}>
      {children}
    </AppContext.Provider>
  );
};
