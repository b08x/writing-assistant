
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Type, FunctionDeclaration } from "@google/genai";
import { BeliefState, Clarification, GraphUpdate, ProviderType } from '../types';

export type StatusUpdateCallback = (message: string) => void;

// --- START: Tool Use Configuration ---

/**
 * Tool: get_creative_context
 * Provides trending context for different creative modes.
 */
const getCreativeContextDeclaration: FunctionDeclaration = {
  name: 'get_creative_context',
  parameters: {
    type: Type.OBJECT,
    description: 'Get current creative trends, style keywords, and composition advice for a specific mode.',
    properties: {
      mode: {
        type: Type.STRING,
        description: 'The creative mode: "image", "story", or "video".',
      },
      topic: {
        type: Type.STRING,
        description: 'The main topic of the prompt to narrow down the advice.',
      }
    },
    required: ['mode', 'topic'],
  },
};

/**
 * Tool: search_technical_specs
 * Returns technical parameters for specific art or narrative styles.
 */
const searchTechnicalSpecsDeclaration: FunctionDeclaration = {
  name: 'search_technical_specs',
  parameters: {
    type: Type.OBJECT,
    description: 'Get deep technical specifications for specific art styles, lens types, or literary genres.',
    properties: {
      query: {
        type: Type.STRING,
        description: 'The technical term or style name (e.g., "chiaroscuro", "cyberpunk lighting", "hard-boiled noir").',
      }
    },
    required: ['query'],
  },
};

/**
 * Mock tool execution logic
 */
const executeTool = async (name: string, args: any): Promise<any> => {
  console.log(`Executing tool: ${name}`, args);
  
  if (name === 'get_creative_context') {
    const { mode, topic } = args;
    if (mode === 'image') return { 
        trends: ["Cinematic lighting", "Hyper-detail", "Minimalist composition"], 
        advice: `For ${topic}, focus on textures and global illumination.` 
    };
    if (mode === 'video') return { 
        pacing: "Slow pan", 
        dynamic_elements: ["Particle effects", "Light trails"] 
    };
    return { tone: "Evocative", pacing: "Fast-start", hook: `Establish the presence of ${topic} in the first paragraph.` };
  }

  if (name === 'search_technical_specs') {
    const { query } = args;
    if (query.toLowerCase().includes('chiaroscuro')) return "High contrast lighting, deep shadows, single light source, focus on volume.";
    if (query.toLowerCase().includes('cyberpunk')) return "Neon palette (pink/cyan), high humidity/rain, retro-futurist tech, urban decay.";
    return `Technical parameters for ${query} focus on balance and structural integrity.`;
  }

  return { status: "unknown_tool" };
};

// --- END: Tool Use Configuration ---

// --- START: Connectivity Validation ---

const validateOpenAiCompatible = async (url: string, apiKey: string | undefined, model: string): Promise<{ success: boolean; message: string }> => {
  if (!apiKey && url.includes('localhost') === false) {
    return { success: false, message: "API key missing. Please provide a valid key in settings." };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      })
    });

    if (response.ok) {
      return { success: true, message: "Connection verified successfully." };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        message: errorData.error?.message || `API returned status ${response.status}: ${response.statusText}` 
      };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Network error during validation." };
  }
};

export const validateProviderKey = async (provider: ProviderType, model: string, userKey?: string): Promise<{ success: boolean; message: string }> => {
  if (provider === 'gemini') {
    try {
      const key = userKey || process.env.API_KEY;
      const validationAi = new GoogleGenAI({ apiKey: key || '' });
      await validationAi.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'ping',
        config: { maxOutputTokens: 1, thinkingConfig: { thinkingBudget: 0 } }
      });
      return { success: true, message: "Gemini API Key Verified" };
    } catch (error: any) {
      console.error("Gemini Validation Error:", error);
      return { success: false, message: error.message || "Invalid API Key or connectivity issue" };
    }
  }

  const configs: Record<string, { url: string; key: string | undefined }> = {
    mistral: { 
      url: "https://api.mistral.ai/v1/chat/completions", 
      key: userKey || process.env.MISTRAL_API_KEY || process.env.API_KEY 
    },
    openrouter: { 
      url: "https://openrouter.ai/api/v1/chat/completions", 
      key: userKey || process.env.OPENROUTER_API_KEY || process.env.API_KEY 
    },
    groq: { 
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: userKey || process.env.GROQ_API_KEY || process.env.API_KEY
    },
    olm: { 
      url: "http://localhost:11434/v1/chat/completions",
      key: userKey || "ollama" 
    }
  };

  const config = configs[provider];
  if (!config) {
    return { success: false, message: `Unknown provider: ${provider}` };
  }

  const pingModel = model || "gpt-3.5-turbo";

  return validateOpenAiCompatible(config.url, config.key, pingModel);
};

