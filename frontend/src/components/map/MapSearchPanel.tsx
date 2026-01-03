import { useTranslation } from 'react-i18next'
import { models } from '../../../wailsjs/go/models'
import { useStationSearch } from './hooks/useStationSearch'

interface MapSearchPanelProps {
  onResultSelect: (stop: models.Stop) => void
}

export default function MapSearchPanel({ onResultSelect }: MapSearchPanelProps) {
  const { t } = useTranslation()
  const {
    searchTerm,
    searchResults,
    isSearching,
    activeResultIndex,
    handleInputChange,
    handleKeyDown,
    handleClear,
    handleResultSelect,
    showResults,
    showEmptyState,
    setActiveResultIndex,
  } = useStationSearch({ onResultSelect })

  return (
    <div className="map-search" role="search">
      <label className="map-search__sr-only" htmlFor="map-search-input">
        {t('map.search.label')}
      </label>
      <div className="map-search__input-wrapper">
        <input
          id="map-search-input"
          type="text"
          placeholder={t('map.search.placeholder')}
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {searchTerm && (
          <button
            type="button"
            className="map-search__clear"
            onClick={handleClear}
            aria-label={t('map.search.clearButton')}
            title={t('map.search.clearButton')}
          >
            ×
          </button>
        )}
      </div>
      {(isSearching || showEmptyState) && (
        <div className="map-search__status-row">
          {isSearching && <span className="map-search__status">{t('map.search.status.searching')}</span>}
          {showEmptyState && <span className="map-search__status">{t('map.search.status.empty')}</span>}
        </div>
      )}
      {showResults && (
        <ul className="map-search__results" role="listbox" aria-label={t('map.search.resultsAria')}>
          {searchResults.map((stop, index) => {
            const isActive = index === activeResultIndex
            return (
              <li key={stop.stop_id}>
                <button
                  type="button"
                  className={`map-search__result${isActive ? ' is-active' : ''}`}
                  onClick={() => handleResultSelect(stop)}
                  onMouseEnter={() => setActiveResultIndex(index)}
                >
                  <span className="map-search__result-name">{stop.stop_name}</span>
                  <span className="map-search__result-meta">{stop.stop_id}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
