using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpClient("football", client =>
{
    client.BaseAddress = new Uri("https://api.football-data.org/v4/");
});

var footballApiKey = builder.Configuration["FootballData:ApiKey"]
    ?? builder.Configuration["FOOTBALL_DATA_API_KEY"];

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

var competitions = new[]
{
    new Competition("PL", "Premier League"),
    new Competition("ELC", "Championship"),
    new Competition("EL1", "League One"),
    new Competition("EL2", "League Two")
};

var backtestWeeks = ParseBacktestWeeks(args);
if (backtestWeeks is > 0)
{
    if (string.IsNullOrWhiteSpace(footballApiKey))
    {
        Console.Error.WriteLine("Server API key not configured. Set FOOTBALL_DATA_API_KEY or FootballData:ApiKey.");
        return;
    }

    var timezone = TimeZoneInfo.FindSystemTimeZoneById("Europe/London");
    var clientFactory = app.Services.GetRequiredService<IHttpClientFactory>();
    var client = clientFactory.CreateClient("football");
    client.DefaultRequestHeaders.Remove("X-Auth-Token");
    client.DefaultRequestHeaders.Add("X-Auth-Token", footballApiKey);

    var results = await RunBacktest(client, competitions, backtestWeeks.Value, timezone, CancellationToken.None);
    PrintBacktestSummary(results);
    return;
}

