// AI Settings Management for SumoPod & OpenRouter
export interface AISettings {
  provider: 'SumoPod' | 'OpenRouter' | string;
  model: string;
  apiKey: string;
}

export const SUMOPOD_BASE_URL = 'https://ai.sumopod.com/v1';
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export const SUMOPOD_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Cost-Effective)', provider: 'OpenAI' },
  { id: 'gpt-4o', name: 'GPT-4o (High Intelligence)', provider: 'OpenAI' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'Anthropic' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek' },
  { id: 'gemini/gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google' },
  { id: 'gemini/gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro Exp', provider: 'Google' },
];

export const OPENROUTER_FREE_MODELS = [
  { id: 'openrouter/auto', name: 'Auto Switch (Free Models Router)', provider: 'OpenRouter' },
  { id: 'google/gemini-2.0-flash-lite-preview-02-05:free', name: 'Gemini 2.0 Flash Lite (Free)', provider: 'Google' },
  { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek V3 (Free)', provider: 'DeepSeek' },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B Instruct (Free)', provider: 'Meta' },
  { id: 'qwen/qwen-2-72b-instruct:free', name: 'Qwen 2 72B Instruct (Free)', provider: 'Qwen' },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)', provider: 'Mistral' },
];

const STORAGE_KEY = 'mobeng_ai_settings';

export function getAISettings(): AISettings {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Fallback for older format if provider field is missing
      if (!parsed.provider) {
        parsed.provider = 'SumoPod';
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse AI settings', e);
    }
  }
  return {
    provider: 'SumoPod',
    model: 'gpt-4o-mini',
    apiKey: '',
  };
}

export function saveAISettings(settings: AISettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
