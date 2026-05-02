# Clear all variables to start fresh
rm(list = ls())

# Load fitzRoy fresh
library(fitzRoy)

# The minimal test — one team, one season
test_clean <- fetch_player_details(
  team = "Geelong",
  season = 2015,
  current = FALSE,
  source = "AFL"
)

cat("Rows:", nrow(test_clean), "\n")
cat("Columns:", paste(colnames(test_clean), collapse = ", "), "\n")
print(head(test_clean, 3))