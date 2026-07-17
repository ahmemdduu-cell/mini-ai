package com.mini.plugins.AiEngine;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/**
 * AiEnginePlugin — Online Kod Çalıştırma Köprüsü
 *
 * Desteklenen diller: python-3.14, nodejs-22, cpp-17, java-21, c-17, php-8, ruby-3, go-1.23
 * Çevrimiçi kompilasyon servisi kullanır — internet gerektirir.
 *
 * JavaScript kullanımı:
 *   const { output } = await AiEngine.runCode({
 *     code: "print('Merhaba Dünya')",
 *     language: "python-3.14",
 *     input: ""           // stdin (isteğe bağlı)
 *   });
 */
@CapacitorPlugin(name = "AiEngine")
public class AiEnginePlugin extends Plugin {

    private static final String API_URL = "https://api.onlinecompiler.io/api/run-code-sync/";
    private static final String API_KEY = "54a81b482603efeb0fdbf7ce5784e330";
    private static final int    TIMEOUT = 30_000; // 30 saniye

    @PluginMethod
    public void runCode(PluginCall call) {
        String code     = call.getString("code",     "print('hello')");
        String language = call.getString("language", "python-3.14");
        String input    = call.getString("input",    "");

        new Thread(() -> {
            try {
                // ── JSON body oluştur ──────────────────────────────────────
                JSONObject body = new JSONObject();
                body.put("compiler", language);
                body.put("code",     code);
                body.put("input",    input);
                byte[] bodyBytes = body.toString().getBytes(StandardCharsets.UTF_8);

                // ── HTTP POST ──────────────────────────────────────────────
                URL url = new URL(API_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Authorization", API_KEY);
                conn.setRequestProperty("Content-Type",  "application/json; charset=utf-8");
                conn.setRequestProperty("Accept",        "application/json");
                conn.setConnectTimeout(TIMEOUT);
                conn.setReadTimeout(TIMEOUT);
                conn.setDoOutput(true);
                conn.getOutputStream().write(bodyBytes);

                // ── Yanıtı oku ─────────────────────────────────────────────
                int statusCode = conn.getResponseCode();
                BufferedReader reader = new BufferedReader(new InputStreamReader(
                    statusCode >= 400 ? conn.getErrorStream() : conn.getInputStream(),
                    StandardCharsets.UTF_8
                ));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();

                String raw = sb.toString();

                // ── Yanıtı parse et ────────────────────────────────────────
                String output;
                try {
                    JSONObject resp = new JSONObject(raw);
                    if (resp.has("output"))       output = resp.getString("output");
                    else if (resp.has("error"))   output = "Hata: " + resp.getString("error");
                    else if (resp.has("stderr"))  output = "Stderr: " + resp.getString("stderr");
                    else                          output = raw;
                } catch (Exception parseEx) {
                    output = raw; // ham metin döndür
                }

                JSObject res = new JSObject();
                res.put("output",     output);
                res.put("statusCode", statusCode);
                res.put("language",   language);
                call.resolve(res);

            } catch (java.net.SocketTimeoutException e) {
                JSObject err = new JSObject();
                err.put("output", "Zaman aşımı: Sunucu yanıt vermedi (30s). İnternet bağlantını kontrol et.");
                call.resolve(err);
            } catch (java.net.UnknownHostException e) {
                JSObject err = new JSObject();
                err.put("output", "İnternet bağlantısı yok. Online kod çalıştırma için internet gereklidir.");
                call.resolve(err);
            } catch (Exception e) {
                JSObject err = new JSObject();
                err.put("output", "API Hatası: " + e.getMessage());
                call.resolve(err);
            }
        }).start();
    }

    // ── Desteklenen diller listesi ────────────────────────────────────────────
    @PluginMethod
    public void getSupportedLanguages(PluginCall call) {
        JSObject r = new JSObject();
        String[] langs = {
            "python-3.14", "nodejs-22", "cpp-17", "c-17",
            "java-21", "php-8.3", "ruby-3.3", "go-1.23",
            "rust-1.79", "kotlin-2.0", "swift-5.10", "bash-5"
        };
        org.json.JSONArray arr = new org.json.JSONArray();
        for (String l : langs) arr.put(l);
        r.put("languages", arr.toString());
        call.resolve(r);
    }
}
