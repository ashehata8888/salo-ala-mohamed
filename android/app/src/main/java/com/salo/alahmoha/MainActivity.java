package com.salo.alahmoha;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.ExistingPeriodicWorkPolicy;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OverlayPlugin.class);
        super.onCreate(savedInstanceState);

        // ── Start foreground service ──────────────────────────────────────────
        Intent serviceIntent = new Intent(this, SaloPrayerService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }

        // ── Schedule service restarter worker ─────────────────────────────────
        PeriodicWorkRequest workRequest = new PeriodicWorkRequest.Builder(
                ServiceRestarterWorker.class, 15, TimeUnit.MINUTES)
                .build();
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "SaloPrayerServiceRestarter",
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest);
    }

    @Override
    public void onResume() {  // ← public, not protected
        super.onResume();
        injectLangIntoWebView();
    }

    private void injectLangIntoWebView() {
        try {
            // Capacitor Preferences stores keys under "CapacitorStorage" namespace
            SharedPreferences prefs = getSharedPreferences(
                    "CapacitorStorage", MODE_PRIVATE);
            String lang = prefs.getString("user_lang", "ar"); // default Arabic

            // Sanitize — only allow "ar" or "en" to prevent any injection
            if (!lang.equals("ar") && !lang.equals("en")) {
                lang = "ar";
            }

            String dir = lang.equals("ar") ? "rtl" : "ltr";

            String script =
                "localStorage.setItem('user_lang', '" + lang + "');" +
                "document.documentElement.setAttribute('dir', '" + dir + "');" +
                "document.documentElement.setAttribute('lang', '" + lang + "');";

            WebView webView = getBridge().getWebView();
            webView.evaluateJavascript(script, null);

        } catch (Exception e) {
            android.util.Log.w("MainActivity", "injectLangIntoWebView failed: " + e.getMessage());
        }
    }
}

