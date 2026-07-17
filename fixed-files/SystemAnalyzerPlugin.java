package com.mini.plugins.SystemAnalyzer;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.app.ActivityManager;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * SystemAnalyzerPlugin — Cihaz Analizi ve Yapay Zeka Model Önerisi
 *
 * JavaScript örneği:
 *   const info = await SystemAnalyzer.getSystemInfo();
 *   const rec  = await SystemAnalyzer.getModelRecommendation();
 */
@CapacitorPlugin(name = "SystemAnalyzer")
public class SystemAnalyzerPlugin extends Plugin {

    private static final String PREFS_NAME  = "mini_prefs";
    private static final String AUTH_KEY    = "mini_auth";
    private static final String CHANNEL_ID  = "mini_channel";

    // ── Auth ──────────────────────────────────────────────────────────────────

    @PluginMethod
    public void saveAuth(PluginCall call) {
        String email = call.getString("email", "");
        getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(AUTH_KEY, email).apply();
        JSObject r = new JSObject();
        r.put("saved", true);
        call.resolve(r);
    }

    @PluginMethod
    public void getAuth(PluginCall call) {
        String email = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(AUTH_KEY, null);
        JSObject r = new JSObject();
        r.put("email", email);
        r.put("hasAuth", email != null);
        call.resolve(r);
    }

    @PluginMethod
    public void clearAuth(PluginCall call) {
        getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().remove(AUTH_KEY).apply();
        call.resolve();
    }

    // ── Ses / Bildirim ────────────────────────────────────────────────────────

    @PluginMethod
    public void beep(PluginCall call) {
        try {
            ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100);
            tg.startTone(ToneGenerator.TONE_PROP_ACK, 200);
            new android.os.Handler(android.os.Looper.getMainLooper())
                .postDelayed(tg::release, 300);
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void showNotification(PluginCall call) {
        String title = call.getString("title", "Mini AI");
        String body  = call.getString("body", "");
        try {
            NotificationManager nm = (NotificationManager)
                getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Mini AI Bildirimleri", NotificationManager.IMPORTANCE_HIGH);
                nm.createNotificationChannel(ch);
            }
            NotificationCompat.Builder nb = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);
            nm.notify((int) System.currentTimeMillis(), nb.build());
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        // Android 13+ (API 33) için POST_NOTIFICATIONS runtime izni gerekir.
        // MainActivity'de ActivityCompat.requestPermissions ile istenmeli.
        call.resolve();
    }

    // ── Sistem Analizi ────────────────────────────────────────────────────────

    /**
     * Cihaz RAM, CPU, batarya ve depolama bilgilerini döndür.
     *
     * Dönüş:
     * {
     *   ram:     { totalMB, availableMB, usedMB },
     *   cpu:     { cores, arch, model },
     *   battery: { percent, isCharging },
     *   storage: { totalGB, freeGB },
     *   device:  { model, brand, androidVersion, sdkInt }
     * }
     */
    @PluginMethod
    public void getSystemInfo(PluginCall call) {
        Context ctx = getContext();
        JSObject result = new JSObject();

        // ── RAM ──
        ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mi);

        JSObject ram = new JSObject();
        long totalMB     = mi.totalMem     / (1024 * 1024);
        long availMB     = mi.availMem     / (1024 * 1024);
        ram.put("totalMB",     totalMB);
        ram.put("availableMB", availMB);
        ram.put("usedMB",      totalMB - availMB);
        result.put("ram", ram);

        // ── CPU ──
        JSObject cpu = new JSObject();
        cpu.put("cores", Runtime.getRuntime().availableProcessors());
        cpu.put("arch",  System.getProperty("os.arch", "unknown"));
        cpu.put("model", Build.HARDWARE);
        cpu.put("board", Build.BOARD);
        result.put("cpu", cpu);

        // ── Batarya ──
        IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
        Intent bs = ctx.registerReceiver(null, ifilter);
        JSObject battery = new JSObject();
        if (bs != null) {
            int level  = bs.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale  = bs.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            int status = bs.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            battery.put("percent",    level * 100.0f / scale);
            battery.put("isCharging", status == BatteryManager.BATTERY_STATUS_CHARGING
                                   || status == BatteryManager.BATTERY_STATUS_FULL);
        }
        result.put("battery", battery);

        // ── Depolama ──
        StatFs stat = new StatFs(Environment.getExternalStorageDirectory().getPath());
        long blockSize = stat.getBlockSizeLong();
        JSObject storage = new JSObject();
        storage.put("totalGB", stat.getBlockCountLong() * blockSize / (1024.0 * 1024 * 1024));
        storage.put("freeGB",  stat.getAvailableBlocksLong() * blockSize / (1024.0 * 1024 * 1024));
        result.put("storage", storage);

        // ── Cihaz ──
        JSObject device = new JSObject();
        device.put("model",          Build.MODEL);
        device.put("brand",          Build.BRAND);
        device.put("manufacturer",   Build.MANUFACTURER);
        device.put("androidVersion", Build.VERSION.RELEASE);
        device.put("sdkInt",         Build.VERSION.SDK_INT);
        result.put("device", device);

