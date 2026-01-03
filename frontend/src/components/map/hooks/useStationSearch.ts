import { useState, useEffect, useRef, useCallback } from 'react'
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

export function useStationSearch({ onResultSelect }: UseStationSearchOptions): UseStationSearchResult {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<models.Stop[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeResultIndex, setActiveResultIndex] = useState(-1)
  const searchDebounceRef = useRef<number | null>(null)
  const searchRequestIdRef = useRef(0)

  useEffect(() => {
    if (searchDebounceRef.current !== null) {
      window.clearTimeout(searchDebounceRef.current)
    }

    const trimmed = searchTerm.trim()
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      setSearchResults([])
      setIsSearching(false)
      setActiveResultIndex(-1)
      return
    }

    searchDebounceRef.current = window.setTimeout(() => {
      setIsSearching(true)
      const currentRequestId = ++searchRequestIdRef.current

      SearchStations(trimmed, SEARCH_RESULT_LIMIT)
        .then((results) => {
          if (currentRequestId !== searchRequestIdRef.current) {
            return
          }
          setSearchResults(results ?? [])
          setActiveResultIndex(results && results.length > 0 ? 0 : -1)
        })
        .catch((err) => {
          if (currentRequestId === searchRequestIdRef.current) {
            console.error('Station search failed:', err)
            setSearchResults([])
            setActiveResultIndex(-1)
          }
        })
        .finally(() => {
          if (currentRequestId === searchRequestIdRef.current) {
            setIsSearching(false)
          }
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      if (searchDebounceRef.current !== null) {
        window.clearTimeout(searchDebounceRef.current)
      }
    }
  }, [searchTerm])

  const handleInputChange = useCallback((evt: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(evt.target.value)
  }, [])

  const handleClear = useCallback(() => {
    setSearchTerm('')
    setSearchResults([])
    setActiveResultIndex(-1)
  }, [])

  const handleResultSelect = useCallback(
    (stop: models.Stop) => {
      if (!stop) {
        return
      }

      setSearchTerm(stop.stop_name)
      setSearchResults([])
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
          setSearchResults([])
          setActiveResultIndex(-1)
        }
      }
    },
    [activeResultIndex, searchResults, handleResultSelect]
  )

  const trimmedSearchTerm = searchTerm.trim()
  const showResults = searchResults.length > 0 && trimmedSearchTerm.length >= SEARCH_MIN_LENGTH
  const showEmptyState =
    !isSearching && trimmedSearchTerm.length >= SEARCH_MIN_LENGTH && searchResults.length === 0

  return {
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
  }
}
