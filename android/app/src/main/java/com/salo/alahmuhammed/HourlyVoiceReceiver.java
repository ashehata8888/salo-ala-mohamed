package com.salo.alahmuhammed;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.util.Log;

import java.util.Calendar;

public class HourlyVoiceReceiver extends BroadcastReceiver {
    private static final String TAG = "HourlyVoiceReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.i(TAG, "=== ALARM FIRED: onReceive invoked ===");
        scheduleNextVoiceAlarm(context);

        android.os.PowerManager pm = (android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE);
        final android.os.PowerManager.WakeLock wakeLock = (pm != null) ? pm.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "SaloApp::HourlyVoice") : null;
        if (wakeLock != null) wakeLock.acquire(10000);

        final PendingResult pendingResult = goAsync();

        try {
            android.content.Context storageContext = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N ? context.createDeviceProtectedStorageContext() : context;
            android.content.SharedPreferences prefs = storageContext.getSharedPreferences("CapacitorStorage", android.content.Context.MODE_PRIVATE);

            int startHour = prefs.getInt("voice_start_hour", 9);
            int endHour = prefs.getInt("voice_end_hour", 23);
            String activeDaysStr = prefs.getString("voice_active_days", "[1,2,3,4,5,6,7]");
            float volume = prefs.getFloat("voice_volume", 0.5f);
            if (volume > 1.0f) {
                volume = volume / 100.0f;
            }

            Calendar calendar = Calendar.getInstance();
            int hourOfDay = calendar.get(Calendar.HOUR_OF_DAY);
            int dayOfWeek = calendar.get(Calendar.DAY_OF_WEEK); // 1=Sun, 7=Sat

            Log.i(TAG, "Current hour detected (hourOfDay = " + hourOfDay + ", dayOfWeek = " + dayOfWeek + ")");

            if (!activeDaysStr.contains(String.valueOf(dayOfWeek))) {
                Log.i(TAG, "Skipping because: Day " + dayOfWeek + " is disabled.");
                if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
                pendingResult.finish();
                return;
            }

            if (hourOfDay < startHour || hourOfDay > endHour) {
                Log.i(TAG, "Skipping because: Failed the " + startHour + ":00 - " + endHour + ":00 window check.");
                if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
                pendingResult.finish();
                return;
            }

            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null && audioManager.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) {
                Log.i(TAG, "Skipping because: Device is on silent or vibrate.");
                if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
                pendingResult.finish();
                return;
            }

            Log.i(TAG, "Passed the 9:00 AM - 11:00 PM window check. Preparing audio.");

            MediaPlayer mediaPlayer = new MediaPlayer();
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build();
                mediaPlayer.setAudioAttributes(audioAttributes);
            }

            AssetFileDescriptor afd = context.getResources().openRawResourceFd(R.raw.sali_voice);
            if (afd == null) {
                Log.i(TAG, "Skipping because: Failed to open raw resource fd for sali_voice");
                mediaPlayer.release();
                if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
                pendingResult.finish();
                return;
            }
            mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();

            mediaPlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override
                public void onCompletion(MediaPlayer mp) {
                    Log.i(TAG, "Playback completed. Releasing MediaPlayer and finishing PendingResult.");
                    mp.release();
                    if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
                pendingResult.finish();
                }
            });

            mediaPlayer.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                @Override
                public boolean onError(MediaPlayer mp, int what, int extra) {
                    Log.e(TAG, "MediaPlayer error occurred (what=" + what + ", extra=" + extra + "). Cleaning up.");
                    mp.release();
                    if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
                pendingResult.finish();
                    return true; // Indicates we handled the error
                }
            });

            mediaPlayer.prepare();
            Log.i(TAG, "Applying volume: " + volume);
            mediaPlayer.setVolume(volume, volume);
            Log.i(TAG, "Calling MediaPlayer.start() with volume " + volume + "...");
            mediaPlayer.start();
            Log.i(TAG, "Audio playback started successfully.");
            
        } catch (Exception e) {
            Log.e(TAG, "Exception in HourlyVoiceReceiver: " + e.getMessage());
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
                pendingResult.finish();
        }
    }

    public static void scheduleNextVoiceAlarm(Context context) {
        android.content.Context storageContext = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N ? context.createDeviceProtectedStorageContext() : context;
        android.content.SharedPreferences prefs = storageContext.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        long interval = prefs.getLong("voice_frequency", 60 * 60 * 1000L); // Default 1 hour

        android.app.AlarmManager alarmManager = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Intent intent = new Intent(context, HourlyVoiceReceiver.class);
        intent.setAction("com.salo.alahmuhammed.HOURLY_VOICE");
        intent.setPackage(context.getPackageName());
        int flags = android.app.PendingIntent.FLAG_CANCEL_CURRENT; // Auto-cancels existing PendingIntent on OS level
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= android.app.PendingIntent.FLAG_IMMUTABLE;
        }
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getBroadcast(context, 3, intent, flags);
        alarmManager.cancel(pendingIntent); // Auto-Clear existing alarm to prevent duplication

        long triggerAtMillis = System.currentTimeMillis() + interval;
        Log.i(TAG, "Alarm Scheduled for " + (interval / 1000) + " seconds.");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (alarmManager.canScheduleExactAlarms()) {
                alarmManager.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.setAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            alarmManager.setExact(android.app.AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
        } else {
            alarmManager.set(android.app.AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
        }
    }
}
