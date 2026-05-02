# 05_pull_draft_data.R
# Goal: pull draft pick data for all current AFL squads.
# AFL.com.au gives us draftPosition, draftYear, draftType for free.

library(fitzRoy)
library(dplyr)
library(readr)

teams <- c(
  "Adelaide", "Brisbane Lions", "Carlton", "Collingwood",
  "Essendon", "Fremantle", "Geelong", "Gold Coast",
  "Greater Western Sydney", "Hawthorn", "Melbourne",
  "North Melbourne", "Port Adelaide", "Richmond",
  "St Kilda", "Sydney", "West Coast", "Western Bulldogs"
)

all_draft_data <- list()

for (team in teams) {
  cat("Fetching", team, "draft data... ")
  
  result <- tryCatch({
    fetch_player_details(team = team, current = TRUE, source = "AFL")
  }, error = function(e) {
    cat("FAILED:", conditionMessage(e), "\n")
    return(NULL)
  })
  
  if (!is.null(result) && nrow(result) > 0) {
    all_draft_data[[team]] <- result
    cat("got", nrow(result), "players\n")
  }
  
  Sys.sleep(2)  # be polite to AFL.com.au
}

# Combine into one dataframe
combined <- bind_rows(all_draft_data)

cat("\nTotal players with draft data:", nrow(combined), "\n")
cat("Columns:\n")
print(colnames(combined))

# Save it
output_file <- "data/draft_data_from_afl.csv"
write_csv(combined, output_file)
cat("\nSaved to:", output_file, "\n")

# Quick sanity check on draft pick coverage
cat("\nDraft pick coverage:\n")
combined %>%
  mutate(has_draft_pick = !is.na(draftPosition) & draftPosition != "") %>%
  count(has_draft_pick) %>%
  print()