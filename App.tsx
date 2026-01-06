
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import PromptInput from './components/PromptInput';
import ClarificationCard from './components/ClarificationCard';
import BeliefGraph from './components/BeliefGraph';
import OutputDisplay from './components/OutputGallery';
import SettingsModal from './components/SettingsModal';
import {
  generateBeliefGraph,
  generateClarifications,
  refinePrompt
} from './services/aiAdapter';
import {
  generateImagesFromPrompt,
  generateStoryFromPrompt,
  generateVideosFromPrompt
} from './services/geminiService';
import { BeliefState, Clarification, GraphUpdate, Attribute, ProviderConfig } from './types';

type Mode = 'image' | 'story' | 'video';
type ToolTab = 'clarify' | 'graph' | 'attributes';
type MobileView = 'editor' | 'preview';

function App() {
  const [prompt, setPrompt] = useState('a cat hosting a party for its animal friends');
  
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [isAttributesLoading, setIsAttributesLoading] = useState(false);
  const [isClarificationsLoading, setIsClarificationsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdatingPrompt, setIsUpdatingPrompt] = useState(false);
  
  const [isOutdated, setIsOutdated] = useState(false); 
  const [showModeChangePopup, setShowModeChangePopup] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [mode, setMode] = useState<Mode>('image');
  
  // Model Settings State
  const [modelConfig, setModelConfig] = useState<ProviderConfig>({
    provider: 'gemini',
    model: 'gemini-3-flash-preview',
    apiKeys: {
      gemini: '',
      mistral: '',
      openrouter: '',
      grok: '',
      llama: ''
    }
  });

  const modeRef = useRef<Mode>(mode);
  const analysisRequestIdRef = useRef(0);
  const generationRequestIdRef = useRef(0);

  const [images, setImages] = useState<string[]>([]);
  const [story, setStory] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [galleryErrors, setGalleryErrors] = useState<Record<Mode, string | null>>({ image: null, story: null, video: null });
  const [requiresApiKey, setRequiresApiKey] = useState(false);
  
  const [beliefGraph, setBeliefGraph] = useState<BeliefState | null>(null);
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [answeredQuestions, setAnsweredQuestions] = useState<string[]>([]);
  const [skippedQuestions, setSkippedQuestions] = useState<string[]>([]); 
  const [hasGenerated, setHasGenerated] = useState(false);

  const [lastAnalyzedPrompt, setLastAnalyzedPrompt] = useState<string | null>(null);
  const [lastAnalyzedMode, setLastAnalyzedMode] = useState<Mode | null>(null);

  const [pendingAttributeUpdates, setPendingAttributeUpdates] = useState<Record<string, string>>({});
  const [pendingRelationshipUpdates, setPendingRelationshipUpdates] = useState<Record<string, string>>({});
  const [pendingClarificationAnswers, setPendingClarificationAnswers] = useState<{[key: string]: string}>({});
  
  const [activeToolTab, setActiveToolTab] = useState<ToolTab>('clarify');
  const [mobileView, setMobileView] = useState<MobileView>('editor');

  // Professional Dark Mode by Default
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  useEffect(() => {
    if (isGenerating) setMobileView('preview');
  }, [isGenerating]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
      if (isDarkMode) {
          document.documentElement.classList.add('dark');
          document.body.style.backgroundColor = '#020617'; // Slate-950
      } else {
          document.documentElement.classList.remove('dark');
          document.body.style.backgroundColor = '#f8fafc'; // Slate-50
      }
  }, [isDarkMode]);

  const clearPendingUpdates = () => {
    setPendingAttributeUpdates({});
    setPendingRelationshipUpdates({});
    setPendingClarificationAnswers({});
  };

  const handleStatusUpdate = useCallback((msg: string) => {
    setStatusNotification(msg);
  }, []);

  const handleModeChange = (newMode: Mode) => {
    if (newMode === mode) return;
    analysisRequestIdRef.current += 1;
    generationRequestIdRef.current += 1;
    setMode(newMode);
    setIsGraphLoading(false);
    setIsAttributesLoading(false);
    setIsClarificationsLoading(false);
    setIsGenerating(false);
    setIsUpdatingPrompt(false);
    setShowModeChangePopup(true);
    setRequiresApiKey(false); 
  };

  const refreshAnalysis = useCallback(async (currentPrompt: string, currentAnsweredQuestions: string[], currentMode: Mode) => {
    const requestId = ++analysisRequestIdRef.current;
    const isCurrent = () => modeRef.current === currentMode && analysisRequestIdRef.current === requestId;
    const safeStatusUpdate = (msg: string) => { if (isCurrent()) handleStatusUpdate(msg); };

    setIsGraphLoading(true);
    setIsAttributesLoading(true);
    setIsClarificationsLoading(true);

    const graphPromise = generateBeliefGraph(currentPrompt, currentMode, modelConfig, safeStatusUpdate)
        .then(graphStructure => {
            if (isCurrent()) if (graphStructure) setBeliefGraph(graphStructure);
        })
        .finally(() => {
            if (isCurrent()) {
                setIsGraphLoading(false);
                setIsAttributesLoading(false);
            }
        });

    const clarificationPromise = generateClarifications(currentPrompt, currentAnsweredQuestions, currentMode, modelConfig, safeStatusUpdate)
        .then(generatedClarifications => {
            if (isCurrent()) setClarifications(generatedClarifications);
        })
        .finally(() => {
             if (isCurrent()) setIsClarificationsLoading(false);
        });

    if (isCurrent()) {
         setLastAnalyzedPrompt(currentPrompt);
         setLastAnalyzedMode(currentMode);
    }
    return Promise.all([graphPromise, clarificationPromise]);
  }, [handleStatusUpdate, modelConfig]);

  const handleRefreshClarifications = useCallback(() => {
    const requestId = ++analysisRequestIdRef.current;
    const requestMode = mode;
    const isCurrent = () => modeRef.current === requestMode && analysisRequestIdRef.current === requestId;
    const safeStatusUpdate = (msg: string) => { if (isCurrent()) handleStatusUpdate(msg); };

    setIsClarificationsLoading(true);
    setPendingClarificationAnswers({});
    setStatusNotification(null);
    
    const currentQuestions = clarifications.map(c => c.question);
    const newSkipped = [...skippedQuestions, ...currentQuestions];
    setSkippedQuestions(newSkipped);

    generateClarifications(prompt, [...answeredQuestions, ...newSkipped], requestMode, modelConfig, safeStatusUpdate)
        .then(newClarifications => { if (isCurrent()) setClarifications(newClarifications); })
        .finally(() => {
             if (isCurrent()) {
                 setIsClarificationsLoading(false);
                 setStatusNotification(null);
             }
        });
  }, [prompt, answeredQuestions, mode, clarifications, skippedQuestions, handleStatusUpdate, modelConfig]);

  const processRequest = useCallback(async (
    currentPrompt: string, 
    currentAnsweredQuestions: string[], 
    currentMode: Mode,
    skipAnalysis: boolean = false,
    skipGeneration: boolean = false
  ) => {
    const genRequestId = ++generationRequestIdRef.current;
    const requestMode = currentMode;
    const isGenCurrent = () => modeRef.current === requestMode && generationRequestIdRef.current === genRequestId;
    const safeGenStatusUpdate = (msg: string) => { if (isGenCurrent()) handleStatusUpdate(msg); };

    setGalleryErrors(prev => ({ ...prev, [requestMode]: null }));
    setRequiresApiKey(false);

    if (!skipGeneration) {
        if (requestMode === 'image') setImages([]);
        else if (requestMode === 'story') setStory(null);
        else if (requestMode === 'video') setVideo(null);
    }
    
    setIsOutdated(false); 
    setStatusNotification(null);
    setShowModeChangePopup(false); 
    
    if (!skipAnalysis) {
        setBeliefGraph(null); 
        setClarifications([]);
        clearPendingUpdates();
        setSkippedQuestions([]); 
    }
    
    const analysisPromise = !skipAnalysis ? refreshAnalysis(currentPrompt, currentAnsweredQuestions, currentMode) : Promise.resolve();
    let generationPromise = Promise.resolve();

    if (!skipGeneration) {
        setIsGenerating(true);
        generationPromise = (async () => {
            try {
                if (requestMode === 'image') {
                    const generatedImages = await generateImagesFromPrompt(currentPrompt, safeGenStatusUpdate, modelConfig.model);
                    if (isGenCurrent()) setImages(generatedImages);
                } else if (requestMode === 'story') {
                    const generatedStory = await generateStoryFromPrompt(currentPrompt, safeGenStatusUpdate, modelConfig.model);
                    if (isGenCurrent()) setStory(generatedStory);
                } else if (requestMode === 'video') {
                    const win = window as any;
                    if (win.aistudio && win.aistudio.hasSelectedApiKey) {
                        const hasKey = await win.aistudio.hasSelectedApiKey();
                        if (!hasKey) {
                            if (isGenCurrent()) {
                                setRequiresApiKey(true);
                                setIsGenerating(false);
                                return;
                            }
                        }
                    }
                    const generatedVideo = await generateVideosFromPrompt(currentPrompt, safeGenStatusUpdate);
                    if (isGenCurrent()) setVideo(generatedVideo);
                }
            } catch (error: any) {
                if (isGenCurrent()) {
                    setGalleryErrors(prev => ({ ...prev, [requestMode]: error.message }));
                }
            } finally {
                if (isGenCurrent()) {
                    setIsGenerating(false);
                    setStatusNotification(null);
                }
            }
        })();
    }
    await Promise.all([analysisPromise, generationPromise]);
  }, [refreshAnalysis, handleStatusUpdate, modelConfig]);

  const handlePromptSubmit = useCallback(() => {
    setHasGenerated(true);
    const shouldSkipAnalysis = prompt === lastAnalyzedPrompt && mode === lastAnalyzedMode;
    processRequest(prompt, answeredQuestions, mode, shouldSkipAnalysis, false);
  }, [prompt, mode, lastAnalyzedPrompt, lastAnalyzedMode, answeredQuestions, processRequest]);

  const handleAnalyzeOnly = useCallback(() => {
     processRequest(prompt, [], mode, false, true);
  }, [prompt, mode, processRequest]);

  const handleApplyAllUpdates = async () => {
    if (isUpdatingPrompt) return;
    const requestMode = mode;
    const isCurrent = () => modeRef.current === requestMode;
    const safeStatusUpdate = (msg: string) => { if (isCurrent()) handleStatusUpdate(msg); };

    setIsUpdatingPrompt(true);
    const qaPairs = Object.entries(pendingClarificationAnswers).map(([q, a]) => ({question: q, answer: a as string}));
    const graphUpdates: GraphUpdate[] = [];
    Object.entries(pendingAttributeUpdates).forEach(([key, value]) => {
        const [entity, attribute] = key.split(':');
        graphUpdates.push({ type: 'attribute', entity, attribute, value: value as string });
    });
    Object.entries(pendingRelationshipUpdates).forEach(([key, value]) => {
        const [source, target] = key.split(':');
        const originalRel = beliefGraph?.relationships.find(r => r.source === source && r.target === target);
        if (originalRel) graphUpdates.push({ type: 'relationship', source, target, oldLabel: originalRel.label, newLabel: value as string });
    });

    const newAnsweredQuestions = [...answeredQuestions, ...qaPairs.map(a => a.question)];
    setAnsweredQuestions(newAnsweredQuestions);

    try {
        const newRefinedPrompt = await refinePrompt(prompt, qaPairs, graphUpdates, modelConfig, safeStatusUpdate);
        if (!isCurrent()) return;
        setPrompt(newRefinedPrompt);
        setIsOutdated(true); 
        clearPendingUpdates(); 
        setSkippedQuestions([]); 
        refreshAnalysis(newRefinedPrompt, newAnsweredQuestions, requestMode);
    } catch(error) {
        if (isCurrent()) setGalleryErrors(prev => ({ ...prev, [requestMode]: "Failed to refine prompt." }));
    } finally {
        if (isCurrent()) {
            setIsUpdatingPrompt(false);
            setStatusNotification(null);
        }
    }
  };
  
  const ToolTabButton = ({ label, tab, current }: { label: string, tab: ToolTab, current: ToolTab }) => (
      <button 
        onClick={() => setActiveToolTab(tab)}
        className={`flex-1 py-3 text-xs sm:text-sm font-semibold text-center transition-all relative focus:outline-none ${current === tab ? 'text-blue-500 dark:text-blue-400 bg-white dark:bg-slate-800 border-b-2 border-blue-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-200 dark:border-slate-800'}`}
      >
        {label}
      </button>
  );

  return (
    <div className={`${isDarkMode ? 'dark' : ''} font-sans h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200 overflow-hidden`}>
        <Header 
            isDarkMode={isDarkMode} 
            toggleDarkMode={() => setIsDarkMode(!isDarkMode)} 
            onShowInfo={() => setShowInfoModal(true)}
            onOpenSettings={() => setShowSettingsModal(true)}
            currentModelName={modelConfig.model}
        />

        {statusNotification && (
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[2000] animate-fade-in-down px-4 w-full max-w-md">
                <div className="bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700/50 text-amber-800 dark:text-amber-100 px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 backdrop-blur-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-pulse text-amber-600 dark:text-amber-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1-1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium flex-1">{statusNotification}</span>
                    <button onClick={() => setStatusNotification(null)} className="ml-auto text-amber-600 dark:text-amber-300 p-1 rounded-full hover:bg-amber-100 dark:hover:bg-amber-800"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                </div>
            </div>
        )}

        <main className="flex-1 flex flex-col w-full max-w-screen-2xl mx-auto xl:p-6 xl:pt-4 xl:pb-6 overflow-hidden min-h-0">
            <div className="flex-1 flex flex-col xl:grid xl:grid-cols-2 xl:gap-6 min-h-0">
            <div className={`flex flex-col gap-0 bg-white dark:bg-slate-900 xl:rounded-2xl xl:border border-slate-200 dark:border-slate-800 shadow-lg transition-colors duration-200 ${mobileView === 'editor' ? 'flex flex-1' : 'hidden xl:flex'} h-full overflow-y-auto overflow-x-hidden`}>
                <div className="flex-shrink-0 z-10 border-b border-slate-200 dark:border-slate-800">
                    <PromptInput
                        prompt={prompt} setPrompt={setPrompt} onSubmit={handlePromptSubmit} onAnalyze={handleAnalyzeOnly} isLoading={isGenerating} isGenerating={isGenerating} isFirstRun={!hasGenerated} mode={mode} setMode={handleModeChange}
                    />
                </div>
                <div className="flex flex-shrink-0 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 justify-between items-center pr-2">
                    <div className="flex flex-1">
                        <ToolTabButton label="Clarifications" tab="clarify" current={activeToolTab} />
                        <ToolTabButton label="Belief Graph" tab="graph" current={activeToolTab} />
                        <ToolTabButton label={mode === 'image' ? 'Image Specs' : (mode === 'video' ? 'Video Specs' : 'Story Elements')} tab="attributes" current={activeToolTab} />
                    </div>
                </div>
                <div className="relative bg-white dark:bg-slate-900 flex-1 overflow-hidden flex flex-col min-h-[450px] pb-[3.5rem] xl:pb-0">
                    {(Object.keys(pendingClarificationAnswers).length + Object.keys(pendingAttributeUpdates).length + Object.keys(pendingRelationshipUpdates).length) > 0 && (
                        <div className="flex-shrink-0 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/50 p-3 flex justify-between items-center animate-fade-in z-20">
                            <span className="text-xs text-blue-700 dark:text-blue-300 font-semibold tracking-wide">PENDING UPDATES</span>
                            <button onClick={handleApplyAllUpdates} disabled={isUpdatingPrompt} className={`bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-4 rounded-lg shadow-lg shadow-blue-500/20 transition-all ${isUpdatingPrompt ? 'opacity-70 cursor-wait' : ''}`}>
                                {isUpdatingPrompt ? "REFINING..." : "RE-SYNCHRONIZE PROMPT"}
                            </button>
                        </div>
                    )}
                    <div className={`p-4 ${activeToolTab === 'clarify' ? 'flex flex-col' : 'hidden'} h-full overflow-hidden`}>
                        <ClarificationCard clarifications={clarifications} onRefresh={handleRefreshClarifications} isLoading={isClarificationsLoading} pendingAnswers={pendingClarificationAnswers} setPendingAnswers={setPendingClarificationAnswers} prompt={prompt} />
                    </div>
                    <div className={`flex-1 w-full min-h-0 ${activeToolTab !== 'clarify' ? 'flex flex-col' : 'hidden'}`}>
                        <BeliefGraph data={beliefGraph} isLoading={isGraphLoading} mode={mode} view={activeToolTab === 'attributes' ? 'attributes' : 'graph'} isVisible={activeToolTab !== 'clarify'} pendingAttributeUpdates={pendingAttributeUpdates} setPendingAttributeUpdates={setPendingAttributeUpdates} pendingRelationshipUpdates={pendingRelationshipUpdates} setPendingRelationshipUpdates={setPendingRelationshipUpdates} pendingClarificationCount={Object.keys(pendingClarificationAnswers).length} currentPrompt={prompt} />
                    </div>
                </div>
            </div>
            <div className={`flex flex-col xl:flex ${mobileView === 'preview' ? 'flex' : 'hidden mt-4 xl:mt-0'} flex-1 h-full min-h-0 pb-[3.5rem] xl:pb-0`}>
                <OutputDisplay images={images} story={story} video={video} mode={mode} isLoading={isGenerating} error={galleryErrors[mode]} isOutdated={isOutdated} requiresApiKey={requiresApiKey} onSelectKey={async () => {
                     const win = window as any; if (win.aistudio && win.aistudio.openSelectKey) { await win.aistudio.openSelectKey(); setRequiresApiKey(false); }
                }} />
            </div>
            </div>
        </main>

        <div className="xl:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around p-2 z-[200] fixed bottom-0 left-0 right-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
            <button onClick={() => setMobileView('editor')} className={`flex-1 flex flex-col items-center py-1 transition-colors ${mobileView === 'editor' ? 'text-blue-600' : 'text-slate-500'}`}><svg className="h-5 w-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg><span className="text-[10px] font-bold">EDITOR</span></button>
            <button onClick={() => setMobileView('preview')} className={`flex-1 flex flex-col items-center py-1 transition-colors ${mobileView === 'preview' ? 'text-blue-600' : 'text-slate-500'}`}><svg className="h-5 w-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span className="text-[10px] font-bold">PREVIEW</span></button>
        </div>

        {showInfoModal && (
          <div className="fixed inset-0 z-[3000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowInfoModal(false)}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-8 relative border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Proactive Co-Creator</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                Experience the next generation of collaborative AI prompting. 
                This interface uses structural analysis to help you build higher-quality prompts 
                through Belief Graphs and Clarification Loops.
              </p>
              <div className="space-y-4 mb-8">
                 <div className="flex items-start gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold">High Precision</h4>
                        <p className="text-xs text-slate-500">Fine-tune every entity and relationship.</p>
                    </div>
                 </div>
                 <div className="flex items-start gap-3">
                    <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg text-emerald-600 dark:text-emerald-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold">Multi-Model Adaptive</h4>
                        <p className="text-xs text-slate-500">Seamlessly switch between top-tier AI providers.</p>
                    </div>
                 </div>
              </div>
              <button onClick={() => setShowInfoModal(false)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl w-full font-bold shadow-xl transition-transform active:scale-95">CONTINUE</button>
            </div>
          </div>
        )}

        <SettingsModal 
          isOpen={showSettingsModal} 
          onClose={() => setShowSettingsModal(false)} 
          config={modelConfig} 
          onChange={setModelConfig} 
        />

        {showModeChangePopup && (
            <div className="fixed bottom-4 right-4 z-[2000] animate-fade-in-up max-w-sm w-full mx-auto px-4 sm:px-0">
                <div className="bg-white dark:bg-slate-900 border-l-4 border-amber-500 rounded-r shadow-2xl p-4 relative border border-slate-200 dark:border-slate-800">
                    <button onClick={() => setShowModeChangePopup(false)} className="absolute top-2 right-2 text-slate-400 hover:text-slate-600">×</button>
                    <h3 className="text-sm font-bold">Mode Context Switched</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Belief Graph preserved for cross-mode reference.</p>
                </div>
            </div>
        )}
    </div>
  );
}

export default App;
