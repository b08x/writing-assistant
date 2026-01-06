
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { BeliefState, Clarification, GraphUpdate, ProviderConfig, ProviderType } from '../types';
import * as gemini from './geminiService';
import { mistralRequest } from './mistralService';
import { openRouterRequest } from './openRouterService';
import { grokRequest } from './grokService';

export type StatusUpdateCallback = (message: string) => void;

/**
 * Robust JSON extraction for models that don't support structured output natively.
 */
function extractJson(text: string): any {
  try {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON from model output:", text);
    throw new Error("Invalid AI response format");
  }
}

export const generateBeliefGraph = async (
  prompt: string,
  mode: 'image' | 'story' | 'video',
  config: ProviderConfig,
  onStatusUpdate?: StatusUpdateCallback
): Promise<BeliefState> => {
  if (config.provider === 'gemini') {
    return gemini.parsePromptToBeliefGraph(prompt, mode, onStatusUpdate, config.model);
  }

  const systemInstruction = `You are a Belief Graph generator. Output ONLY raw JSON. No conversational text.`;
  const userPrompt = `Analyze this prompt for a ${mode}: "${prompt}". Return a Belief Graph in JSON format with entities (name, description, attributes) and relationships.`;

  let responseText = "";
  if (config.provider === 'mistral') responseText = await mistralRequest(userPrompt, config.model, systemInstruction);
  else if (config.provider === 'openrouter') responseText = await openRouterRequest(userPrompt, config.model, systemInstruction);
  else if (config.provider === 'grok') responseText = await grokRequest(userPrompt, config.model, systemInstruction);
  else if (config.provider === 'llama') responseText = await openRouterRequest(userPrompt, config.model, systemInstruction); // Llama usually via OpenRouter

  const raw = extractJson(responseText);
  
  const rawEntities = Array.isArray(raw.entities) ? raw.entities : [];
  const rawRelationships = Array.isArray(raw.relationships) ? raw.relationships : [];

  // Transform to the app's internal format
  return {
    entities: rawEntities.map((e: any) => ({
      ...e,
      alternatives: Array.isArray(e.alternatives) 
        ? e.alternatives.map((s: any) => typeof s === 'string' ? { name: s } : s) 
        : [],
      attributes: (Array.isArray(e.attributes) ? e.attributes : []).map((a: any) => ({
        ...a,
        value: Array.isArray(a.value) 
          ? a.value.map((v: any) => typeof v === 'string' ? { name: v } : v) 
          : []
      }))
    })),
    relationships: rawRelationships.map((r: any) => ({
      ...r,
      alternatives: Array.isArray(r.alternatives) 
        ? r.alternatives.map((s: any) => typeof s === 'string' ? { name: s } : s) 
        : []
    })),
    prompt
  };
};

export const generateClarifications = async (
  prompt: string,
  askedQuestions: string[],
  mode: 'image' | 'story' | 'video',
  config: ProviderConfig,
  onStatusUpdate?: StatusUpdateCallback
): Promise<Clarification[]> => {
  if (config.provider === 'gemini') {
    return gemini.generateClarifications(prompt, askedQuestions, mode, onStatusUpdate, config.model);
  }

  const userPrompt = `Generate 3 clarifying questions with options to help refine this ${mode} prompt: "${prompt}". Already asked: ${askedQuestions.join(', ')}. Return JSON array of objects with 'question' and 'options'.`;
  
  let responseText = "";
  if (config.provider === 'mistral') responseText = await mistralRequest(userPrompt, config.model);
  else if (config.provider === 'openrouter') responseText = await openRouterRequest(userPrompt, config.model);
  else if (config.provider === 'grok') responseText = await grokRequest(userPrompt, config.model);
  else if (config.provider === 'llama') responseText = await openRouterRequest(userPrompt, config.model);

  return extractJson(responseText);
};

export const refinePrompt = async (
  originalPrompt: string,
  clarifications: { question: string; answer: string }[],
  graphUpdates: GraphUpdate[],
  config: ProviderConfig,
  onStatusUpdate?: StatusUpdateCallback
): Promise<string> => {
  if (config.provider === 'gemini') {
    return gemini.refinePromptWithAllUpdates(originalPrompt, clarifications, graphUpdates, onStatusUpdate, config.model);
  }

  const userPrompt = `Original: ${originalPrompt}. Edits: ${JSON.stringify(graphUpdates)}. Answers: ${JSON.stringify(clarifications)}. Output only the new refined prompt text.`;
  
  if (config.provider === 'mistral') return await mistralRequest(userPrompt, config.model);
  if (config.provider === 'openrouter') return await openRouterRequest(userPrompt, config.model);
  if (config.provider === 'grok') return await grokRequest(userPrompt, config.model);
  return await openRouterRequest(userPrompt, config.model);
};
