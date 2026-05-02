library(fitzRoy)

# Try several plausible aliases for the two missing teams.
candidates <- c(
  "Greater Western Sydney",
  "GWS",
  "GWS Giants",
  "Giants",
  "North Melbourne",
  "Kangaroos",
  "North Melbourne Kangaroos"
)

for (team in candidates) {
  cat("\n=== Trying:", team, "===\n")
  result <- tryCatch({
    fetch_player_details(team = team, current = TRUE, source = "footywire")
  }, error = function(e) {
    cat("  ERROR:", conditionMessage(e), "\n")
    return(NULL)
  })
  if (!is.null(result)) {
    cat("  OK -", nrow(result), "rows\n")
  }
  Sys.sleep(2)
}
