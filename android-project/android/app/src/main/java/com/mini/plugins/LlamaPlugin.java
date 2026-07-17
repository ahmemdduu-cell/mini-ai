package com.mini.plugins;

import android.content.Context;
import android.app.DownloadManager;
import android.net.Uri;
import android.os.Environment;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LlamaPlugin")
public class LlamaPlugin extends Plugin {
    
    static { System.loadLibrary("llama-android"); }
    
    private static native long load_model(String filename);
    private static native long new_context(long model);
    private static native void free_model(long model);
    private static native void free_context(long context);
    private static native long new_batch(int nTokens, int embd, int nSeqMax);
    private static native long new_sampler();
    private static native void free_batch(long batch);
    private static native void free_sampler(long sampler);
    private static native int completion_init(long ctx, long batch, String text, boolean chat, int nLen);
    private static native String completion_loop(long ctx, long batch, long sampler, int nLen, int[] ncur);
    private static native void kv_cache_clear(long ctx);
    private static native void log_to_android();
    private static native String system_info();
    
    private long modelPtr = 0, ctxPtr = 0, batchPtr = 0, samplerPtr = 0;
    
    @PluginMethod
    public void loadModel(PluginCall call) {
        String path = call.getString("modelPath", "");
        new Thread(() -> {
            try {
                log_to_android();
                modelPtr = load_model(path);
                if (modelPtr == 0) { call.reject("Model yüklenemedi"); return; }
                ctxPtr = new_context(modelPtr);
                if (ctxPtr == 0) { call.reject("Context oluşturulamadı"); return; }
                batchPtr = new_batch(512, 0, 1);
                samplerPtr = new_sampler();
                JSObject r = new JSObject();
                r.put("success", true);
                r.put("info", system_info());
                call.resolve(r);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }
    
    @PluginMethod
    public void generate(PluginCall call) {
        String prompt = call.getString("prompt", "");
        boolean chat = call.getBoolean("formatChat", false);
        if (ctxPtr == 0) { call.reject("Model yüklenmemiş"); return; }
        new Thread(() -> {
            try {
                int[] ncur = new int[]{completion_init(ctxPtr, batchPtr, prompt, chat, 256)};
                StringBuilder sb = new StringBuilder();
                while (ncur[0] <= 256) {
                    String token = completion_loop(ctxPtr, batchPtr, samplerPtr, 256, ncur);
                    if (token == null) break;
                    sb.append(token);
                }
                kv_cache_clear(ctxPtr);
                JSObject r = new JSObject();
                r.put("text", sb.toString());
                call.resolve(r);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }
    
    @PluginMethod
    public void unloadModel(PluginCall call) {
        if (ctxPtr != 0) { free_context(ctxPtr); free_model(modelPtr); free_batch(batchPtr); free_sampler(samplerPtr); }
        modelPtr = ctxPtr = batchPtr = samplerPtr = 0;
        call.resolve();
    }
    
    @PluginMethod
    public void downloadModel(PluginCall call) {
        String url = call.getString("url", "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q6_K_L.gguf");
        String fileName = url.substring(url.lastIndexOf('/') + 1);
        
        DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url))
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, fileName)
            .setTitle(fileName);
        
        DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        long downloadId = dm.enqueue(req);
        
        JSObject r = new JSObject();
        r.put("downloadId", downloadId);
        r.put("fileName", fileName);
        call.resolve(r);
    }
}
