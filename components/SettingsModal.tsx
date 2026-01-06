
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ProviderType, ModelOption, ProviderConfig, ConnectionStatus } from '../types';
import { validateProviderKey } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ProviderConfig;
  onChange: (config: ProviderConfig) => void;
}

const PROVIDERS: { id: ProviderType; name: string; icon: string }[] = [
  { id: 'gemini', name: 'Gemini', icon: '✨' },
  { id: 'mistral', name: 'Mistral', icon: '🌪️' },
  { id: 'openrouter', name: 'OpenRouter', icon: '📡' },
  { id: 'grok', name: 'Grok', icon: '🧠' },
  { id: 'llama', name: 'Llama', icon: '🦙' },
];

const MODELS: Record<ProviderType, ModelOption[]> = {
  gemini: [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Fast, intelligent, tool-enabled.', isRecommended: true, supportsTools: true },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'Advanced reasoning leader.', isRecommended: true, supportsTools: true },
    { id: 'gemini-2.5-flash-lite-latest', name: 'Gemini 2.5 Flash Lite', description: 'Ultra-efficient for simple tasks.', supportsTools: true },
    { id: 'gemini-2.5-flash-native-audio-preview-09-2025', name: 'Gemini Audio Native', description: 'Direct audio/video reasoning.', supportsTools: true },
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', description: 'Pro-grade high-res visuals.', supportsTools: true },
  ],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large 2', description: 'Top-tier performance & tool use.', supportsTools: true },
    { id: 'mistral-small-latest', name: 'Mistral Small', description: 'Efficient, low-latency reasoning.', supportsTools: true },
    { id: 'pixtral-12b-2409', name: 'Pixtral', description: 'Vision-capable multimodal expert.', isBeta: true, supportsTools: true },
  ],
  openrouter: [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'State of the art coding and nuance.', isRecommended: true, supportsTools: true },
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Exp)', description: 'Experimental multimodal leader.', isBeta: true, supportsTools: true },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'Ultra-fast and smart compact model.', supportsTools: true },
  ],
  grok: [
    { id: 'grok-2-1212', name: 'Grok-2', description: 'Latest reasoning with real-time context.', supportsTools: true },
    { id: 'grok-beta', name: 'Grok Beta', description: 'Unfiltered, high-speed performance.', isBeta: true, supportsTools: true },
  ],
  llama: [
    { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', description: 'The open weights reasoning king.', supportsTools: true },
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', description: 'Industry standard for reliability.', supportsTools: true },
    { id: 'meta-llama/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 Vision', description: 'Advanced image and text processing.', isBeta: true, supportsTools: true },
  ]
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onChange }) => {
  // --- Hooks must be at the top level to satisfy React Rules of Hooks ---
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModels = useMemo(() => MODELS[config.provider] || [], [config.provider]);
  const selectedModel = useMemo(() => 
    currentModels.find(m => m.id === config.model) || currentModels[0], 
  [currentModels, config.model]);

  // Reset status when provider changes
  useEffect(() => {
    setConnectionStatus('idle');
    setStatusMessage(null);
    setIsDropdownOpen(false);
  }, [config.provider]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle early return only AFTER hook declarations
  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setConnectionStatus('verifying');
    setStatusMessage("Testing API endpoint...");
    
    try {
      const result = await validateProviderKey(config.provider, config.model, config.apiKeys[config.provider]);
      setConnectionStatus(result.success ? 'verified' : 'error');
      setStatusMessage(result.message);
    } catch (err: any) {
      setConnectionStatus('error');
      setStatusMessage(err.message || "Unknown error during validation");
    }
  };

  const handleKeyChange = (provider: ProviderType, key: string) => {
    onChange({
      ...config,
      apiKeys: {
        ...config.apiKeys,
        [provider]: key
      }
    });
  };

  const selectModel = (modelId: string) => {
    onChange({ ...config, model: modelId });
    setIsDropdownOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-850/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Model Configuration</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Manage your provider keys and reasoning engines</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
          {/* Provider Selection */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4 block">1. Select Provider</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    onChange({ ...config, provider: p.id, model: MODELS[p.id][0].id });
                  }}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all group ${
                    config.provider === p.id 
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-[0_0_15px_rgba(59,130,246,0.2)] ring-1 ring-blue-500/20' 
                    : 'border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-900 bg-white dark:bg-gray-850'
                  }`}
                >
                  <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">{p.icon}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-tight ${config.provider === p.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Credentials Input */}
          {config.provider !== 'gemini' && (
            <div className="animate-fade-in">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4 block">2. API Credentials</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.543 17.543A2 2 0 0110.129 18H9a2 2 0 01-2-2v-1a2 2 0 01.586-1.414l5.223-5.223A2 2 0 0014 9a2 2 0 012-2z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={config.apiKeys[config.provider] || ''}
                  onChange={(e) => handleKeyChange(config.provider, e.target.value)}
                  placeholder={`Enter ${config.provider.charAt(0).toUpperCase() + config.provider.slice(1)} API Key...`}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                />
              </div>
            </div>
          )}

          {/* Connectivity Status Panel */}
          <div className="p-4 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-100 dark:border-gray-800 space-y-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${
                     connectionStatus === 'verified' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                     connectionStatus === 'error' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' :
                     connectionStatus === 'verifying' ? 'bg-blue-500 animate-pulse' :
                     'bg-gray-400'
                   }`} />
                   <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-widest">
                     Connection Health
                   </span>
                </div>
                <button 
                  onClick={handleTestConnection}
                  disabled={connectionStatus === 'verifying'}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border uppercase tracking-wider transition-all ${
                    connectionStatus === 'verified' 
                    ? 'text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20' 
                    : 'text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-900/40'
                  } disabled:opacity-50`}
                >
                  {connectionStatus === 'verifying' ? 'Checking...' : (connectionStatus === 'verified' ? 'Re-verify' : 'Test Connection')}
                </button>
             </div>
             {statusMessage && (
               <p className={`text-xs font-medium leading-relaxed ${connectionStatus === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}`}>
                 {statusMessage}
               </p>
             )}
          </div>

          {/* Refactored Model Selection as Dropdown */}
          <div className="space-y-4 relative" ref={dropdownRef}>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block">
              {config.provider === 'gemini' ? '2.' : '3.'} Active Reasoning Model
            </label>
            
            <div className="relative">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`w-full flex items-center justify-between p-4 bg-white dark:bg-gray-850 border-2 rounded-xl text-left transition-all ${
                  isDropdownOpen ? 'border-blue-500 shadow-lg ring-1 ring-blue-500/10' : 'border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-900'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 dark:text-gray-100">{selectedModel?.name}</span>
                    <div className="flex gap-1">
                      {selectedModel?.isBeta && <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter">BETA</span>}
                      {selectedModel?.supportsTools && <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter">TOOLS</span>}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{selectedModel?.description}</p>
                </div>
                <svg className={`h-5 w-5 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                  {currentModels.map(m => (
                    <button
                      key={m.id}
                      onClick={() => selectModel(m.id)}
                      className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors border-b last:border-0 border-gray-50 dark:border-gray-700 ${
                        config.model === m.id ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-bold ${config.model === m.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-100'}`}>
                          {m.name}
                        </span>
                        <div className="flex gap-1">
                          {m.isBeta && <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-tighter">BETA</span>}
                          {m.supportsTools && <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-tighter">TOOLS</span>}
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{m.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-850 border-t border-gray-100 dark:border-gray-800">
           <button 
             onClick={onClose}
             className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-[0.98]"
           >
             Save Configuration
           </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
