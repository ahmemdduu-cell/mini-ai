# .so Dosyaları Kurulum Rehberi

## Dosyaları şu klasöre koy:

```
android/
└── app/
    └── src/
        └── main/
            └── jniLibs/
                └── arm64-v8a/
                    ├── libllama-android.so   ← LlamaPlugin bunu yükler
                    ├── libllama.so
                    ├── libggml.so
                    ├── libggml-base.so
                    ├── libggml-cpu.so
                    └── libomp.so
```

## app/build.gradle'a ekle:

```gradle
android {
    sourceSets {
        main {
            jniLibs.srcDirs = ['src/main/jniLibs']
        }
    }
    packagingOptions {
        jniLibs {
            useLegacyPackaging = true
        }
    }
}
```

## MainActivity.java'ya plugin kayıtları:

```java
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
```

## Plugin çağrı akışı (Index.tsx içinde):

### Açılışta sistem analizi:
```js
const info = await SystemAnalyzer.getSystemInfo();
const rec  = await SystemAnalyzer.getModelRecommendation();
// → rec.recommendedSize: "4B", rec.reason: "RAM 6GB — 4B önerilir"
```

### Offline model indirme:
```js
const { downloadId, fileName } = await LlamaPlugin.downloadModel({ url: "https://..." });
// Düzenli olarak durumu kontrol et:
const { status, progress } = await LlamaPlugin.getDownloadStatus({ downloadId });
// status: "running" | "successful" | "failed"
```

### Model yükleme ve çalıştırma:
```js
const { success, info } = await LlamaPlugin.loadModel({ modelPath: "/path/to/model.gguf" });
const { text } = await LlamaPlugin.generate({ prompt: "Merhaba!", formatChat: true });
```

### Online kod çalıştırma:
```js
const { output } = await AiEngine.runCode({ code: "print('hello')", language: "python-3.14" });
```
