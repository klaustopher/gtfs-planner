import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getTransportTypeLabel } from '../../utils/transportType'
import './TransportFilterDropdown.css'

interface TransportFilterDropdownProps {
  availableTypes: number[]
  selectedTypes: Set<number>
  onToggleType: (routeType: number) => void
}

export default function TransportFilterDropdown({
  availableTypes,
  selectedTypes,
  onToggleType,
}: TransportFilterDropdownProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  if (availableTypes.length === 0) {
    return null
  }

  const allSelected = availableTypes.every(type => selectedTypes.has(type))
  const noneSelected = availableTypes.every(type => !selectedTypes.has(type))

  // When the feed also exposes the detailed rail categories, the generic rail
  // bucket (category 2) reads better as "other rail"; on its own it is just "rail".
  const hasDetailedRail = availableTypes.some(type => type === 101 || type === 106 || type === 109)
  const labelFor = (routeType: number) =>
    routeType === 2 && hasDetailedRail
      ? t('transportType.short.railOther')
      : getTransportTypeLabel(routeType, t)

  const handleToggleAll = () => {
    if (allSelected) {
      // Deselect all
      availableTypes.forEach(type => {
        if (selectedTypes.has(type)) {
          onToggleType(type)
        }
      })
    } else {
      // Select all
      availableTypes.forEach(type => {
        if (!selectedTypes.has(type)) {
          onToggleType(type)
        }
      })
    }
  }

  // Get summary text for button
  const getSummaryText = () => {
    if (allSelected) {
      return t('map.transportFilter.all')
    }
    if (noneSelected) {
      return t('map.transportFilter.none')
    }
    return `${selectedTypes.size}/${availableTypes.length}`
  }

  return (
    <div className="transport-filter-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className="transport-filter-dropdown__button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="transport-filter-dropdown__label">
          {t('map.transportFilter.title')}
        </span>
        <span className="transport-filter-dropdown__summary">{getSummaryText()}</span>
        <svg
          className={`transport-filter-dropdown__arrow${isOpen ? ' is-open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="transport-filter-dropdown__menu">
          <div className="transport-filter-dropdown__menu-header">
            <label className="transport-filter-dropdown__option">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleToggleAll}
                className="transport-filter-dropdown__checkbox"
              />
              <span className="transport-filter-dropdown__option-label">
                {allSelected ? t('map.transportFilter.deselectAll') : t('map.transportFilter.selectAll')}
              </span>
            </label>
          </div>
          <div className="transport-filter-dropdown__divider" />
          <div className="transport-filter-dropdown__options">
            {availableTypes.map(routeType => {
              const isSelected = selectedTypes.has(routeType)
              const label = labelFor(routeType)

              return (
                <label key={routeType} className="transport-filter-dropdown__option">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleType(routeType)}
                    className="transport-filter-dropdown__checkbox"
                  />
                  <span className="transport-filter-dropdown__option-label">{label}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
