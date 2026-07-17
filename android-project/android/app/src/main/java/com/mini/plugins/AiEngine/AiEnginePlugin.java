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

@CapacitorPlugin(name = "AiEngine")
public class AiEnginePlugin extends Plugin {

    @PluginMethod
    public void runCode(PluginCall call) {
        String code = call.getString("code", "print('hello')");
        String lang = call.getString("language", "python-3.14");
        
        new Thread(() -> {
            try {
                URL url = new URL("https://api.onlinecompiler.io/api/run-code-sync/");
                HttpURLConnection c = (HttpURLConnection) url.openConnection();
                c.setRequestMethod("POST");
                c.setRequestProperty("Authorization", "54a81b482603efeb0fdbf7ce5784e330");
                c.setRequestProperty("Content-Type", "application/json");
                c.setDoOutput(true);
                
                String json = "{\"compiler\":\"" + lang + "\",\"code\":\"" + 
                    code.replace("\\", "\\\\").replace("\"", "\\\"") + "\",\"input\":\"\"}";
                c.getOutputStream().write(json.getBytes());
                
                BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream()));
                StringBuilder sb = new StringBuilder(); String l;
                while ((l = r.readLine()) != null) sb.append(l);
                r.close();
                
                JSObject res = new JSObject();
                res.put("output", sb.toString());
                call.resolve(res);
            } catch (Exception e) {
                JSObject res = new JSObject();
                res.put("output", "{\"error\":\"" + e.getMessage() + "\"}");
                call.resolve(res);
            }
        }).start();
    }
}
