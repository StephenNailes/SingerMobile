<?php
/**
 * Database connection -- drop-in replacement for the connection.php already on
 * FreeHostia. Same class name, same method, same credentials, so students.php
 * and pinoysingers.php keep working unchanged.
 *
 * Two things were added:
 *   1. set_charset('utf8mb4') -- without it, "Bamboo Manalac" loses its n-tilde
 *      and emoji turn into question marks on the way in and out of MySQL.
 *   2. One connection per request, reused -- FreeHostia's free plan caps
 *      concurrent MySQL connections, and a JSON error beats a white die() page.
 *
 * If you would rather not touch your existing file, keep yours: singers.php
 * only needs a dbObj with getConnstring(). You will just be on latin1.
 */

class dbObj
{
    var $servername = "localhost";
    var $username   = "stenai4_nailes_db";
    var $password   = "rOl88G7zA@";
    var $dbname     = "stenai4_nailes_db";
    var $conn;

    private static $shared = null;

    public function getConnstring()
    {
        if (self::$shared instanceof mysqli) {
            $this->conn = self::$shared;
            return $this->conn;
        }

        $this->conn = @mysqli_connect(
            $this->servername,
            $this->username,
            $this->password,
            $this->dbname
        );

        if (!$this->conn) {
            // An API caller gets JSON, not an HTML death page.
            if (!headers_sent()) {
                header('Content-Type: application/json; charset=utf-8');
                http_response_code(500);
            }
            echo json_encode(array(
                'status'  => 0,
                'message' => 'Database connection failed: ' . mysqli_connect_error(),
            ));
            exit;
        }

        mysqli_set_charset($this->conn, 'utf8mb4');

        self::$shared = $this->conn;
        return $this->conn;
    }
}
