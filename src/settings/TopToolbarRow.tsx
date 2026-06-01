import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ToggleRow } from '../shared/components/ToggleRow'
import { TOOLBAR_ITEM_KEYS, TOOLBAR_ITEM_LABELS, DEFAULT_SELECTORS } from '../content/selectors'
import type { Settings, ToolbarItemKey } from '../shared/types'

interface TopToolbarRowProps {
  settings: Settings
  onToggle: () => void
  onPick: () => void
  onReset: () => void
  onItemToggle: (key: ToolbarItemKey) => void
}

export function TopToolbarRow({ settings, onToggle, onPick, onReset, onItemToggle }: TopToolbarRowProps) {
  const [expanded, setExpanded] = useState(false)
  const { topToolbar } = settings.elements
  const chevronTitle = expanded ? 'Collapse toolbar item visibility' : 'Expand toolbar item visibility'

  return (
    <div className="toolbar-row-group">
      <ToggleRow
        label="Top Toolbar"
        visible={topToolbar.visible}
        selector={topToolbar.selector}
        defaultSelector={DEFAULT_SELECTORS.topToolbar}
        onToggle={onToggle}
        onPick={onPick}
        onReset={onReset}
        showSelector
        extraActions={
          <button
            type="button"
            className="icon-btn"
            onClick={() => setExpanded(e => !e)}
            title={chevronTitle}
            aria-label={chevronTitle}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        }
      />
      {expanded && (
        <div className="toolbar-sub-items">
          <p className="toolbar-sub-desc">Controls which items remain visible when the toolbar is hidden.</p>
          {TOOLBAR_ITEM_KEYS.map(key => (
            <ToggleRow
              key={key}
              label={TOOLBAR_ITEM_LABELS[key]}
              visible={settings.topToolbarItems[key]}
              onToggle={() => onItemToggle(key)}
              simple
            />
          ))}
        </div>
      )}
    </div>
  )
}
