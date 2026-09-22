<?php
/**
 * Tinig singer directory REST API.
 *
 * GET    singers.php                 -> all singers (A-Z)
 * GET    singers.php?id=5            -> one singer
 * GET    singers.php?q=lea           -> search name / hometown / song
 * GET    singers.php?genre=Pop       -> filter by genre
 * GET    singers.php?favorite=1      -> saved only
 * POST   singers.php                 -> create   (JSON body)
 * PUT    singers.php?id=5            -> update   (JSON body)
 * PATCH  singers.php?id=5            -> toggle favorite, or set {"favorite":1}
 * DELETE singers.php?id=5            -> delete
 *
 * Every response is JSON. Success: the singer row, or a list of rows.
 * Failure: {"status":0,"message":"...","errors":{"field":"..."}}
 *
 * Hosts that block PUT/PATCH/DELETE: send POST with ?_method=PUT (or the
 * X-HTTP-Method-Override header) -- both are honoured below.
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-HTTP-Method-Override');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Never print warnings into the JSON body; log them instead.
ini_set('display_errors', '0');
error_reporting(E_ALL);

include_once 'connection.php';

/**
 * Bearer auth, off by default so you can get the app talking to the database
 * first. Flip this to true once it works, and set EXPO_PUBLIC_API_TOKEN in the
 * app's .env to the same token that auth.php holds.
 *
 * The preflight OPTIONS request above already returned: browsers never attach
 * the Authorization header to a preflight, so checking it there would break
 * Tinig on the web.
 */
define('REQUIRE_AUTH', false);

if (REQUIRE_AUTH) {
    include_once 'auth.php';
    $auth = new authObj();
    if (!$auth->authenticate()) {
        http_response_code(401);
        echo json_encode(array('status' => 0, 'message' => 'Invalid API token.'));
        exit;
    }
}

$db = new dbObj();
$connection = $db->getConnstring();