app.MapGet("/api/analysis", async (
    string date,
    string? timezone,
    IHttpClientFactory httpClientFactory,
    CancellationToken cancellationToken) =>
{
    if (!DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var analysisDate))
    {
        return Results.BadRequest(new { error = "Invalid date. Use yyyy-MM-dd." });
    }

    if (string.IsNullOrWhiteSpace(footballApiKey))
    {
        return Results.BadRequest(new
        {
            error = "Server API key not configured. Set FOOTBALL_DATA_API_KEY or FootballData:ApiKey."
        });
    }

    timezone ??= "Europe/London";
    TimeZoneInfo tz;
    try
    {
        tz = TimeZoneInfo.FindSystemTimeZoneById(timezone);
    }
    catch (TimeZoneNotFoundException)
    {
        return Results.BadRequest(new { error = $"Unknown timezone '{timezone}'." });
    }

    var client = httpClientFactory.CreateClient("football");
    client.DefaultRequestHeaders.Remove("X-Auth-Token");
    client.DefaultRequestHeaders.Add("X-Auth-Token", footballApiKey);

    var dateStr = analysisDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    var competitionTasks = competitions.Select(c => LoadCompetitionData(client, c, dateStr, cancellationToken));
    var competitionData = (await Task.WhenAll(competitionTasks)).Where(c => c is not null).Cast<CompetitionData>().ToList();

    if (competitionData.Count == 0)
    {
        return Results.BadRequest(new { error = "Unable to load any English league data. Check API key and plan limits." });
    }

    var standingsByCompetition = competitionData.ToDictionary(c => c.Competition.Code, c => c.Standings);

    var allMatches = competitionData.SelectMany(c => c.Matches).ToList();
    var threePm = allMatches
        .Where(m => IsKickoffAt3pm(m.UtcDate, tz))
        .OrderBy(m => m.UtcDate)
        .ThenBy(m => m.LeagueName)
        .ThenBy(m => m.HomeName)
        .ToList();

    if (threePm.Count == 0)
    {
        return Results.Ok(new
        {
            date = dateStr,
            timezone,
            leagues = competitions.Select(c => c.Name),
            fixtures = Array.Empty<object>(),
            topPicks = Array.Empty<object>(),
            totalRanked = 0
        });
    }

    var teamHistoryCache = new ConcurrentDictionary<int, Task<List<FinishedMatch>>>();

    var rankingTasks = threePm.Select(async fixture =>
    {
        var homeHistoryTask = teamHistoryCache.GetOrAdd(fixture.HomeId,
            teamId => LoadTeamHistory(client, teamId, dateStr, cancellationToken));
        var awayHistoryTask = teamHistoryCache.GetOrAdd(fixture.AwayId,
            teamId => LoadTeamHistory(client, teamId, dateStr, cancellationToken));

        var homeHistory = await homeHistoryTask;
        var awayHistory = await awayHistoryTask;

        var homeForm = ComputeForm(homeHistory, fixture.HomeId, 4, null);
        var awayForm = ComputeForm(awayHistory, fixture.AwayId, 4, null);
        var homeVenueForm = ComputeForm(homeHistory, fixture.HomeId, 6, true);
        var awayVenueForm = ComputeForm(awayHistory, fixture.AwayId, 6, false);
        var h2h = ComputeHeadToHead(homeHistory, fixture.HomeId, fixture.AwayId);

        standingsByCompetition.TryGetValue(fixture.LeagueCode, out var standings);
        standings ??= new Dictionary<int, StandingRow>();

        standings.TryGetValue(fixture.HomeId, out var homeStanding);
        standings.TryGetValue(fixture.AwayId, out var awayStanding);

        var score = ComputeScore(homeForm, awayForm, homeVenueForm, awayVenueForm, h2h, homeStanding, awayStanding);
        var drawRisk = ComputeDrawRisk(score, homeForm, awayForm, homeVenueForm, awayVenueForm);
        var dataQuality = ComputeDataQuality(homeForm, awayForm, homeVenueForm, awayVenueForm);
        var pickHome = score >= 0;
        var certainty = ComputeCertainty(score, drawRisk, dataQuality);

        return new RankedPick(
            fixture,
            pickHome ? fixture.HomeName : fixture.AwayName,
            certainty,
            homeForm.Points,
            awayForm.Points,
            h2h,
            score,
            drawRisk,
            dataQuality,
            homeVenueForm.Points,
            awayVenueForm.Points);
    });

    var ranked = (await Task.WhenAll(rankingTasks))
        .OrderByDescending(r => r.Certainty)
        .ThenByDescending(r => Math.Abs(r.Score))
        .ToList();

    var top = ranked.Take(10).Select(r => new
    {
        pickTeam = r.PickTeam,
        certainty = r.Certainty,
        league = r.Fixture.LeagueName,
        homeTeam = r.Fixture.HomeName,
        awayTeam = r.Fixture.AwayName,
        kickoff = TimeZoneInfo.ConvertTimeFromUtc(r.Fixture.UtcDate, tz).ToString("ddd HH:mm", CultureInfo.InvariantCulture),
        homeFormPoints = r.HomeFormPoints,
        awayFormPoints = r.AwayFormPoints,
        h2hBias = Math.Round(r.HeadToHeadBias, 2),
        modelScore = Math.Round(r.Score, 3),
        drawRisk = Math.Round(r.DrawRisk, 2),
        dataQuality = Math.Round(r.DataQuality, 2),
        homeVenueFormPoints = r.HomeVenueFormPoints,
        awayVenueFormPoints = r.AwayVenueFormPoints
    });

    var fixtures = threePm.Select(f => new
    {
        league = f.LeagueName,
        homeTeam = f.HomeName,
        awayTeam = f.AwayName,
        kickoff = TimeZoneInfo.ConvertTimeFromUtc(f.UtcDate, tz).ToString("ddd HH:mm", CultureInfo.InvariantCulture)
    });

    return Results.Ok(new
    {
        date = dateStr,
        timezone,
        leagues = competitions.Select(c => c.Name),
        fixtures,
        topPicks = top,
        totalRanked = ranked.Count
    });
});

app.MapGet("/api/backtest", async (
    int? weeks,
    string? timezone,
    IHttpClientFactory httpClientFactory,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(footballApiKey))
    {
        return Results.BadRequest(new
        {
            error = "Server API key not configured. Set FOOTBALL_DATA_API_KEY or FootballData:ApiKey."
        });
    }

    var requestedWeeks = Math.Clamp(weeks ?? 3, 1, 12);
    timezone ??= "Europe/London";

    TimeZoneInfo tz;
    try
    {
        tz = TimeZoneInfo.FindSystemTimeZoneById(timezone);
    }
    catch (TimeZoneNotFoundException)
    {
        return Results.BadRequest(new { error = $"Unknown timezone '{timezone}'." });
    }

    var client = httpClientFactory.CreateClient("football");
    client.DefaultRequestHeaders.Remove("X-Auth-Token");
    client.DefaultRequestHeaders.Add("X-Auth-Token", footballApiKey);

    var results = await RunBacktest(client, competitions, requestedWeeks, tz, cancellationToken);
    var overallPicks = results.Sum(r => r.Picks);
    var overallCorrect = results.Sum(r => r.Correct);

    return Results.Ok(new
    {
        timezone,
        weeks = requestedWeeks,
        overall = new
        {
            picks = overallPicks,
            correct = overallCorrect,
            accuracy = overallPicks == 0 ? 0 : Math.Round((double)overallCorrect / overallPicks * 100, 1)
        },
        weeksResult = results.Select(r => new
        {
            date = r.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            picks = r.Picks,
            correct = r.Correct,
            accuracy = r.Picks == 0 ? 0 : Math.Round((double)r.Correct / r.Picks * 100, 1),
            fixtures = r.Fixtures,
            topPicks = r.TopPicks.Select(p => new
            {
                p.League,
                p.HomeTeam,
                p.AwayTeam,
                p.PickTeam,
                p.Winner,
                p.Certainty,
                p.Correct
            })
        })
    });
});

