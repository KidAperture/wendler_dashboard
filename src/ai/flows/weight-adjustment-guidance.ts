// Use server directive is required for Genkit flows.
'use server';

/**
 * @fileOverview Analyzes workout history and suggests personalized weight adjustments.
 *
 * - weightAdjustmentGuidance - A function that recommends weight adjustments based on workout history.
 * - WeightAdjustmentGuidanceInput - The input type for the weightAdjustmentGuidance function.
 * - WeightAdjustmentGuidanceOutput - The return type for the weightAdjustmentGuidance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const WeightAdjustmentGuidanceInputSchema = z.object({
  workoutHistory: z
    .string()
    .describe(
      'A JSON string containing the user workout history, with each entry including the date, prescribed weight, actual reps completed, and target reps.'
    ),
  currentMax: z.number().describe('The user current training max.'),
  exercise: z.string().describe('The name of the exercise.'),
});
export type WeightAdjustmentGuidanceInput = z.infer<typeof WeightAdjustmentGuidanceInputSchema>;

const WeightAdjustmentGuidanceOutputSchema = z.object({
  adjustmentRecommendation: z
    .string()
    .describe(
      'A recommendation for how much weight to add or subtract for the next cycle, along with reasoning.'
    ),
});
export type WeightAdjustmentGuidanceOutput = z.infer<typeof WeightAdjustmentGuidanceOutputSchema>;

export async function weightAdjustmentGuidance(
  input: WeightAdjustmentGuidanceInput
): Promise<WeightAdjustmentGuidanceOutput> {
  return weightAdjustmentGuidanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'weightAdjustmentGuidancePrompt',
  input: {schema: WeightAdjustmentGuidanceInputSchema},
  output: {schema: WeightAdjustmentGuidanceOutputSchema},
  prompt: `You are an expert in the Wendler 5/3/1 training program.

You will analyze the user's workout history and provide a recommendation for weight adjustments in the next cycle.

Consider the following:

- If the user consistently failed to hit the target reps, recommend reducing the weight.
- If the user consistently exceeded the target reps, recommend increasing the weight.
- If the user was able to hit the target reps, recommend a standard weight increase.
- If there is not enough workout history, recommend continuing with the same weight.

Workout History: {{{workoutHistory}}}

Current Max: {{{currentMax}}}

Exercise: {{{exercise}}}

Based on this information, what adjustment to the training max do you recommend? Explain your reasoning.

{{#json adjustmentRecommendation}}{{/json}}`,
});

const weightAdjustmentGuidanceFlow = ai.defineFlow(
  {
    name: 'weightAdjustmentGuidanceFlow',
    inputSchema: WeightAdjustmentGuidanceInputSchema,
    outputSchema: WeightAdjustmentGuidanceOutputSchema,
  },
  async input => {
    try {
      // Parse workoutHistory to ensure it's valid JSON
      JSON.parse(input.workoutHistory);
    } catch (e) {
      throw new Error('Invalid workout history JSON provided.');
    }

    const {output} = await prompt(input);
    return output!;
  }
);
