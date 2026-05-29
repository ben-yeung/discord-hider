import { getSettings } from '../shared/storage'
import { applySettings } from './styleManager'
import { startPicker } from './picker'
import { ELEMENT_KEYS } from './selectors'
import type { ElementKey } from '../shared/types'

getSettings().then(applySettings)

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'sync') getSettings().then(applySettings)
})

chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'startPicker' && ELEMENT_KEYS.includes(message.key as ElementKey)) {
    startPicker(message.key as ElementKey, () => getSettings().then(applySettings))
  }
})