app.Run();

static bool IsKickoffAt3pm(DateTime utcDate, TimeZoneInfo timezone)
{
    var local = TimeZoneInfo.ConvertTimeFromUtc(utcDate, timezone);
    return local.Hour == 15 && local.Minute == 0;
}

static async Task<CompetitionData?> LoadCompetitionData(HttpClient client, Competition competition, string date, CancellationToken cancellationToken)
{
    var matchesDoc = await GetJson(client,
        $"competitions/{competition.Code}/matches?status=SCHEDULED&dateFrom={date}&dateTo={date}",
        cancellationToken);

    if (matchesDoc is null)
    {
        return null;
    }

    var standingsDoc = await GetJson(client, $"competitions/{competition.Code}/standings", cancellationToken);
    var standings = standingsDoc is null
        ? new Dictionary<int, StandingRow>()
        : ParseStandings(standingsDoc.RootElement);

    var matches = ParseScheduledMatches(matchesDoc.RootElement, competition);
    return new CompetitionData(competition, matches, standings);
}

static async Task<JsonDocument?> GetJson(HttpClient client, string path, CancellationToken cancellationToken)
{
    using var response = await client.GetAsync(path, cancellationToken);
    if (!response.IsSuccessStatusCode)
    {
        return null;
    }

    await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
    return await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
}

static List<ScheduledMatch> ParseScheduledMatches(JsonElement root, Competition competition)
{
    var matches = new List<ScheduledMatch>();
    if (!root.TryGetProperty("matches", out var arr) || arr.ValueKind != JsonValueKind.Array)
    {
        return matches;
    }

    foreach (var item in arr.EnumerateArray())
    {
        var utcDate = item.GetProperty("utcDate").GetString();
        if (!DateTime.TryParse(utcDate, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var utc))
        {
            continue;
        }

        var home = item.GetProperty("homeTeam");
        var away = item.GetProperty("awayTeam");

        matches.Add(new ScheduledMatch(
            competition.Code,
            competition.Name,
            home.GetProperty("id").GetInt32(),
            home.GetProperty("name").GetString() ?? "Home",
            away.GetProperty("id").GetInt32(),
            away.GetProperty("name").GetString() ?? "Away",
            DateTime.SpecifyKind(utc, DateTimeKind.Utc)));
    }

    return matches;
}

static Dictionary<int, StandingRow> ParseStandings(JsonElement root)
{
    var map = new Dictionary<int, StandingRow>();
    if (!root.TryGetProperty("standings", out var standings) || standings.ValueKind != JsonValueKind.Array)
    {
        return map;
    }

    var total = standings.EnumerateArray().FirstOrDefault(s =>
        s.TryGetProperty("type", out var t) && t.GetString() == "TOTAL");

    if (!total.TryGetProperty("table", out var table) || table.ValueKind != JsonValueKind.Array)
    {
        return map;
    }

    foreach (var row in table.EnumerateArray())
    {
        var teamId = row.GetProperty("team").GetProperty("id").GetInt32();
        map[teamId] = new StandingRow(
            row.GetProperty("position").GetInt32(),
            row.GetProperty("points").GetInt32(),
            row.GetProperty("goalDifference").GetInt32());
    }

    return map;
}

