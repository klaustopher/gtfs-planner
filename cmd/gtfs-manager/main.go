package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var cfgFile string

var rootCmd = &cobra.Command{
	Use:   "gtfs-manager",
	Short: "GTFS database management utility",
	Long:  `A CLI tool for managing GTFS transit data - check status, download feeds, and import data.`,
	Run: func(cmd *cobra.Command, args []string) {
		// Default to status command
		statusCmd.Run(cmd, args)
	},
}

func init() {
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is ./gtfs-config.yaml)")
	rootCmd.AddCommand(statusCmd)
	rootCmd.AddCommand(downloadCmd)
	rootCmd.AddCommand(importCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
