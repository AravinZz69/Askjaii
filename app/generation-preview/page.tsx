'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Sparkles, AlertCircle, AlertTriangle, ArrowLeft, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store/stage';
import { useSettingsStore } from '@/lib/store/settings';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { getAvailableProvidersWithVoices } from '@/lib/audio/voice-resolver';
import { useI18n } from '@/lib/hooks/use-i18n';
import {
  loadImageMapping,
  loadPdfBlob,
  cleanupOldImages,
  storeImages,
} from '@/lib/utils/image-storage';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import { db } from '@/lib/utils/database';
import { MAX_PDF_CONTENT_CHARS, MAX_VISION_IMAGES } from '@/lib/constants/generation';
import { nanoid } from 'nanoid';
import type { Stage } from '@/lib/types/stage';
import type { SceneOutline, PdfImage, ImageMapping } from '@/lib/types/generation';
import { AgentRevealModal } from '@/components/agent/agent-reveal-modal';
import { createLogger } from '@/lib/logger';
import { type GenerationSessionState, ALL_STEPS, getActiveSteps } from './types';
import { StepVisualizer } from './components/visualizers';

const log = createLogger('GenerationPreview');

function GenerationPreviewContent() {
  const router = useRouter();
  const { t } = useI18n();
  const hasStartedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [session, setSession] = useState<GenerationSessionState | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isComplete] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [streamingOutlines, setStreamingOutlines] = useState<SceneOutline[] | null>(null);
  const [truncationWarnings, setTruncationWarnings] = useState<string[]>([]);
  const [webSearchSources, setWebSearchSources] = useState<Array<{ title: string; url: string }>>(
    [],
  );
  const [showAgentReveal, setShowAgentReveal] = useState(false);
  const [generatedAgents, setGeneratedAgents] = useState<
    Array<{
      id: string;
      name: string;
      role: string;
      persona: string;
      avatar: string;
      color: string;
      priority: number;
    }>
  >([]);
  const agentRevealResolveRef = useRef<(() => void) | null>(null);

  // Compute active steps based on session state
  const activeSteps = getActiveSteps(session);

  // Set video playback speed to slow
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.5; // 50% speed for cinematic slow motion
    }
  }, []);

  // Load session from sessionStorage
  useEffect(() => {
    cleanupOldImages(24).catch((e) => log.error(e));

    const saved = sessionStorage.getItem('generationSession');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as GenerationSessionState;
        setSession(parsed);
      } catch (e) {
        log.error('Failed to parse generation session:', e);
      }
    }
    setSessionLoaded(true);
  }, []);

  // Abort all in-flight requests on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Get API credentials from localStorage
  const getApiHeaders = () => {
    const modelConfig = getCurrentModelConfig();
    const settings = useSettingsStore.getState();
    const imageProviderConfig = settings.imageProvidersConfig?.[settings.imageProviderId];
    const videoProviderConfig = settings.videoProvidersConfig?.[settings.videoProviderId];
    return {
      'Content-Type': 'application/json',
      'x-model': modelConfig.modelString,
      'x-api-key': modelConfig.apiKey,
      'x-base-url': modelConfig.baseUrl,
      'x-provider-type': modelConfig.providerType || '',
      'x-requires-api-key': modelConfig.requiresApiKey ? 'true' : 'false',
      // Image generation provider
      'x-image-provider': settings.imageProviderId || '',
      'x-image-model': settings.imageModelId || '',
      'x-image-api-key': imageProviderConfig?.apiKey || '',
      'x-image-base-url': imageProviderConfig?.baseUrl || '',
      // Video generation provider
      'x-video-provider': settings.videoProviderId || '',
      'x-video-model': settings.videoModelId || '',
      'x-video-api-key': videoProviderConfig?.apiKey || '',
      'x-video-base-url': videoProviderConfig?.baseUrl || '',
      // Media generation toggles
      'x-image-generation-enabled': String(settings.imageGenerationEnabled ?? false),
      'x-video-generation-enabled': String(settings.videoGenerationEnabled ?? false),
    };
  };

  // Auto-start generation when session is loaded
  useEffect(() => {
    if (session && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Main generation flow
  const startGeneration = async () => {
    if (!session) return;

    // Create AbortController for this generation run
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    // Use a local mutable copy so we can update it after PDF parsing
    let currentSession = session;

    setError(null);
    setCurrentStepIndex(0);

    try {
      // Compute active steps for this session (recomputed after session mutations)
      let activeSteps = getActiveSteps(currentSession);

      // Determine if we need the PDF analysis step
      const hasPdfToAnalyze = !!currentSession.pdfStorageKey && !currentSession.pdfText;
      // If no PDF to analyze, skip to the next available step
      if (!hasPdfToAnalyze) {
        const firstNonPdfIdx = activeSteps.findIndex((s) => s.id !== 'pdf-analysis');
        setCurrentStepIndex(Math.max(0, firstNonPdfIdx));
      }

      // Step 0: Parse PDF if needed
      if (hasPdfToAnalyze) {
        log.debug('=== Generation Preview: Parsing PDF ===');
        const pdfBlob = await loadPdfBlob(currentSession.pdfStorageKey!);
        if (!pdfBlob) {
          throw new Error(t('generation.pdfLoadFailed'));
        }

        // Ensure pdfBlob is a valid Blob with content
        if (!(pdfBlob instanceof Blob) || pdfBlob.size === 0) {
          log.error('Invalid PDF blob:', {
            type: typeof pdfBlob,
            size: pdfBlob instanceof Blob ? pdfBlob.size : 'N/A',
          });
          throw new Error(t('generation.pdfLoadFailed'));
        }

        // Wrap as a File to guarantee multipart/form-data with correct content-type
        const pdfFile = new File([pdfBlob], currentSession.pdfFileName || 'document.pdf', {
          type: 'application/pdf',
        });

        const parseFormData = new FormData();
        parseFormData.append('pdf', pdfFile);

        if (currentSession.pdfProviderId) {
          parseFormData.append('providerId', currentSession.pdfProviderId);
        }
        if (currentSession.pdfProviderConfig?.apiKey?.trim()) {
          parseFormData.append('apiKey', currentSession.pdfProviderConfig.apiKey);
        }
        if (currentSession.pdfProviderConfig?.baseUrl?.trim()) {
          parseFormData.append('baseUrl', currentSession.pdfProviderConfig.baseUrl);
        }

        const parseResponse = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: parseFormData,
          signal,
        });

        if (!parseResponse.ok) {
          const errorData = await parseResponse.json();
          throw new Error(errorData.error || t('generation.pdfParseFailed'));
        }

        const parseResult = await parseResponse.json();
        if (!parseResult.success || !parseResult.data) {
          throw new Error(t('generation.pdfParseFailed'));
        }

        let pdfText = parseResult.data.text as string;

        // Truncate if needed
        if (pdfText.length > MAX_PDF_CONTENT_CHARS) {
          pdfText = pdfText.substring(0, MAX_PDF_CONTENT_CHARS);
        }

        // Create image metadata and store images
        // Prefer metadata.pdfImages (both parsers now return this)
        const rawPdfImages = parseResult.data.metadata?.pdfImages;
        const images = rawPdfImages
          ? rawPdfImages.map(
              (img: {
                id: string;
                src?: string;
                pageNumber?: number;
                description?: string;
                width?: number;
                height?: number;
              }) => ({
                id: img.id,
                src: img.src || '',
                pageNumber: img.pageNumber || 1,
                description: img.description,
                width: img.width,
                height: img.height,
              }),
            )
          : (parseResult.data.images as string[]).map((src: string, i: number) => ({
              id: `img_${i + 1}`,
              src,
              pageNumber: 1,
            }));

        const imageStorageIds = await storeImages(images);

        const pdfImages: PdfImage[] = images.map(
          (
            img: {
              id: string;
              src: string;
              pageNumber: number;
              description?: string;
              width?: number;
              height?: number;
            },
            i: number,
          ) => ({
            id: img.id,
            src: '',
            pageNumber: img.pageNumber,
            description: img.description,
            width: img.width,
            height: img.height,
            storageId: imageStorageIds[i],
          }),
        );

        // Update session with parsed PDF data
        const updatedSession = {
          ...currentSession,
          pdfText,
          pdfImages,
          imageStorageIds,
          pdfStorageKey: undefined, // Clear so we don't re-parse
        };
        setSession(updatedSession);
        sessionStorage.setItem('generationSession', JSON.stringify(updatedSession));

        // Truncation warnings
        const warnings: string[] = [];
        if ((parseResult.data.text as string).length > MAX_PDF_CONTENT_CHARS) {
          warnings.push(t('generation.textTruncated', { n: MAX_PDF_CONTENT_CHARS }));
        }
        if (images.length > MAX_VISION_IMAGES) {
          warnings.push(
            t('generation.imageTruncated', { total: images.length, max: MAX_VISION_IMAGES }),
          );
        }
        if (warnings.length > 0) {
          setTruncationWarnings(warnings);
        }

        // Reassign local reference for subsequent steps
        currentSession = updatedSession;
        activeSteps = getActiveSteps(currentSession);
      }

      // Step: Web Search (if enabled)
      const webSearchStepIdx = activeSteps.findIndex((s) => s.id === 'web-search');
      if (currentSession.requirements.webSearch && webSearchStepIdx >= 0) {
        setCurrentStepIndex(webSearchStepIdx);
        setWebSearchSources([]);

        const wsSettings = useSettingsStore.getState();
        const wsApiKey =
          wsSettings.webSearchProvidersConfig?.[wsSettings.webSearchProviderId]?.apiKey;
        const res = await fetch('/api/web-search', {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            query: currentSession.requirements.requirement,
            pdfText: currentSession.pdfText || undefined,
            apiKey: wsApiKey || undefined,
          }),
          signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Web search failed' }));
          throw new Error(data.error || t('generation.webSearchFailed'));
        }

        const searchData = await res.json();
        const sources = (searchData.sources || []).map((s: { title: string; url: string }) => ({
          title: s.title,
          url: s.url,
        }));
        setWebSearchSources(sources);

        const updatedSessionWithSearch = {
          ...currentSession,
          researchContext: searchData.context || '',
          researchSources: sources,
        };
        setSession(updatedSessionWithSearch);
        sessionStorage.setItem('generationSession', JSON.stringify(updatedSessionWithSearch));
        currentSession = updatedSessionWithSearch;
        activeSteps = getActiveSteps(currentSession);
      }

      // Load imageMapping early (needed for both outline and scene generation)
      let imageMapping: ImageMapping = {};
      if (currentSession.imageStorageIds && currentSession.imageStorageIds.length > 0) {
        log.debug('Loading images from IndexedDB');
        imageMapping = await loadImageMapping(currentSession.imageStorageIds);
      } else if (
        currentSession.imageMapping &&
        Object.keys(currentSession.imageMapping).length > 0
      ) {
        log.debug('Using imageMapping from session (old format)');
        imageMapping = currentSession.imageMapping;
      }

      // ── Agent generation (before outlines so persona can influence structure) ──
      const settings = useSettingsStore.getState();
      let agents: Array<{
        id: string;
        name: string;
        role: string;
        persona?: string;
      }> = [];

      // Create stage client-side (needed for agent generation stageId)
      const stageId = nanoid(10);
      const stage: Stage = {
        id: stageId,
        name: extractTopicFromRequirement(currentSession.requirements.requirement),
        description: '',
        language: currentSession.requirements.language || 'zh-CN',
        style: 'professional',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (settings.agentMode === 'auto') {
        const agentStepIdx = activeSteps.findIndex((s) => s.id === 'agent-generation');
        if (agentStepIdx >= 0) setCurrentStepIndex(agentStepIdx);

        try {
          const allAvatars = [
            {
              path: '/avatars/teacher.png',
              desc: 'Teacher avatar - professional and knowledgeable',
            },
            {
              path: '/avatars/assistant.jpg',
              desc: 'Assistant avatar - helpful and supportive',
            },
            {
              path: '/avatars/classclown.jpg',
              desc: 'Class clown avatar - energetic and humorous',
            },
            {
              path: '/avatars/curious.png',
              desc: 'Curious student avatar - inquisitive and eager',
            },
            {
              path: '/avatars/notetaker.jpg',
              desc: 'Note taker avatar - organized and studious',
            },
            {
              path: '/avatars/thinker.jpg',
              desc: 'Deep thinker avatar - thoughtful and contemplative',
            },
          ];

          const getAvailableVoicesForGeneration = () => {
            const providers = getAvailableProvidersWithVoices(settings.ttsProvidersConfig);
            return providers.flatMap((p) =>
              p.voices.map((v) => ({
                providerId: p.providerId,
                voiceId: v.id,
                voiceName: v.name,
              })),
            );
          };

          // No outlines yet — agent generation uses only stage name + description
          const agentResp = await fetch('/api/generate/agent-profiles', {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
              stageInfo: { name: stage.name, description: stage.description },
              language: currentSession.requirements.language || 'zh-CN',
              availableAvatars: allAvatars.map((a) => a.path),
              avatarDescriptions: allAvatars.map((a) => ({ path: a.path, desc: a.desc })),
              availableVoices: getAvailableVoicesForGeneration(),
            }),
            signal,
          });

          if (!agentResp.ok) throw new Error('Agent generation failed');
          const agentData = await agentResp.json();
          if (!agentData.success) throw new Error(agentData.error || 'Agent generation failed');

          // Save to IndexedDB and registry
          const { saveGeneratedAgents } = await import('@/lib/orchestration/registry/store');
          const savedIds = await saveGeneratedAgents(stage.id, agentData.agents);
          settings.setSelectedAgentIds(savedIds);
          stage.agentIds = savedIds;

          // Show card-reveal modal, continue generation once all cards are revealed
          setGeneratedAgents(agentData.agents);
          setShowAgentReveal(true);
          await new Promise<void>((resolve) => {
            agentRevealResolveRef.current = resolve;
          });

          agents = savedIds
            .map((id) => useAgentRegistry.getState().getAgent(id))
            .filter(Boolean)
            .map((a) => ({
              id: a!.id,
              name: a!.name,
              role: a!.role,
              persona: a!.persona,
            }));
        } catch (err: unknown) {
          log.warn('[Generation] Agent generation failed, falling back to presets:', err);
          const registry = useAgentRegistry.getState();
          const fallbackIds = settings.selectedAgentIds.filter((id) => {
            const a = registry.getAgent(id);
            return a && !a.isGenerated;
          });
          agents = fallbackIds
            .map((id) => registry.getAgent(id))
            .filter(Boolean)
            .map((a) => ({
              id: a!.id,
              name: a!.name,
              role: a!.role,
              persona: a!.persona,
            }));
          stage.agentIds = fallbackIds;
        }
      } else {
        // Preset mode — use selected agents (include persona)
        // Filter out stale generated agent IDs that may linger in settings
        const registry = useAgentRegistry.getState();
        const presetAgentIds = settings.selectedAgentIds.filter((id) => {
          const a = registry.getAgent(id);
          return a && !a.isGenerated;
        });
        agents = presetAgentIds
          .map((id) => registry.getAgent(id))
          .filter(Boolean)
          .map((a) => ({
            id: a!.id,
            name: a!.name,
            role: a!.role,
            persona: a!.persona,
          }));
        stage.agentIds = presetAgentIds;
      }

      // ── Generate outlines (with agent personas for teacher context) ──
      let outlines = currentSession.sceneOutlines;

      const outlineStepIdx = activeSteps.findIndex((s) => s.id === 'outline');
      setCurrentStepIndex(outlineStepIdx >= 0 ? outlineStepIdx : 0);
      if (!outlines || outlines.length === 0) {
        log.debug('=== Generating outlines (SSE) ===');
        setStreamingOutlines([]);

        outlines = await new Promise<SceneOutline[]>((resolve, reject) => {
          const collected: SceneOutline[] = [];

          fetch('/api/generate/scene-outlines-stream', {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
              requirements: currentSession.requirements,
              pdfText: currentSession.pdfText,
              pdfImages: currentSession.pdfImages,
              imageMapping,
              researchContext: currentSession.researchContext,
              agents,
            }),
            signal,
          })
            .then((res) => {
              if (!res.ok) {
                return res.json().then((d) => {
                  reject(new Error(d.error || t('generation.outlineGenerateFailed')));
                });
              }

              const reader = res.body?.getReader();
              if (!reader) {
                reject(new Error(t('generation.streamNotReadable')));
                return;
              }

              const decoder = new TextDecoder();
              let sseBuffer = '';

              const pump = (): Promise<void> =>
                reader.read().then(({ done, value }) => {
                  if (value) {
                    sseBuffer += decoder.decode(value, { stream: !done });
                    const lines = sseBuffer.split('\n');
                    sseBuffer = lines.pop() || '';

                    for (const line of lines) {
                      if (!line.startsWith('data: ')) continue;
                      try {
                        const evt = JSON.parse(line.slice(6));
                        if (evt.type === 'outline') {
                          collected.push(evt.data);
                          setStreamingOutlines([...collected]);
                        } else if (evt.type === 'retry') {
                          collected.length = 0;
                          setStreamingOutlines([]);
                          setStatusMessage(t('generation.outlineRetrying'));
                        } else if (evt.type === 'done') {
                          resolve(evt.outlines || collected);
                          return;
                        } else if (evt.type === 'error') {
                          reject(new Error(evt.error));
                          return;
                        }
                      } catch (e) {
                        log.error('Failed to parse outline SSE:', line, e);
                      }
                    }
                  }
                  if (done) {
                    if (collected.length > 0) {
                      resolve(collected);
                    } else {
                      reject(new Error(t('generation.outlineEmptyResponse')));
                    }
                    return;
                  }
                  return pump();
                });

              pump().catch(reject);
            })
            .catch(reject);
        });

        const updatedSession = { ...currentSession, sceneOutlines: outlines };
        setSession(updatedSession);
        sessionStorage.setItem('generationSession', JSON.stringify(updatedSession));

        // Outline generation succeeded — clear homepage draft cache
        try {
          localStorage.removeItem('requirementDraft');
        } catch {
          /* ignore */
        }

        // Brief pause to let user see the final outline state
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      // Move to scene generation step
      setStatusMessage('');
      if (!outlines || outlines.length === 0) {
        throw new Error(t('generation.outlineEmptyResponse'));
      }

      // Store stage and outlines
      const store = useStageStore.getState();
      store.setStage(stage);
      store.setOutlines(outlines);

      // Advance to slide-content step
      const contentStepIdx = activeSteps.findIndex((s) => s.id === 'slide-content');
      if (contentStepIdx >= 0) setCurrentStepIndex(contentStepIdx);

      // Build stageInfo and userProfile for API call
      const stageInfo = {
        name: stage.name,
        description: stage.description,
        language: stage.language,
        style: stage.style,
      };

      const userProfile =
        currentSession.requirements.userNickname || currentSession.requirements.userBio
          ? `Student: ${currentSession.requirements.userNickname || 'Unknown'}${currentSession.requirements.userBio ? ` — ${currentSession.requirements.userBio}` : ''}`
          : undefined;

      // Generate ONLY the first scene
      store.setGeneratingOutlines(outlines);

      const firstOutline = outlines[0];

      // Step 2: Generate content (currentStepIndex is already 2)
      const contentResp = await fetch('/api/generate/scene-content', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          outline: firstOutline,
          allOutlines: outlines,
          pdfImages: currentSession.pdfImages,
          imageMapping,
          stageInfo,
          stageId: stage.id,
          agents,
        }),
        signal,
      });

      if (!contentResp.ok) {
        const errorData = await contentResp.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errorData.error || t('generation.sceneGenerateFailed'));
      }

      const contentData = await contentResp.json();
      if (!contentData.success || !contentData.content) {
        throw new Error(contentData.error || t('generation.sceneGenerateFailed'));
      }

      // Generate actions (activate actions step indicator)
      const actionsStepIdx = activeSteps.findIndex((s) => s.id === 'actions');
      setCurrentStepIndex(actionsStepIdx >= 0 ? actionsStepIdx : currentStepIndex + 1);

      const actionsResp = await fetch('/api/generate/scene-actions', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          outline: contentData.effectiveOutline || firstOutline,
          allOutlines: outlines,
          content: contentData.content,
          stageId: stage.id,
          agents,
          previousSpeeches: [],
          userProfile,
        }),
        signal,
      });

      if (!actionsResp.ok) {
        const errorData = await actionsResp.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errorData.error || t('generation.sceneGenerateFailed'));
      }

      const data = await actionsResp.json();
      if (!data.success || !data.scene) {
        throw new Error(data.error || t('generation.sceneGenerateFailed'));
      }

      // Generate TTS for first scene (part of actions step — blocking)
      if (settings.ttsEnabled && settings.ttsProviderId !== 'browser-native-tts') {
        const ttsProviderConfig = settings.ttsProvidersConfig?.[settings.ttsProviderId];
        const speechActions = (data.scene.actions || []).filter(
          (a: { type: string; text?: string }) => a.type === 'speech' && a.text,
        );

        let ttsFailCount = 0;
        for (const action of speechActions) {
          const audioId = `tts_${action.id}`;
          action.audioId = audioId;
          try {
            const resp = await fetch('/api/generate/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: action.text,
                audioId,
                ttsProviderId: settings.ttsProviderId,
                ttsModelId: ttsProviderConfig?.modelId,
                ttsVoice: settings.ttsVoice,
                ttsSpeed: settings.ttsSpeed,
                ttsApiKey: ttsProviderConfig?.apiKey || undefined,
                ttsBaseUrl: ttsProviderConfig?.baseUrl || undefined,
              }),
              signal,
            });
            if (!resp.ok) {
              ttsFailCount++;
              continue;
            }
            const ttsData = await resp.json();
            if (!ttsData.success) {
              ttsFailCount++;
              continue;
            }
            const binary = atob(ttsData.base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: `audio/${ttsData.format}` });
            await db.audioFiles.put({
              id: audioId,
              blob,
              format: ttsData.format,
              createdAt: Date.now(),
            });
          } catch (err) {
            log.warn(`[TTS] Failed for ${audioId}:`, err);
            ttsFailCount++;
          }
        }

        if (ttsFailCount > 0 && speechActions.length > 0) {
          throw new Error(t('generation.speechFailed'));
        }
      }

      // Add scene to store and navigate
      store.addScene(data.scene);
      store.setCurrentSceneId(data.scene.id);

      // Set remaining outlines as skeleton placeholders
      const remaining = outlines.filter((o) => o.order !== data.scene.order);
      store.setGeneratingOutlines(remaining);

      // Store generation params for classroom to continue generation
      sessionStorage.setItem(
        'generationParams',
        JSON.stringify({
          pdfImages: currentSession.pdfImages,
          agents,
          userProfile,
        }),
      );

      sessionStorage.removeItem('generationSession');
      await store.saveToStorage();
      router.push(`/classroom/${stage.id}`);
    } catch (err) {
      // AbortError is expected when navigating away — don't show as error
      if (err instanceof DOMException && err.name === 'AbortError') {
        log.info('[GenerationPreview] Generation aborted');
        return;
      }
      sessionStorage.removeItem('generationSession');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const extractTopicFromRequirement = (requirement: string): string => {
    const trimmed = requirement.trim();
    if (trimmed.length <= 500) {
      return trimmed;
    }
    return trimmed.substring(0, 500).trim() + '...';
  };

  const goBackToHome = () => {
    abortControllerRef.current?.abort();
    sessionStorage.removeItem('generationSession');
    router.push('/');
  };

  // Still loading session from sessionStorage
  if (!sessionLoaded) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#050a15] flex items-center justify-center">
        <div className="text-cyan-400 font-mono text-sm tracking-wider animate-pulse">
          INITIALIZING WORKBENCH...
        </div>
      </div>
    );
  }

  // No session found
  if (!session) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#050a15] flex items-center justify-center p-4">
        <div className="text-center space-y-6">
          <div className="size-20 mx-auto rounded-xl border border-red-500/30 bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="size-10 text-red-400" />
          </div>
          <h2 className="text-xl font-mono text-red-400">{t('generation.sessionNotFound')}</h2>
          <p className="text-sm text-slate-500 font-mono">{t('generation.sessionNotFoundDesc')}</p>
          <Button 
            onClick={() => router.push('/')} 
            className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30"
          >
            <ArrowLeft className="size-4 mr-2" />
            {t('generation.backToHome')}
          </Button>
        </div>
      </div>
    );
  }

  const activeStep =
    activeSteps.length > 0
      ? activeSteps[Math.min(currentStepIndex, activeSteps.length - 1)]
      : ALL_STEPS[0];

  // Terminal logs based on current step
  const terminalLogs = [
    `[SYSTEM] Workbench initialized...`,
    `[AGENT-1] ${activeStep.id === 'web-search' ? 'Searching knowledge base...' : 'Standing by...'}`,
    `[AGENT-2] ${activeStep.id === 'outline' ? 'Drafting course outline...' : 'Awaiting instructions...'}`,
    `[AGENT-3] ${activeStep.id === 'slide-content' ? 'Generating slide content...' : 'Processing queue...'}`,
    `[CORE] Status: ${error ? 'ERROR' : isComplete ? 'COMPLETE' : 'ACTIVE'}`,
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-[#030712] flex flex-col items-center justify-center relative overflow-hidden">
      
      {/* ═══ Layer 0: Background Video (GPU-Accelerated) ═══ */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 gpu-layer">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover transform-gpu opacity-40"
          style={{
            willChange: 'transform',
            transform: 'translateZ(0) scale(1.1)',
          }}
        >
          <source src="/hf_20260217_030345_246c0224-10a4-422c-b324-070b7c0eceda.mp4" type="video/mp4" />
        </video>
        {/* Dark overlay to blend video with quantum grid */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/60 via-[#030712]/40 to-[#030712]/80 transform-gpu" />
      </div>
      
      {/* ═══ Layer 1: Deep Ambient Blobs (GPU-Accelerated) ═══ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden gpu-layer">
        <motion.div
          className="absolute w-[800px] h-[800px] rounded-full transform-gpu"
          style={{
            background: 'radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)',
            left: '-10%',
            top: '-20%',
            filter: 'blur(80px)',
            willChange: 'transform',
          }}
          animate={{
            x: [0, 150, 50, 0],
            y: [0, 100, -50, 0],
            scale: [1, 1.2, 0.9, 1],
            rotate: [0, 45, -20, 0],
          }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full transform-gpu"
          style={{
            background: 'radial-gradient(circle, rgba(0,217,255,0.12) 0%, transparent 70%)',
            right: '-5%',
            bottom: '-10%',
            filter: 'blur(60px)',
            willChange: 'transform',
          }}
          animate={{
            x: [0, -100, 80, 0],
            y: [0, -80, 60, 0],
            scale: [1, 0.8, 1.3, 1],
            rotate: [0, -30, 60, 0],
          }}
          transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full transform-gpu"
          style={{
            background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)',
            left: '40%',
            top: '60%',
            filter: 'blur(70px)',
            willChange: 'transform',
          }}
          animate={{
            x: [0, 80, -60, 0],
            y: [0, -100, 50, 0],
            scale: [1, 1.1, 0.85, 1],
          }}
          transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* ═══ Layer 2: 3D Isometric Quantum Grid ═══ */}
      <motion.div 
        className="fixed inset-0 pointer-events-none"
        style={{ perspective: '1000px' }}
      >
        <motion.div
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{
            rotateX: [2, -2, 2],
            rotateY: [-3, 3, -3],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg className="absolute inset-0 w-full h-full opacity-30">
            <defs>
              <pattern id="quantumGrid" width="80" height="80" patternUnits="userSpaceOnUse">
                <path 
                  d="M 80 0 L 0 0 0 80" 
                  fill="none" 
                  stroke="url(#gridLineGradient)" 
                  strokeWidth="0.5"
                />
                <circle cx="0" cy="0" r="1.5" fill="rgba(0,217,255,0.5)" />
              </pattern>
              <linearGradient id="gridLineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(0,217,255,0.4)" />
                <stop offset="50%" stopColor="rgba(139,92,246,0.3)" />
                <stop offset="100%" stopColor="rgba(0,217,255,0.4)" />
              </linearGradient>
              <radialGradient id="gridFadeRadial" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
              <mask id="quantumMask">
                <rect width="100%" height="100%" fill="url(#gridFadeRadial)" />
              </mask>
            </defs>
            <motion.rect 
              width="200%" 
              height="200%" 
              x="-50%"
              y="-50%"
              fill="url(#quantumGrid)" 
              mask="url(#quantumMask)"
              animate={{ 
                x: ['-50%', '-30%', '-50%'],
                y: ['-50%', '-30%', '-50%'],
              }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            />
          </svg>
        </motion.div>
      </motion.div>

      {/* ═══ Lumina Avatar Bubble (Near Hexagon) ═══ */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.5, x: 100 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 100 }}
        className="fixed top-1/2 right-[8%] -translate-y-1/2 z-20 hidden lg:block"
      >
        <motion.div
          animate={{ y: [0, -15, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative"
        >
          {/* Glass bubble */}
          <div className={cn(
            "size-28 rounded-full backdrop-blur-2xl flex items-center justify-center",
            "border-2 transition-all duration-700",
            error 
              ? "border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.3),inset_0_0_30px_rgba(239,68,68,0.1)]" 
              : isComplete 
                ? "border-green-500/50 shadow-[0_0_50px_rgba(34,197,94,0.3),inset_0_0_30px_rgba(34,197,94,0.1)]"
                : "border-cyan-500/30 shadow-[0_0_50px_rgba(0,217,255,0.25),inset_0_0_30px_rgba(0,217,255,0.08)]",
            "bg-slate-900/40"
          )}>
            <motion.div
              animate={!error && !isComplete ? { 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              } : {}}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Bot className={cn(
                "size-12 transition-colors duration-500",
                error ? "text-red-400" : isComplete ? "text-green-400" : "text-cyan-400"
              )} />
            </motion.div>
          </div>
          
          {/* Projection beam */}
          <motion.div
            className="absolute top-1/2 -left-32 w-32 h-1"
            style={{
              background: error 
                ? 'linear-gradient(90deg, transparent, rgba(239,68,68,0.5))' 
                : isComplete
                  ? 'linear-gradient(90deg, transparent, rgba(34,197,94,0.5))'
                  : 'linear-gradient(90deg, transparent, rgba(0,217,255,0.5))',
            }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          {/* Status label */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className={cn(
              "text-xs font-mono tracking-widest uppercase px-3 py-1 rounded-full",
              "bg-slate-900/80 backdrop-blur-sm border",
              error ? "text-red-400 border-red-500/30" : 
              isComplete ? "text-green-400 border-green-500/30" : 
              "text-cyan-400 border-cyan-500/30"
            )}>
              {error ? "Error" : isComplete ? "Complete" : "Projecting"}
            </span>
          </div>
        </motion.div>
      </motion.div>

      {/* ═══ Observer Badge (Top Left) ═══ */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed top-6 left-6 z-30 flex items-center gap-3"
      >
        <motion.div 
          className={cn(
            "size-12 rounded-xl flex items-center justify-center transition-all duration-500",
            "backdrop-blur-xl border",
            error ? "border-red-500/50 bg-red-500/10" :
            isComplete ? "border-green-500/50 bg-green-500/10" :
            "border-cyan-500/30 bg-cyan-500/10"
          )}
          animate={!error && !isComplete ? { 
            boxShadow: [
              '0 0 20px rgba(0,217,255,0.3)',
              '0 0 40px rgba(139,92,246,0.3)',
              '0 0 20px rgba(0,217,255,0.3)',
            ]
          } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Bot className={cn(
            "size-6",
            error ? "text-red-400" : isComplete ? "text-green-400" : "text-cyan-400"
          )} />
        </motion.div>
        <div className="hidden sm:block">
          <div className="text-[10px] text-slate-600 font-mono uppercase tracking-[0.2em]">Observer</div>
          <div className={cn(
            "text-sm font-mono tracking-wide",
            error ? "text-red-400" : isComplete ? "text-green-400" : "text-cyan-400"
          )}>
            {error ? "ERROR DETECTED" : isComplete ? "MISSION COMPLETE" : "MONITORING..."}
          </div>
        </div>
      </motion.div>

      {/* ═══ Exit Button ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-6 right-6 z-30"
      >
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={goBackToHome}
          className="text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 font-mono tracking-wider border border-transparent hover:border-cyan-500/20"
        >
          <ArrowLeft className="size-4 mr-2" />
          EXIT
        </Button>
      </motion.div>

      {/* ═══ Central Quantum Core ═══ */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4">
        
        {/* Interactive Hexagon with Data-Dissolve */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 100 }}
          className="relative mb-8"
        >
          <svg width="280" height="240" viewBox="0 0 280 240" className="relative z-10">
            {/* Outer hex glow */}
            <motion.polygon
              points="140,10 260,65 260,175 140,230 20,175 20,65"
              fill="none"
              stroke="url(#hexOuterGlow)"
              strokeWidth="2"
              opacity="0.3"
              animate={{ 
                scale: [1, 1.05, 1],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            {/* Main hex border with dash animation */}
            <motion.polygon
              points="140,20 250,70 250,170 140,220 30,170 30,70"
              fill="none"
              stroke="url(#hexGradientMain)"
              strokeWidth="1.5"
              strokeDasharray="8 4"
              animate={{ strokeDashoffset: [0, -24] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
            {/* Inner hex */}
            <motion.polygon
              points="140,40 230,80 230,160 140,200 50,160 50,80"
              fill="rgba(0,217,255,0.02)"
              stroke="rgba(0,217,255,0.2)"
              strokeWidth="0.5"
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            {/* Data nodes */}
            {[[140, 20], [250, 70], [250, 170], [140, 220], [30, 170], [30, 70]].map(([x, y], i) => (
              <motion.circle
                key={i}
                cx={x}
                cy={y}
                r="4"
                fill="url(#nodeGradient)"
                animate={{ 
                  r: [3, 5, 3],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
            <defs>
              <linearGradient id="hexGradientMain" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00d9ff" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
              <linearGradient id="hexOuterGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00d9ff" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.5" />
              </linearGradient>
              <radialGradient id="nodeGradient">
                <stop offset="0%" stopColor="#00d9ff" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </radialGradient>
            </defs>
          </svg>

          {/* Glitch Title inside hex */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.h1 
              className={cn(
                "text-xl md:text-2xl font-mono font-bold tracking-[0.15em] uppercase text-center px-4",
                "relative"
              )}
              style={{ 
                color: error ? '#ef4444' : isComplete ? '#22c55e' : '#00d9ff',
                textShadow: error 
                  ? '0 0 20px rgba(239,68,68,0.5)' 
                  : isComplete 
                    ? '0 0 20px rgba(34,197,94,0.5)'
                    : '0 0 20px rgba(0,217,255,0.5), 0 0 40px rgba(139,92,246,0.3)',
              }}
            >
              {/* Glitch layers */}
              <span className="relative">
                {error ? 'GENERATION FAILED' : isComplete ? 'COMPLETE' : t(activeStep.title).toUpperCase()}
                <motion.span
                  className="absolute inset-0 text-pink-500 opacity-0"
                  aria-hidden
                  animate={{ 
                    opacity: [0, 0.8, 0],
                    x: [-2, 2, -2],
                  }}
                  transition={{ duration: 0.1, repeat: Infinity, repeatDelay: 3 }}
                >
                  {error ? 'GENERATION FAILED' : isComplete ? 'COMPLETE' : t(activeStep.title).toUpperCase()}
                </motion.span>
                <motion.span
                  className="absolute inset-0 text-cyan-300 opacity-0"
                  aria-hidden
                  animate={{ 
                    opacity: [0, 0.6, 0],
                    x: [2, -2, 2],
                  }}
                  transition={{ duration: 0.1, repeat: Infinity, repeatDelay: 3.1 }}
                >
                  {error ? 'GENERATION FAILED' : isComplete ? 'COMPLETE' : t(activeStep.title).toUpperCase()}
                </motion.span>
              </span>
            </motion.h1>
            
            {/* Scanline effect */}
            <motion.div
              className="absolute inset-0 pointer-events-none overflow-hidden opacity-20"
              style={{
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,217,255,0.1) 2px, rgba(0,217,255,0.1) 4px)',
              }}
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />

            <p className="text-slate-500 font-mono text-xs md:text-sm mt-3 max-w-xs text-center px-4 tracking-wide">
              {error ? error : isComplete ? t('generation.classroomReady') : statusMessage || t(activeStep.description)}
            </p>
          </div>
        </motion.div>

        {/* ═══ Floating Status Pods ═══ */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          {/* Pod 1: SLIDES - Float Up */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ 
              opacity: 1, 
              y: 0,
            }}
            transition={{ delay: 0.2 }}
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className={cn(
                "w-32 md:w-40 h-40 md:h-48 rounded-2xl backdrop-blur-xl p-4 flex flex-col items-center justify-center",
                "border transition-all duration-500",
                activeStep.id === 'slide-content' || activeStep.id === 'outline'
                  ? "border-cyan-500/50 bg-cyan-500/5 shadow-[0_0_40px_rgba(0,217,255,0.15)]"
                  : "border-slate-700/30 bg-slate-900/30 hover:border-cyan-500/30"
              )}
            >
              <div className="text-[10px] font-mono text-slate-500 mb-3 uppercase tracking-[0.2em]">Slides</div>
              <motion.div
                animate={activeStep.id === 'slide-content' ? { 
                  scale: [1, 1.1, 1],
                } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <svg width="56" height="56" viewBox="0 0 56 56" className="text-cyan-400">
                  <rect x="6" y="6" width="44" height="34" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="12" y="12" width="18" height="10" rx="1" fill="currentColor" opacity="0.2"/>
                  <motion.line 
                    x1="12" y1="26" x2="38" y2="26" 
                    stroke="currentColor" strokeWidth="1.5" opacity="0.4"
                    animate={{ pathLength: [0, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <line x1="12" y1="32" x2="30" y2="32" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
                  <rect x="20" y="44" width="16" height="4" rx="2" fill="currentColor" opacity="0.2"/>
                </svg>
              </motion.div>
              <div className={cn(
                "text-xs font-mono mt-3 transition-colors",
                activeStep.id === 'slide-content' || activeStep.id === 'outline' ? "text-cyan-400" : "text-slate-600"
              )}>
                {streamingOutlines ? `${streamingOutlines.length} slides` : '—'}
              </div>
            </motion.div>
          </motion.div>

          {/* Pod 2: QUIZZES - Float Down */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              className={cn(
                "w-32 md:w-40 h-40 md:h-48 rounded-2xl backdrop-blur-xl p-4 flex flex-col items-center justify-center",
                "border transition-all duration-500",
                activeStep.id === 'actions'
                  ? "border-violet-500/50 bg-violet-500/5 shadow-[0_0_40px_rgba(139,92,246,0.15)]"
                  : "border-slate-700/30 bg-slate-900/30 hover:border-violet-500/30"
              )}
            >
              <div className="text-[10px] font-mono text-slate-500 mb-3 uppercase tracking-[0.2em]">Quizzes</div>
              <motion.div
                animate={activeStep.id === 'actions' ? { rotate: [0, 10, -10, 0] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <svg width="56" height="56" viewBox="0 0 56 56" className="text-violet-400">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                  <motion.path
                    d="M16 28 L24 36 L40 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: activeStep.id === 'actions' ? [0, 1, 1, 0] : 0.4 }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </svg>
              </motion.div>
              <div className={cn(
                "text-xs font-mono mt-3 transition-colors",
                activeStep.id === 'actions' ? "text-violet-400" : "text-slate-600"
              )}>
                Processing
              </div>
            </motion.div>
          </motion.div>

          {/* Pod 3: AGENTS - Subtle Rotate */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <motion.div
              animate={{ 
                y: [-4, 4, -4],
                rotate: [-1, 1, -1],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className={cn(
                "w-32 md:w-40 h-40 md:h-48 rounded-2xl backdrop-blur-xl p-4 flex flex-col items-center justify-center",
                "border transition-all duration-500",
                activeStep.id === 'agents'
                  ? "border-pink-500/50 bg-pink-500/5 shadow-[0_0_40px_rgba(236,72,153,0.15)]"
                  : "border-slate-700/30 bg-slate-900/30 hover:border-pink-500/30"
              )}
            >
              <div className="text-[10px] font-mono text-slate-500 mb-3 uppercase tracking-[0.2em]">Agents</div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              >
                <svg width="56" height="56" viewBox="0 0 56 56" className="text-pink-400">
                  <circle cx="28" cy="28" r="5" fill="currentColor"/>
                  <circle cx="28" cy="10" r="4" fill="currentColor" opacity="0.6"/>
                  <circle cx="44" cy="37" r="4" fill="currentColor" opacity="0.6"/>
                  <circle cx="12" cy="37" r="4" fill="currentColor" opacity="0.6"/>
                  <line x1="28" y1="28" x2="28" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
                  <line x1="28" y1="28" x2="40" y2="35" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
                  <line x1="28" y1="28" x2="16" y2="35" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
                </svg>
              </motion.div>
              <div className={cn(
                "text-xs font-mono mt-3 transition-colors",
                activeStep.id === 'agents' ? "text-pink-400" : "text-slate-600"
              )}>
                {generatedAgents.length > 0 ? `${generatedAgents.length} agents` : '—'}
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Error Action Button */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8"
            >
              <Button 
                onClick={goBackToHome}
                className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 font-mono tracking-wider"
              >
                {t('generation.goBackAndRetry')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ Glass Terminal (Bottom) ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 100 }}
        className="fixed bottom-0 left-0 right-0 z-20 p-4"
      >
        <div className="max-w-2xl mx-auto rounded-t-2xl overflow-hidden backdrop-blur-2xl bg-slate-900/60 border border-slate-700/30 border-b-0 shadow-[0_-10px_60px_rgba(0,0,0,0.3)]">
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/30 bg-slate-800/30">
            <div className="flex gap-1.5">
              <div className="size-2.5 rounded-full bg-red-500/80" />
              <div className="size-2.5 rounded-full bg-yellow-500/80" />
              <div className="size-2.5 rounded-full bg-green-500/80" />
            </div>
            <span className="text-[10px] font-mono text-slate-500 ml-2 tracking-wider">agent_logs.terminal</span>
            <motion.div 
              className="ml-auto size-2 rounded-full bg-cyan-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </div>
          {/* Terminal content */}
          <div className="p-4 font-mono text-[11px] space-y-1.5 max-h-28 overflow-hidden">
            {terminalLogs.map((log, i) => (
              <motion.div
                key={`${log}-${i}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className={cn(
                  "tracking-wide",
                  log.includes('ERROR') && "text-red-400",
                  log.includes('COMPLETE') && "text-green-400",
                  log.includes('ACTIVE') && "text-cyan-400",
                  !log.includes('ERROR') && !log.includes('COMPLETE') && !log.includes('ACTIVE') && "text-slate-500",
                )}
              >
                {log}
              </motion.div>
            ))}
            <div className="flex items-center gap-1 text-cyan-400">
              <span className="text-slate-600">{'>'}</span>
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                █
              </motion.span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Agent Reveal Modal */}
      <AgentRevealModal
        agents={generatedAgents}
        open={showAgentReveal}
        onClose={() => setShowAgentReveal(false)}
        onAllRevealed={() => {
          agentRevealResolveRef.current?.();
          agentRevealResolveRef.current = null;
        }}
      />
    </div>
  );
}

export default function GenerationPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] w-full bg-[#050a15] flex items-center justify-center">
          <div className="text-cyan-400 font-mono text-sm tracking-wider animate-pulse">
            LOADING WORKBENCH...
          </div>
        </div>
      }
    >
      <GenerationPreviewContent />
    </Suspense>
  );
}
