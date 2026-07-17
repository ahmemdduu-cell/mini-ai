package com.mini.plugins.SystemAnalyzer;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.app.ActivityManager;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemAnalyzer")
public class SystemAnalyzerPlugin extends Plugin {

    private static final String PREFS_NAME = "mini_prefs";
    private static final String AUTH_KEY = "mini_auth";

    @PluginMethod
    public void saveAuth(PluginCall call) {
        String email = call.getString("email", "");
        getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(AUTH_KEY, email).apply();
        JSObject r = new JSObject(); r.put("saved", true); call.resolve(r);
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

    @PluginMethod
    public void beep(PluginCall call) {
        try {
            ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100);
            tg.startTone(ToneGenerator.TONE_PROP_ACK, 200);
            new android.os.Handler().postDelayed(() -> tg.release(), 300);
        } catch (Exception e) {}
        call.resolve();
    }

    @PluginMethod
    public void showNotification(PluginCall call) {
        String title = call.getString("title", "Mini AI");
        String body = call.getString("body", "");
        try {
            NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel ch = new NotificationChannel("mini_channel", "Mini Bildirimler", NotificationManager.IMPORTANCE_HIGH);
                nm.createNotificationChannel(ch);
            }
            NotificationCompat.Builder nb = new NotificationCompat.Builder(getContext(), "mini_channel")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);
            nm.notify((int) System.currentTimeMillis(), nb.build());
        } catch (Exception e) {}
        call.resolve();
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        // Android 13+ permission handled via ActivityCompat.requestPermissions in real integration
        call.resolve();
    }

    @PluginMethod
    public void getSystemInfo(PluginCall call) {
        JSObject result = new JSObject();
        Context ctx = getContext();
        
        ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mi);
        
        JSObject ram = new JSObject();
        ram.put("totalMB", mi.totalMem / (1024 * 1024));
        ram.put("availableMB", mi.availMem / (1024 * 1024));
        ram.put("usedMB", (mi.totalMem - mi.availMem) / (1024 * 1024));
        result.put("ram", ram);
        
        JSObject cpu = new JSObject();
        cpu.put("cores", Runtime.getRuntime().availableProcessors());
        cpu.put("arch", System.getProperty("os.arch"));
        cpu.put("model", Build.HARDWARE);
        result.put("cpu", cpu);
        
        IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
        Intent bs = ctx.registerReceiver(null, ifilter);
        JSObject battery = new JSObject();
        battery.put("percent", bs.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) * 100.0f / bs.getIntExtra(BatteryManager.EXTRA_SCALE, 100));
        battery.put("isCharging", bs.getIntExtra(BatteryManager.EXTRA_STATUS, -1) == BatteryManager.BATTERY_STATUS_CHARGING);
        result.put("battery", battery);
        
        JSObject device = new JSObject();
        device.put("model", Build.MODEL);
        device.put("brand", Build.BRAND);
        device.put("androidVersion", Build.VERSION.RELEASE);
        result.put("device", device);
        
        call.resolve(result);
    }
}
