<?php
// Copy this file as leaderboard-config.php to the folder on the server that CONTAINS public_html (never inside it,
// or anybody could download it), and fill in the REST url and token of the Upstash database.
// public/api/scores.php reads it from there.
return [
    'url' => 'https://your-database.upstash.io',
    'token' => 'your-rest-token',
];
