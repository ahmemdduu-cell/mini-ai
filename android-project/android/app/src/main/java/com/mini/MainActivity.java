package com.mini;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.mini.plugins.LlamaPlugin;
import com.mini.plugins.AiEngine.AiEnginePlugin;
import com.mini.plugins.SystemAnalyzer.SystemAnalyzerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LlamaPlugin.class);
        registerPlugin(AiEnginePlugin.class);
        registerPlugin(SystemAnalyzerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