        call.resolve(result);
    }

    // ── Model Önerisi ─────────────────────────────────────────────────────────

    /**
     * Cihazın RAM'ine göre uygun GGUF model kategorisini öner.
     *
     * Dönüş:
     * {
     *   recommendedSize:  "3B" | "4B" | "7B" | "8B" | "13B",
     *   reason:           "RAM 3.8 GB — 3B/4B modeller önerilir",
     *   minRamGB:         4.0,
     *   maxRamGB:         6.0,
     *   canRun8B:         false,
     *   canRun13B:        false,
     *   warning:          "" | "RAM düşük, 3B model önerilir",
     *   suggestedModels:  ["Phi-4-mini-instruct", "Qwen2.5-Coder-3B"]
     * }
     */
    @PluginMethod
    public void getModelRecommendation(PluginCall call) {
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mi);

        double totalGB = mi.totalMem / (1024.0 * 1024 * 1024);
        double freeGB  = mi.availMem  / (1024.0 * 1024 * 1024);

        String recommendedSize;
        String reason;
        String warning = "";
        JSArray suggested = new JSArray();

        if (totalGB >= 12.0) {
            recommendedSize = "13B";
            reason = String.format("RAM %.1f GB — 13B modeller rahatça çalışır", totalGB);
            suggested.put("Guanaco-13B-Uncensored");
            suggested.put("Qwen3-14B-Claude");
        } else if (totalGB >= 8.0) {
            recommendedSize = "8B";
            reason = String.format("RAM %.1f GB — 7–8B modeller önerilir", totalGB);
            suggested.put("DeepSeek-R1-Qwen3-8B");
            suggested.put("Qwen2.5-Coder-7B");
            suggested.put("Lexi-Llama-3-8B-Uncensored");
        } else if (totalGB >= 5.5) {
            recommendedSize = "7B";
            reason = String.format("RAM %.1f GB — 7B modeller çalışabilir (yavaş olabilir)", totalGB);
            warning = "7B modeller yavaş çalışabilir; 4B tercih edilebilir.";
            suggested.put("Qwen2.5-Coder-7B");
            suggested.put("Jan-code-4b");
        } else if (totalGB >= 4.0) {
            recommendedSize = "4B";
            reason = String.format("RAM %.1f GB — 4B modeller idealdir", totalGB);
            suggested.put("Phi-4-mini-instruct");
            suggested.put("Jan-code-4b");
        } else {
            recommendedSize = "3B";
            reason = String.format("RAM %.1f GB — 3B modeller önerilir (sınırlı RAM)", totalGB);
            warning = "RAM düşük. Büyük modeller çalışmayabilir veya uygulamayı çökertebilir.";
            suggested.put("Qwen2.5-Coder-3B");
            suggested.put("Nidum-Llama-3.2-3B-Uncensored");
        }

        JSObject r = new JSObject();
        r.put("recommendedSize",  recommendedSize);
        r.put("reason",           reason);
        r.put("totalRamGB",       Math.round(totalGB * 10.0) / 10.0);
        r.put("freeRamGB",        Math.round(freeGB  * 10.0) / 10.0);
        r.put("canRun8B",         totalGB >= 8.0);
        r.put("canRun13B",        totalGB >= 12.0);
        r.put("warning",          warning);
        r.put("suggestedModels",  suggested);
        call.resolve(r);
    }

    // ── Depolama Kontrolü ─────────────────────────────────────────────────────

    /**
     * Belirli bir dosya indirmek için yeterli alan var mı?
     *
     * JavaScript: const { hasSpace, freeGB } = await SystemAnalyzer.checkStorageSpace({ requiredBytes: 5000000000 });
     */
    @PluginMethod
    public void checkStorageSpace(PluginCall call) {
        long required = call.getLong("requiredBytes", 0L);
        try {
            StatFs stat = new StatFs(
                getContext().getExternalFilesDir(null) != null
                    ? getContext().getExternalFilesDir(null).getAbsolutePath()
                    : Environment.getExternalStorageDirectory().getPath()
            );
            long free = stat.getAvailableBlocksLong() * stat.getBlockSizeLong();
            JSObject r = new JSObject();
            r.put("hasSpace", free >= required);
            r.put("freeBytes", free);
            r.put("freeGB", free / (1024.0 * 1024 * 1024));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Depolama kontrolü hatası: " + e.getMessage());
        }
    }

    // ── Model Dosyası Var Mı? ─────────────────────────────────────────────────

    /**
     * İndirilmiş model dosyasının var olup olmadığını kontrol et.
     *
     * JavaScript:
     *   const { exists, path } = await SystemAnalyzer.checkModelFile({ fileName: "model.gguf" });
     */
    @PluginMethod
    public void checkModelFile(PluginCall call) {
        String fileName = call.getString("fileName", "");
        try {
            java.io.File dir  = getContext().getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS);
            java.io.File file = new java.io.File(dir, fileName);
            JSObject r = new JSObject();
            r.put("exists",  file.exists() && file.length() > 0);
            r.put("path",    file.getAbsolutePath());
            r.put("sizeBytes", file.exists() ? file.length() : 0L);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("checkModelFile hatası: " + e.getMessage());
        }
    }
}
