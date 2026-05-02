test_2012 <- fetch_player_details(
  team = "Geelong",
  season = 2012,
  current = FALSE,
  source = "AFL"
)

cat("Rows:", nrow(test_2012), "\n")
cat("Columns:", paste(colnames(test_2012), collapse = ", "), "\n")
print(head(test_2012, 3))