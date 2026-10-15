<?php
// Leaderboards of the arcade games, kept in Upstash Redis. One board per game, chosen with ?game= (tetris when missing)
//   GET  /api/scores.php?game=tetris  ->  { "scores": [...] } best scores first
//   POST /api/scores.php?game=tetris  { name, score, lines, level, duration }  ->  { "scores": [...], "rank": n }
//   POST /api/scores.php?game=pacman  { name, score, level, duration }  ->  { "scores": [...], "rank": n }
//
// The Upstash url and token are read from leaderboard-config.php, OUTSIDE of public_html so nobody can download
// it (see server/leaderboard-config.example.php), or from environment variables.
// The same rules run on `npm run dev` from server/devLeaderboard.ts: keep both in sync.

declare(strict_types=1);

const GAMES = ['tetris', 'pacman'];
// scores sent back, and scores kept (the rest are dropped)
const TOP = 10;
const KEEP = 100;
// submissions per minute from the same ip
const RATE_LIMIT = 5;
// no rude names on the wall
const BLOCKED = ['ASS', 'FUK', 'FUC', 'FCK', 'SEX', 'DIK', 'DIC', 'CUM', 'NIG', 'NAZ', 'KKK', 'FAG', 'TIT', 'XXX', 'SHT', 'PTA', 'PUT', 'CAC', 'POL', 'COK', 'GAY', 'JEW', 'WTF'];

header('Content-Type: application/json');
header('Cache-Control: no-store');

function fail(int $status, string $error): void
{
    http_response_code($status);
    echo json_encode(['error' => $error]);
    exit;
}

function config(): array
{
    // public_html/api/scores.php -> the folder that holds public_html
    $file = dirname(__DIR__, 2) . '/leaderboard-config.php';
    $config = is_file($file) ? require $file : [];
    $url = $config['url'] ?? getenv('UPSTASH_REDIS_REST_URL');
    $token = $config['token'] ?? getenv('UPSTASH_REDIS_REST_TOKEN');
    if (!$url || !$token) fail(500, 'leaderboard not configured');
    return [rtrim($url, '/'), $token];
}

// several redis commands in a single request, returns the result of each one
function redis(array $commands): array
{
    [$url, $token] = config();
    $curl = curl_init($url . '/pipeline');
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($commands),
    ]);
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if ($body === false || $status !== 200) fail(502, 'leaderboard unavailable');
    return array_map(fn ($reply) => $reply['result'] ?? null, json_decode($body, true));
}

// every entry is a member of a sorted set by score: "NAME|lines|level|timestamp|random" (lines is 0 in pacman)
function entries(?array $flat): array
{
    $entries = [];
    for ($i = 0; $i + 1 < count($flat ?? []); $i += 2) {
        [$name, $lines, $level, $time] = explode('|', $flat[$i]);
        $entries[] = ['name' => $name, 'score' => (int) $flat[$i + 1], 'lines' => (int) $lines, 'level' => (int) $level, 'date' => (int) $time];
    }
    return $entries;
}

// Tetris: returns the lines of the game, or fails when the numbers can't come from a real game
function checkTetris(array $input, int $score, int $level, float $duration): int
{
    $lines = filter_var($input['lines'] ?? null, FILTER_VALIDATE_INT);
    if ($lines === false) fail(400, 'bad request');
    if ($score > 9999999 || $lines < 0 || $lines > 9999) fail(400, 'not a real game');
    // the level only depends on the lines
    if ($level !== intdiv($lines, 10) + 1) fail(400, 'not a real game');
    // most a game with those lines could score: points only come from lines (100 times the level, times a bonus that
    // grows .5 with every line made in a row), so at most every line at the final level in one single streak
    if ($score > 100 * $level * ($lines + .25 * $lines * ($lines - 1))) fail(400, 'not a real game');
    // and the least time it could take: .15 seconds per piece (faster than the best players) needed for those lines
    if ($duration < ceil($lines * 10 / 4) * .15) fail(400, 'not a real game');
    return $lines;
}

// most points a pacman level can give: every dot and energizer (2600), the 4 ghosts after each of the 4 energizers
// (4 x 3000) while the ghosts still turn blue, and both fruits
function pacmanLevelMax(int $level): int
{
    $fruits = [1 => 100, 2 => 300, 3 => 500, 4 => 500, 5 => 700, 6 => 700, 7 => 1000, 8 => 1000, 9 => 2000, 10 => 2000, 11 => 3000, 12 => 3000];
    $blue = $level < 17 || $level === 18;
    return 2600 + ($blue ? 12000 : 0) + 2 * ($fruits[$level] ?? 5000);
}

// Pacman: fails when the numbers can't come from a real game (the level is the one the game ended in)
function checkPacman(int $score, int $level, float $duration): void
{
    if ($level > 256 || $score % 10 !== 0) fail(400, 'not a real game');
    $max = 0;
    for ($l = 1; $l <= $level; $l++) $max += pacmanLevelMax($l);
    if ($score > $max) fail(400, 'not a real game');
    // clearing a maze takes going over every dot: more than 20 seconds even at full speed
    if ($duration < ($level - 1) * 20) fail(400, 'not a real game');
}

$game = (string) ($_GET['game'] ?? 'tetris');
if (!in_array($game, GAMES, true)) fail(404, 'no such game');
$board = $game . ':leaderboard';
$top = ['ZREVRANGE', $board, 0, TOP - 1, 'WITHSCORES'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    [$scores] = redis([$top]);
    echo json_encode(['scores' => entries($scores)]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'method not allowed');

$input = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($input)) fail(400, 'bad request');

$name = strtoupper((string) ($input['name'] ?? ''));
$score = filter_var($input['score'] ?? null, FILTER_VALIDATE_INT);
$level = filter_var($input['level'] ?? null, FILTER_VALIDATE_INT);
$duration = filter_var($input['duration'] ?? null, FILTER_VALIDATE_FLOAT);

if (!preg_match('/^[A-Z]{3}$/', $name) || in_array($name, BLOCKED, true)) fail(400, 'name not allowed');
if ($score === false || $level === false || $duration === false) fail(400, 'bad request');
if ($score < 1 || $level < 1 || $duration < 0 || $duration > 6 * 3600) fail(400, 'not a real game');

$lines = 0;
if ($game === 'tetris') $lines = checkTetris($input, $score, $level, $duration);
else checkPacman($score, $level, $duration);

$rate = $game . ':rate:' . sha1($_SERVER['REMOTE_ADDR'] ?? '');
[, $count] = redis([['SET', $rate, 0, 'EX', 60, 'NX'], ['INCR', $rate]]);
if ((int) $count > RATE_LIMIT) fail(429, 'too many scores, wait a minute');

$member = implode('|', [$name, $lines, $level, time(), bin2hex(random_bytes(3))]);
[, , $scores, $rank] = redis([
    ['ZADD', $board, $score, $member],
    ['ZREMRANGEBYRANK', $board, 0, -(KEEP + 1)],
    $top,
    ['ZREVRANK', $board, $member],
]);

echo json_encode(['scores' => entries($scores), 'rank' => $rank === null ? null : (int) $rank + 1]);
