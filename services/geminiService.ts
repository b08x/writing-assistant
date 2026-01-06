
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Type, FunctionDeclaration } from "@google/genai";
import { BeliefState, Clarification, GraphUpdate, ProviderType } from '../types';

export type StatusUpdateCallback = (message: string) => void;

// --- START: Tool Use Configuration ---

const getCreativeContextDeclaration: FunctionDeclaration = {
  name: 'get_creative_context',
  parameters: {
    type: Type.OBJECT,
    description: 'Get current creative trends, style keywords, and composition advice for a specific mode.',
    properties: {
      mode: { type: Type.STRING, description: 'The creative mode: "image", "story", or "video".' },
      topic: { type: Type.STRING, description: 'The main topic of the prompt to narrow down the advice.' }
    },
    required: ['mode', 'topic'],
  },
};

const searchTechnicalSpecsDeclaration: FunctionDeclaration = {
  name: 'search_technical_specs',
  parameters: {
    type: Type.OBJECT,
    description: 'Get deep technical specifications for specific art styles, lens types, or literary genres.',
    properties: {
      query: { type: Type.STRING, description: 'The technical term or style name (e.g., "chiaroscuro").' }
    },
    required: ['query'],
  },
};

const executeTool = async (name: string, args: any): Promise<any> => {
  console.log(`Executing tool: ${name}`, args);
  if (name === 'get_creative_context') {
    const { mode, topic } = args;
    if (mode === 'image') return { trends: ["Cinematic lighting", "Hyper-detail"], advice: `For ${topic}, focus on textures.` };
    if (mode === 'video') return { pacing: "Slow pan", dynamic_elements: ["Particle effects"] };
    return { tone: "Evocative", pacing: "Fast-start" };
  }
  if (name === 'search_technical_specs') {
    const { query } = args;
    if (query.toLowerCase().includes('chiaroscuro')) return "High contrast lighting, deep shadows.";
    return `Technical parameters for ${query} focus on balance.`;
  }
  return { status: "unknown_tool" };
};

// --- END: Tool Use Configuration ---

// --- START: Connectivity Validation ---

const validateOpenAiCompatible = async (url: string, apiKey: string | undefined, model: string): Promise<{ success: boolean; message: string }> => {
  if (!apiKey && url.includes('localhost') === false) {
    return { success: false, message: "API key missing." };
  }
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 })
    });
    if (response.ok) return { success: true, message: "Connection verified." };
    const errorData = await response.json().catch(() => ({}));
    return { success: false, message: errorData.error?.message || `API error ${response.status}` };
  } catch (error: any) {
    return { success: false, message: error.message || "Network error." };
  }
};

export const validateProviderKey = async (provider: ProviderType, model: string, userKey?: string): Promise<{ success: boolean; message: string }> => {
  if (provider === 'gemini') {
    try {
      const key = userKey || process.env.API_KEY;
      const ai = new GoogleGenAI({ apiKey: key || '' });
      await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'ping',
        config: { maxOutputTokens: 1, thinkingConfig: { thinkingBudget: 0 } }
      });
      return { success: true, message: "Gemini API Key Verified" };
    } catch (error: any) {
      return { success: false, message: error.message || "Invalid Gemini Key" };
    }
  }
  const configs: Record<string, { url: string; key: string | undefined }> = {
    mistral: { url: "https://api.mistral.ai/v1/chat/completions", key: userKey || process.env.MISTRAL_API_KEY },
    openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", key: userKey || process.env.OPENROUTER_API_KEY },
    groq: { url: "https://api.groq.com/openai/v1/chat/completions", key: userKey || process.env.GROQ_API_KEY },
    olm: { url: "http://localhost:11434/v1/chat/completions", key: userKey || "ollama" }
  };
  const config = configs[provider];
  if (!config) return { success: false, message: `Unknown provider: ${provider}` };
  return validateOpenAiCompatible(config.url, config.key, model || "gpt-3.5-turbo");
};