define('GENRES', 'Pop,R&B,Rock,Folk,Theatre');
define('FIELDS', 'name,genre,hometown,bio,song,imageUrl,sourceUrl');
// ISO-8601 UTC, exactly the shape `new Date(...)` expects in the app.
define('SELECT_COLS', "id, name, genre, hometown, bio, song, imageUrl, sourceUrl, favorite,
     DATE_FORMAT(createdAt, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt,
     DATE_FORMAT(updatedAt, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt");

function genres()
{
    return explode(',', GENRES);
}

function fields()
{
    return explode(',', FIELDS);
}

/* ---------------------------------------------------------------- helpers */

function respond($payload, $code = 200)
{
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail($message, $code = 400, $errors = null)
{
    $payload = array('status' => 0, 'message' => $message);
    if ($errors) {
        $payload['errors'] = $errors;
    }
    respond($payload, $code);
}

function body()
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return array();
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        fail('Send a JSON object as the request body.', 400);
    }
    return $data;
}

function requireId()
{
    if (!isset($_GET['id']) || !ctype_digit((string) $_GET['id']) || (int) $_GET['id'] < 1) {
        fail('Add ?id= with the singer id.', 400);
    }
    return (int) $_GET['id'];
}

function textLength($value)
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

/** Mirrors validateSinger() in src/data/singers.ts so both ends agree. */
function cleanInput($data)
{
    $errors = array();
    $clean  = array();

    foreach (fields() as $field) {
        $value = isset($data[$field]) ? $data[$field] : '';
        if (is_scalar($value)) {
            // Strip control characters, keep every real Unicode character.
            $stripped = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', (string) $value);
            $clean[$field] = trim($stripped === null ? (string) $value : $stripped);
        } else {
            $clean[$field] = '';
        }
    }

    $nameLength = textLength($clean['name']);
    if ($nameLength < 1) {
        $errors['name'] = 'Enter the singer\'s name.';
    } elseif ($nameLength > 80) {
        $errors['name'] = 'Use 80 characters or fewer.';
    }

    if (!in_array($clean['genre'], genres(), true)) {
        $errors['genre'] = 'Choose a genre from the list.';
    }

    $limits = array('hometown' => 100, 'song' => 120, 'bio' => 2000);
    foreach ($limits as $field => $limit) {
        if (textLength($clean[$field]) > $limit) {
            $errors[$field] = 'Use ' . $limit . ' characters or fewer.';
        }
    }

    foreach (array('imageUrl', 'sourceUrl') as $field) {
        if ($clean[$field] === '') {
            continue;
        }
        $parts = parse_url($clean[$field]);
        $valid = is_array($parts)
            && isset($parts['scheme']) && strtolower($parts['scheme']) === 'https'
            && !empty($parts['host'])
            && !isset($parts['user']) && !isset($parts['pass'])
            && strlen($clean[$field]) <= 2000;
        if (!$valid) {
            $errors[$field] = 'Enter a valid https:// link without a username or password.';
        }
    }

    if ($errors) {
        fail('Check the highlighted fields.', 422, $errors);
    }
    return $clean;
}

/** MySQL hands back strings; the app's types expect real numbers. */
function castRow($row)
{
    $row['id']       = (int) $row['id'];
    $row['favorite'] = (int) $row['favorite'];
    return $row;
}

function fetchSinger($id)
{
    global $connection;

    $statement = $connection->prepare('SELECT ' . SELECT_COLS . ' FROM singers WHERE id = ? LIMIT 1');
    $statement->bind_param('i', $id);
    $statement->execute();
    $result = $statement->get_result();
    $row    = $result ? $result->fetch_assoc() : null;
    $statement->close();

    return $row ? castRow($row) : null;
}

/* ----------------------------------------------------------------- routes */

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST') {
    $override = '';
    if (isset($_GET['_method'])) {
        $override = $_GET['_method'];
    } elseif (isset($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
        $override = $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'];
    }
    if ($override !== '') {
        $method = strtoupper($override);
    }
}

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            $singer = fetchSinger(requireId());
            if (!$singer) {
                fail('This singer no longer exists.', 404);
            }
            respond($singer);
        }
        listSingers();
        break;

    case 'POST':
        createSinger(cleanInput(body()));
        break;

    case 'PUT':
        updateSinger(requireId(), cleanInput(body()));
        break;

    case 'PATCH':
        setFavorite(requireId(), body());
        break;

    case 'DELETE':
        deleteSinger(requireId());
        break;

    default:
        header('Allow: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        fail('Method not supported.', 405);
}

/* -------------------------------------------------------------- endpoints */

function listSingers()
{
    global $connection;

    $where  = array();
    $params = array();
    $types  = '';

    if (isset($_GET['genre']) && $_GET['genre'] !== '' && $_GET['genre'] !== 'All') {
        if (!in_array($_GET['genre'], genres(), true)) {
            fail('Unknown genre.', 400);
        }
        $where[]  = 'genre = ?';
        $params[] = $_GET['genre'];
        $types   .= 's';
    }

    if (isset($_GET['favorite']) && $_GET['favorite'] !== '') {
        $where[]  = 'favorite = ?';
        $params[] = (int) ((bool) $_GET['favorite']);
        $types   .= 'i';
    }

    $query = isset($_GET['q']) ? trim($_GET['q']) : '';
    if ($query !== '') {
        // Escape LIKE wildcards so a literal % or _ searches for itself.
        $like     = '%' . str_replace(array('\\', '%', '_'), array('\\\\', '\\%', '\\_'), $query) . '%';
        $where[]  = '(name LIKE ? OR hometown LIKE ? OR song LIKE ?)';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
        $types   .= 'sss';
    }

    $sql = 'SELECT ' . SELECT_COLS . ' FROM singers';
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    // name is indexed, so this ORDER BY is served straight from the index.
    $sql .= ' ORDER BY name ASC, id ASC';

    $statement = $connection->prepare($sql);
    if ($params) {
        $bind = array($types);
        foreach ($params as $index => $value) {
            $bind[] = &$params[$index];
        }
        call_user_func_array(array($statement, 'bind_param'), $bind);
    }
    $statement->execute();
    $result = $statement->get_result();

    $rows = array();
    while ($row = $result->fetch_assoc()) {
        $rows[] = castRow($row);
    }
    $statement->close();

    respond($rows);
}

function createSinger($input)
{
    global $connection;

    $sql = 'INSERT INTO singers (name, genre, hometown, bio, song, imageUrl, sourceUrl, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())';
    $statement = $connection->prepare($sql);
    $statement->bind_param(
        'sssssss',
        $input['name'],
        $input['genre'],
        $input['hometown'],
        $input['bio'],
        $input['song'],
        $input['imageUrl'],
        $input['sourceUrl']
    );

    if (!@$statement->execute()) {
        $duplicate = ($statement->errno === 1062);
        $statement->close();
        if ($duplicate) {
            fail(
                'A singer with this name already exists. Use a different name or edit the existing profile.',
                409,
                array('name' => 'This name is already in the directory.')
            );
        }
        fail('Your changes could not be saved. Please try again.', 500);
    }

    $id = (int) $statement->insert_id;
    $statement->close();

    respond(fetchSinger($id), 201);
}

function updateSinger($id, $input)
{
    global $connection;

    $sql = 'UPDATE singers SET name = ?, genre = ?, hometown = ?, bio = ?, song = ?,
                   imageUrl = ?, sourceUrl = ?, updatedAt = UTC_TIMESTAMP()
            WHERE id = ?';
    $statement = $connection->prepare($sql);
    $statement->bind_param(
        'sssssssi',
        $input['name'],
        $input['genre'],
        $input['hometown'],
        $input['bio'],
        $input['song'],
        $input['imageUrl'],
        $input['sourceUrl'],
        $id
    );

    if (!@$statement->execute()) {
        $duplicate = ($statement->errno === 1062);
        $statement->close();
        if ($duplicate) {
            fail(
                'A singer with this name already exists. Use a different name or edit the existing profile.',
                409,
                array('name' => 'This name is already in the directory.')
            );
        }
        fail('Your changes could not be saved. Please try again.', 500);
    }
    $statement->close();

    // affected_rows is 0 for an unchanged row too, so confirm by reading it back.
    $singer = fetchSinger($id);
    if (!$singer) {
        fail('This singer no longer exists. Return to the directory.', 404);
    }
    respond($singer);
}

function setFavorite($id, $data)
{
    global $connection;

    if (array_key_exists('favorite', $data)) {
        $favorite  = (int) ((bool) $data['favorite']);
        $statement = $connection->prepare(
            'UPDATE singers SET favorite = ?, updatedAt = UTC_TIMESTAMP() WHERE id = ?'
        );
        $statement->bind_param('ii', $favorite, $id);
    } else {
        // Toggle inside the statement: no read-modify-write race between devices.
        $statement = $connection->prepare(
            'UPDATE singers SET favorite = 1 - favorite, updatedAt = UTC_TIMESTAMP() WHERE id = ?'
        );
        $statement->bind_param('i', $id);
    }

    $statement->execute();
    $statement->close();

    $singer = fetchSinger($id);
    if (!$singer) {
        fail('This singer no longer exists. Return to the directory.', 404);
    }
    respond($singer);
}

function deleteSinger($id)
{
    global $connection;

    $statement = $connection->prepare('DELETE FROM singers WHERE id = ?');
    $statement->bind_param('i', $id);
    $statement->execute();
    $deleted = $statement->affected_rows;
    $statement->close();

    if ($deleted < 1) {
        fail('This singer no longer exists. Return to the directory.', 404);
    }
    respond(array('status' => 1, 'id' => $id, 'message' => 'Singer deleted.'));
}
