// Package textfold normalizes text for case- and accent-insensitive search.
package textfold

import "strings"

var folder = strings.NewReplacer("ä", "a", "ö", "o", "ü", "u", "ß", "ss")

// Fold returns a normalized form for matching: Unicode-lower-cased with German
// umlauts folded to their base letters (ö→o, ä→a, ü→u, ß→ss). The importer
// stores this for each stop name and search queries fold the query the same way,
// so "koln", "köln" and "Köln" all match "Köln Hbf".
func Fold(s string) string {
	return folder.Replace(strings.ToLower(s))
}
