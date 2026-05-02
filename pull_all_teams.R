library(fitzRoy)

teams <- c("Adelaide", "Brisbane Lions", "Carlton", "Collingwood",
           "Essendon", "Fremantle", "Geelong", "Gold Coast",
           "GWS", "Hawthorn", "Melbourne",
           "Kangaroos", "Port Adelaide", "Richmond",
           "St Kilda", "Sydney", "West Coast", "Western Bulldogs")

output_dir <- "D:/Projects/AFLStar/footy-star/data/raw_pulls/"
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

for (team in teams) {
  cat("Fetching", team, "...\n")
  
  result <- tryCatch({
    fetch_player_details(team = team, current = TRUE, source = "footywire")
  }, error = function(e) {
    cat("  ERROR:", conditionMessage(e), "\n")
    return(NULL)
  })
  
  if (!is.null(result)) {
    # Footywire's accepted aliases don't always match the canonical AFL
    # team name we want to use for the filename. Override here so the
    # output stems stay aligned with mergeRawPulls.ts.
    file_overrides <- list(GWS = "gws", Kangaroos = "north_melbourne")
    safe_name <- if (!is.null(file_overrides[[team]])) {
      file_overrides[[team]]
    } else {
      gsub(" ", "_", tolower(team))
    }
    write.csv(result, paste0(output_dir, safe_name, ".csv"), row.names = FALSE)
    cat("  Saved", nrow(result), "players\n")
  }
  
  Sys.sleep(2)  # be polite to Footywire's server
}

cat("Done.\n")