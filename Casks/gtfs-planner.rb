cask "gtfs-planner" do
  version "1.0.0"
  sha256 "c914e7646e5a84708de8cf78e65adb37fd97d828e0f508ed7e147059f3f54676"

  url "https://github.com/klaustopher/gtfs-planner/releases/download/v#{version}/gtfs-planner_v#{version}_macOS_universal.dmg",
      verified: "github.com/klaustopher/gtfs-planner/"
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