static async Task<List<FinishedMatch>> LoadTeamHistory(HttpClient client, int teamId, string date, CancellationToken cancellationToken)
{
    var doc = await GetJson(client, $"teams/{teamId}/matches?status=FINISHED&dateTo={date}&limit=30", cancellationToken);
    if (doc is null)
    {
        return new List<FinishedMatch>();
    }

    var list = new List<FinishedMatch>();
    if (!doc.RootElement.TryGetProperty("matches", out var arr) || arr.ValueKind != JsonValueKind.Array)
    {
        return list;
    }

    foreach (var m in arr.EnumerateArray())
    {
        var home = m.GetProperty("homeTeam").GetProperty("id").GetInt32();
        var away = m.GetProperty("awayTeam").GetProperty("id").GetInt32();

        var fullTime = m.GetProperty("score").GetProperty("fullTime");
        var hg = fullTime.GetProperty("home").GetInt32();
        var ag = fullTime.GetProperty("away").GetInt32();

        list.Add(new FinishedMatch(home, away, hg, ag));
    }

    return list;
}

static TeamForm ComputeForm(List<FinishedMatch> matches, int teamId, int take, bool? homeOnly)
{
    var recent = matches
        .Where(m => homeOnly is null || (homeOnly.Value ? m.HomeTeamId == teamId : m.AwayTeamId == teamId))
        .Take(take);

    var points = 0;
    var games = 0;
    var goalsFor = 0;
    var goalsAgainst = 0;

    foreach (var m in recent)
    {
        games++;
        var isHome = m.HomeTeamId == teamId;
        var gf = isHome ? m.HomeGoals : m.AwayGoals;
        var ga = isHome ? m.AwayGoals : m.HomeGoals;
        goalsFor += gf;
        goalsAgainst += ga;

        if (gf > ga) points += 3;
        else if (gf == ga) points += 1;
    }

    var ppg = games > 0 ? (double)points / games : 1.2;
    var gfpg = games > 0 ? (double)goalsFor / games : 1.2;
    var gapg = games > 0 ? (double)goalsAgainst / games : 1.2;
    return new TeamForm(points, games, ppg, gfpg, gapg);
}

static double ComputeHeadToHead(List<FinishedMatch> homeTeamHistory, int homeId, int awayId)
{
    var h2h = homeTeamHistory
        .Where(m => m.HomeTeamId == awayId || m.AwayTeamId == awayId)
        .Take(5)
        .ToList();

    if (h2h.Count == 0)
    {
        return 0;
    }

    var score = 0;
    foreach (var m in h2h)
    {
        var homeIsTarget = m.HomeTeamId == homeId;
        var teamGoals = homeIsTarget ? m.HomeGoals : m.AwayGoals;
        var oppGoals = homeIsTarget ? m.AwayGoals : m.HomeGoals;

        if (teamGoals > oppGoals) score += 1;
        else if (teamGoals < oppGoals) score -= 1;
    }

    return (double)score / h2h.Count;
}

static double ComputeScore(
    TeamForm homeForm,
    TeamForm awayForm,
    TeamForm homeVenueForm,
    TeamForm awayVenueForm,
    double h2h,
    StandingRow? home,
    StandingRow? away)
{
    var formDiff = (homeForm.Ppg - awayForm.Ppg) / 3.0;
    var venueFormDiff = (homeVenueForm.Ppg - awayVenueForm.Ppg) / 3.0;
    var attackDefenseDiff = Normalize(
        (homeVenueForm.GoalsForPerGame - awayVenueForm.GoalsAgainstPerGame)
        - (awayVenueForm.GoalsForPerGame - homeVenueForm.GoalsAgainstPerGame),
        3);
    var posDiff = Normalize((away?.Position ?? 10) - (home?.Position ?? 10), 24);
    var pointsDiff = Normalize((home?.Points ?? 0) - (away?.Points ?? 0), 60);
    var gdDiff = Normalize((home?.GoalDifference ?? 0) - (away?.GoalDifference ?? 0), 40);
    const double homeEdge = 0.06;

    return (formDiff * 0.25)
        + (venueFormDiff * 0.25)
        + (attackDefenseDiff * 0.14)
        + (posDiff * 0.12)
        + (pointsDiff * 0.11)
        + (gdDiff * 0.07)
        + (h2h * 0.06)
        + homeEdge;
}

