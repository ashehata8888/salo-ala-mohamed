package com.salo.alahmoha;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PathMeasure;
import android.graphics.RectF;
import android.view.View;
import android.view.animation.LinearInterpolator;

public class AnimatedGlowBorderView extends View {
    private Paint paint;
    private Path fullPath;
    private Path drawnPath;
    private PathMeasure pathMeasure;
    private float pathLength;
    private float animatedValue = 0f;
    private float cornerRadius = 50f;
    private ValueAnimator animator;

    public AnimatedGlowBorderView(Context context) {
        super(context);
        init();
    }

    private void init() {
        setLayerType(LAYER_TYPE_SOFTWARE, null);
        paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(7f);
        paint.setColor(Color.WHITE);
        // Removed shadow layer effect as explicitly requested
        
        fullPath = new Path();
        drawnPath = new Path();
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        
        float halfStroke = paint.getStrokeWidth() / 2f;
        RectF rect = new RectF(halfStroke, halfStroke, w - halfStroke, h - halfStroke);
        
        fullPath.reset();
        // Adjusting corner radius concentrically so it perfectly aligns with the background shape
        float innerRadius = cornerRadius - halfStroke;
        fullPath.addRoundRect(rect, innerRadius, innerRadius, Path.Direction.CW);
        
        pathMeasure = new PathMeasure(fullPath, false);
        pathLength = pathMeasure.getLength();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        if (pathMeasure == null) return;
        
        drawnPath.reset();
        // Shift the start point forward towards the end to erase in a clockwise direction
        pathMeasure.getSegment(pathLength * animatedValue, pathLength, drawnPath, true);
        canvas.drawPath(drawnPath, paint);
    }

    public void startBorderAnimation(long durationMs) {
        if (animator != null && animator.isRunning()) {
            animator.cancel();
        }
        
        animator = ValueAnimator.ofFloat(0f, 1f); // Increments from 0 to 1 to shift the start point
        animator.setDuration(durationMs);
        animator.setInterpolator(new LinearInterpolator()); // Steady pace like a ticking timer
        animator.addUpdateListener(animation -> {
            animatedValue = (float) animation.getAnimatedValue();
            invalidate();
        });
        animator.start();
    }
}