// --- START: Retry Logic for API Calls ---
const isRetryableError = (error: any): boolean => {
  const errorMessage = typeof error?.message === 'string' ? error.message : JSON.stringify(error);
  return (
    errorMessage.includes('"code":503') || 
    errorMessage.includes('"status":"UNAVAILABLE"') ||
    errorMessage.includes('"code":500') ||
    errorMessage.includes('"status":"UNKNOWN"') ||
    errorMessage.includes('Rpc failed') ||
    errorMessage.includes('xhr error') ||
    errorMessage.includes('502') || 
    errorMessage.includes('Bad Gateway') ||
    errorMessage.includes('504') ||
    errorMessage.includes('Gateway Timeout') ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('"code":429') ||
    errorMessage.includes('429') ||
    errorMessage.includes('"status":"RESOURCE_EXHAUSTED"')
  );
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (isRetryableError(error)) {
        const msg = `Connection unstable or rate limited during ${actionName}. Retrying (${i + 1}/${retries})...`;
        console.warn(msg);
        if (onStatusUpdate) onStatusUpdate(msg);

        await delay(currentDelay);
        currentDelay = currentDelay * 2 + Math.floor(Math.random() * 1000);
      } else {
        console.error("Encountered a non-retryable error:", error);
        throw error;
      }
    }
  }

  console.error("All retry attempts failed for the request.");
  throw lastError;
};

/**
 * Handle recursive tool calls
 */
const handleContentWithTools = async (
    ai: GoogleGenAI,
    modelName: string,
    contents: any,
    config: any,
    onStatusUpdate?: StatusUpdateCallback
): Promise<GenerateContentResponse> => {
    let response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: config
    });

    const maxLoops = 5;
    let loops = 0;

    // Track full conversation for tools
    let chatContents = Array.isArray(contents) ? [...contents] : [contents];
    if (typeof chatContents[0] === 'string') chatContents[0] = { role: 'user', parts: [{ text: chatContents[0] }] };

    while (response.functionCalls && response.functionCalls.length > 0 && loops < maxLoops) {
        loops++;
        onStatusUpdate?.(`AI using technical tools... (step ${loops})`);
        
        // Add model's previous message with function calls
        chatContents.push(response.candidates[0].content);

        const functionResponses = [];
        for (const fc of response.functionCalls) {
            const result = await executeTool(fc.name, fc.args);
            functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: { result }
            });
        }

        // Add tool results
        chatContents.push({
            role: 'tool',
            parts: functionResponses.map(fr => ({
                functionResponse: fr
            }))
        });

        // Re-generate with tool outputs
        response = await ai.models.generateContent({
            model: modelName,
            contents: chatContents,
            config: config
        });
    }

    return response;
};

/**
 * Generates the complete Belief Graph.
 */
