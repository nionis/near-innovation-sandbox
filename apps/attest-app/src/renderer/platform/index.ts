import DesktopPlatform from './desktop_platform'
import { Platform } from './interfaces'
import WebPlatform from './web_platform'

function initPlatform(): Platform {
  if (window.electronAPI) {
    return new DesktopPlatform(window.electronAPI)
  } else {
    return new WebPlatform()
  }
}

export default initPlatform()