static double ComputeDrawRisk(
    double score,
    TeamForm homeForm,
    TeamForm awayForm,
    TeamForm homeVenueForm,
    TeamForm awayVenueForm)
{
    var closeness = 1 - Math.Clamp(Math.Abs(score), 0, 1);
    var overallParity = 1 - Math.Clamp(Math.Abs(homeForm.Ppg - awayForm.Ppg) / 3.0, 0, 1);
    var venueParity = 1 - Math.Clamp(Math.Abs(homeVenueForm.Ppg - awayVenueForm.Ppg) / 3.0, 0, 1);
    var expectedGoals = (homeVenueForm.GoalsForPerGame + awayVenueForm.GoalsForPerGame) / 2.0;
    var lowScoring = 1 - Math.Clamp(expectedGoals / 2.6, 0, 1);
    return Math.Clamp((closeness * 0.4) + (overallParity * 0.2) + (venueParity * 0.2) + (lowScoring * 0.2), 0, 1);
}

static double ComputeDataQuality(TeamForm homeForm, TeamForm awayForm, TeamForm homeVenueForm, TeamForm awayVenueForm)
{
    var overall = Math.Min(homeForm.Games, awayForm.Games) / 4.0;
    var venue = Math.Min(homeVenueForm.Games, awayVenueForm.Games) / 6.0;
    return Math.Clamp((overall * 0.55) + (venue * 0.45), 0, 1);
}

static int ComputeCertainty(double score, double drawRisk, double dataQuality)
{
    var raw = 50 + (Math.Abs(score) * 40) - (drawRisk * 10) + (dataQuality * 6);
    return (int)Math.Round(Math.Clamp(raw, 50, 94));
}

static double Normalize(double value, double maxAbs)
{
    if (maxAbs <= 0)
    {
        return 0;
    }

    return Math.Clamp(value / maxAbs, -1, 1);
}

static int? ParseBacktestWeeks(string[] args)
{
    for (var i = 0; i < args.Length; i++)
    {
        if (args[i] == "--backtest-weeks" && i + 1 < args.Length && int.TryParse(args[i + 1], out var weeks))
        {
            return weeks;
        }
    }

    return null;
}

