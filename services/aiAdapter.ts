
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { BeliefState, Clarification, GraphUpdate, ProviderConfig } from '../types';
import * as gemini from './geminiService';
import { mistralRequest } from './mistralService';
import { openRouterRequest } from './openRouterService';
import { grokRequest } from './grokService';

export type StatusUpdateCallback = (message: string) => void;

/**
 * Robust JSON extraction for models that don't support structured output natively.
 * This is the 'Core Adaptation' logic that makes varied LLM outputs compatible.
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

/**
 * Normalizes raw entity/relationship data from third-party LLMs 
 * into our application's internal BeliefState format.
 */
function adaptToBeliefState(raw: any, prompt: string): BeliefState {
  return {
    entities: (raw.entities || []).map((e: any) => ({
      ...e,
      alternatives: e.alternatives ? e.alternatives.map((s: string) => ({ name: s })) : [],
      attributes: (e.attributes || []).map((a: any) => ({
        ...a,
        value: Array.isArray(a.value) ? a.value.map((v: any) => typeof v === 'string' ? { name: v } : v) : []
      }))
    })),
    relationships: (raw.relationships || []).map((r: any) => ({
      ...r,
      alternatives: r.alternatives ? r.alternatives.map((s: string) => ({ name: s })) : []
    })),
    prompt
  };
}

export const generateBeliefGraph = async (
  prompt: string,
  mode: 'image' | 'story' | 'video',
  config: ProviderConfig,
  onStatusUpdate?: StatusUpdateCallback
): Promise<BeliefState> => {
  // Gemini uses native adaptation via responseSchema
  if (config.provider === 'gemini') {
    return gemini.parsePromptToBeliefGraph(prompt, mode, onStatusUpdate, config.model);
  }

  // Other providers need manual adaptation
  const systemInstruction = `You are a Belief Graph generator. Output ONLY raw JSON. No conversational text. Format: { "entities": [...], "relationships": [...] }`;
  const userPrompt = `Analyze this prompt for a ${mode}: "${prompt}". Return a Belief Graph in JSON format with entities (name, description, attributes) and relationships.`;
  const userKey = config.apiKeys[config.provider];

  let responseText = "";
  if (config.provider === 'mistral') responseText = await mistralRequest(userPrompt, config.model, systemInstruction, userKey);
  else if (config.provider === 'openrouter') responseText = await openRouterRequest(userPrompt, config.model, systemInstruction, userKey);
  else if (config.provider === 'grok') responseText = await grokRequest(userPrompt, config.model, systemInstruction, userKey);
  else if (config.provider === 'llama') responseText = await openRouterRequest(userPrompt, config.model, systemInstruction, userKey);

  return adaptToBeliefState(extractJson(responseText), prompt);
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
  const userKey = config.apiKeys[config.provider];
  
  let responseText = "";
  if (config.provider === 'mistral') responseText = await mistralRequest(userPrompt, config.model, undefined, userKey);
  else if (config.provider === 'openrouter') responseText = await openRouterRequest(userPrompt, config.model, undefined, userKey);
  else if (config.provider === 'grok') responseText = await grokRequest(userPrompt, config.model, undefined, userKey);
  else if (config.provider === 'llama') responseText = await openRouterRequest(userPrompt, config.model, undefined, userKey);

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

  const userPrompt = `Original: ${originalPrompt}. Edits: ${JSON.stringify(graphUpdates)}. Answers: ${JSON.stringify(clarifications)}. Output only the new refined prompt text. No conversational filler.`;
  const userKey = config.apiKeys[config.provider];
  
  if (config.provider === 'mistral') return await mistralRequest(userPrompt, config.model, undefined, userKey);
  if (config.provider === 'openrouter') return await openRouterRequest(userPrompt, config.model, undefined, userKey);
  if (config.provider === 'grok') return await grokRequest(userPrompt, config.model, undefined, userKey);
  return await openRouterRequest(userPrompt, config.model, undefined, userKey);
};