export const parsePromptToBeliefGraph = async (
    prompt: string, 
    mode: 'image' | 'story' | 'video', 
    onStatusUpdate?: StatusUpdateCallback,
    modelName: string = 'gemini-3-pro-preview'
): Promise<BeliefState> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    console.log(`Generating Full Belief Graph using ${modelName} for ${mode}:`, prompt);

    let specificInstructions = "";

    if (mode === 'image') {
        specificInstructions = `
        - **The Image Entity:** Always include an entity named "The Image". Required Attributes: weather, location, time of day, atmosphere, camera angle, image style.
        - **Human Subjects:** If an entity is human, include Attributes: age, gender, ethnicity, hair_style, clothing, expression, pose.
        - **Objects:** Include Attributes: color, material, shape, size, texture, lighting.
        `;
    } else if (mode === 'video') {
         specificInstructions = `
        - **The Video Entity:** Always include an entity named "The Video". Required Attributes: camera_movement, lighting, atmosphere, video_style, pacing, duration_feel.
        - **Subjects:** If an entity is active, include Attributes: movement, expression, action_speed, clothing.
        - **Setting:** Include Attributes: location, weather, time_of_day, ambience.
        `;
    } else {
        specificInstructions = `
        - **The Story Entity:** Always include an entity named "The Story". Required Attributes: genre, tone, narrative_perspective, pacing, central_conflict.
        - **Characters:** Include Attributes: personality, motivation, role, age, background, emotional_state.
        `;
    }

    const generationPrompt = `
    Analyze the prompt and generate a complete **Belief Graph** representing the scene or story.
    Identify all entities, their detailed attributes, and their relationships.

    USE YOUR TOOLS (get_creative_context, search_technical_specs) if the prompt involves specific art styles, complex camera work, or creative themes you need more context for.

    Entity Types:
    - **Explicit Entities:** Clearly stated in the prompt (presence_in_prompt: True).
    - **Implicit Entities:** Entities not mentioned but logically necessary (presence_in_prompt: False). Limit to 2-3 key implicit entities.
    
    Attribute Rules:
    1.  **Existence:** For EVERY entity, you **MUST** include an attribute named 'existence' (value "true" or "false").
    2.  **Rich Attributes:** For every entity, generate 3-4 descriptive attributes based on these rules:
        ${specificInstructions}
    3.  **Values:** For EVERY attribute, provide 2-3 plausible alternative candidate values as a list of strings. The first value should be the most likely one.
    4.  **Inference:** If an attribute is not explicitly stated, infer a likely value and set "presence_in_prompt" to false.

    Relationships:
    - Identify logical relationships between entities (e.g., "holding", "next to", "part of").
    - Provide a label and alternatives (as strings).

    Input: { "prompt": "${prompt}" }
    OUTPUT JSON:`;

    const attributeSchema = { 
        type: Type.OBJECT, 
        properties: { 
            name: { type: Type.STRING }, 
            presence_in_prompt: { type: Type.BOOLEAN }, 
            value: { type: Type.ARRAY, items: { type: Type.STRING } } 
        }, 
        required: ['name', 'presence_in_prompt', 'value'] 
    };
    
    const entitySchema = { 
        type: Type.OBJECT, 
        properties: { 
            name: { type: Type.STRING }, 
            presence_in_prompt: { type: Type.BOOLEAN }, 
            description: { type: Type.STRING }, 
            alternatives: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true }, 
            attributes: { type: Type.ARRAY, items: attributeSchema } 
        }, 
        required: ['name', 'presence_in_prompt', 'description', 'attributes'] 
    };
    
    const relationshipSchema = { 
        type: Type.OBJECT, 
        properties: { 
            source: { type: Type.STRING }, 
            target: { type: Type.STRING }, 
            label: { type: Type.STRING }, 
            alternatives: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true } 
        }, 
        required: ['source', 'target', 'label'] 
    };

    try {
        const response = await withRetry<GenerateContentResponse>(() => 
            handleContentWithTools(
                ai,
                modelName,
                generationPrompt,
                {
                    responseMimeType: "application/json",
                    tools: [{ functionDeclarations: [getCreativeContextDeclaration, searchTechnicalSpecsDeclaration] }],
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            entities: { type: Type.ARRAY, items: entitySchema },
                            relationships: { type: Type.ARRAY, items: relationshipSchema }
                        },
                        required: ['entities', 'relationships']
                    }
                },
                onStatusUpdate
            ), 5, 2000, onStatusUpdate, "Belief Graph Generation");

        let jsonText = response.text.trim();
        const rawGraph = JSON.parse(jsonText);
        const entities = rawGraph.entities.map((e: any) => ({
            ...e,
            alternatives: e.alternatives ? e.alternatives.map((s: string) => ({ name: s })) : [],
            attributes: e.attributes.map((a: any) => ({
                ...a,
                value: a.value.map((s: string) => ({ name: s }))
            }))
        }));
        const relationships = rawGraph.relationships.map((r: any) => ({
            ...r,
            alternatives: r.alternatives ? r.alternatives.map((s: string) => ({ name: s })) : []
        }));
        return { entities, relationships, prompt };
    } catch (error) {
        console.error("Error generating belief graph:", error);
        return { entities: [], relationships: [], prompt };
    }
};