static async Task<List<BacktestWeekResult>> RunBacktest(
    HttpClient client,
    IReadOnlyList<Competition> competitions,
    int weeks,
    TimeZoneInfo timezone,
    CancellationToken cancellationToken)
{
    var dates = GetRecentSaturdayDates(weeks, timezone);
    var weekResults = new List<BacktestWeekResult>();

    foreach (var date in dates)
    {
        var dateStr = date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var cutoffDate = date.AddDays(-1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        var fixtures = new List<BacktestFixture>();
        var historyByCompetition = new Dictionary<string, List<HistoricalMatch>>();
        var standingsByCompetition = new Dictionary<string, Dictionary<int, StandingRow>>();

        foreach (var competition in competitions)
        {
            var fixturesDoc = await GetJson(client,
                $"competitions/{competition.Code}/matches?status=FINISHED&dateFrom={dateStr}&dateTo={dateStr}",
                cancellationToken);
            var allOnDate = fixturesDoc is null
                ? new List<HistoricalMatch>()
                : ParseHistoricalMatches(fixturesDoc.RootElement, competition);

            var threePm = allOnDate
                .Where(m => IsKickoffAt3pm(m.UtcDate, timezone))
                .ToList();

            fixtures.AddRange(threePm.Select(m => new BacktestFixture(
                competition.Code,
                competition.Name,
                m.HomeId,
                m.HomeName,
                m.AwayId,
                m.AwayName,
                m.UtcDate,
                m.HomeGoals,
                m.AwayGoals)));

            var historyDoc = await GetJson(client,
                $"competitions/{competition.Code}/matches?status=FINISHED&dateTo={cutoffDate}",
                cancellationToken);
            var history = historyDoc is null
                ? new List<HistoricalMatch>()
                : ParseHistoricalMatches(historyDoc.RootElement, competition);

            historyByCompetition[competition.Code] = history
                .OrderByDescending(m => m.UtcDate)
                .ToList();
            standingsByCompetition[competition.Code] = BuildStandings(history);
        }

        var ranked = fixtures.Select(fixture =>
        {
            historyByCompetition.TryGetValue(fixture.LeagueCode, out var compHistory);
            compHistory ??= new List<HistoricalMatch>();
            standingsByCompetition.TryGetValue(fixture.LeagueCode, out var standings);
            standings ??= new Dictionary<int, StandingRow>();

            var homeHistory = compHistory
                .Where(m => m.HomeId == fixture.HomeId || m.AwayId == fixture.HomeId)
                .Take(30)
                .Select(m => new FinishedMatch(m.HomeId, m.AwayId, m.HomeGoals, m.AwayGoals))
                .ToList();
            var awayHistory = compHistory
                .Where(m => m.HomeId == fixture.AwayId || m.AwayId == fixture.AwayId)
                .Take(30)
                .Select(m => new FinishedMatch(m.HomeId, m.AwayId, m.HomeGoals, m.AwayGoals))
                .ToList();

            var homeForm = ComputeForm(homeHistory, fixture.HomeId, 4, null);
            var awayForm = ComputeForm(awayHistory, fixture.AwayId, 4, null);
            var homeVenueForm = ComputeForm(homeHistory, fixture.HomeId, 6, true);
            var awayVenueForm = ComputeForm(awayHistory, fixture.AwayId, 6, false);
            var h2h = ComputeHeadToHead(homeHistory, fixture.HomeId, fixture.AwayId);

            standings.TryGetValue(fixture.HomeId, out var homeStanding);
            standings.TryGetValue(fixture.AwayId, out var awayStanding);

            var score = ComputeScore(homeForm, awayForm, homeVenueForm, awayVenueForm, h2h, homeStanding, awayStanding);
            var drawRisk = ComputeDrawRisk(score, homeForm, awayForm, homeVenueForm, awayVenueForm);
            var dataQuality = ComputeDataQuality(homeForm, awayForm, homeVenueForm, awayVenueForm);
            var certainty = ComputeCertainty(score, drawRisk, dataQuality);
            var pickTeam = score >= 0 ? fixture.HomeName : fixture.AwayName;
            var winner = fixture.HomeGoals == fixture.AwayGoals
                ? "Draw"
                : fixture.HomeGoals > fixture.AwayGoals ? fixture.HomeName : fixture.AwayName;
            var correct = winner != "Draw" && winner == pickTeam;

            return new BacktestPickResult(
                fixture.LeagueName,
                fixture.HomeName,
                fixture.AwayName,
                pickTeam,
                winner,
                certainty,
                correct);
        })
        .OrderByDescending(r => r.Certainty)
        .Take(10)
        .ToList();

        var picks = ranked.Count;
        var correct = ranked.Count(r => r.Correct);

        weekResults.Add(new BacktestWeekResult(date, fixtures.Count, picks, correct, ranked));
    }

    return weekResults;
}

static List<DateOnly> GetRecentSaturdayDates(int weeks, TimeZoneInfo timezone)
{
    var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timezone).Date;
    var date = DateOnly.FromDateTime(nowLocal);
    var dates = new List<DateOnly>();

    while (date.DayOfWeek != DayOfWeek.Saturday)
    {
        date = date.AddDays(-1);
    }

    for (var i = 0; i < weeks; i++)
    {
        dates.Add(date.AddDays(-7 * i));
    }

    return dates;
}

static List<HistoricalMatch> ParseHistoricalMatches(JsonElement root, Competition competition)
{
    var list = new List<HistoricalMatch>();
    if (!root.TryGetProperty("matches", out var arr) || arr.ValueKind != JsonValueKind.Array)
    {
        return list;
    }

    foreach (var item in arr.EnumerateArray())
    {
        var utcDate = item.GetProperty("utcDate").GetString();
        if (!DateTime.TryParse(utcDate, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var utc))
        {
            continue;
        }

        var fullTime = item.GetProperty("score").GetProperty("fullTime");
        if (fullTime.GetProperty("home").ValueKind != JsonValueKind.Number
            || fullTime.GetProperty("away").ValueKind != JsonValueKind.Number)
        {
            continue;
        }

        var home = item.GetProperty("homeTeam");
        var away = item.GetProperty("awayTeam");
        list.Add(new HistoricalMatch(
            competition.Code,
            competition.Name,
            home.GetProperty("id").GetInt32(),
            home.GetProperty("name").GetString() ?? "Home",
            away.GetProperty("id").GetInt32(),
            away.GetProperty("name").GetString() ?? "Away",
            DateTime.SpecifyKind(utc, DateTimeKind.Utc),
            fullTime.GetProperty("home").GetInt32(),
            fullTime.GetProperty("away").GetInt32()));
    }

    return list;
}

