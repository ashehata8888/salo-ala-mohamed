package com.salo.alahmuhammed;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.util.Log;

@CapacitorPlugin(name = "OverlayPlugin")
public class OverlayPlugin extends Plugin {
    private MediaPlayer previewPlayer;

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(getContext())) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                
                JSObject ret = new JSObject();
                ret.put("granted", false);
                call.resolve(ret);
                return;
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            android.app.AlarmManager alarmManager = (android.app.AlarmManager) getContext().getSystemService(android.content.Context.ALARM_SERVICE);
            if (alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                        Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                
                JSObject ret = new JSObject();
                ret.put("granted", false);
                call.resolve(ret);
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            granted = Settings.canDrawOverlays(getContext());
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            android.app.AlarmManager alarmManager = (android.app.AlarmManager) getContext().getSystemService(android.content.Context.ALARM_SERVICE);
            if (alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
                granted = false;
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void showPreview(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            call.reject("Permission not granted");
            return;
        }
        OverlayHelper.showOverlay(getContext());
        call.resolve();
    }
    @PluginMethod
    public void isBatteryOptimizationIgnored(PluginCall call) {
        boolean isIgnored = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
            if (pm != null) {
                isIgnored = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            }
        }
        JSObject ret = new JSObject();
        ret.put("isIgnored", isIgnored);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimization(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                
                JSObject ret = new JSObject();
                ret.put("requested", true);
                call.resolve(ret);
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("requested", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void syncSettings(PluginCall call) {
        android.content.Context storageContext = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N ? getContext().createDeviceProtectedStorageContext() : getContext();
        android.content.SharedPreferences prefs = storageContext.getSharedPreferences("CapacitorStorage", android.content.Context.MODE_PRIVATE);
        android.content.SharedPreferences.Editor editor = prefs.edit();

        if (call.hasOption("userLang")) editor.putString("user_lang", call.getString("userLang"));
        if (call.hasOption("popupSpeed")) editor.putString("popup_speed", call.getString("popupSpeed"));
        if (call.hasOption("enableActiveTimer")) editor.putString("enable_active_timer", String.valueOf(call.getBoolean("enableActiveTimer", true)));
        if (call.hasOption("enableHourlyVoice")) editor.putString("enable_hourly_voice", String.valueOf(call.getBoolean("enableHourlyVoice", true)));
        
        if (call.hasOption("voiceFrequency")) editor.putString("voiceFrequency", String.valueOf(call.getInt("voiceFrequency", 3600000)));
        if (call.hasOption("voiceSchedules")) editor.putString("voice_schedules", call.getString("voiceSchedules", "[{\"days\":[1,2,3,4,5,6,7],\"startMinutes\":540,\"endMinutes\":1380}]"));
        if (call.hasOption("voiceVolume")) editor.putString("voiceVolume", String.valueOf(call.getDouble("voiceVolume", 0.5)));

        if (call.hasOption("reducePopupFrequency")) editor.putString("reducePopupFrequency", String.valueOf(call.getBoolean("reducePopupFrequency", false)));
        if (call.hasOption("pauseUntil")) editor.putString("pauseUntil", String.valueOf(call.getLong("pauseUntil", 0L)));
        if (call.hasOption("salahPhrases")) {
            try {
                com.getcapacitor.JSArray phrases = call.getArray("salahPhrases");
                if (phrases != null) {
                    editor.putString("salah_phrases", phrases.toString());
                }
            } catch (Exception e) {}
        }

        editor.apply();
        call.resolve();
    }

    @PluginMethod
    public void pauseOverlay(PluginCall call) {
        int minutes = call.getInt("minutes", 0);
        android.content.Context storageContext = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N ? getContext().createDeviceProtectedStorageContext() : getContext();
        android.content.SharedPreferences prefs = storageContext.getSharedPreferences("CapacitorStorage", android.content.Context.MODE_PRIVATE);

        Intent resumeIntent = new Intent(getContext(), BootReceiver.class);
        resumeIntent.setAction("com.salo.alahmuhammed.RESUME_SERVICE");
        int flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= android.app.PendingIntent.FLAG_IMMUTABLE;
        }
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getBroadcast(getContext(), 2, resumeIntent, flags);
        android.app.AlarmManager alarmManager = (android.app.AlarmManager) getContext().getSystemService(android.content.Context.ALARM_SERVICE);

        if (minutes <= 0) {
            // Cancel pause
            prefs.edit().putString("pauseUntil", "0").apply();
            
            if (alarmManager != null) {
                alarmManager.cancel(pendingIntent);
            }
            
            // Tell service to resume
            getContext().sendBroadcast(resumeIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("pauseUntil", 0L);
            call.resolve(ret);
            return;
        }

        long pauseUntil = System.currentTimeMillis() + (minutes * 60000L);
        prefs.edit().putString("pauseUntil", String.valueOf(pauseUntil)).apply();

        // Tell service to pause
        Intent pauseIntent = new Intent(getContext(), SaloPrayerService.class);
        pauseIntent.setAction("com.salo.alahmuhammed.PAUSE_SERVICE");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                getContext().startForegroundService(pauseIntent);
            } catch (Exception e) {
                getContext().startService(pauseIntent);
            }
        } else {
            getContext().startService(pauseIntent);
        }

        // Schedule Reactivation via BootReceiver
        if (alarmManager != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, pauseUntil, pendingIntent);
                } else {
                    alarmManager.setAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, pauseUntil, pendingIntent);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, pauseUntil, pendingIntent);
            } else {
                alarmManager.setExact(android.app.AlarmManager.RTC_WAKEUP, pauseUntil, pendingIntent);
            }
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("pauseUntil", pauseUntil);
        call.resolve(ret);
    }

    @PluginMethod
    public void startHourlyVoice(PluginCall call) {
        // Delegate scheduling to HourlyVoiceReceiver
        HourlyVoiceReceiver.scheduleNextVoiceAlarm(getContext());

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void cancelHourlyVoice(PluginCall call) {
        Intent intent = new Intent(getContext(), HourlyVoiceReceiver.class);
        intent.setAction("com.salo.alahmuhammed.HOURLY_VOICE");
        intent.setPackage(getContext().getPackageName());
        int flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= android.app.PendingIntent.FLAG_IMMUTABLE;
        }
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getBroadcast(getContext(), 3, intent, flags);
        android.app.AlarmManager alarmManager = (android.app.AlarmManager) getContext().getSystemService(android.content.Context.ALARM_SERVICE);

        if (alarmManager != null) {
            alarmManager.cancel(pendingIntent);
            pendingIntent.cancel();
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void playPreviewSound(PluginCall call) {
        float volume = call.getFloat("volume", 0.5f);
        if (volume > 1.0f) {
            volume = volume / 100.0f;
        }

        try {
            if (previewPlayer != null) {
                if (previewPlayer.isPlaying()) {
                    previewPlayer.stop();
                }
                previewPlayer.release();
                previewPlayer = null;
            }

            previewPlayer = new MediaPlayer();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build();
                previewPlayer.setAudioAttributes(audioAttributes);
            }

            android.net.Uri soundUri = android.net.Uri.parse("android.resource://" + getContext().getPackageName() + "/" + R.raw.sali_voice);
            previewPlayer.setDataSource(getContext(), soundUri);

            previewPlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override
                public void onCompletion(MediaPlayer mp) {
                    mp.release();
                    previewPlayer = null;
                }
            });

            previewPlayer.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                @Override
                public boolean onError(MediaPlayer mp, int what, int extra) {
                    Log.e("OverlayPlugin", "MediaPlayer error during preview: what=" + what + " extra=" + extra);
                    mp.release();
                    previewPlayer = null;
                    return true;
                }
            });

            previewPlayer.prepare();
            previewPlayer.setVolume(volume, volume);
            previewPlayer.start();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e("OverlayPlugin", "Preview audio failed: " + e.getMessage(), e);
            if (previewPlayer != null) {
                previewPlayer.release();
                previewPlayer = null;
            }
            call.reject("Audio preview failed", e);
        }
    }
}
