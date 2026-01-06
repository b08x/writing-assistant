
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ModelOption, ProviderType } from '../types';

const FALLBACK_GEMINI_MODELS: ModelOption[] = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Optimized for speed and high-volume tool use.', isRecommended: true, supportsTools: true },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'SOTA reasoning and complex prompt analysis.', isRecommended: true, supportsTools: true },
  { id: 'gemini-2.5-flash-lite-latest', name: 'Gemini 2.5 Flash Lite', description: 'Ultra-efficient latency for quick refinements.', supportsTools: true },
  { id: 'gemini-2.5-flash-native-audio-preview-09-2025', name: 'Native Audio Reasoning', description: 'Multimodal processing directly in the core.', supportsTools: true },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', description: 'High-fidelity visual generation engine.', supportsTools: true },
];

export const fetchRemoteModels = async (provider: ProviderType, apiKey?: string, baseUrl?: string): Promise<ModelOption[]> => {
  try {
    if (provider === 'openrouter') {
      const key = apiKey || process.env.OPENROUTER_API_KEY;
      const response = await fetch("https://openrouter.ai/api/v1/models");
      if (!response.ok) throw new Error("Failed to fetch OpenRouter models");
      const data = await response.json();
      return data.data.map((m: any) => ({
        id: m.id || 'unknown',
        name: m.name || m.id || 'Unknown Model',
        description: m.description || "No description provided.",
        supportsTools: true,
        isRecommended: (m.id || '').includes('claude-3.5') || (m.id || '').includes('gpt-4o')
      }));
    }

    if (provider === 'gemini') {
      const key = apiKey || process.env.API_KEY;
      if (!key) return FALLBACK_GEMINI_MODELS;
      
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!response.ok) return FALLBACK_GEMINI_MODELS;
        const data = await response.json();
        if (!data.models) return FALLBACK_GEMINI_MODELS;
        
        return data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => ({
            id: m.name?.split('/').pop() || 'unknown',
            name: m.displayName || m.name || 'Gemini Model',
            description: m.description || '',
            supportsTools: true,
            isRecommended: (m.name || '').includes('flash') || (m.name || '').includes('pro')
          }));
      } catch (e) {
        console.warn("Gemini model fetch failed, using fallbacks.", e);
        return FALLBACK_GEMINI_MODELS;
      }
    }

    if (provider === 'mistral') {
      const key = apiKey || process.env.MISTRAL_API_KEY;
      if (!key) return [];
      const response = await fetch("https://api.mistral.ai/v1/models", {
        headers: { "Authorization": `Bearer ${key}` }
      });
      if (!response.ok) throw new Error("Failed to fetch Mistral models");
      const data = await response.json();
      return data.data.map((m: any) => {
        const modelId = m.id || 'unknown';
        return {
          id: modelId,
          name: modelId.replace(/-/g, ' ').toUpperCase(),
          description: "Mistral foundation model.",
          supportsTools: true,
          isRecommended: modelId.includes('large')
        };
      });
    }

    if (provider === 'groq') {
      const key = apiKey || process.env.GROQ_API_KEY;
      if (!key) return [];
      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${key}` }
      });
      if (!response.ok) throw new Error("Failed to fetch Groq models");
      const data = await response.json();
      return data.data.map((m: any) => ({
        id: m.id || 'unknown',
        name: (m.id || 'Unknown').toUpperCase(),
        description: "High-speed inference powered by LPU.",
        supportsTools: true
      }));
    }

    if (provider === 'olm') {
      const finalUrl = baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const response = await fetch(`${finalUrl}/api/tags`);
      if (!response.ok) throw new Error("Ollama server not found");
      const data = await response.json();
      return data.models.map((m: any) => ({
        id: m.name || 'unknown',
        name: m.name || 'Local Model',
        description: `Local model: ${m.details?.parameter_size || 'unknown size'}`,
        supportsTools: false
      }));
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching models for ${provider}:`, error);
    return [];
  }
};
