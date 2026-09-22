-- ============================================================================
--  Tinig singer directory -- MySQL schema for FreeHostia
--  Run this once in phpMyAdmin:  FreeHostia control panel -> MySQL -> phpMyAdmin
--  Pick your database in the left sidebar FIRST, then open the SQL tab and
--  paste everything below.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
-- Notes on the choices here:
--   * InnoDB           -- row-level locks and real transactions, so two phones
--                         writing at the same time never block the whole table.
--   * utf8mb4          -- "Bamboo Mañalac" and emoji both survive a round trip.
--   * ENUM for genre   -- one byte on disk, and MySQL itself rejects a genre
--                         that is not one of the five the app offers.
--   * VARCHAR sizes    -- match the limits validateSinger() enforces in the app.
--   * DATETIME (UTC)   -- the API writes UTC_TIMESTAMP() and reads the values
--                         back as ISO-8601, which is what `new Date(...)` wants.
--                         Never TIMESTAMP: that shifts with the server timezone.

CREATE TABLE IF NOT EXISTS `singers` (
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

  -- Same rule as the app: one profile per name, compared case-insensitively
  -- (the utf8mb4_unicode_ci collation is what makes "lea" match "Lea").
  -- This index also serves the default "ORDER BY name" listing with no filesort.
  UNIQUE KEY `singers_name` (`name`),

  -- Covers ?genre=Pop and ?genre=Pop ordered by name, in one index.
  KEY `singers_genre_name` (`genre`, `name`),

  -- Covers the Saved tab: ?favorite=1 ordered by name.
  KEY `singers_favorite_name` (`favorite`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Seed rows -- the six singers the app ships with
-- ---------------------------------------------------------------------------
-- INSERT IGNORE: safe to re-run. Existing rows with the same name are skipped
-- instead of raising a duplicate-key error.

INSERT IGNORE INTO `singers` (`name`, `genre`, `hometown`, `bio`, `song`, `imageUrl`, `sourceUrl`) VALUES
('Gary Valenciano', 'Pop', '', 'Filipino singer and performer whose work spans pop and inspirational music, recordings, television, and live concerts.', '', '', 'https://www.garyv.com/about-gary-v'),
('Regine Velasquez', 'Pop', '', 'Filipino singer and actress known for her powerful vocals and a career spanning pop ballads, concerts, and screen performances.', '', '', 'https://music.apple.com/us/artist/regine-velasquez/32340032'),
('Lea Salonga', 'Theatre', '', 'Filipino singer and actress whose work spans musical theatre, concert stages, and the singing voices of Disney princesses Jasmine and Mulan.', '', '', 'https://www.leasalonga.com/about'),
('Sarah Geronimo', 'Pop', '', 'Filipino singer, actress, and performer with a career spanning pop recordings, concerts, television, and film.', '', '', 'https://sarah-geronimo.com/'),
('Moira dela Torre', 'Pop', '', 'Filipino singer-songwriter known for her expressive voice and heartfelt songs.', '', '', 'https://www.tatlerasia.com/people/moira-dela-torre'),
('Bamboo Mañalac', 'Rock', '', 'Filipino rock vocalist and solo recording artist, also known for his work with Rivermaya and the band Bamboo.', '', '', 'https://music.apple.com/us/artist/bamboo-manalac/324891781');

-- ---------------------------------------------------------------------------
-- Optional: faster search once the directory grows past a few hundred rows
-- ---------------------------------------------------------------------------
-- The API's ?q= search uses LIKE '%term%', which cannot use a normal index.
-- That is fine for a class directory. If yours grows large and the host runs
-- MySQL 5.6+ on InnoDB, add a FULLTEXT index and switch the search branch in
-- singers.php to MATCH ... AGAINST:
--
--   ALTER TABLE `singers` ADD FULLTEXT KEY `singers_search` (`name`, `hometown`, `song`);
--
-- If the ALTER fails with "The used table type doesn't support FULLTEXT
-- indexes", the host is on an older MySQL -- keep the LIKE search.

-- ---------------------------------------------------------------------------
-- If CREATE TABLE fails on an old MySQL (5.5 or older)
-- ---------------------------------------------------------------------------
-- "DEFAULT CURRENT_TIMESTAMP" on a DATETIME column needs MySQL 5.6+.
-- The API always writes both timestamps itself, so you can simply drop the two
-- DEFAULT clauses:
--
--   `createdAt` DATETIME NOT NULL,
--   `updatedAt` DATETIME NOT NULL,
--
-- and re-run the CREATE TABLE above.

-- ---------------------------------------------------------------------------
-- Handy checks
-- ---------------------------------------------------------------------------
-- SELECT COUNT(*) AS singers FROM `singers`;
-- SHOW CREATE TABLE `singers`;
-- EXPLAIN SELECT * FROM `singers` WHERE genre = 'Pop' ORDER BY name;   -- expect "Using index condition", no "Using filesort"
