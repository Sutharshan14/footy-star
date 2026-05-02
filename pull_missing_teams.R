library(fitzRoy)

# fitzRoy + footywire is finicky about team aliases. These two need
# the short names below; saved under the stems mergeRawPulls.ts expects.
teams <- list(
  list(name = "GWS",       stem = "gws"),
  list(name = "Kangaroos", stem = "north_melbourne")
)

output_dir <- "D:/Projects/AFLStar/footy-star/data/raw_pulls/"
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

for (t in teams) {
  cat("Fetching", t$name, "...\n")

  result <- tryCatch({
    fetch_player_details(team = t$name, current = TRUE, source = "footywire")
  }, error = function(e) {
    cat("  ERROR:", conditionMessage(e), "\n")
    return(NULL)
  })

  if (!is.null(result)) {
    write.csv(result, paste0(output_dir, t$stem, ".csv"), row.names = FALSE)
    cat("  Saved", nrow(result), "players ->", paste0(t$stem, ".csv"), "\n")
  }

  Sys.sleep(2)
}

cat("Done.\n")