static Dictionary<int, StandingRow> BuildStandings(List<HistoricalMatch> matches)
{
    var stats = new Dictionary<int, StandingAccumulator>();

    foreach (var match in matches)
    {
        if (!stats.TryGetValue(match.HomeId, out var home))
        {
            home = new StandingAccumulator();
            stats[match.HomeId] = home;
        }
        if (!stats.TryGetValue(match.AwayId, out var away))
        {
            away = new StandingAccumulator();
            stats[match.AwayId] = away;
        }

        home.Played++;
        away.Played++;
        home.GoalsFor += match.HomeGoals;
        home.GoalsAgainst += match.AwayGoals;
        away.GoalsFor += match.AwayGoals;
        away.GoalsAgainst += match.HomeGoals;

        if (match.HomeGoals > match.AwayGoals)
        {
            home.Points += 3;
        }
        else if (match.HomeGoals < match.AwayGoals)
        {
            away.Points += 3;
        }
        else
        {
            home.Points += 1;
            away.Points += 1;
        }
    }

    var ordered = stats
        .Select(kvp => new
        {
            TeamId = kvp.Key,
            kvp.Value.Points,
            GoalDifference = kvp.Value.GoalsFor - kvp.Value.GoalsAgainst,
            kvp.Value.GoalsFor
        })
        .OrderByDescending(x => x.Points)
        .ThenByDescending(x => x.GoalDifference)
        .ThenByDescending(x => x.GoalsFor)
        .ToList();

    var standings = new Dictionary<int, StandingRow>();
    for (var i = 0; i < ordered.Count; i++)
    {
        standings[ordered[i].TeamId] = new StandingRow(i + 1, ordered[i].Points, ordered[i].GoalDifference);
    }

    return standings;
}

static void PrintBacktestSummary(List<BacktestWeekResult> results)
{
    Console.WriteLine("Backtest Results (Top 10 picks each week)");
    Console.WriteLine("------------------------------------------");

    foreach (var week in results)
    {
        var accuracy = week.Picks == 0 ? 0 : (double)week.Correct / week.Picks * 100;
        Console.WriteLine($"{week.Date:yyyy-MM-dd} | Fixtures: {week.Fixtures} | Picks: {week.Picks} | Correct: {week.Correct} | Accuracy: {accuracy:F1}%");
    }

    var picks = results.Sum(r => r.Picks);
    var correct = results.Sum(r => r.Correct);
    var overall = picks == 0 ? 0 : (double)correct / picks * 100;
    Console.WriteLine("------------------------------------------");
    Console.WriteLine($"Overall | Picks: {picks} | Correct: {correct} | Accuracy: {overall:F1}%");
}

record Competition(string Code, string Name);
record CompetitionData(Competition Competition, List<ScheduledMatch> Matches, Dictionary<int, StandingRow> Standings);
record ScheduledMatch(string LeagueCode, string LeagueName, int HomeId, string HomeName, int AwayId, string AwayName, DateTime UtcDate);
record StandingRow(int Position, int Points, int GoalDifference);
class StandingAccumulator
{
    public int Played { get; set; }
    public int Points { get; set; }
    public int GoalsFor { get; set; }
    public int GoalsAgainst { get; set; }
}
record HistoricalMatch(string LeagueCode, string LeagueName, int HomeId, string HomeName, int AwayId, string AwayName, DateTime UtcDate, int HomeGoals, int AwayGoals);
record BacktestFixture(string LeagueCode, string LeagueName, int HomeId, string HomeName, int AwayId, string AwayName, DateTime UtcDate, int HomeGoals, int AwayGoals);
record BacktestPickResult(string League, string HomeTeam, string AwayTeam, string PickTeam, string Winner, int Certainty, bool Correct);
record BacktestWeekResult(DateOnly Date, int Fixtures, int Picks, int Correct, List<BacktestPickResult> TopPicks);
record FinishedMatch(int HomeTeamId, int AwayTeamId, int HomeGoals, int AwayGoals);
record TeamForm(int Points, int Games, double Ppg, double GoalsForPerGame, double GoalsAgainstPerGame);
record RankedPick(
    ScheduledMatch Fixture,
    string PickTeam,
    int Certainty,
    int HomeFormPoints,
    int AwayFormPoints,
    double HeadToHeadBias,
    double Score,
    double DrawRisk,
    double DataQuality,
    int HomeVenueFormPoints,
    int AwayVenueFormPoints);
