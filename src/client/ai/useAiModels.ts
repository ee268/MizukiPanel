import { useEffect, useRef, useState } from "react";
import { api, json } from "../api";
import { useAiCredential, useAiVaultState } from "./useAiCredential";
import type { AiModel, AiWritingSettings } from "../../shared/ai-writing";
export function useAiModels(settings: AiWritingSettings) {
  const key = useAiCredential(settings.provider);
  const vault = useAiVaultState();
  const saved = vault.saved(settings.provider);
  const [models, setModels] = useState<AiModel[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    setModels([]);
    setError("");
    setLoading(false);
    request.current?.abort();
    request.current = null;
    return () => request.current?.abort();
  }, [settings.provider, settings.openaiBaseUrl, settings.anthropicBaseUrl, key, saved]);
  async function fetchModels() {
    if (request.current) return;
    if (!vault.available(settings.provider)) {
      setError("请先填写或保存 API Key。");
      return;
    }
    const abort = new AbortController();
    request.current = abort;
    setLoading(true);
    setError("");
    try {
      const result = await api<{ models: AiModel[] }>("/api/ai/models", {
        ...json("POST", {
          settings: {
            provider: settings.provider,
            openaiBaseUrl: settings.openaiBaseUrl,
            anthropicBaseUrl: settings.anthropicBaseUrl,
          },
          apiKey: key,
          useSavedKey: !key && saved,
        }),
        signal: abort.signal,
      });
      if (!abort.signal.aborted) {
        setModels(result.models);
        if (!result.models.length) setError("上游未返回模型，可手动添加模型 ID。");
        return result.models;
      }
    } catch (cause) {
      if (!abort.signal.aborted)
        setError(cause instanceof Error ? cause.message : "获取模型失败，可手动添加模型 ID。");
    } finally {
      if (request.current === abort) {
        request.current = null;
        setLoading(false);
      }
    }
  }
  return { models, loading, error, fetchModels };
}