// --- START: Retry Logic ---

const isRetryableError = (error: any): boolean => {
  const msg = typeof error?.message === 'string' ? error.message : JSON.stringify(error);
  // Specifically exclude NOT_FOUND (404) as it indicates project mismatch for Veo
  if (msg.includes("Requested entity was not found")) return false;
  return (
    msg.includes('"code":503') || msg.includes('"code":500') ||
    msg.includes('Rpc failed') || msg.includes('502') || 
    msg.includes('504') || msg.includes('"code":429')
  );
};

const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelay = 1000,
  onStatusUpdate?: StatusUpdateCallback,
  actionName: string = "Request"
): Promise<T> => {
  let lastError: any;
  let currentDelay = initialDelay;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); } catch (error: any) {
      lastError = error;
      if (isRetryableError(error)) {
        if (onStatusUpdate) onStatusUpdate(`Retrying ${actionName}... (${i + 1}/${retries})`);
        await new Promise(r => setTimeout(r, currentDelay));
        currentDelay = currentDelay * 2 + Math.floor(Math.random() * 1000);
      } else throw error;
    }
  }
  throw lastError;
};

// --- AI Methods ---

const handleContentWithTools = async (ai: GoogleGenAI, modelName: string, contents: any, config: any, onStatusUpdate?: StatusUpdateCallback): Promise<GenerateContentResponse> => {
    let response = await ai.models.generateContent({ model: modelName, contents, config });
    const maxLoops = 5;
    let loops = 0;
    let chatContents = Array.isArray(contents) ? [...contents] : [{ role: 'user', parts: [{ text: contents }] }];
    while (response.functionCalls && response.functionCalls.length > 0 && loops < maxLoops) {
        loops++;
        onStatusUpdate?.(`Executing tools... (${loops})`);
        chatContents.push(response.candidates[0].content);
        const functionResponses = [];
        for (const fc of response.functionCalls) {
            const result = await executeTool(fc.name, fc.args);
            functionResponses.push({ id: fc.id, name: fc.name, response: { result } });
        }
        chatContents.push({ role: 'tool', parts: functionResponses.map(fr => ({ functionResponse: fr })) });
        response = await ai.models.generateContent({ model: modelName, contents: chatContents, config });
    }
    return response;
};

export const parsePromptToBeliefGraph = async (prompt: string, mode: 'image' | 'story' | 'video', onStatusUpdate?: StatusUpdateCallback, modelName: string = 'gemini-3-pro-preview'): Promise<BeliefState> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let specificInstructions = mode === 'image' ? " weather, location, style." : (mode === 'video' ? " movement, lighting, pacing." : " genre, tone, conflict.");
    const generationPrompt = `Generate a Belief Graph for: "${prompt}". Identify entities (existence: "true"/"false"), attributes (${specificInstructions}), and relationships. Use tools for creative context.`;
    try {
        const response = await withRetry<GenerateContentResponse>(() => handleContentWithTools(ai, modelName, generationPrompt, {
            responseMimeType: "application/json",
            tools: [{ functionDeclarations: [getCreativeContextDeclaration, searchTechnicalSpecsDeclaration] }],
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    entities: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, presence_in_prompt: { type: Type.BOOLEAN }, description: { type: Type.STRING }, alternatives: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true }, attributes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, presence_in_prompt: { type: Type.BOOLEAN }, value: { type: Type.ARRAY, items: { type: Type.STRING } } } } } } } },
                    relationships: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { source: { type: Type.STRING }, target: { type: Type.STRING }, label: { type: Type.STRING }, alternatives: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true } } } }
                }
            }
        }, onStatusUpdate), 3, 2000, onStatusUpdate, "Belief Graph");
        // FIX: Ensure response.text is treated as string and handle undefined
        const responseText = response.text || '';
        const raw = JSON.parse(responseText.trim());
        return { 
            entities: raw.entities.map((e: any) => ({ ...e, alternatives: e.alternatives?.map((s: string) => ({ name: s })) || [], attributes: e.attributes.map((a: any) => ({ ...a, value: a.value.map((s: string) => ({ name: s })) })) })), 
            relationships: raw.relationships.map((r: any) => ({ ...r, alternatives: r.alternatives?.map((s: string) => ({ name: s })) || [] })), 
            prompt 
        };
    } catch (e) { return { entities: [], relationships: [], prompt }; }
};

