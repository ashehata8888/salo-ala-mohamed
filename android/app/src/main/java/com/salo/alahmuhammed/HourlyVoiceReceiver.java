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

import org.json.JSONArray;
import org.json.JSONObject;
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

            String voiceEnabledStr = prefs.getString("enable_hourly_voice", "false");
            if (!"true".equals(voiceEnabledStr)) {
                Log.i(TAG, "Alarm disabled via preferences. Skipping playback.");
                if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
                pendingResult.finish();
                return;
            }

            String voiceSchedulesJson = prefs.getString("voice_schedules", "[{\"days\":[1,2,3,4,5,6,7],\"startMinutes\":540,\"endMinutes\":1380}]");
            float volume = 0.5f;
            try {
                volume = Float.parseFloat(prefs.getString("voiceVolume", "0.5"));
            } catch (Exception e) {}
            if (volume > 1.0f) {
                volume = volume / 100.0f;
            }

            Calendar calendar = Calendar.getInstance();
            int hourOfDay = calendar.get(Calendar.HOUR_OF_DAY);
            int minute = calendar.get(Calendar.MINUTE);
            int dayOfWeek = calendar.get(Calendar.DAY_OF_WEEK); // 1=Sun, 7=Sat
            int currentMinutes = hourOfDay * 60 + minute;

            Log.i(TAG, "Current time detected (dayOfWeek = " + dayOfWeek + ", currentMinutes = " + currentMinutes + ")");

            boolean isInValidWindow = false;

            try {
                JSONArray schedules = new JSONArray(voiceSchedulesJson);
                for (int i = 0; i < schedules.length(); i++) {
                    JSONObject schedule = schedules.getJSONObject(i);
                    JSONArray days = schedule.getJSONArray("days");
                    boolean dayMatches = false;
                    for (int j = 0; j < days.length(); j++) {
                        if (days.getInt(j) == dayOfWeek) {
                            dayMatches = true;
                            break;
                        }
                    }

                    if (dayMatches) {
                        int startMinutes = schedule.getInt("startMinutes");
                        int endMinutes = schedule.getInt("endMinutes");
                        
                        if (startMinutes <= endMinutes) {
                            if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
                                isInValidWindow = true;
                                break;
                            }
                        } else {
                            // Wraps past midnight
                            if (currentMinutes >= startMinutes || currentMinutes <= endMinutes) {
                                isInValidWindow = true;
                                break;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error parsing voice_schedules: " + e.getMessage());
            }

            if (!isInValidWindow) {
                Log.i(TAG, "Current time outside scheduled active windows for today. Skipping playback.");
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

            Log.i(TAG, "Passed the scheduled window check. Preparing audio.");

            MediaPlayer mediaPlayer = new MediaPlayer();
            
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build();
                    mediaPlayer.setAudioAttributes(audioAttributes);
                }

                android.net.Uri soundUri = android.net.Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.sali_voice);
                mediaPlayer.setDataSource(context, soundUri);

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
                Log.e(TAG, "MediaPlayer setup failed: " + e.getMessage(), e);
                mediaPlayer.release();
                if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
                pendingResult.finish();
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Exception in HourlyVoiceReceiver: " + e.getMessage());
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
                pendingResult.finish();
        }
    }

    public static void scheduleNextVoiceAlarm(Context context) {
        android.content.Context storageContext = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N ? context.createDeviceProtectedStorageContext() : context;
        android.content.SharedPreferences prefs = storageContext.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        long interval = 60 * 60 * 1000L; // Default 1 hour
        try {
            interval = Long.parseLong(prefs.getString("voiceFrequency", "3600000"));
        } catch (Exception e) {}

        android.app.AlarmManager alarmManager = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Intent intent = new Intent(context, HourlyVoiceReceiver.class);
        intent.setAction("com.salo.alahmuhammed.HOURLY_VOICE");
        intent.setPackage(context.getPackageName());
        int flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT; // Overwrite existing PendingIntent safely
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= android.app.PendingIntent.FLAG_IMMUTABLE;
        }
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getBroadcast(context, 3, intent, flags);
        alarmManager.cancel(pendingIntent); // Auto-Clear existing alarm to prevent duplication

        long now = System.currentTimeMillis();
        long targetMillis = now + interval;
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.setTimeInMillis(targetMillis);

        try {
            String voiceSchedulesJson = prefs.getString("voice_schedules", "[{\"days\":[1,2,3,4,5,6,7],\"startMinutes\":540,\"endMinutes\":1380}]");
            org.json.JSONArray schedules = new org.json.JSONArray(voiceSchedulesJson);
            
            boolean isValid = false;
            int dayOfWeek = cal.get(java.util.Calendar.DAY_OF_WEEK);
            int targetMinutes = cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 + cal.get(java.util.Calendar.MINUTE);
            
            for (int i = 0; i < schedules.length(); i++) {
                org.json.JSONObject schedule = schedules.getJSONObject(i);
                org.json.JSONArray days = schedule.getJSONArray("days");
                boolean dayMatches = false;
                for (int j = 0; j < days.length(); j++) {
                    if (days.getInt(j) == dayOfWeek) {
                        dayMatches = true; break;
                    }
                }
                if (dayMatches) {
                    int startMinutes = schedule.getInt("startMinutes");
                    int endMinutes = schedule.getInt("endMinutes");
                    if (startMinutes <= endMinutes) {
                        if (targetMinutes >= startMinutes && targetMinutes <= endMinutes) {
                            isValid = true; break;
                        }
                    } else {
                        if (targetMinutes >= startMinutes || targetMinutes <= endMinutes) {
                            isValid = true; break;
                        }
                    }
                }
            }

            if (!isValid) {
                long bestNextMillis = Long.MAX_VALUE;
                for (int dayOffset = 0; dayOffset <= 7; dayOffset++) {
                    java.util.Calendar checkCal = (java.util.Calendar) cal.clone();
                    checkCal.add(java.util.Calendar.DAY_OF_YEAR, dayOffset);
                    int checkDayOfWeek = checkCal.get(java.util.Calendar.DAY_OF_WEEK);
                    
                    for (int i = 0; i < schedules.length(); i++) {
                        org.json.JSONObject schedule = schedules.getJSONObject(i);
                        org.json.JSONArray days = schedule.getJSONArray("days");
                        boolean dayMatches = false;
                        for (int j = 0; j < days.length(); j++) {
                            if (days.getInt(j) == checkDayOfWeek) {
                                dayMatches = true; break;
                            }
                        }
                        if (dayMatches) {
                            int startMinutes = schedule.getInt("startMinutes");
                            if (dayOffset == 0 && startMinutes <= targetMinutes) {
                                continue;
                            }
                            java.util.Calendar candidateCal = (java.util.Calendar) checkCal.clone();
                            candidateCal.set(java.util.Calendar.HOUR_OF_DAY, startMinutes / 60);
                            candidateCal.set(java.util.Calendar.MINUTE, startMinutes % 60);
                            candidateCal.set(java.util.Calendar.SECOND, 0);
                            candidateCal.set(java.util.Calendar.MILLISECOND, 0);
                            
                            if (candidateCal.getTimeInMillis() < bestNextMillis) {
                                bestNextMillis = candidateCal.getTimeInMillis();
                            }
                        }
                    }
                    if (bestNextMillis != Long.MAX_VALUE) {
                        targetMillis = bestNextMillis;
                        break;
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error calculating next schedule: " + e.getMessage());
        }

        long triggerAtMillis = targetMillis;
        Log.i(TAG, "Alarm Scheduled for " + ((triggerAtMillis - now) / 1000) + " seconds.");

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
