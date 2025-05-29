"use client";

import { useContext } from 'react';
import { AppContext, type AppContextType } from '@/app/context/AppContext';

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
