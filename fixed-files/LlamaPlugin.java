package com.mini.plugins;

import android.content.Context;
import android.app.DownloadManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * LlamaPlugin — llama.cpp Native Bridge for Capacitor
 *
 * Gerekli .so dosyaları (arm64-v8a):
 *   - libllama-android.so   (System.loadLibrary("llama-android") bunu yükler)
 *   - libllama.so
 *   - libggml.so
 *   - libggml-base.so
 *   - libggml-cpu.so
 *   - libomp.so
 *
 * Bunları android/app/src/main/jniLibs/arm64-v8a/ klasörüne koy.
 */
@CapacitorPlugin(name = "LlamaPlugin")
public class LlamaPlugin extends Plugin {

    // ── Native library yükle ─────────────────────────────────────────────────
    static {
        try {
            System.loadLibrary("llama-android");
        } catch (UnsatisfiedLinkError e) {
            android.util.Log.e("LlamaPlugin", "libllama-android.so yüklenemedi: " + e.getMessage());
        }
    }

    // ── JNI Native metotlar ──────────────────────────────────────────────────
    private static native long  load_model(String filename);
    private static native long  new_context(long model);
    private static native void  free_model(long model);
    private static native void  free_context(long context);
    private static native long  new_batch(int nTokens, int embd, int nSeqMax);
    private static native long  new_sampler();
    private static native void  free_batch(long batch);
    private static native void  free_sampler(long sampler);
    private static native int   completion_init(long ctx, long batch, String text, boolean chat, int nLen);
    private static native String completion_loop(long ctx, long batch, long sampler, int nLen, int[] ncur);
    private static native void  kv_cache_clear(long ctx);
    private static native void  log_to_android();
    private static native String system_info();

    // ── State ────────────────────────────────────────────────────────────────
    private long modelPtr    = 0;
    private long ctxPtr      = 0;
    private long batchPtr    = 0;
    private long samplerPtr  = 0;
    private String loadedModelPath = "";

    // ── loadModel ────────────────────────────────────────────────────────────
    /**
     * JavaScript çağrısı:
     *   await LlamaPlugin.loadModel({ modelPath: "/storage/.../model.gguf" });
     *   → { success: true, info: "llama version..." }
     */
    @PluginMethod
    public void loadModel(PluginCall call) {
        String path = call.getString("modelPath", "");
        if (path.isEmpty()) { call.reject("modelPath boş olamaz"); return; }

        new Thread(() -> {
            try {
                // Önceki model varsa temizle
                if (modelPtr != 0) {
                    free_context(ctxPtr);
                    free_model(modelPtr);
                    free_batch(batchPtr);
                    free_sampler(samplerPtr);
                    modelPtr = ctxPtr = batchPtr = samplerPtr = 0;
                }

                log_to_android();

                modelPtr = load_model(path);
                if (modelPtr == 0) {
                    call.reject("Model yüklenemedi: dosya bozuk veya desteklenmiyor — " + path);
                    return;
                }

                ctxPtr = new_context(modelPtr);
                if (ctxPtr == 0) {
                    free_model(modelPtr); modelPtr = 0;
                    call.reject("Inference context oluşturulamadı — yetersiz RAM olabilir");
                    return;
                }

                batchPtr   = new_batch(512, 0, 1);
                samplerPtr = new_sampler();
                loadedModelPath = path;

                JSObject r = new JSObject();
                r.put("success", true);
                r.put("info", system_info());
                call.resolve(r);
            } catch (UnsatisfiedLinkError e) {
                call.reject("Native kütüphane bulunamadı (libllama-android.so): " + e.getMessage());
            } catch (Exception e) {
                call.reject("loadModel hatası: " + e.getMessage());
            }
        }).start();
    }

    // ── generate ─────────────────────────────────────────────────────────────
    /**
     * JavaScript çağrısı:
     *   await LlamaPlugin.generate({ prompt: "Merhaba", formatChat: true });
     *   → { text: "Merhaba! Nasıl yardımcı olabilirim?" }
     *
     * formatChat: true → <|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n
     */
    @PluginMethod
    public void generate(PluginCall call) {
        String prompt    = call.getString("prompt", "");
        boolean chat     = Boolean.TRUE.equals(call.getBoolean("formatChat", true));
        int maxLen       = call.getInt("maxTokens", 512);

        if (ctxPtr == 0 || modelPtr == 0) {
            call.reject("Model yüklenmemiş — önce loadModel() çağır");
            return;
        }

        // Chat format (ChatML)
        String formattedPrompt = chat
            ? "<|im_start|>user\n" + prompt + "<|im_end|>\n<|im_start|>assistant\n"
            : prompt;

        new Thread(() -> {
            try {
                kv_cache_clear(ctxPtr);
                int[] ncur = new int[]{ completion_init(ctxPtr, batchPtr, formattedPrompt, false, maxLen) };
                StringBuilder sb = new StringBuilder();

                while (ncur[0] <= maxLen) {
                    String token = completion_loop(ctxPtr, batchPtr, samplerPtr, maxLen, ncur);
                    if (token == null) break;
                    // ChatML stop token
                    if (token.contains("<|im_end|>") || token.contains("<|endoftext|>")) break;
                    sb.append(token);
                }

                kv_cache_clear(ctxPtr);

                JSObject r = new JSObject();
                r.put("text", sb.toString().trim());
                call.resolve(r);
            } catch (Exception e) {
                call.reject("generate hatası: " + e.getMessage());
            }
        }).start();
    }

