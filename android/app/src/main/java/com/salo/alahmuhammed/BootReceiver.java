package com.salo.alahmuhammed;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkManager;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_USER_UNLOCKED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.salo.alahmuhammed.RESTART_SERVICE".equals(action) ||
            "com.salo.alahmuhammed.RESUME_SERVICE".equals(action)) {

            // Try direct start first (fastest path)
            try {
                Intent serviceIntent = new Intent(context, SaloPrayerService.class);
                serviceIntent.putExtra("BOOT_TRIGGER", true);
                if ("com.salo.alahmuhammed.RESUME_SERVICE".equals(action)) {
                    serviceIntent.setAction("com.salo.alahmuhammed.RESUME_SERVICE");
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Exception e) {
                // Ignore — expedited worker below will handle it
            }

            // Also schedule an EXPEDITED worker as backup
            try {
                OneTimeWorkRequest workRequest = new OneTimeWorkRequest.Builder(
                        ServiceRestarterWorker.class)
                        .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                        .build();
                WorkManager.getInstance(context).enqueueUniqueWork(
                        "BootServiceStart",
                        ExistingWorkPolicy.REPLACE,
                        workRequest);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
