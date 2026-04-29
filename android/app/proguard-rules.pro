# Capacitor
-keep class com.getcapacitor.** { *; }
-keep class com.salo.alahmoha.** { *; }
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception

# WebView / JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
}
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String);
}

# AndroidX / Support
-keep class androidx.** { *; }
-keep interface androidx.** { *; }

# WorkManager
-keep class androidx.work.** { *; }