    // ── unloadModel ──────────────────────────────────────────────────────────
    /**
     * Modeli bellekten temizle.
     * JavaScript: await LlamaPlugin.unloadModel();
     */
    @PluginMethod
    public void unloadModel(PluginCall call) {
        if (ctxPtr != 0) {
            free_context(ctxPtr);
            free_batch(batchPtr);
            free_sampler(samplerPtr);
        }
        if (modelPtr != 0) {
            free_model(modelPtr);
        }
        modelPtr = ctxPtr = batchPtr = samplerPtr = 0;
        loadedModelPath = "";
        call.resolve();
    }

    // ── downloadModel ────────────────────────────────────────────────────────
    /**
     * HuggingFace'den GGUF modelini indir.
     * JavaScript:
     *   const { downloadId, fileName } = await LlamaPlugin.downloadModel({ url: "https://..." });
     *
     * İndirme durumu sistem bildirimiyle gösterilir.
     * Dosya: /storage/emulated/0/Android/data/<packageName>/files/Downloads/<fileName>
     */
    @PluginMethod
    public void downloadModel(PluginCall call) {
        String url = call.getString("url", "");
        if (url.isEmpty()) { call.reject("url boş olamaz"); return; }

        String fileName = url.substring(url.lastIndexOf('/') + 1);
        // Parametreleri temizle (örn. ?download=true)
        if (fileName.contains("?")) fileName = fileName.substring(0, fileName.indexOf('?'));

        try {
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url))
                .setTitle("Mini AI — " + fileName)
                .setDescription("AI modeli indiriliyor...")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, fileName)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(true);

            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            long downloadId = dm.enqueue(req);

            JSObject r = new JSObject();
            r.put("downloadId", downloadId);
            r.put("fileName", fileName);
            r.put("destinationDir", getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS).getAbsolutePath());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("İndirme başlatılamadı: " + e.getMessage());
        }
    }

    // ── getDownloadStatus ────────────────────────────────────────────────────
    /**
     * İndirme durumunu sorgula.
     * JavaScript:
     *   const { status, progress, reason } = await LlamaPlugin.getDownloadStatus({ downloadId: 123 });
     *   status: "running" | "paused" | "successful" | "failed" | "pending" | "unknown"
     */
    @PluginMethod
    public void getDownloadStatus(PluginCall call) {
        long downloadId = call.getLong("downloadId", -1L);
        if (downloadId == -1) { call.reject("downloadId gerekli"); return; }

        try {
            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Query q = new DownloadManager.Query().setFilterById(downloadId);
            Cursor cursor = dm.query(q);

            JSObject r = new JSObject();
            if (cursor != null && cursor.moveToFirst()) {
                int statusCol   = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                int reasonCol   = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);
                int totalCol    = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
                int downloadCol = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);

                int    status      = statusCol   >= 0 ? cursor.getInt(statusCol)  : -1;
                int    reason      = reasonCol   >= 0 ? cursor.getInt(reasonCol)  : 0;
                long   total       = totalCol    >= 0 ? cursor.getLong(totalCol)  : -1;
                long   downloaded  = downloadCol >= 0 ? cursor.getLong(downloadCol) : 0;
                int    progress    = (total > 0) ? (int)(downloaded * 100 / total) : 0;

                String statusStr;
                switch (status) {
                    case DownloadManager.STATUS_RUNNING:    statusStr = "running";     break;
                    case DownloadManager.STATUS_PAUSED:     statusStr = "paused";      break;
                    case DownloadManager.STATUS_SUCCESSFUL: statusStr = "successful";  break;
                    case DownloadManager.STATUS_FAILED:     statusStr = "failed";      break;
                    case DownloadManager.STATUS_PENDING:    statusStr = "pending";     break;
                    default:                                statusStr = "unknown";     break;
                }

                r.put("status",     statusStr);
                r.put("progress",   progress);
                r.put("downloaded", downloaded);
                r.put("total",      total);
                r.put("reason",     reason);
                cursor.close();
            } else {
                r.put("status", "unknown");
                r.put("progress", 0);
            }
            call.resolve(r);
        } catch (Exception e) {
            call.reject("getDownloadStatus hatası: " + e.getMessage());
        }
    }

    // ── isModelLoaded ────────────────────────────────────────────────────────
    /**
     * Model yüklü mü?
     * JavaScript: const { loaded, modelPath } = await LlamaPlugin.isModelLoaded();
     */
    @PluginMethod
    public void isModelLoaded(PluginCall call) {
        JSObject r = new JSObject();
        r.put("loaded", modelPtr != 0 && ctxPtr != 0);
        r.put("modelPath", loadedModelPath);
        call.resolve(r);
    }

    // ── systemInfo ───────────────────────────────────────────────────────────
    /**
     * llama.cpp sistem bilgilerini döndür.
     * JavaScript: const { info } = await LlamaPlugin.systemInfo();
     */
    @PluginMethod
    public void systemInfo(PluginCall call) {
        try {
            JSObject r = new JSObject();
            r.put("info", system_info());
            call.resolve(r);
        } catch (UnsatisfiedLinkError e) {
            call.reject("Native lib yüklenmemiş: " + e.getMessage());
        }
    }
}
