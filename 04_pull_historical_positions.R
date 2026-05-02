# 04_pull_historical_positions.R
# Goal: pull historical squad data from AFL.com.au for seasons 2011-2024
# to fill in positions for recently-retired players that Footywire missed.

library(fitzRoy)
library(dplyr)
library(readr)

output_dir <- "data/raw_pulls_historical/"
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

# Years to pull. 2011 is the earliest AFL.com.au reliably has.
# Adjust the upper bound if needed.
years <- 2011:2024

teams <- c(
  "Adelaide", "Brisbane Lions", "Carlton", "Collingwood",
  "Essendon", "Fremantle", "Geelong", "Gold Coast",
  "Greater Western Sydney", "Hawthorn", "Melbourne",
  "North Melbourne", "Port Adelaide", "Richmond",
  "St Kilda", "Sydney", "West Coast", "Western Bulldogs"
)

# Track results so we can report at the end
results_log <- data.frame(
  year = integer(),
  team = character(),
  players_returned = integer(),
  status = character(),
  stringsAsFactors = FALSE
)

for (yr in years) {
  cat(sprintf("\n=== Year %d ===\n", yr))
  
  for (team in teams) {
    cat(sprintf("  %s ... ", team))
    
    team_data <- tryCatch({
      fetch_player_details(
        team = team,
        season = yr,
        current = FALSE,
        source = "AFL"
      )
    }, error = function(e) {
      cat(sprintf("FAILED (%s)\n", conditionMessage(e)))
      return(NULL)
    })
    
    if (!is.null(team_data) && nrow(team_data) > 0) {
      safe_team <- gsub(" ", "_", tolower(team))
      output_path <- sprintf("%s%d_%s.csv", output_dir, yr, safe_team)
      write_csv(team_data, output_path)
      cat(sprintf("saved %d players\n", nrow(team_data)))
      
      results_log <- rbind(results_log, data.frame(
        year = yr, team = team, players_returned = nrow(team_data),
        status = "OK", stringsAsFactors = FALSE
      ))
    } else {
      results_log <- rbind(results_log, data.frame(
        year = yr, team = team, players_returned = 0,
        status = "EMPTY_OR_FAILED", stringsAsFactors = FALSE
      ))
    }
    
    Sys.sleep(2)  # politeness pause between requests
  }
}

# Save the log so you can see what worked
write_csv(results_log, paste0(output_dir, "_pull_log.csv"))

# Summary
cat("\n\n=== Final summary ===\n")
cat("Total successful pulls:", sum(results_log$status == "OK"), "\n")
cat("Total failed pulls:", sum(results_log$status != "OK"), "\n")
cat("Total player rows across all files:", sum(results_log$players_returned), "\n")
cat("Files saved to:", output_dir, "\n")