cask "gtfs-planner" do
  version "2.0.0"
  sha256 "6a251d0e1cb468511d965978d93a85a3cf26e99f701f3bdf38ff6f218aba8919"

  url "https://github.com/klaustopher/gtfs-planner/releases/download/v#{version}/gtfs-planner_v#{version}_macOS_universal.dmg"
  name "GTFS Planner"
  desc "Visualize GTFS transit data and plan multi-leg journeys"
  homepage "https://github.com/klaustopher/gtfs-planner"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on macos: :big_sur

  app "gtfs-planner.app"

  zap trash: [
    "~/Library/Application Support/gtfs-planner",
    "~/Library/Preferences/me.kgz.gtfs-planner.plist",
    "~/Library/Saved Application State/me.kgz.gtfs-planner.savedState",
  ]

  caveats <<~EOS
    Your imported GTFS database is kept at
      ~/Library/Application Support/gtfs-planner
    so reinstalls and upgrades don't force a multi-gigabyte re-import.

    To remove it together with the app:
      brew uninstall --zap gtfs-planner
  EOS
end
