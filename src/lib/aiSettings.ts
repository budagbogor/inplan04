// AI Settings Management for SumoPod
export interface AISettings {
  provider: string;
  model: string;
  apiKey: string;
}

export const SUMOPOD_BASE_URL = 'https://ai.sumopod.com/v1';

export const POPULAR_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Cost-Effective)', provider: 'OpenAI' },
  { id: 'gpt-4o', name: 'GPT-4o (High Intelligence)', provider: 'OpenAI' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'Anthropic' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek' },
  { id: 'gemini/gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google' },
  { id: 'gemini/gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro Exp', provider: 'Google' },
];

const STORAGE_KEY = 'mobeng_ai_settings';

export function getAISettings(): AISettings {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
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
