
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

const PROVIDERS: { id: ProviderType; name: string; icon: string }[] = [
  { id: 'gemini', name: 'Gemini', icon: '✨' },
  { id: 'mistral', name: 'Mistral', icon: '🌪️' },
  { id: 'openrouter', name: 'OpenRouter', icon: '📡' },
  { id: 'grok', name: 'Grok', icon: '🧠' },
  { id: 'llama', name: 'Llama', icon: '🦙' },
];

const MODELS: Record<ProviderType, ModelOption[]> = {
  gemini: [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Fast, efficient, and balanced.', isRecommended: true },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'Maximum reasoning and quality.', isRecommended: true },
    { id: 'gemini-2.5-flash-lite-latest', name: 'Gemini 2.5 Flash Lite', description: 'Ultra-low latency.' },
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Image', description: 'Optimized for visual content.' },
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', description: 'Professional grade high-res generation.' },
  ],
  mistral: [
    { id: 'mistral-large', name: 'Mistral Large', description: 'Top-tier performance.' },
    { id: 'mistral-medium', name: 'Mistral Medium', description: 'Balanced efficiency.' },
    { id: 'pixtral-12b', name: 'Pixtral', description: 'Multimodal expert.', isBeta: true },
  ],
  openrouter: [
    { id: 'openrouter-auto', name: 'Auto (Cheapest)', description: 'Router picks best value.' },
    { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'State of the art coding and nuance.' },
  ],
  grok: [
    { id: 'grok-2', name: 'Grok-2', description: 'Unfiltered, real-time context.' },
    { id: 'grok-2-mini', name: 'Grok-2 Mini', description: 'Lighter and faster.' },
  ],
  llama: [
    { id: 'llama-3.1-405b', name: 'Llama 3.1 405B', description: 'Open weights king.' },
    { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', description: 'Perfect for most tasks.' },
  ]
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onChange }) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Reset status when provider changes
  useEffect(() => {
    setConnectionStatus('idle');
    setStatusMessage(null);
  }, [config.provider]);

  if (!isOpen) return null;

  const currentModels = useMemo(() => MODELS[config.provider] || [], [config.provider]);

  const handleTestConnection = async () => {
    setConnectionStatus('verifying');
    setStatusMessage("Testing API endpoint...");
    
    try {
      const result = await validateProviderKey(config.provider, config.model);
      setConnectionStatus(result.success ? 'verified' : 'error');
      setStatusMessage(result.message);
    } catch (err: any) {
      setConnectionStatus('error');
      setStatusMessage(err.message || "Unknown error during validation");
    }
  };

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700 max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Model Settings</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Choose your preferred AI brain</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto">
          {/* Provider Selection */}
          <div>
            <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 block">1. Select Provider</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => onChange({ provider: p.id, model: MODELS[p.id][0].id })}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all group ${
                    config.provider === p.id 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md ring-2 ring-blue-500/20' 
                    : 'border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800 bg-white dark:bg-gray-900'
                  }`}
                >
                  <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">{p.icon}</span>
                  <span className={`text-xs font-bold ${config.provider === p.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Connectivity Status Panel */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 space-y-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${
                     connectionStatus === 'verified' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                     connectionStatus === 'error' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' :
                     connectionStatus === 'verifying' ? 'bg-blue-500 animate-pulse' :
                     'bg-gray-400'
                   }`} />
                   <span className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight">
                     Connection Health
                   </span>
                </div>
                <button 
                  onClick={handleTestConnection}
                  disabled={connectionStatus === 'verifying'}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                    connectionStatus === 'verified' 
                    ? 'text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30' 
                    : 'text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                  } disabled:opacity-50`}
                >
                  {connectionStatus === 'verifying' ? 'Checking...' : (connectionStatus === 'verified' ? 'Re-verify' : 'Test Connection')}
                </button>
             </div>
             {statusMessage && (
               <p className={`text-xs ${connectionStatus === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}`}>
                 {statusMessage}
               </p>
             )}
          </div>

          {/* Model Selection */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">2. Select Model</label>
            <div className="grid gap-3">
              {currentModels.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    onChange({ ...config, model: m.id });
                    setConnectionStatus('idle');
                    setStatusMessage(null);
                  }}
                  className={`flex items-center p-4 rounded-xl border transition-all text-left group ${
                    config.model === m.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                    : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 bg-white dark:bg-gray-900'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 mr-4 flex-shrink-0 flex items-center justify-center ${config.model === m.id ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {config.model === m.id && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${config.model === m.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-100'}`}>
                        {m.name}
                      </span>
                      {m.isRecommended && <span className="text-[10px] bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded font-bold uppercase">PRO</span>}
                      {m.isBeta && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase">BETA</span>}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{m.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4 items-center justify-between flex-shrink-0">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
             </div>
             <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                {config.provider === 'gemini' 
                  ? "Standard Gemini environment keys are managed automatically." 
                  : `Note: ${config.provider.charAt(0).toUpperCase() + config.provider.slice(1)} integration may require specific platform permissions.`}
             </p>
           </div>
           <button 
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-8 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 w-full sm:w-auto"
           >
            Done
           </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
