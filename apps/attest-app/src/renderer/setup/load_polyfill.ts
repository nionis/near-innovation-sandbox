import { CHATBOX_BUILD_TARGET } from '../variables'

if (CHATBOX_BUILD_TARGET === 'mobile_app') {
  require('core-js/actual')
}
