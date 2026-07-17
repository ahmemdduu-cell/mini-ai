export interface AIModel {
  name: string;
  repo_id: string;
  description: string;
  parameters: string;
  abilities: string[];
  gguf_file: string;
  gguf_size_bytes: number | null;
  download_url: string;
}

export const AI_MODELS: AIModel[] = [
  {
    name: "Nidum-Llama-3.2-3B-Uncensored-GGUF",
    repo_id: "VibeStudio/Nidum-Llama-3.2-3B-Uncensored-GGUF",
    description: "Text Generation • 3B • Updated Dec 17, 2024 • 6.67k • 37",
    parameters: "3B",
    abilities: ["uncensored"],
    gguf_file: "Nidum-Llama-3.2-3B-Uncensored-GGUF.gguf",
    gguf_size_bytes: 2019377632,
    download_url: "https://huggingface.co/VibeStudio/Nidum-Llama-3.2-3B-Uncensored-GGUF/resolve/main/model-Q4_K_M.gguf"
  },
  {
    name: "Qwen2.5-Coder-3B-Instruct-GGUF",
    repo_id: "Qwen/Qwen2.5-Coder-3B-Instruct-GGUF",
    description: "Text Generation • 3B • Updated Nov 11, 2024 • 33k • 61",
    parameters: "3B",
    abilities: ["text-generation", "code", "censored"],
    gguf_file: "qwen2.5-coder-3b-instruct-q4_k_m.gguf",
    gguf_size_bytes: 2104932800,
    download_url: "https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/qwen2.5-coder-3b-instruct-q4_k_m.gguf"
  },
  {
    name: "Jan-code-4b-gguf",
    repo_id: "janhq/Jan-code-4b-gguf",
    description: "Text Generation • 4B • Updated 8 days ago • 10.4k • 42",
    parameters: "4B",
    abilities: ["text-generation", "code", "censored"],
    gguf_file: "Jan-code-4b-Q4_K_M.gguf",
    gguf_size_bytes: 2716066656,
    download_url: "https://huggingface.co/janhq/Jan-code-4b-gguf/resolve/main/Jan-code-4b-Q4_K_M.gguf"
  },
  {
    name: "Phi-4-mini-instruct-GGUF",
    repo_id: "unsloth/Phi-4-mini-instruct-GGUF",
    description: "Text Generation • 4B • Updated Mar 3, 2025 • 19.7k • 78",
    parameters: "4B",
    abilities: ["text-generation", "censored"],
    gguf_file: "Phi-4-mini-instruct-Q4_K_M.gguf",
    gguf_size_bytes: 2491874272,
    download_url: "https://huggingface.co/unsloth/Phi-4-mini-instruct-GGUF/resolve/main/Phi-4-mini-instruct-Q4_K_M.gguf"
  },
  {
    name: "Qwen3-4B-Gemini-TripleX-High-Reasoning-Thinking-Heretic-Uncensored-GGUF",
    repo_id: "DavidAU/Qwen3-4B-Gemini-TripleX-High-Reasoning-Thinking-Heretic-Uncensored-GGUF",
    description: "Text Generation • 4B • Updated 29 days ago • 9.07k • 29",
    parameters: "4B",
    abilities: ["uncensored"],
    gguf_file: "Qwen3-4B-Gemini-TripleX-High-Reasoning-Thinking-Heretic-Uncensored.Q4_K_M.gguf",
    gguf_size_bytes: null,
    download_url: "https://huggingface.co/DavidAU/Qwen3-4B-Gemini-TripleX-High-Reasoning-Thinking-Heretic-Uncensored-GGUF/resolve/main/Qwen3-4B-Gemini-TripleX-High-Reasoning-Thinking-Heretic-Uncensored.Q4_K_M.gguf"
  },
  {
    name: "DeepSeek-R1-0528-Qwen3-8B-GGUF",
    repo_id: "unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF",
    description: "Text Generation • 8B • Updated Jun 16, 2025 • 103k • 389",
    parameters: "8B",
    abilities: ["text-generation", "reasoning", "censored"],
    gguf_file: "DeepSeek-R1-0528-Qwen3-8B-Q4_K_M.gguf",
    gguf_size_bytes: 5027785216,
    download_url: "https://huggingface.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF/resolve/main/DeepSeek-R1-0528-Qwen3-8B-Q4_K_M.gguf"
  },
  {
    name: "Qwen2.5-Coder-7B-Instruct-GGUF",
    repo_id: "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF",
    description: "Text Generation • 8B • Updated Nov 12, 2024 • 99.5k • 203",
    parameters: "8B",
    abilities: ["text-generation", "code", "censored"],
    gguf_file: "qwen2.5-coder-7b-instruct-q4_k_m-00001-of-00002.gguf",
    gguf_size_bytes: 3993201376,
    download_url: "https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m-00001-of-00002.gguf"
  },
  {
    name: "Qwen3-8B-GGUF",
    repo_id: "Qwen/Qwen3-8B-GGUF",
    description: "Text Generation • 8B • Updated May 21, 2025 • 80.2k • 160",
    parameters: "8B",
    abilities: ["text-generation", "censored"],
    gguf_file: "Qwen3-8B-Q4_K_M.gguf",
    gguf_size_bytes: 5027783488,
    download_url: "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf"
  },
  {
    name: "Lexi-Llama-3-8B-Uncensored-GGUF",
    repo_id: "bartowski/Lexi-Llama-3-8B-Uncensored-GGUF",
    description: "Text Generation • 8B • Updated Apr 24, 2024 • 16.4k • 50",
    parameters: "8B",
    abilities: ["uncensored"],
    gguf_file: "Lexi-Llama-3-8B-Uncensored-Q4_K_M.gguf",
    gguf_size_bytes: 4920733984,
    download_url: "https://huggingface.co/bartowski/Lexi-Llama-3-8B-Uncensored-GGUF/resolve/main/Lexi-Llama-3-8B-Uncensored-Q4_K_M.gguf"
  },
  {
    name: "Cybersecurity-BaronLLM_Offensive_Security_LLM_Q6_K_GGUF",
    repo_id: "AlicanKiraz0/Cybersecurity-BaronLLM_Offensive_Security_LLM_Q6_K_GGUF",
    description: "Text Generation • 8B • Updated Jun 4, 2025 • 603 • 144",
    parameters: "8B",
    abilities: ["text-generation", "cybersecurity", "offensive-security", "censored"],
    gguf_file: "Cybersecurity-BaronLLM_Offensive_Security_LLM.Q4_K_M.gguf",
    gguf_size_bytes: null,
    download_url: "https://huggingface.co/AlicanKiraz0/Cybersecurity-BaronLLM_Offensive_Security_LLM_Q6_K_GGUF/resolve/main/Cybersecurity-BaronLLM_Offensive_Security_LLM.Q4_K_M.gguf"
  },
  {
    name: "Qwen3.5-9B-Claude-4.6-Opus-Reasoning-Distilled-GGUF",
    repo_id: "Jackrong/Qwen3.5-9B-Claude-4.6-Opus-Reasoning-Distilled-GGUF",
    description: "Text Generation • 9B • Updated 5 days ago • 40.3k • 69",
    parameters: "9B",
    abilities: ["text-generation", "reasoning", "censored"],
    gguf_file: "Qwen3.5-9B.Q4_K_M.gguf",
    gguf_size_bytes: 5627040640,
    download_url: "https://huggingface.co/Jackrong/Qwen3.5-9B-Claude-4.6-Opus-Reasoning-Distilled-GGUF/resolve/main/Qwen3.5-9B.Q4_K_M.gguf"
  },
  {
    name: "Qwen3-14B-Claude-4.5-Opus-High-Reasoning-Distill-GGUF",
    repo_id: "TeichAI/Qwen3-14B-Claude-4.5-Opus-High-Reasoning-Distill-GGUF",
    description: "Text Generation • 15B • Updated 18 days ago • 101k • 289",
    parameters: "15B",
    abilities: ["text-generation", "reasoning", "censored"],
    gguf_file: "Qwen3-14B-Claude-4.5-Opus-Distill.q4_k_m.gguf",
    gguf_size_bytes: 9001754240,
    download_url: "https://huggingface.co/TeichAI/Qwen3-14B-Claude-4.5-Opus-High-Reasoning-Distill-GGUF/resolve/main/Qwen3-14B-Claude-4.5-Opus-Distill.q4_k_m.gguf"
  },
  {
    name: "Guanaco-13B-Uncensored-GGUF",
    repo_id: "TheBloke/Guanaco-13B-Uncensored-GGUF",
    description: "Text Generation • 13B • Updated Sep 27, 2023 • 1.04k • 43",
    parameters: "13B",
    abilities: ["uncensored"],
    gguf_file: "guanaco-13b-uncensored.Q4_K_M.gguf",
    gguf_size_bytes: 7865956288,
    download_url: "https://huggingface.co/TheBloke/Guanaco-13B-Uncensored-GGUF/resolve/main/guanaco-13b-uncensored.Q4_K_M.gguf"
  },
  {
    name: "gpt-oss-20b-GGUF",
    repo_id: "unsloth/gpt-oss-20b-GGUF",
    description: "Text Generation • 21B • Updated Dec 19, 2025 • 322k • 624",
    parameters: "21B",
    abilities: ["text-generation", "censored"],
    gguf_file: "gpt-oss-20b-Q4_K_M.gguf",
    gguf_size_bytes: 11624759488,
    download_url: "https://huggingface.co/unsloth/gpt-oss-20b-GGUF/resolve/main/gpt-oss-20b-Q4_K_M.gguf"
  },
];

/** Recommend a model based on available RAM */
export function recommendModel(ramMB: number): AIModel {
  if (ramMB >= 12000) return AI_MODELS.find(m => m.parameters === "8B")!;
  if (ramMB >= 6000)  return AI_MODELS.find(m => m.parameters === "4B")!;
  return AI_MODELS.find(m => m.parameters === "3B")!;
}

/** Format bytes to human-readable size */
export function formatBytes(bytes: number | null): string {
  if (!bytes) return "Bilinmiyor";
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(0)} MB`;
}
