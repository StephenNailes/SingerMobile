<?php
/**
 * Tinig setup check -- open this in a browser to prove the FreeHostia side works.
 *
 *   https://your-site.freehostia.com/api/setup-check.php
 *
 * It checks PHP, the database connection, the table, and then runs a real
 * create -> read -> update -> favourite -> delete cycle through the same SQL
 * the API uses, cleaning up after itself.
 *
 *   ?install=1   creates the table and inserts the six seed singers
 *   ?reset=1     drops the table first, then installs (DESTROYS ALL DATA)
 *
 * Delete this file once the app is running -- it reveals your schema.
 */

include_once 'connection.php';

$checks  = array();
$fatal   = false;
$install = isset($_GET['install']);
$reset   = isset($_GET['reset']);

function check(&$checks, $label, $ok, $detail = '', $hint = '')
{
    $checks[] = array('label' => $label, 'ok' => $ok, 'detail' => $detail, 'hint' => $hint);
    return $ok;
}

/* ---------------------------------------------------------------- 1. PHP */

check($checks, 'PHP version', version_compare(PHP_VERSION, '5.6', '>='), PHP_VERSION,
      'PHP 5.6 or newer is needed. Set it in the FreeHostia control panel.');
check($checks, 'mysqli extension', function_exists('mysqli_connect'), '',
      'Without mysqli nothing here can reach MySQL.');
check($checks, 'json extension', function_exists('json_encode'));
check($checks, 'mbstring extension', function_exists('mb_strlen'), '',
      'Optional. Without it, name lengths are counted in bytes, so accented names hit the 80-character limit sooner.');

/* -------------------------------------------------------- 2. Connection */

$connection = null;
$db = new dbObj();
$connection = $db->getConnstring(); // exits with JSON if it cannot connect

check($checks, 'Database connection', true,
      'Connected to ' . htmlspecialchars($db->dbname) . ' on ' . htmlspecialchars($db->servername));
check($checks, 'MySQL server', true, mysqli_get_server_info($connection));

$charset = mysqli_character_set_name($connection);
check($checks, 'Connection charset', strpos($charset, 'utf8') === 0, $charset,
      'Not utf8mb4: accented names such as "Bamboo Manalac" will be mangled. Use the connection.php from this folder.');

/* ------------------------------------------------- 3. Install / reset */

