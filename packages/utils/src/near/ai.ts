/** available chat model IDs with E2EE on near.ai API */
export const NEAR_AI_CHAT_MODEL_IDS = [
  'deepseek-ai/DeepSeek-V3.1',
  'openai/gpt-oss-120b',
  'Qwen/Qwen3-30B-A3B-Instruct-2507',
  'zai-org/GLM-4.6',
  'zai-org/GLM-4.7',
] as const;

/** available chat model IDs on near.ai API */
export type NearAIChatModelId = (typeof NEAR_AI_CHAT_MODEL_IDS)[number];

/** base URL for near.ai API, includes chat completions and attestation endpoints */
export const NEAR_AI_BASE_URL = 'https://cloud-api.near.ai/v1';

/** base URL for NVIDIA NRAS API */
export const NRAS_BASE_URL = 'https://nras.attestation.nvidia.com/v3';
