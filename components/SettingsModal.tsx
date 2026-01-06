
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useMemo, useState, useEffect } from 'react';
import { ProviderType, ModelOption, ProviderConfig, ConnectionStatus } from '../types';
import { validateProviderKey } from '../services/geminiService';

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
  { id: 'grok', name: 'xAI Grok', icon: '🧠', description: 'Real-time context & unfiltered reasoning.' },
  { id: 'llama', name: 'Meta Llama', icon: '🦙', description: 'Standard-setting open weights.' },
];

const MODELS: Record<ProviderType, ModelOption[]> = {
  gemini: [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Optimized for speed and high-volume tool use.', isRecommended: true, supportsTools: true },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'SOTA reasoning and complex prompt analysis.', isRecommended: true, supportsTools: true },
    { id: 'gemini-2.5-flash-lite-latest', name: 'Gemini 2.5 Flash Lite', description: 'Ultra-efficient latency for quick refinements.', supportsTools: true },
    { id: 'gemini-2.5-flash-native-audio-preview-09-2025', name: 'Native Audio Reasoning', description: 'Multimodal processing directly in the core.', supportsTools: true },
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', description: 'High-fidelity visual generation engine.', supportsTools: true },
  ],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large 2', description: 'Flagship model with 128k context & deep reasoning.', isRecommended: true, supportsTools: true },
    { id: 'mistral-medium-latest', name: 'Mistral Medium', description: 'Ideal balance between cost and performance.', supportsTools: true },
    { id: 'mistral-small-latest', name: 'Mistral Small', description: 'Lightweight efficiency for classification.', supportsTools: true },
    { id: 'pixtral-12b-2409', name: 'Pixtral Vision', description: 'Multimodal vision expert.', isBeta: true, supportsTools: true },
    { id: 'codestral-latest', name: 'Codestral', description: 'Specialized for structured data and code.', supportsTools: true },
  ],
  openrouter: [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Nuanced writing and reasoning leader.', isRecommended: true, supportsTools: true },
    { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'Omni model with industry-standard reliability.', supportsTools: true },
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', description: 'Latest experimental multimodal flash.', isBeta: true, supportsTools: true },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', description: 'Efficient reasoning from DeepSeek.', supportsTools: true },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'Smarter and faster than 3.5 Turbo.', supportsTools: true },
  ],
  grok: [
    { id: 'grok-2-1212', name: 'Grok-2', description: 'Latest flagship with massive context.', isRecommended: true, supportsTools: true },
    { id: 'grok-2-mini', name: 'Grok-2 Mini', description: 'Compact and extremely fast reasoning.', supportsTools: true },
    { id: 'grok-beta', name: 'Grok Beta', description: 'Experimental high-throughput model.', isBeta: true, supportsTools: true },
  ],
  llama: [
    { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', description: 'The peak of open weight reasoning.', isRecommended: true, supportsTools: true },
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', description: 'Versatile and highly reliable.', supportsTools: true },
    { id: 'meta-llama/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision', description: 'State of the art open vision model.', isBeta: true, supportsTools: true },
    { id: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', description: 'High-speed open vision reasoning.', supportsTools: true },
  ]
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onChange }) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const currentModels = useMemo(() => MODELS[config.provider] || [], [config.provider]);

  useEffect(() => {
    setConnectionStatus('idle');
    setStatusMessage(null);
  }, [config.provider, config.model]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setConnectionStatus('verifying');
    setStatusMessage("Synchronizing with endpoint...");
    
    try {
      const result = await validateProviderKey(config.provider, config.model, config.apiKeys[config.provider]);
      setConnectionStatus(result.success ? 'verified' : 'error');
      setStatusMessage(result.message);
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

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 h-[85vh] max-h-[800px]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">AI Reasoning Engine</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure your preferred foundation model and provider key.</p>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Standardized Two-Pane Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Providers */}
          <div className="w-64 border-r border-slate-100 dark:border-slate-800 flex flex-col bg-slate-50/30 dark:bg-slate-950/20">
            <div className="p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3">Providers</span>
              <div className="mt-3 space-y-1">
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onChange({ ...config, provider: p.id, model: MODELS[p.id][0].id })}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      config.provider === p.id 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xl">{p.icon}</span>
                    <div className="text-left overflow-hidden">
                      <div className="text-sm font-bold truncate">{p.name}</div>
                      {config.provider === p.id && <div className="text-[9px] opacity-80 font-medium">Selected</div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Health Check */}
            <div className="mt-auto p-4 border-t border-slate-100 dark:border-slate-800">
               <div className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        connectionStatus === 'verified' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                        connectionStatus === 'error' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' :
                        connectionStatus === 'verifying' ? 'bg-blue-500 animate-pulse' :
                        'bg-slate-400'
                      }`} />
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wide">Sync State</span>
                    </div>
                    <button 
                      onClick={handleTestConnection}
                      disabled={connectionStatus === 'verifying'}
                      className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase hover:underline"
                    >
                      {connectionStatus === 'verifying' ? 'Syncing...' : 'Validate'}
                    </button>
                  </div>
                  {statusMessage && (
                    <p className="text-[9px] text-slate-400 leading-tight italic truncate" title={statusMessage}>
                      {statusMessage}
                    </p>
                  )}
               </div>
            </div>
          </div>

          {/* Main Area - Models & Keys */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            {/* API Key Section */}
            {config.provider !== 'gemini' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex justify-between items-end">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authentication Key</label>
                   <a href="#" className="text-[9px] text-blue-500 hover:underline">Get Key →</a>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.543 17.543A2 2 0 0110.129 18H9a2 2 0 01-2-2v-1a2 2 0 01.586-1.414l5.223-5.223A2 2 0 0014 9a2 2 0 012-2z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={config.apiKeys[config.provider] || ''}
                    onChange={(e) => handleKeyChange(config.provider, e.target.value)}
                    placeholder={`Paste ${config.provider} Production Key...`}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            {/* Model Selection Section */}
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Available Models</label>
              <div className="grid gap-3">
                {currentModels.map(m => (
                  <button
                    key={m.id}
                    onClick={() => onChange({ ...config, model: m.id })}
                    className={`flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                      config.model === m.id 
                      ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-900/10 shadow-lg shadow-blue-500/5' 
                      : 'border-slate-50 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900 bg-slate-50/50 dark:bg-slate-950/40'
                    }`}
                  >
                    <div className={`mt-1 h-5 w-5 rounded-full border-4 flex-shrink-0 transition-colors ${config.model === m.id ? 'border-blue-500 bg-white dark:bg-slate-900' : 'border-slate-200 dark:border-slate-800'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className={`text-sm font-bold truncate ${config.model === m.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>
                          {m.name}
                        </span>
                        <div className="flex gap-1.5 flex-shrink-0">
                           {m.isBeta && <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-tight">BETA</span>}
                           {m.supportsTools && <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-tight">TOOLS</span>}
                           {m.isRecommended && <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-tight">SOTA</span>}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal line-clamp-2">{m.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
           <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors">CANCEL</button>
           <button 
             onClick={onClose}
             className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-8 rounded-xl transition-all shadow-xl shadow-blue-500/20 active:scale-95"
           >
             CONFIRM ENGINE
           </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
