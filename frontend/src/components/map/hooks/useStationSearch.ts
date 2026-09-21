import { useState, useEffect, useCallback } from 'react'
import type { ChangeEvent, KeyboardEvent, Dispatch, SetStateAction } from 'react'
import { SearchStations } from '../../../../wailsjs/go/main/App'
import { models } from '../../../../wailsjs/go/models'

const SEARCH_DEBOUNCE_MS = 250
const SEARCH_RESULT_LIMIT = 8
const SEARCH_MIN_LENGTH = 2

interface UseStationSearchOptions {
  onResultSelect: (stop: models.Stop) => void
}

export interface UseStationSearchResult {
  searchTerm: string
  searchResults: models.Stop[]
  isSearching: boolean
  activeResultIndex: number
  handleInputChange: (evt: ChangeEvent<HTMLInputElement>) => void
  handleKeyDown: (evt: KeyboardEvent<HTMLInputElement>) => void
  handleClear: () => void
  handleResultSelect: (stop: models.Stop) => void
  showResults: boolean
  showEmptyState: boolean
  setActiveResultIndex: Dispatch<SetStateAction<number>>
}

interface LoadedResults {
  term: string
  results: models.Stop[]
}

const EMPTY_RESULTS: models.Stop[] = []

export function useStationSearch({ onResultSelect }: UseStationSearchOptions): UseStationSearchResult {
  const [searchTerm, setSearchTerm] = useState('')
  const [loaded, setLoaded] = useState<LoadedResults | null>(null)
  const [dismissedTerm, setDismissedTerm] = useState<string | null>(null)
  const [activeResultIndex, setActiveResultIndex] = useState(-1)

  const trimmedSearchTerm = searchTerm.trim()
  const query = trimmedSearchTerm.length >= SEARCH_MIN_LENGTH ? trimmedSearchTerm : null
  const isDismissed = query !== null && dismissedTerm === query

  const searchResults =
    query !== null && !isDismissed && loaded?.term === query ? loaded.results : EMPTY_RESULTS
  const isSearching = query !== null && !isDismissed && loaded?.term !== query

  useEffect(() => {
    if (query === null || isDismissed) {
      return
    }

    let cancelled = false

    const timer = window.setTimeout(() => {
      SearchStations(query, SEARCH_RESULT_LIMIT)
        .then((results) => {
          if (cancelled) {
            return
          }
          setLoaded({ term: query, results: results ?? [] })
          setActiveResultIndex(results && results.length > 0 ? 0 : -1)
        })
        .catch((err) => {
          console.error('Station search failed:', err)
          if (cancelled) {
            return
          }
          setLoaded({ term: query, results: [] })
          setActiveResultIndex(-1)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, isDismissed])

  const handleInputChange = useCallback((evt: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(evt.target.value)
    setDismissedTerm(null)
  }, [])

  const handleClear = useCallback(() => {
    setSearchTerm('')
    setDismissedTerm(null)
    setActiveResultIndex(-1)
  }, [])

  const handleResultSelect = useCallback(
    (stop: models.Stop) => {
      if (!stop) {
        return
      }

      setSearchTerm(stop.stop_name)
      setDismissedTerm(stop.stop_name.trim())
      setActiveResultIndex(-1)
      onResultSelect(stop)
    },
    [onResultSelect]
  )

  const handleKeyDown = useCallback(
    (evt: KeyboardEvent<HTMLInputElement>) => {
      if (evt.key === 'ArrowDown') {
        evt.preventDefault()
        setActiveResultIndex((prev) => {
          if (searchResults.length === 0) {
            return -1
          }
          const next = prev + 1
          return next >= searchResults.length ? 0 : next
        })
      } else if (evt.key === 'ArrowUp') {
        evt.preventDefault()
        setActiveResultIndex((prev) => {
          if (searchResults.length === 0) {
            return -1
          }
          const next = prev - 1
          return next < 0 ? searchResults.length - 1 : next
        })
      } else if (evt.key === 'Enter') {
        if (activeResultIndex >= 0 && activeResultIndex < searchResults.length) {
          evt.preventDefault()
          handleResultSelect(searchResults[activeResultIndex])
        }
      } else if (evt.key === 'Escape') {
        if (searchResults.length > 0) {
          evt.preventDefault()
          setDismissedTerm(query)
          setActiveResultIndex(-1)
        }
      }
    },
    [activeResultIndex, searchResults, handleResultSelect, query]
  )

  const showResults = searchResults.length > 0 && trimmedSearchTerm.length >= SEARCH_MIN_LENGTH
  const showEmptyState =
    !isSearching && trimmedSearchTerm.length >= SEARCH_MIN_LENGTH && searchResults.length === 0

  return {
    searchTerm,
    searchResults,
    isSearching,
    activeResultIndex: searchResults.length === 0 ? -1 : Math.min(activeResultIndex, searchResults.length - 1),
    handleInputChange,
    handleKeyDown,
    handleClear,
    handleResultSelect,
    showResults,
    showEmptyState,
    setActiveResultIndex,
  }
}
