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

@CapacitorPlugin(name = "OverlayPlugin")
public class OverlayPlugin extends Plugin {

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
    public void pauseOverlay(PluginCall call) {
        int minutes = call.getInt("minutes", 0);
        android.content.SharedPreferences prefs = getContext().getSharedPreferences("CapacitorStorage", android.content.Context.MODE_PRIVATE);

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
}
