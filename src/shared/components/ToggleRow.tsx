import type { ReactNode } from 'react'
import { Pipette, RotateCcw } from 'lucide-react'
import './ToggleRow.css'

interface ToggleRowProps {
  label: string
  visible: boolean
  onToggle: () => void
  selector?: string | null
  defaultSelector?: string
  onPick?: () => void
  onReset?: () => void
  showSelector?: boolean
  simple?: boolean
  showPicker?: boolean
  beforeSwitch?: ReactNode
  extraActions?: ReactNode
}

export function ToggleRow({
  label, visible, onToggle,
  selector = null, defaultSelector = '',
  onPick, onReset,
  showSelector = false, simple = false, showPicker = true, beforeSwitch, extraActions,
}: ToggleRowProps) {
  const isCustom = selector !== null
  const displaySelector = selector ?? defaultSelector

  return (
    <div className="toggle-row">
      <div className="toggle-row-label">
        <span>{label}</span>
        {showSelector && (
          <code className={`selector${isCustom ? ' custom' : ''}`}>
            {displaySelector}{isCustom ? ' — custom' : ''}
          </code>
        )}
      </div>
      {beforeSwitch}
      {!simple && showPicker && (
        <button
          type="button"
          className="icon-btn"
          onClick={onPick}
          title="Pick element on page"
          aria-label={`Pick ${label} element`}
        >
          <Pipette size={15} />
        </button>
      )}
      {!simple && (
        <button
          type="button"
          className={`icon-btn reset${isCustom ? ' active' : ''}`}
          onClick={onReset}
          disabled={!isCustom}
          title="Reset to default selector"
          aria-label={`Reset ${label} selector`}
        >
          <RotateCcw size={14} />
        </button>
      )}
      {extraActions}
      <button
        type="button"
        className={`switch ${visible ? 'on' : 'off'}`}
        onClick={onToggle}
        role="switch"
        aria-checked={visible}
        aria-label={`Toggle ${label}`}
      />
    </div>
  )
}