export const generateClarifications = async (
    prompt: string, 
    askedQuestions: string[], 
    mode: 'image' | 'story' | 'video', 
    onStatusUpdate?: StatusUpdateCallback,
    modelName: string = 'gemini-3-flash-preview'
): Promise<Clarification[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const imagePrompt = `You are an expert in text-to-image prompting. Your goal is to help a user refine their prompt by asking clarifying questions.`;
    const videoPrompt = `You are an expert in AI video generation prompting. Your goal is to help a user refine their prompt by asking clarifying questions.`;
    const storyPrompt = `You are a creative writing assistant. Your goal is to help a user develop their story idea.`;

    let specificPrompt = imagePrompt;
    if (mode === 'story') specificPrompt = storyPrompt;
    if (mode === 'video') specificPrompt = videoPrompt;

    const finalPrompt = specificPrompt + `
    
Follow these instructions EXACTLY:
1.  **Quantity:** Generate EXACTLY 3 questions.
2.  **Ease of Answering:** Provide 3-5 plausible choices per question.
3.  **Avoid Repetition**: DO NOT ask: ${askedQuestions.map(q => `- "${q}"`).join('\n') || 'N/A'}

User Prompt: "${prompt}"

Return output as JSON array of objects with 'question' and 'options'.`;

    try {
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: modelName,
            contents: finalPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ['question', 'options'],
                    },
                },
            },
        }), 5, 2000, onStatusUpdate, "Clarification Generation"); 

        return JSON.parse(response.text.trim()) as Clarification[];
    } catch (error) {
        console.error("Error generating clarifications:", error);
        return [];
    }
};

export const refinePromptWithAllUpdates = async (
    originalPrompt: string,
    clarifications: { question: string; answer: string }[],
    graphUpdates: GraphUpdate[],
    onStatusUpdate?: StatusUpdateCallback,
    modelName: string = 'gemini-3-flash-preview'
  ): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let updatesPromptSection = "";
    if (graphUpdates.length > 0) {
        const graphList = graphUpdates.map((u, i) => u.type === 'attribute' ? `- For entity "${u.entity}", set "${u.attribute}" to "${u.value}".` : `- Change relationship between "${u.source}" and "${u.target}" from "${u.oldLabel}" to "${u.newLabel}".`).join('\n');
        updatesPromptSection += `\nSPECIFIC EDITS:\n${graphList}\n`;
    }
    if (clarifications.length > 0) {
        const qaList = clarifications.map(c => `- Answer to "${c.question}": "${c.answer}"`).join('\n');
        updatesPromptSection += `\nNEW INFORMATION:\n${qaList}\n`;
    }
  
    const prompt = `Rewrite the prompt to incorporate these edits while preserving existing context.
    Original Prompt: "${originalPrompt}"
    ${updatesPromptSection}
    - If existence is "false", remove entity.
    - Preserving original style and tone is critical.
    
    Updated Prompt:`;
  
    try {
      const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: modelName,
        contents: prompt,
      }), 3, 1000, onStatusUpdate, "Prompt Refinement");
      return response.text;
    } catch (error) {
      console.error("Error refining prompt:", error);
      return originalPrompt;
    }
  };

export const generateImagesFromPrompt = async (
    prompt: string, 
    onStatusUpdate?: StatusUpdateCallback,
    modelName: string = 'gemini-2.5-flash-image'
): Promise<string[]> => {
    const generateOne = async (): Promise<string | null> => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        try {
            const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
                model: modelName,
                contents: { parts: [{ text: prompt }] },
                config: { imageConfig: { aspectRatio: "1:1" } }
            }), 3, 2000, onStatusUpdate, "Image Generation");
            
            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
            return null;
        } catch (err) { return null; }
    };

    let images: string[] = [];
    let attempts = 0;
    while (images.length < 4 && attempts < 2) {
        const needed = 4 - images.length;
        const promises = Array(needed).fill(null).map(() => generateOne());
        const results = await Promise.all(promises);
        images = [...images, ...results.filter((img): img is string => img !== null)];
        attempts++;
    }
    if (images.length === 0) throw new Error("Image generation failed.");
    return images;
};

export const generateVideosFromPrompt = async (
    prompt: string, 
    onStatusUpdate?: StatusUpdateCallback
): Promise<string> => {
    const modelName = 'veo-3.1-fast-generate-preview';
    try {
        const freshAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let operation = await freshAi.models.generateVideos({
            model: modelName,
            prompt: prompt,
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await freshAi.operations.getVideosOperation({operation: operation});
        }
        if (operation.error) throw new Error(`Video generation failed: ${operation.error.message}`);
        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) throw new Error("No video URI returned");
        const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) { throw error; }
};

export const generateStoryFromPrompt = async (
    prompt: string, 
    onStatusUpdate?: StatusUpdateCallback,
    modelName: string = 'gemini-3-pro-preview'
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const storyGenerationPrompt = `Write a short, creative story based on: "${prompt}"`;
    try {
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: modelName,
            contents: storyGenerationPrompt,
            config: { temperature: 0.8 }
        }), 3, 1000, onStatusUpdate, "Story Generation");
        return response.text;
    } catch (error) { throw error; }
};
