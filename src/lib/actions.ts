"use server";

import { weightAdjustmentGuidance, type WeightAdjustmentGuidanceInput, type WeightAdjustmentGuidanceOutput } from '@/ai/flows/weight-adjustment-guidance';

export async function getWeightAdjustmentSuggestion(input: WeightAdjustmentGuidanceInput): Promise<WeightAdjustmentGuidanceOutput | { error: string }> {
  try {
    // The flow input expects workoutHistory as a JSON string.
    // Ensure the input.workoutHistory is already a stringified JSON.
    // If it's an object, it should be stringified before calling this action.
    if (typeof input.workoutHistory !== 'string') {
        // This check is more for robustness. The component calling this action should ensure correct format.
        console.warn("workoutHistory was not a string. Attempting to stringify.");
        input.workoutHistory = JSON.stringify(input.workoutHistory);
    }
    
    // Validate JSON format of workoutHistory before passing to the AI flow
    try {
        JSON.parse(input.workoutHistory);
    } catch (e) {
        console.error("Invalid JSON in workoutHistory:", e);
        return { error: "Workout history is not valid JSON." };
    }

    const result = await weightAdjustmentGuidance(input);
    return result;
  } catch (error) {
    console.error("Error in getWeightAdjustmentSuggestion:", error);
    if (error instanceof Error) {
        return { error: error.message };
    }
    return { error: "An unknown error occurred while fetching weight adjustment guidance." };
  }
}
