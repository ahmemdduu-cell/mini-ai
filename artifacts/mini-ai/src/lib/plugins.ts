/**
 * Capacitor plugin bridges for Mini AI Android app.
 * Falls back gracefully in browser (dev preview).
 */
import { registerPlugin } from "@capacitor/core";

// ─── LlamaPlugin ──────────────────────────────────────────────
export interface LlamaPlugin {
  loadModel(options: { modelPath: string }): Promise<{ success: boolean; info: string }>;
  generate(options: { prompt: string; formatChat?: boolean }): Promise<{ text: string }>;
  unloadModel(): Promise<void>;
  downloadModel(options: { url: string }): Promise<{ downloadId: number; fileName: string }>;
}

export const Llama = registerPlugin<LlamaPlugin>("LlamaPlugin");

// ─── AiEnginePlugin ───────────────────────────────────────────
export interface AiEnginePlugin {
  runCode(options: { code: string; language?: string }): Promise<{ output: string }>;
}

export const AiEngine = registerPlugin<AiEnginePlugin>("AiEngine");

// ─── SystemAnalyzerPlugin ─────────────────────────────────────
export interface SystemAnalyzerPlugin {
  getSystemInfo(): Promise<{
    ram: { totalMB: number; availableMB: number; usedMB: number };
    cpu: { cores: number; arch: string; model: string };
    battery: { percent: number; isCharging: boolean };
    device: { model: string; brand: string; androidVersion: string };
  }>;
  saveAuth(options: { email: string }): Promise<{ saved: boolean }>;
  getAuth(): Promise<{ email: string | null; hasAuth: boolean }>;
  clearAuth(): Promise<void>;
  beep(): Promise<void>;
  showNotification(options: { title: string; body: string }): Promise<void>;
  requestNotificationPermission(): Promise<void>;
}

export const SystemAnalyzer = registerPlugin<SystemAnalyzerPlugin>("SystemAnalyzer");

// ─── Helpers ──────────────────────────────────────────────────

/** True only when running inside a real Capacitor native app */
export function isNative(): boolean {
  return typeof (window as any).Capacitor !== "undefined" &&
    (window as any).Capacitor.isNativePlatform?.() === true;
}

/** Get model download dir path on Android */
export function getModelDir(): string {
  return "/storage/emulated/0/Android/data/com.mini.app/files/Downloads/";
}
