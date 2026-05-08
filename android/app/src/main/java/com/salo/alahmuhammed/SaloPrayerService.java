package com.salo.alahmuhammed;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.content.pm.ServiceInfo;
import androidx.core.app.NotificationCompat;

public class SaloPrayerService extends Service {
    private BroadcastReceiver screenReceiver;
    private Handler timerHandler = new Handler(Looper.getMainLooper());
    private Handler unlockHandler = new Handler(Looper.getMainLooper());
    private final long ONE_HOUR_MS = 3600000;
    private boolean skipNextPopup = true;
    private boolean isReceiverRegistered = false;

    private void checkAndRegisterReceiver() {
        if (!isReceiverRegistered && screenReceiver != null) {
            IntentFilter filter = new IntentFilter();
            filter.addAction(Intent.ACTION_USER_PRESENT);
            filter.addAction(Intent.ACTION_SCREEN_OFF);
            filter.addAction(Intent.ACTION_USER_UNLOCKED);
            registerReceiver(screenReceiver, filter);
            isReceiverRegistered = true;
        }
    }

    private void unregisterScreenReceiver() {
        if (isReceiverRegistered && screenReceiver != null) {
            try {
                unregisterReceiver(screenReceiver);
            } catch (Exception e) {}
            isReceiverRegistered = false;
        }
    }

    private Runnable timerRunnable = new Runnable() {
        @Override
        public void run() {
            OverlayHelper.showOverlay(SaloPrayerService.this);
            timerHandler.postDelayed(this, ONE_HOUR_MS);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    "unlock_channel",
                    "Unlock Service Channel",
                    NotificationManager.IMPORTANCE_MIN
            );
            channel.setSound(null, null);
            channel.enableVibration(false);
            channel.setShowBadge(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }

        Notification notification = new NotificationCompat.Builder(this, "unlock_channel")
                .setContentTitle("")
                .setContentText("")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(1, notification);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_USER_PRESENT);
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        filter.addAction(Intent.ACTION_USER_UNLOCKED);
        
        screenReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (Intent.ACTION_USER_PRESENT.equals(intent.getAction())) {
                    // Debounce rapidly fired system broadcasts and fire instantly
                    unlockHandler.removeCallbacksAndMessages(null);
                    unlockHandler.post(() -> {
                        try {
                            android.content.SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                            boolean reducePopupFrequency = Boolean.parseBoolean(prefs.getString("reducePopupFrequency", "false"));
                            
                            if (reducePopupFrequency) {
                                if (skipNextPopup) {
                                    skipNextPopup = false;
                                } else {
                                    skipNextPopup = true;
                                    showOverlayWithCooldown(context);
                                }
                            } else {
                                showOverlayWithCooldown(context);
                            }
                        } catch (Exception e) {
                            android.util.Log.e("SaloPrayerService", "Error showing overlay on unlock", e);
                        }
                    });
                } else if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
                    unlockHandler.removeCallbacksAndMessages(null);
                    stopTimer();
                }
            }
        };

        android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        long pauseUntil = 0;
        try {
            pauseUntil = Long.parseLong(prefs.getString("pauseUntil", "0"));
        } catch (NumberFormatException e) {
            e.printStackTrace();
        }
        if (System.currentTimeMillis() >= pauseUntil) {
            checkAndRegisterReceiver();
        }
        
        // resetTimer reads SharedPreferences which may not be available
        // during Direct Boot (LOCKED_BOOT_COMPLETED). Safe to skip — the
        // first USER_PRESENT unlock will trigger resetTimer via the receiver.
        try {
            resetTimer();
        } catch (Exception e) {
            android.util.Log.w("SaloPrayerService", "resetTimer skipped (Direct Boot)", e);
        }
    }

    private void resetTimer() {
        timerHandler.removeCallbacks(timerRunnable);
        
        android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        boolean isTimerEnabled = Boolean.parseBoolean(prefs.getString("enable_active_timer", "true"));
        
        if (isTimerEnabled) {
            timerHandler.postDelayed(timerRunnable, ONE_HOUR_MS);
        }
    }

    private void stopTimer() {
        timerHandler.removeCallbacks(timerRunnable);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    "unlock_channel",
                    "Unlock Service Channel",
                    NotificationManager.IMPORTANCE_MIN
            );
            channel.setDescription("Shows listening status for screen unlocks");
            channel.setShowBadge(false);
            channel.setSound(null, null);
            channel.enableVibration(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private long lastShownTime = 0;
    private static final long COOLDOWN_MS = 10000; // 10 seconds

    private void showOverlayWithCooldown(Context context) {
        long currentTime = System.currentTimeMillis();
        if (currentTime - lastShownTime > COOLDOWN_MS) {
            lastShownTime = currentTime;
            OverlayHelper.showOverlay(context);
            resetTimer();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("com.salo.alahmuhammed.PAUSE_SERVICE".equals(action)) {
                unregisterScreenReceiver();
            } else if ("com.salo.alahmuhammed.RESUME_SERVICE".equals(action)) {
                android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                prefs.edit().putString("pauseUntil", "0").apply();
                checkAndRegisterReceiver();
            } else {
                android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                long pauseUntil = 0;
                try {
                    pauseUntil = Long.parseLong(prefs.getString("pauseUntil", "0"));
                } catch (NumberFormatException e) {
                    e.printStackTrace();
                }
                if (System.currentTimeMillis() >= pauseUntil) {
                    checkAndRegisterReceiver();
                } else {
                    unregisterScreenReceiver(); // Just in case
                }
            }
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopTimer();
        unregisterScreenReceiver();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        
        Intent restartIntent = new Intent(getApplicationContext(), BootReceiver.class);
        restartIntent.setAction("com.salo.alahmuhammed.RESTART_SERVICE");
        
        PendingIntent restartPendingIntent;
        int flags = PendingIntent.FLAG_ONE_SHOT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        restartPendingIntent = PendingIntent.getBroadcast(getApplicationContext(), 1, restartIntent, flags);
        
        AlarmManager alarmManager = (AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.set(
                    AlarmManager.ELAPSED_REALTIME,
                    SystemClock.elapsedRealtime() + 1000,
                    restartPendingIntent
            );
        }
    }
}