export const generateClarifications = async (prompt: string, askedQuestions: string[], mode: 'image' | 'story' | 'video', onStatusUpdate?: StatusUpdateCallback, modelName: string = 'gemini-3-flash-preview'): Promise<Clarification[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const finalPrompt = `Generate 3 clarifying questions for: "${prompt}". Avoid: ${askedQuestions.join(', ')}. Return JSON array of objects with 'question' and 'options'.`;
    try {
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({ model: modelName, contents: finalPrompt, config: { responseMimeType: "application/json" } }), 3, 2000, onStatusUpdate, "Clarifications");
        // FIX: Ensure response.text is treated as string and handle undefined
        const responseText = response.text || '';
        return JSON.parse(responseText.trim());
    } catch (e) { return []; }
};

export const refinePromptWithAllUpdates = async (originalPrompt: string, clarifications: { question: string; answer: string }[], graphUpdates: GraphUpdate[], onStatusUpdate?: StatusUpdateCallback, modelName: string = 'gemini-3-flash-preview'): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Refine prompt: "${originalPrompt}". Edits: ${JSON.stringify(graphUpdates)}. Answers: ${JSON.stringify(clarifications)}.`;
    try {
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({ model: modelName, contents: prompt }), 3, 1000, onStatusUpdate, "Refinement");
        // FIX: Ensure string return type
        return response.text || originalPrompt;
    } catch (e) { return originalPrompt; }
};

export const generateImagesFromPrompt = async (prompt: string, onStatusUpdate?: StatusUpdateCallback, modelName: string = 'gemini-2.5-flash-image'): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const images: string[] = [];
    for(let i=0; i<4; i++) {
        try {
            const resp = await ai.models.generateContent({ model: modelName, contents: { parts: [{ text: prompt }] } });
            const part = resp.candidates[0].content.parts.find(p => p.inlineData);
            if (part) images.push(`data:image/png;base64,${part.inlineData.data}`);
        } catch (e) {}
    }
    if (images.length === 0) throw new Error("Image generation failed.");
    return images;
};

export const generateVideosFromPrompt = async (prompt: string, onStatusUpdate?: StatusUpdateCallback): Promise<string> => {
    const modelName = 'veo-3.1-fast-generate-preview';
    try {
        const freshAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let operation: any = await freshAi.models.generateVideos({ model: modelName, prompt, config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' } });
        while (!operation.done) {
            await new Promise(r => setTimeout(r, 10000));
            operation = await freshAi.operations.getVideosOperation({operation: operation});
        }
        // Fix: Cast operation.error.message to string to avoid 'unknown' type error
        if (operation.error) throw new Error(String((operation as any).error?.message || "Video generation failed."));
        // Fix: Use 'any' cast and then 'string' to handle the uri extraction from potentially untyped operation response
        const uri = (operation.response as any)?.generatedVideos?.[0]?.video?.uri as string;
        const resp = await fetch(`${uri}&key=${process.env.API_KEY}`);
        const blob = await resp.blob();
        return URL.createObjectURL(blob);
    } catch (error: any) {
        // Essential: Re-throw the error so App.tsx can see the 404 status
        throw error;
    }
};

export const generateStoryFromPrompt = async (prompt: string, onStatusUpdate?: StatusUpdateCallback, modelName: string = 'gemini-3-pro-preview'): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const resp = await ai.models.generateContent({ model: modelName, contents: `Story: ${prompt}` });
        // FIX: Ensure string return type
        return resp.text || '';
    } catch (e) { throw e; }
};
