import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The iOS app deploys to iOS 15 (IPHONEOS_DEPLOYMENT_TARGET) and Android to
// minSdk 24, so the bundle must not use syntax those webviews cannot parse.
// Vite's default target emits CSS media-query range syntax — `(width>=768px)` —
// which Safari only understands from 16.4, so the tablet breakpoints were
// silently dropped on iOS 15/16.0-16.3 iPads. Pinning the target restores the
// `min-width:` form.
// https://vite.dev/config/build-options.html#build-target
export default defineConfig({
  plugins: [react()],
  build: {
    target: ['safari15', 'chrome87'],
    cssTarget: ['safari15', 'chrome87'],
  },
})
