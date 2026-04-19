package com.salo.alahmoha;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONException;

public class OverlayHelper {
    private static View overlayView;
    private static Runnable dismissRunnable;
    private static Handler handler = new Handler(Looper.getMainLooper());

    public static void showOverlay(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !android.provider.Settings.canDrawOverlays(context)) {
            return;
        }

        handler.post(() -> {
            if (overlayView != null) return;
            
            final WindowManager windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
            if (windowManager == null) return;

            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String lang = prefs.getString("user_lang", "ar");
            String defaultText = lang.equals("en") ? "Peace be upon Prophet Muhammad \u200E\uFDDF" : "اللهم صل وسلم على نبينا محمد \u200E\uFDDF";
            String text = defaultText;

            String phrasesJson = prefs.getString("salah_phrases", null);
            if (phrasesJson != null) {
                try {
                    JSONArray array = new JSONArray(phrasesJson);
                    if (array.length() > 0) {
                        int currentIndex = prefs.getInt("salah_index", 0);
                        if (currentIndex >= array.length()) currentIndex = 0;
                        text = array.getString(currentIndex);
                        
                        SharedPreferences.Editor editor = prefs.edit();
                        editor.putInt("salah_index", (currentIndex + 1) % array.length());
                        editor.apply();
                    }
                } catch (JSONException e) {
                    Log.e("OverlayHelper", "Error parsing phrases", e);
                }
            }

            LinearLayout layout = new LinearLayout(context);
            layout.setOrientation(LinearLayout.VERTICAL);
            layout.setPadding(50, 40, 50, 40);
            
            android.graphics.drawable.GradientDrawable gd = new android.graphics.drawable.GradientDrawable();
            gd.setColor(Color.parseColor("#F20b0f19"));
            gd.setCornerRadius(40f);
            gd.setStroke(2, Color.parseColor("#55ffffff"));
            layout.setBackground(gd);
            layout.setGravity(Gravity.CENTER);

            TextView tv = new TextView(context);
            tv.setText(text);
            tv.setTextColor(Color.WHITE);
            tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
            tv.setGravity(Gravity.CENTER);
            layout.addView(tv);

            overlayView = layout;

            overlayView.setOnTouchListener(new View.OnTouchListener() {
                private float initialX;
                private boolean isMoved = false;

                @Override
                public boolean onTouch(View v, MotionEvent event) {
                    switch (event.getAction()) {
                        case MotionEvent.ACTION_DOWN:
                            initialX = event.getRawX();
                            isMoved = false;
                            return true;
                        case MotionEvent.ACTION_MOVE:
                            float deltaX = event.getRawX() - initialX;
                            if (Math.abs(deltaX) > 50) {
                                isMoved = true;
                                overlayView.setTranslationX(deltaX);
                                overlayView.setAlpha(1.0f - Math.abs(deltaX) / 500f);
                            }
                            return true;
                        case MotionEvent.ACTION_UP:
                            if (isMoved && Math.abs(event.getRawX() - initialX) > 150) {
                                removeOverlay(windowManager);
                            } else if (!isMoved) {
                                removeOverlay(windowManager);
                            } else {
                                overlayView.animate().translationX(0).alpha(1.0f).setDuration(200).start();
                            }
                            return true;
                    }
                    return false;
                }
            });

            int layoutFlag;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                layoutFlag = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
            } else {
                layoutFlag = WindowManager.LayoutParams.TYPE_PHONE;
            }

            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    layoutFlag,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT);

            params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            params.y = 150; 
            params.windowAnimations = android.R.style.Animation_Dialog;

            int screenWidth = context.getResources().getDisplayMetrics().widthPixels;
            params.width = screenWidth > 200 ? screenWidth - 100 : screenWidth;

            try {
                windowManager.addView(overlayView, params);
            } catch (Exception e) {
                Log.e("OverlayHelper", "Error adding view", e);
                overlayView = null;
                return;
            }

            dismissRunnable = () -> removeOverlay(windowManager);
            handler.postDelayed(dismissRunnable, 8000);
        });
    }

    private static void removeOverlay(WindowManager windowManager) {
        if (overlayView != null) {
            try {
                windowManager.removeView(overlayView);
            } catch (Exception e) {
                Log.e("OverlayHelper", "Error removing view", e);
            }
            overlayView = null;
        }
        if (dismissRunnable != null) {
            handler.removeCallbacks(dismissRunnable);
            dismissRunnable = null;
        }
    }
}
