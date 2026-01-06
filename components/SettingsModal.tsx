
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ProviderType, ModelOption, ProviderConfig, ConnectionStatus } from '../types';
import { validateProviderKey } from '../services/geminiService';
import { fetchRemoteModels } from '../services/modelDiscovery';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ProviderConfig;
  onChange: (config: ProviderConfig) => void;
}

const PROVIDERS: { id: ProviderType; name: string; icon: string; description: string }[] = [
  { id: 'gemini', name: 'Google Gemini', icon: '✨', description: 'Multimodal reasoning leaders.' },
  { id: 'mistral', name: 'Mistral AI', icon: '🌪️', description: 'Open weight experts from Europe.' },
  { id: 'openrouter', name: 'OpenRouter', icon: '📡', description: 'Unified access to all SOTA models.' },
  { id: 'groq', name: 'GROQ', icon: '⚡', description: 'Ultra-fast LPU powered inference.' },
  { id: 'olm', name: 'OLM (Ollama)', icon: '🏠', description: 'Local private model access.' },
];

const STATIC_MODELS: Record<string, ModelOption[]> = {
  gemini: [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Optimized for speed and high-volume tool use.', isRecommended: true, supportsTools: true },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'SOTA reasoning and complex prompt analysis.', isRecommended: true, supportsTools: true },
    { id: 'gemini-2.5-flash-native-audio-preview-09-2025', name: 'Native Audio Reasoning', description: 'Multimodal processing directly in the core.', supportsTools: true },
  ],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large 2', description: 'Flagship model with 128k context & deep reasoning.', isRecommended: true, supportsTools: true },
    { id: 'mistral-medium-latest', name: 'Mistral Medium', description: 'Ideal balance between cost and performance.', supportsTools: true },
  ]
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onChange }) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [dynamicModels, setDynamicModels] = useState<ModelOption[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const currentModels = useMemo(() => {
    if (dynamicModels.length > 0) {
      return dynamicModels;
    }
    return STATIC_MODELS[config.provider] || [];
  }, [config.provider, dynamicModels]);

  const refreshModels = useCallback(async () => {
    if (!isOpen) return;
    setIsFetchingModels(true);
    const models = await fetchRemoteModels(config.provider, config.apiKeys[config.provider], config.ollamaBaseUrl);
    if (models && models.length > 0) {
      setDynamicModels(models);
    }
    setIsFetchingModels(false);
  }, [config.provider, config.apiKeys, config.ollamaBaseUrl, isOpen]);

  // Initial validation/refresh if keys are preset in env
  useEffect(() => {
    if (isOpen) {
      const checkInitialStatus = async () => {
        const currentKey = config.apiKeys[config.provider];
        const envKey = (config.provider === 'gemini') ? process.env.API_KEY : 
                      (config.provider === 'mistral') ? process.env.MISTRAL_API_KEY :
                      (config.provider === 'groq') ? process.env.GROQ_API_KEY :
                      (config.provider === 'openrouter') ? process.env.OPENROUTER_API_KEY : null;
        
        if (currentKey || envKey || config.provider === 'olm') {
          refreshModels();
        }
      };
      checkInitialStatus();
    }
  }, [isOpen, config.provider, refreshModels]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setConnectionStatus('verifying');
    setStatusMessage("Synchronizing with endpoint...");
    
    try {
      const result = await validateProviderKey(config.provider, config.model, config.apiKeys[config.provider]);
      setConnectionStatus(result.success ? 'verified' : 'error');
      setStatusMessage(result.message);
      
      if (result.success) {
        refreshModels();
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setStatusMessage(err.message || "Endpoint unreachable.");
    }
  };

  const handleKeyChange = (provider: ProviderType, key: string) => {
    onChange({
      ...config,
      apiKeys: { ...config.apiKeys, [provider]: key }
    });
  };

  const handleOllamaBaseUrlChange = (url: string) => {
    onChange({
      ...config,
      ollamaBaseUrl: url
    });
  };

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 h-[85vh] max-h-[850px]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">AI Reasoning Engine</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure your preferred foundation model and provider keys.</p>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Two-Pane Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Providers */}
          <div className="w-72 border-r border-slate-100 dark:border-slate-800 flex flex-col bg-slate-50/30 dark:bg-slate-950/20">
            <div className="p-4 flex-grow overflow-y-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3">Providers</span>
              <div className="mt-3 space-y-1">
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                        setDynamicModels([]);
                        onChange({ ...config, provider: p.id, model: (STATIC_MODELS[p.id]?.[0].id || config.model) });
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all ${
                      config.provider === p.id 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/20' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-2xl">{p.icon}</span>
                    <div className="text-left overflow-hidden">
                      <div className="text-sm font-bold truncate">{p.name}</div>
                      <div className="text-[10px] opacity-70 truncate font-medium">{p.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Sync State Area */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800">
               <div className="bg-slate-100 dark:bg-slate-800/60 p-4 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        connectionStatus === 'verified' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                        connectionStatus === 'error' ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' :
                        connectionStatus === 'verifying' ? 'bg-blue-500 animate-pulse' :
                        'bg-slate-400'
                      }`} />
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Provider Health</span>
                    </div>
                    <button 
                      onClick={handleTestConnection}
                      disabled={connectionStatus === 'verifying'}
                      className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase hover:underline"
                    >
                      {connectionStatus === 'verifying' ? 'Verifying...' : 'Validate'}
                    </button>
                  </div>
                  {statusMessage && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight font-medium" title={statusMessage}>
                      {statusMessage}
                    </p>
                  )}
               </div>
            </div>
          </div>

          {/* Main Area */}
          <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            {/* API Key Section */}
            {config.provider !== 'gemini' && config.provider !== 'olm' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-end">
                   <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Authentication Key</label>
                   <a href="#" className="text-[10px] font-bold text-blue-500 hover:text-blue-400 underline-offset-4 hover:underline">Revoke / Rotation Docs →</a>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.543 17.543A2 2 0 0110.129 18H9a2 2 0 01-2-2v-1a2 2 0 01.586-1.414l5.223-5.223A2 2 0 0014 9a2 2 0 012-2z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={config.apiKeys[config.provider] || ''}
                    onChange={(e) => handleKeyChange(config.provider, e.target.value)}
                    placeholder={`Production ${config.provider.toUpperCase()} API Secret...`}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400/70"
                  />
                </div>
              </div>
            )}

            {/* Ollama Configuration Section */}
            {config.provider === 'olm' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="flex justify-between items-end">
                       <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ollama Base URL</label>
                       <span className="text-[10px] font-bold text-slate-400">Default: http://localhost:11434</span>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={config.ollamaBaseUrl || 'http://localhost:11434'}
                        onChange={(e) => handleOllamaBaseUrlChange(e.target.value)}
                        placeholder="http://localhost:11434"
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400/70"
                      />
                    </div>
                </div>
            )}

            {/* Model Selection Section */}
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                 <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Available Models</label>
                 <button 
                   onClick={refreshModels}
                   disabled={isFetchingModels}
                   className="flex items-center gap-2 text-[10px] font-bold text-blue-500 dark:text-blue-400 hover:text-blue-600 transition-colors uppercase tracking-widest"
                 >
                   <svg className={`h-3 w-3 ${isFetchingModels ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                   </svg>
                   {isFetchingModels ? 'Fetching...' : 'Refresh Models'}
                 </button>
              </div>
              
              <div className="grid gap-3">
                {currentModels.length === 0 && !isFetchingModels ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                     <p className="text-sm text-slate-400">No models found for this provider.</p>
                     {config.provider === 'olm' && <p className="text-xs text-slate-500 mt-1">Check if Ollama is running and OLLAMA_BASE_URL is correct.</p>}
                  </div>
                ) : (
                  currentModels.map(m => (
                    <button
                      key={m.id}
                      onClick={() => onChange({ ...config, model: m.id })}
                      className={`flex items-start gap-5 p-5 rounded-3xl border-2 text-left transition-all ${
                        config.model === m.id 
                        ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-900/10 shadow-xl shadow-blue-500/10 scale-[1.01]' 
                        : 'border-slate-50 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900 bg-slate-50/50 dark:bg-slate-950/40'
                      }`}
                    >
                      <div className={`mt-1 h-5 w-5 rounded-full border-4 flex-shrink-0 transition-all ${config.model === m.id ? 'border-blue-500 bg-white dark:bg-slate-900' : 'border-slate-200 dark:border-slate-800'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span className={`text-sm font-black truncate tracking-tight ${config.model === m.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>
                            {m.name}
                          </span>
                          <div className="flex gap-2 flex-shrink-0">
                             {m.isBeta && <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border border-amber-200 dark:border-amber-700">BETA</span>}
                             {m.supportsTools && <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border border-blue-200 dark:border-blue-700">TOOLS</span>}
                             {m.isRecommended && <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border border-emerald-200 dark:border-emerald-700">SOTA</span>}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium line-clamp-2">{m.description}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4">
           <button onClick={onClose} className="px-6 py-2.5 text-xs font-black text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors tracking-widest uppercase">DISCARD</button>
           <button 
             onClick={onClose}
             className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-3 px-10 rounded-2xl transition-all shadow-2xl shadow-blue-500/20 active:scale-95 uppercase tracking-widest"
           >
             CONFIRM DEPLOYMENT
           </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
