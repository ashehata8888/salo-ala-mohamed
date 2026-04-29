package com.salo.alahmuhammed;

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
    private static boolean isRemoving = false;

    private static int calculateDuration(Context context, int textLength) {
        android.content.SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String speedPref = prefs.getString("popup_speed", "medium");
        
        int baseMs, charMultiplier;
        switch(speedPref) {
            case "fast":
                baseMs = 1500;
                charMultiplier = 50;
                break;
            case "slow":
                baseMs = 5000;
                charMultiplier = 130;
                break;
            case "medium":
            default:
                baseMs = 3000;
                charMultiplier = 90;
                break;
        }
        return Math.min(15000, baseMs + (textLength * charMultiplier));
    }

    public static void showOverlay(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !android.provider.Settings.canDrawOverlays(context)) {
            return;
        }

        handler.post(() -> {
            if (overlayView != null) {
                // If it's already showing, just reset the dismiss timer
                if (dismissRunnable != null) {
                    handler.removeCallbacks(dismissRunnable);
                }
                
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
                            currentIndex = currentIndex > 0 ? currentIndex - 1 : array.length() - 1; // It already incremented in the view earlier
                            text = array.getString(currentIndex);
                        }
                    } catch (JSONException e) {}
                }
                
                int durationMs = calculateDuration(context, text.length());
                
                if (overlayView instanceof android.widget.RelativeLayout) {
                    android.widget.RelativeLayout frame = (android.widget.RelativeLayout) overlayView;
                    for (int i=0; i<frame.getChildCount(); i++) {
                        View child = frame.getChildAt(i);
                        if (child instanceof AnimatedGlowBorderView) {
                            ((AnimatedGlowBorderView)child).startBorderAnimation(durationMs);
                            break;
                        }
                    }
                }
                
                final WindowManager windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
                dismissRunnable = () -> removeOverlay(windowManager);
                handler.postDelayed(dismissRunnable, durationMs);
                return;
            }
            
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

            int durationMs = calculateDuration(context, text.length());

            // Wrap everything in a RelativeLayout to force the glowing border to perfectly match the inner layout's height
            android.widget.RelativeLayout rootFrame = new android.widget.RelativeLayout(context);
            
            LinearLayout layout = new LinearLayout(context);
            layout.setId(View.generateViewId());
            layout.setOrientation(LinearLayout.VERTICAL);
            
            // Convert Web/DP padding units to actual physical screen pixels
            int padLR = (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 20, context.getResources().getDisplayMetrics());
            int padTB = (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 16, context.getResources().getDisplayMetrics());
            layout.setPadding(padLR, padTB, padLR, padTB); 
            
            // Rich 45-degree gold/bronze metallic gradient
            android.graphics.drawable.GradientDrawable gd = new android.graphics.drawable.GradientDrawable(
                    android.graphics.drawable.GradientDrawable.Orientation.TL_BR,
                    new int[]{ Color.parseColor("#a8813a"), Color.parseColor("#ebd089"), Color.parseColor("#a8813a") }
            );
            // Match the thickness of the moving white highlight (which uses 7f)
            int staticBorderWidth = 7;
            // Base static dark gold border applied to the container
            gd.setStroke(staticBorderWidth, Color.parseColor("#7a5c1e"));
            
            gd.setCornerRadius(50f);
            layout.setBackground(gd);
            layout.setGravity(Gravity.CENTER);

            TextView tv = new TextView(context);
            tv.setText(text);
            // Dark text for the gold background
            tv.setTextColor(Color.parseColor("#000000")); 
            tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24); // Increased for readability
            tv.setTypeface(null, android.graphics.Typeface.BOLD); // Made it bolder
            tv.setGravity(Gravity.CENTER);
            tv.setLineSpacing(0, 0.82f); // Extremely tight row spacing
            layout.addView(tv);

            // Create and configure the border view stretching across the same dimensions
            AnimatedGlowBorderView borderView = new AnimatedGlowBorderView(context);
            
            android.widget.RelativeLayout.LayoutParams layoutParams = new android.widget.RelativeLayout.LayoutParams(
                android.widget.RelativeLayout.LayoutParams.MATCH_PARENT, 
                android.widget.RelativeLayout.LayoutParams.WRAP_CONTENT);
            rootFrame.addView(layout, layoutParams);
            
            android.widget.RelativeLayout.LayoutParams borderParams = new android.widget.RelativeLayout.LayoutParams(
                android.widget.RelativeLayout.LayoutParams.MATCH_PARENT, 
                android.widget.RelativeLayout.LayoutParams.WRAP_CONTENT);
            borderParams.addRule(android.widget.RelativeLayout.ALIGN_TOP, layout.getId());
            borderParams.addRule(android.widget.RelativeLayout.ALIGN_BOTTOM, layout.getId());
            rootFrame.addView(borderView, borderParams);

            overlayView = rootFrame;

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
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT);

            params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            params.y = 150; 
            params.windowAnimations = android.R.style.Animation_Dialog;

            int screenWidth = context.getResources().getDisplayMetrics().widthPixels;
            params.width = screenWidth > 200 ? screenWidth - 100 : screenWidth;

            try {
                windowManager.addView(overlayView, params);
                borderView.startBorderAnimation(durationMs);
            } catch (Exception e) {
                Log.e("OverlayHelper", "Error adding view", e);
                overlayView = null;
                return;
            }

            dismissRunnable = () -> removeOverlay(windowManager);
            handler.postDelayed(dismissRunnable, durationMs);
        });
    }

    private static void removeOverlay(WindowManager windowManager) {
        if (overlayView == null) return;
        
        if (dismissRunnable != null) {
            handler.removeCallbacks(dismissRunnable);
            dismissRunnable = null;
        }

        final View viewToRemove = overlayView;
        overlayView = null;

        try {
            windowManager.removeView(viewToRemove);
        } catch (Exception e) {
            Log.e("OverlayHelper", "Error removing view", e);
        }
    }
}
