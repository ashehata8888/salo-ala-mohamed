package com.salo.alahmoha;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
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
        
        Intent serviceIntent = new Intent(this, SaloPrayerService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }

        PeriodicWorkRequest workRequest = new PeriodicWorkRequest.Builder(
                ServiceRestarterWorker.class, 15, TimeUnit.MINUTES)
                .build();
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "SaloPrayerServiceRestarter",
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest);
    }
}
