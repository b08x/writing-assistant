
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
 */
function adaptToBeliefState(raw: any, prompt: string): BeliefState {
  const rawEntities = Array.isArray(raw.entities) ? raw.entities : [];
  const rawRelationships = Array.isArray(raw.relationships) ? raw.relationships : [];

  return {
    entities: rawEntities.map((e: any) => ({
      ...e,
      alternatives: Array.isArray(e.alternatives) 
        ? e.alternatives.map((s: any) => typeof s === 'string' ? { name: s } : s) 
        : [],
      attributes: (Array.isArray(e.attributes) ? e.attributes : []).map((a: any) => ({
        ...a,
        presence_in_prompt: a.presence_in_prompt ?? false,
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
}

/**
 * Standard OpenAI-compatible requester for multiple providers
 */
const standardRequest = async (url: string, key: string, model: string, prompt: string, system?: string) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt }
      ]
    })
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API error: ${response.statusText}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
};

export const generateBeliefGraph = async (
  prompt: string,
  mode: 'image' | 'story' | 'video',
  config: ProviderConfig,
  onStatusUpdate?: StatusUpdateCallback
): Promise<BeliefState> => {
  if (config.provider === 'gemini') {
    return gemini.parsePromptToBeliefGraph(prompt, mode, onStatusUpdate, config.model);
  }

  let specificInstructions = "";
  if (mode === 'image') {
    specificInstructions = `- Always include an entity named "The Image". Attributes: weather, location, time_of_day, atmosphere, camera_angle, style.`;
  } else if (mode === 'video') {
    specificInstructions = `- Always include an entity named "The Video". Attributes: camera_movement, lighting, atmosphere, video_style, pacing.`;
  } else {
    specificInstructions = `- Always include an entity named "The Story". Attributes: genre, tone, narrative_perspective, pacing, conflict_type.`;
  }

  const systemInstruction = `You are a SOTA Belief Graph generator. 
Task: Parse a creative prompt into a structured JSON graph.
Rules:
1. Identify all physical and conceptual entities.
2. ${specificInstructions}
3. For every attribute, provide 2-3 candidate values in an array.
4. Set "presence_in_prompt" to true ONLY if the user explicitly mentioned that attribute.
5. Identify logical relationships (A [label] B).
6. Output ONLY raw JSON. No markdown backticks.`;

  const userPrompt = `Input Prompt: "${prompt}"
Mode: ${mode}

Output Format:
{
  "entities": [
    {
      "name": "string",
      "presence_in_prompt": boolean,
      "description": "string",
      "attributes": [
        { "name": "string", "presence_in_prompt": boolean, "value": ["option1", "option2"] }
      ]
    }
  ],
  "relationships": [
    { "source": "entity_name", "target": "entity_name", "label": "string" }
  ]
}`;

  const userKey = config.apiKeys[config.provider];

  let responseText = "";
  if (config.provider === 'mistral') responseText = await mistralRequest(userPrompt, config.model, systemInstruction, userKey);
  else if (config.provider === 'openrouter') responseText = await openRouterRequest(userPrompt, config.model, systemInstruction, userKey);
  else if (config.provider === 'groq') responseText = await standardRequest("https://api.groq.com/openai/v1/chat/completions", userKey || process.env.GROQ_API_KEY || '', config.model, userPrompt, systemInstruction);
  else if (config.provider === 'olm') {
    const baseUrl = config.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    responseText = await standardRequest(`${baseUrl}/v1/chat/completions`, userKey, config.model, userPrompt, systemInstruction);
  }

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

  const userPrompt = `Analyze this ${mode} prompt: "${prompt}". 
Generate 3 expert clarifying questions to help make it more detailed. 
Each question must have 3-4 options. 
Already asked: ${askedQuestions.join(', ')}. 
Return ONLY a JSON array of objects: [{"question": "...", "options": ["...", "..."]}]`;
  const userKey = config.apiKeys[config.provider];
  
  let responseText = "";
  if (config.provider === 'mistral') responseText = await mistralRequest(userPrompt, config.model, undefined, userKey);
  else if (config.provider === 'openrouter') responseText = await openRouterRequest(userPrompt, config.model, undefined, userKey);
  else if (config.provider === 'groq') responseText = await standardRequest("https://api.groq.com/openai/v1/chat/completions", userKey || process.env.GROQ_API_KEY || '', config.model, userPrompt);
  else if (config.provider === 'olm') {
    const baseUrl = config.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    responseText = await standardRequest(`${baseUrl}/v1/chat/completions`, userKey, config.model, userPrompt);
  }

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

  const userPrompt = `Refine this prompt.
Original: ${originalPrompt}. 
Edits from Belief Graph: ${JSON.stringify(graphUpdates)}. 
Clarification answers: ${JSON.stringify(clarifications)}. 
Output ONLY the new refined prompt text. Keep the same creative spirit but incorporate the new details seamlessly.`;
  const userKey = config.apiKeys[config.provider];
  
  if (config.provider === 'mistral') return await mistralRequest(userPrompt, config.model, undefined, userKey);
  if (config.provider === 'openrouter') return await openRouterRequest(userPrompt, config.model, undefined, userKey);
  if (config.provider === 'groq') return await standardRequest("https://api.groq.com/openai/v1/chat/completions", userKey || process.env.GROQ_API_KEY || '', config.model, userPrompt);
  if (config.provider === 'olm') {
    const baseUrl = config.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    return await standardRequest(`${baseUrl}/v1/chat/completions`, userKey, config.model, userPrompt);
  }
  return originalPrompt;
};

/**
 * Dispatches story generation to the correct provider
 */
export const generateStory = async (
  prompt: string,
  config: ProviderConfig,
  onStatusUpdate?: StatusUpdateCallback
): Promise<string> => {
  if (config.provider === 'gemini') {
    return gemini.generateStoryFromPrompt(prompt, onStatusUpdate, config.model);
  }
  
  const userPrompt = `Write a high-quality creative narrative based on the following prompt. Use evocative language and maintain high internal consistency.
Prompt: "${prompt}"`;
  const userKey = config.apiKeys[config.provider];

  if (config.provider === 'mistral') return await mistralRequest(userPrompt, config.model, undefined, userKey);
  if (config.provider === 'openrouter') return await openRouterRequest(userPrompt, config.model, undefined, userKey);
  if (config.provider === 'groq') return await standardRequest("https://api.groq.com/openai/v1/chat/completions", userKey || process.env.GROQ_API_KEY || '', config.model, userPrompt);
  if (config.provider === 'olm') {
    const baseUrl = config.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    return await standardRequest(`${baseUrl}/v1/chat/completions`, userKey, config.model, userPrompt);
  }
  return prompt;
};