$ddl = "CREATE TABLE IF NOT EXISTS `singers` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`      VARCHAR(80)   NOT NULL,
  `genre`     ENUM('Pop','R&B','Rock','Folk','Theatre') NOT NULL DEFAULT 'Pop',
  `hometown`  VARCHAR(100)  NOT NULL DEFAULT '',
  `bio`       VARCHAR(2000) NOT NULL DEFAULT '',
  `song`      VARCHAR(120)  NOT NULL DEFAULT '',
  `imageUrl`  VARCHAR(2048) NOT NULL DEFAULT '',
  `sourceUrl` VARCHAR(2048) NOT NULL DEFAULT '',
  `favorite`  TINYINT(1) UNSIGNED NOT NULL DEFAULT 0,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `singers_name` (`name`),
  KEY `singers_genre_name` (`genre`, `name`),
  KEY `singers_favorite_name` (`favorite`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

$seed = array(
    array('Gary Valenciano', 'Pop', 'Filipino singer and performer whose work spans pop and inspirational music, recordings, television, and live concerts.', 'https://www.garyv.com/about-gary-v'),
    array('Regine Velasquez', 'Pop', 'Filipino singer and actress known for her powerful vocals and a career spanning pop ballads, concerts, and screen performances.', 'https://music.apple.com/us/artist/regine-velasquez/32340032'),
    array('Lea Salonga', 'Theatre', 'Filipino singer and actress whose work spans musical theatre, concert stages, and the singing voices of Disney princesses Jasmine and Mulan.', 'https://www.leasalonga.com/about'),
    array('Sarah Geronimo', 'Pop', 'Filipino singer, actress, and performer with a career spanning pop recordings, concerts, television, and film.', 'https://sarah-geronimo.com/'),
    array('Moira dela Torre', 'Pop', 'Filipino singer-songwriter known for her expressive voice and heartfelt songs.', 'https://www.tatlerasia.com/people/moira-dela-torre'),
    array("Bamboo Ma\xc3\xb1alac", 'Rock', 'Filipino rock vocalist and solo recording artist, also known for his work with Rivermaya and the band Bamboo.', 'https://music.apple.com/us/artist/bamboo-manalac/324891781'),
);

if ($reset) {
    mysqli_query($connection, 'DROP TABLE IF EXISTS `singers`');
    $install = true;
}

if ($install) {
    $created = mysqli_query($connection, $ddl);
    check($checks, 'Create table', (bool) $created,
          $created ? 'singers table ready' : mysqli_error($connection),
          'If this mentions CURRENT_TIMESTAMP, your MySQL is older than 5.6. See the fallback at the bottom of schema.sql.');

    if ($created) {
        $inserted = 0;
        $statement = mysqli_prepare($connection,
            'INSERT IGNORE INTO `singers` (name, genre, bio, sourceUrl, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())');
        foreach ($seed as $row) {
            mysqli_stmt_bind_param($statement, 'ssss', $row[0], $row[1], $row[2], $row[3]);
            mysqli_stmt_execute($statement);
            $inserted += mysqli_stmt_affected_rows($statement);
        }
        mysqli_stmt_close($statement);
        check($checks, 'Seed singers', true, $inserted . ' inserted, ' . (count($seed) - $inserted) . ' already present');
    }
}

/* ------------------------------------------------------- 4. Table shape */

$tableExists = false;
$result = mysqli_query($connection, "SHOW TABLES LIKE 'singers'");
$tableExists = $result && mysqli_num_rows($result) > 0;

if (!check($checks, 'Table `singers` exists', $tableExists, '',
           'Run schema.sql in phpMyAdmin, or add ?install=1 to this page\'s address.')) {
    $fatal = true;
}

if (!$fatal) {
    $expected = array('id', 'name', 'genre', 'hometown', 'bio', 'song',
                      'imageUrl', 'sourceUrl', 'favorite', 'createdAt', 'updatedAt');
    $found = array();
    $result = mysqli_query($connection, 'SHOW COLUMNS FROM `singers`');
    while ($row = mysqli_fetch_assoc($result)) {
        $found[] = $row['Field'];
    }
    $missing = array_diff($expected, $found);
    if (!check($checks, 'Columns match the app', count($missing) === 0,
               count($found) . ' columns',
               'Missing: ' . implode(', ', $missing) . '. Column names are case-sensitive on Linux MySQL -- imageUrl, not imageurl.')) {
        $fatal = true;
    }

    $result = mysqli_query($connection, "SHOW TABLE STATUS LIKE 'singers'");
    $status = mysqli_fetch_assoc($result);
    check($checks, 'Storage engine', isset($status['Engine']) && strtoupper($status['Engine']) === 'INNODB',
          isset($status['Engine']) ? $status['Engine'] : '?',
          'MyISAM works but has no transactions and locks the whole table on every write.');
    check($checks, 'Collation', isset($status['Collation']) && strpos($status['Collation'], 'utf8mb4') === 0,
          isset($status['Collation']) ? $status['Collation'] : '?',
          'Not utf8mb4: accented names and emoji will not store correctly.');

    $indexes = array();
    $result = mysqli_query($connection, 'SHOW INDEX FROM `singers`');
    while ($row = mysqli_fetch_assoc($result)) {
        $indexes[$row['Key_name']] = true;
    }
    check($checks, 'Indexes present', isset($indexes['singers_name']) && isset($indexes['singers_genre_name']),
          implode(', ', array_keys($indexes)),
          'Without singers_name, duplicate names are allowed and the A-Z listing does a full sort.');

    $result = mysqli_query($connection, 'SELECT COUNT(*) AS total FROM `singers`');
    $row = mysqli_fetch_assoc($result);
    check($checks, 'Rows in table', true, $row['total'] . ' singers');
}

/* -------------------------------------------------- 5. Live CRUD probe */

if (!$fatal) {
    $probe = '__tinig_probe_' . substr(md5(uniqid('', true)), 0, 8);
    $ok = true;

    $statement = mysqli_prepare($connection,
        'INSERT INTO `singers` (name, genre, hometown, bio, song, imageUrl, sourceUrl, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())');
    $genre = 'Folk'; $blank = ''; $town = 'Probe City'; $bio = 'Temporary row written by setup-check.php.';
    mysqli_stmt_bind_param($statement, 'sssssss', $probe, $genre, $town, $bio, $blank, $blank, $blank);
    $ok = mysqli_stmt_execute($statement);
    $probeId = mysqli_stmt_insert_id($statement);
    mysqli_stmt_close($statement);
    check($checks, 'CREATE a singer', (bool) $ok, $ok ? 'new id ' . $probeId : mysqli_error($connection),
          'The database user may lack INSERT rights.');

    if ($ok) {
        $result = mysqli_query($connection,
            "SELECT name, favorite,
                    DATE_FORMAT(updatedAt, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt
             FROM `singers` WHERE id = " . (int) $probeId);
        $row = mysqli_fetch_assoc($result);
        check($checks, 'READ it back', $row && $row['name'] === $probe,
              $row ? 'updatedAt = ' . $row['updatedAt'] . ' (this must look like an ISO date)' : 'not found');

        $renamed = $probe . '_edited';
        $statement = mysqli_prepare($connection,
            'UPDATE `singers` SET name = ?, updatedAt = UTC_TIMESTAMP() WHERE id = ?');
        mysqli_stmt_bind_param($statement, 'si', $renamed, $probeId);
        $updated = mysqli_stmt_execute($statement) && mysqli_stmt_affected_rows($statement) === 1;
        mysqli_stmt_close($statement);
        check($checks, 'UPDATE it', $updated, '', 'The database user may lack UPDATE rights.');

        mysqli_query($connection, 'UPDATE `singers` SET favorite = 1 - favorite WHERE id = ' . (int) $probeId);
        $result = mysqli_query($connection, 'SELECT favorite FROM `singers` WHERE id = ' . (int) $probeId);
        $row = mysqli_fetch_assoc($result);
        check($checks, 'TOGGLE favourite', $row && (int) $row['favorite'] === 1, 'favorite = ' . $row['favorite']);

        // Duplicate names must be refused -- that is what the UNIQUE key is for.
        $statement = mysqli_prepare($connection,
            'INSERT INTO `singers` (name, genre, createdAt, updatedAt) VALUES (?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())');
        mysqli_stmt_bind_param($statement, 'ss', $renamed, $genre);
        @mysqli_stmt_execute($statement);
        $errno = mysqli_stmt_errno($statement);
        mysqli_stmt_close($statement);
        if ($errno !== 1062) {
            mysqli_query($connection, "DELETE FROM `singers` WHERE name = '" . mysqli_real_escape_string($connection, $renamed) . "' AND id <> " . (int) $probeId);
        }
        check($checks, 'Duplicate name refused', $errno === 1062, 'MySQL error ' . $errno . ' (1062 = duplicate key, which is what we want)',
              'The UNIQUE key on name is missing, so two profiles could share a name.');

        $deleted = mysqli_query($connection, 'DELETE FROM `singers` WHERE id = ' . (int) $probeId);
        check($checks, 'DELETE it (cleanup)', (bool) $deleted, 'probe row removed',
              'Delete the row named ' . $probe . '_edited by hand in phpMyAdmin.');
    }
}

/* ------------------------------------------------------------- 6. Report */

$passed = 0;
$failed = 0;
foreach ($checks as $c) {
    if ($c['ok']) { $passed++; } else { $failed++; }
}

$scheme  = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$dir     = rtrim(str_replace('\\', '/', dirname($_SERVER['PHP_SELF'])), '/');
$baseUrl = $scheme . '://' . $_SERVER['HTTP_HOST'] . $dir;
$apiUrl  = $baseUrl . '/singers.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tinig setup check</title>
<style>
  :root { color-scheme: light dark; --bg:#faf7f2; --card:#fff; --ink:#1c1917; --muted:#6b6560;
          --line:#e7e1d8; --ok:#1a7f4b; --bad:#b83826; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#171513; --card:#201d1a; --ink:#f5f1ea; --muted:#a29a91; --line:#332e29;
            --ok:#4ade80; --bad:#f87171; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:32px 16px; background:var(--bg); color:var(--ink);
         font:16px/1.55 -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  .sub { color: var(--muted); margin: 0 0 24px; }
  .banner { padding:16px 20px; border-radius:14px; font-weight:600; margin-bottom:24px;
            background:var(--card); border:1px solid var(--line); border-left:5px solid var(--ok); }
  .banner.bad { border-left-color: var(--bad); }
  ul { list-style:none; margin:0 0 28px; padding:0; border:1px solid var(--line);
       border-radius:14px; overflow:hidden; background:var(--card); }
  li { display:flex; gap:12px; padding:13px 18px; border-top:1px solid var(--line); }
  li:first-child { border-top:0; }
  .mark { flex:0 0 22px; font-weight:700; }
  .pass .mark { color:var(--ok); } .flunk .mark { color:var(--bad); }
  .label { font-weight:600; }
  .detail, .hint { display:block; font-weight:400; font-size:14px; color:var(--muted); margin-top:2px; }
  .hint { color:var(--bad); }
  code, pre { font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size:13.5px; }
  pre { background:var(--card); border:1px solid var(--line); border-radius:12px;
        padding:14px 16px; overflow-x:auto; }
  h2 { font-size:18px; margin:28px 0 10px; }
  a { color: inherit; }
  .row { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px; }
  .btn { display:inline-block; padding:9px 16px; border-radius:999px; text-decoration:none;
         border:1px solid var(--line); background:var(--card); font-size:14px; font-weight:600; }
</style>
</head>
<body>
<main>
  <h1>Tinig setup check</h1>
  <p class="sub"><?php echo date('D, d M Y H:i'); ?> server time</p>

  <div class="banner <?php echo $failed ? 'bad' : ''; ?>">
    <?php if ($failed): ?>
      <?php echo $failed; ?> check<?php echo $failed === 1 ? '' : 's'; ?> failed,
      <?php echo $passed; ?> passed. Fix the red rows below, then reload.
    <?php else: ?>
      All <?php echo $passed; ?> checks passed. The database side is working &mdash;
      point the app at the URL below.
    <?php endif; ?>
  </div>

  <div class="row">
    <a class="btn" href="?">Re-run checks</a>
    <a class="btn" href="?install=1">Create table + seed</a>
    <a class="btn" href="singers.php">Open the API</a>
  </div>

  <ul>
    <?php foreach ($checks as $c): ?>
      <li class="<?php echo $c['ok'] ? 'pass' : 'flunk'; ?>">
        <span class="mark"><?php echo $c['ok'] ? '&#10003;' : '&#10007;'; ?></span>
        <span class="label">
          <?php echo htmlspecialchars($c['label']); ?>
          <?php if ($c['detail'] !== ''): ?>
            <span class="detail"><?php echo htmlspecialchars($c['detail']); ?></span>
          <?php endif; ?>
          <?php if (!$c['ok'] && $c['hint'] !== ''): ?>
            <span class="hint"><?php echo htmlspecialchars($c['hint']); ?></span>
          <?php endif; ?>
        </span>
      </li>
    <?php endforeach; ?>
  </ul>

  <h2>Put this in the app's .env</h2>
<pre>EXPO_PUBLIC_API_URL=<?php echo htmlspecialchars($apiUrl); ?></pre>

  <h2>Try the API by hand</h2>
<pre>curl "<?php echo htmlspecialchars($apiUrl); ?>"

curl -X POST "<?php echo htmlspecialchars($apiUrl); ?>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Singer","genre":"Pop","hometown":"","bio":"","song":"","imageUrl":"","sourceUrl":""}'

curl -X DELETE "<?php echo htmlspecialchars($apiUrl); ?>?id=REPLACE_WITH_ID"</pre>

  <p class="sub">Delete setup-check.php once the app is talking to the database.</p>
</main>
</body>
</html>
