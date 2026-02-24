# AccaApp (.NET Web App)

Browser-based ASP.NET Core application for weekly football accumulator picks.

## What it does

- Date picker to select a match day.
- Automatically pulls English fixtures across:
  - Premier League (`PL`)
  - Championship (`ELC`)
  - League One (`EL1`)
  - League Two (`EL2`)
- Filters to **3pm kickoffs** in selected timezone (default `Europe/London`).
- Uses league table, last 4-game form, home/away split form (last 6 at venue), goal trends, and recent head-to-head trend.
- Returns the top 10 likely winners in descending confidence.

## Run locally

1. In the project folder, run:
   ```bash
   export FOOTBALL_DATA_API_KEY="your_api_key_here"
   dotnet run
   ```
2. Open the local URL shown in terminal.
3. Pick date and run analysis.

## API notes

- Frontend calls: `GET /api/analysis?date=yyyy-MM-dd&timezone=Europe/London`.
- API token stays server-side via `FOOTBALL_DATA_API_KEY` (or `FootballData:ApiKey` config).
- Backend calls `football-data.org v4` for each of the 4 English leagues.

## Model tuning

- Confidence is adjusted by:
  - team strength score (form + table + attack/defense matchup + H2H + home edge)
  - draw-risk penalty for close/low-scoring matchups
  - data-quality boost when enough recent matches are available
