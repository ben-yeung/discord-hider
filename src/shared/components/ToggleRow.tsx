import { Pipette, RotateCcw } from 'lucide-react'
import './ToggleRow.css'

interface ToggleRowProps {
  label: string
  visible: boolean
  selector: string | null
  defaultSelector: string
  onToggle: () => void
  onPick: () => void
  onReset: () => void
  showSelector?: boolean
}

export function ToggleRow({
  label, visible, selector, defaultSelector,
  onToggle, onPick, onReset, showSelector = false,
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
      <button
        type="button"
        className={`switch ${visible ? 'on' : 'off'}`}
        onClick={onToggle}
        role="switch"
        aria-checked={visible}
        aria-label={`Toggle ${label}`}
      />
      <button
        type="button"
        className="icon-btn"
        onClick={onPick}
        title="Pick element on page"
        aria-label={`Pick ${label} element`}
      >
        <Pipette size={15} />
      </button>
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
    </div>
  )
}
