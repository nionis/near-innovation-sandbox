import * as Sentry from '@sentry/react'
import { CHATBOX_BUILD_PLATFORM, CHATBOX_BUILD_TARGET, NODE_ENV } from '@/variables'
import platform from '../platform'

void (async () => {
  const settings = await platform.getSettings()
  if (!settings.allowReportingAndTracking) {
    return
  }

  const version = await platform.getVersion().catch(() => 'unknown')
  Sentry.init({
    dsn: 'https://eca691c5e01ebfa05958fca1fcb487a9@sentry.midway.run/697',
    environment: NODE_ENV,
    // Performance Monitoring
    // Set to 1.0 to capture all errors, then sample in beforeSend
    sampleRate: 1.0,
    tracesSampleRate: 0.1, // Capture 100% of the transactions, reduce in production!
    // Session Replay
    replaysSessionSampleRate: 0.05, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 0.05, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    release: version,
    // 设置全局标签
    initialScope: {
      tags: {
        platform: platform.type,
        app_version: version,
        build_target: CHATBOX_BUILD_TARGET,
        build_platform: CHATBOX_BUILD_PLATFORM,
      },
    },
    // beforeSend hook implements differential sampling
    beforeSend(event) {
      // ErrorBoundary: 100% reporting
      if (event.tags?.errorBoundary) {
        return event
      }

      // Other errors: 10% sampling
      if (Math.random() < 0.1) {
        return event
      }

      // Discard 90% of non-ErrorBoundary errors
      return null
    },
  })
})()

export default Sentry
