package com.salo.alahmoha;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            Intent.ACTION_USER_PRESENT.equals(action) ||
            "com.salo.alahmoha.RESTART_SERVICE".equals(action)) {
            
            android.util.Log.d("BootReceiver", "Reviving service on action: " + action);
            Intent serviceIntent = new Intent(context, SaloPrayerService.class);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
