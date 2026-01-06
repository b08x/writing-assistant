
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ModelOption, ProviderType } from '../types';

export const fetchRemoteModels = async (provider: ProviderType, apiKey?: string): Promise<ModelOption[]> => {
  try {
    if (provider === 'openrouter') {
      const response = await fetch("https://openrouter.ai/api/v1/models");
      if (!response.ok) throw new Error("Failed to fetch OpenRouter models");
      const data = await response.json();
      return data.data.map((m: any) => ({
        id: m.id,
        name: m.name,
        description: m.description || "No description provided.",
        supportsTools: true,
        isRecommended: m.id.includes('claude-3.5') || m.id.includes('gpt-4o')
      }));
    }

    if (provider === 'gemini') {
      const key = apiKey || process.env.API_KEY;
      if (!key) return [];
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (!response.ok) throw new Error("Failed to fetch Gemini models");
      const data = await response.json();
      return data.models
        .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
        .map((m: any) => ({
          id: m.name.split('/').pop(),
          name: m.displayName,
          description: m.description,
          supportsTools: true,
          isRecommended: m.name.includes('flash') || m.name.includes('pro')
        }));
    }

    if (provider === 'mistral') {
      if (!apiKey) return [];
      const response = await fetch("https://api.mistral.ai/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });
      if (!response.ok) throw new Error("Failed to fetch Mistral models");
      const data = await response.json();
      return data.data.map((m: any) => ({
        id: m.id,
        name: m.id.replace(/-/g, ' ').toUpperCase(),
        description: "Mistral foundation model.",
        supportsTools: true,
        isRecommended: m.id.includes('large')
      }));
    }

    if (provider === 'groq') {
      if (!apiKey) return [];
      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });
      if (!response.ok) throw new Error("Failed to fetch Groq models");
      const data = await response.json();
      return data.data.map((m: any) => ({
        id: m.id,
        name: m.id,
        description: "High-speed inference powered by LPU.",
        supportsTools: true
      }));
    }

    if (provider === 'olm') {
      const response = await fetch("http://localhost:11434/api/tags");
      if (!response.ok) throw new Error("Ollama local server not found");
      const data = await response.json();
      return data.models.map((m: any) => ({
        id: m.name,
        name: m.name,
        description: `Local model: ${m.details.parameter_size || 'unknown size'}`,
        supportsTools: false
      }));
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching models for ${provider}:`, error);
    return [];
  }
};
