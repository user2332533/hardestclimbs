-- Climbing Database Schema for D1

-- Athletes table
CREATE TABLE athletes (
  name TEXT,
  nationality TEXT,
  gender TEXT,
  year_of_birth INTEGER,
  record_created TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'pending', 'rejected')),
  hash TEXT,
  PRIMARY KEY (name, record_created)
);

-- Climbs table
CREATE TABLE climbs (
  name TEXT,
  climb_type TEXT NOT NULL CHECK (climb_type IN ('sport', 'boulder')),
  grade TEXT NOT NULL,
  location_country TEXT,
  location_area TEXT,
  location_latitude REAL,
  location_longitude REAL,
  record_created TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'pending', 'rejected')),
  hash TEXT,
  PRIMARY KEY (name, record_created)
);

-- Ascents table
CREATE TABLE ascents (
  climb_name TEXT NOT NULL,
  athlete_name TEXT NOT NULL,
  date_of_ascent TEXT,
  web_link TEXT,
  record_created TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'pending', 'rejected')),
  hash TEXT,
  PRIMARY KEY (climb_name, athlete_name, record_created),
  FOREIGN KEY (climb_name) REFERENCES climbs(name),
  FOREIGN KEY (athlete_name) REFERENCES athletes(name)
);

-- Indexes for performance
CREATE INDEX idx_ascents_climb_name ON ascents(climb_name);
CREATE INDEX idx_ascents_athlete_name ON ascents(athlete_name);
CREATE INDEX idx_climbs_type ON climbs(climb_type);
CREATE INDEX idx_athletes_status ON athletes(status);
CREATE INDEX idx_athletes_name_created ON athletes(name, record_created);
CREATE INDEX idx_climbs_name_created ON climbs(name, record_created);
CREATE INDEX idx_ascents_name_created ON ascents(climb_name, athlete_name, record_created);