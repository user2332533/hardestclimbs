// Shared functions for all pages

// Grade conversion function
export function convertGrade(frenchGrade, climbType) {
  if (!frenchGrade) return frenchGrade;
  
  const sportGrades = {
    '9a+/b': '5.15a/b',
    '9b': '5.15b',
    '9b/+': '5.15b/c',
    '9b+': '5.15c',
    '9b/c': '5.15c/d',
    '9c': '5.15d',
    '9c/+': '5.15d/16a',
    '9c+': '5.16a'
  };
  
  const boulderGrades = {
    '8C': 'V15',
    '8C/+': 'V15/V16',
    '8C+': 'V16',
    '8C+/9A': 'V16/V17',
    '9A': 'V17',
    '9A/+': 'V17/18',
    '9A+': 'V18'
  };
  
  const mapping = climbType === 'sport' ? sportGrades : boulderGrades;
  const americanGrade = mapping[frenchGrade];
  
  if (americanGrade) {
    return `${frenchGrade} (${americanGrade})`;
  }
  
  return frenchGrade;
}

// Shared database function for getting climbs with ascents
export async function getClimbsWithAscents(db, type) {
  const baseQuery = `
    WITH valid_climbs AS (
      SELECT 
        *, 
        ROW_NUMBER() OVER (PARTITION BY name ORDER BY record_created DESC, hash DESC) AS rn
      FROM climbs 
      WHERE 
        climb_type = ? AND 
        status = 'valid'
    ), 
    latest_climbs AS (
      SELECT 
        name,
        grade,
        location_country,
        location_area,
        location_latitude,
        location_longitude
      FROM valid_climbs
      WHERE rn = 1
    ), 
    valid_ascents AS (
      SELECT 
        *, 
        ROW_NUMBER() OVER (PARTITION BY a.climb_name, a.athlete_name ORDER BY a.record_created DESC, a.hash DESC) AS rn
      FROM ascents a
      WHERE a.status = 'valid'
    ), 
    latest_ascents AS (
      SELECT 
        climb_name,
        athlete_name,
        date_of_ascent,
        web_link,
        MIN(date_of_ascent) OVER (PARTITION BY climb_name) AS date_of_first_ascent
      FROM valid_ascents
      WHERE rn = 1
    ) 
    SELECT *
    FROM latest_climbs AS lc
    LEFT JOIN latest_ascents AS la 
      ON lc.name = la.climb_name
    ORDER BY 
      lc.grade DESC, 
      CASE WHEN la.date_of_first_ascent IS NULL THEN 1 ELSE 0 END,
      la.date_of_first_ascent,
      la.date_of_ascent
  `;
  
  const stmt = db.prepare(baseQuery);
  const result = await stmt.bind(type).all();
  
  // Group results by climb name
  const climbsMap = new Map();
  
  result.results.forEach(row => {
    const climbName = row.name;
    
    if (!climbsMap.has(climbName)) {
      climbsMap.set(climbName, {
        name: climbName,
        grade: row.grade,
        location_country: row.location_country,
        location_area: row.location_area,
        location_latitude: row.location_latitude,
        location_longitude: row.location_longitude,
        ascents: []
      });
    }
    
    // Add ascent if it exists
    if (row.athlete_name) {
      climbsMap.get(climbName).ascents.push({
        athlete_name: row.athlete_name,
        date_of_ascent: row.date_of_ascent,
        web_link: row.web_link
      });
    }
  });
  
  // Convert to array and sort ascents by date
  const climbs = Array.from(climbsMap.values());
  climbs.forEach(climb => {
    climb.ascents.sort((a, b) => {
      if (!a.date_of_ascent) return 1;
      if (!b.date_of_ascent) return -1;
      return new Date(a.date_of_ascent) - new Date(b.date_of_ascent);
    });
  });
  
  return climbs;
}

// Shared database function for getting athletes with their ascents
export async function getAthletesWithAscents(db) {
  const athletesQuery = `
    WITH latest_athletes AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY name ORDER BY record_created DESC, hash DESC) as rn
      FROM athletes 
      WHERE status = 'valid'
    ),
    valid_ascents AS (
      SELECT 
        a.*, 
        c.grade, 
        c.climb_type, 
        c.location_country, 
        c.location_area,
        ROW_NUMBER() OVER (PARTITION BY a.climb_name, a.athlete_name ORDER BY a.record_created DESC, a.hash DESC) AS rn
      FROM ascents a 
      JOIN climbs c ON a.climb_name = c.name 
      WHERE a.status = 'valid'
    ),
    latest_ascents AS (
      SELECT 
        athlete_name,
        climb_name,
        grade,
        climb_type,
        location_country,
        location_area,
        date_of_ascent,
        web_link
      FROM valid_ascents
      WHERE rn = 1
    )
    SELECT 
      la.name,
      la.nationality,
      la.gender,
      la.year_of_birth,
      le.athlete_name,
      le.climb_name,
      le.grade,
      le.climb_type,
      le.location_country,
      le.location_area,
      le.date_of_ascent,
      le.web_link
    FROM latest_athletes la
    LEFT JOIN latest_ascents le ON la.name = le.athlete_name
    WHERE la.rn = 1
    ORDER BY la.name, le.date_of_ascent DESC
  `;
  
  const result = await db.prepare(athletesQuery).all();
  
  // Group results by athlete name
  const athletesMap = new Map();
  
  result.results.forEach(row => {
    const athleteName = row.name;
    
    if (!athletesMap.has(athleteName)) {
      athletesMap.set(athleteName, {
        name: athleteName,
        nationality: row.nationality,
        gender: row.gender,
        year_of_birth: row.year_of_birth,
        ascents: []
      });
    }
    
    // Add ascent if it exists
    if (row.climb_name) {
      athletesMap.get(athleteName).ascents.push({
        climb_name: row.climb_name,
        grade: row.grade,
        climb_type: row.climb_type,
        location_country: row.location_country,
        location_area: row.location_area,
        date_of_ascent: row.date_of_ascent,
        web_link: row.web_link
      });
    }
  });
  
  // Convert to array and calculate stats
  const athletes = Array.from(athletesMap.values());
  athletes.forEach(athlete => {
    // Calculate ascent counts
    athlete.sportAscentCount = athlete.ascents.filter(a => a.climb_type === 'sport').length;
    athlete.boulderAscentCount = athlete.ascents.filter(a => a.climb_type === 'boulder').length;
    athlete.totalAscentCount = athlete.ascents.length;
    
    // Get first ascent date for ordering
    const allDates = athlete.ascents.map(a => a.date_of_ascent).filter(d => d);
    athlete.firstAscentDate = allDates.length > 0 ? Math.min(...allDates.map(d => new Date(d))) : null;
  });
  
  // Sort by total ascents DESC, first ascent date, name
  athletes.sort((a, b) => {
    // First by total ascents (descending)
    if (b.totalAscentCount !== a.totalAscentCount) {
      return b.totalAscentCount - a.totalAscentCount;
    }
    
    // Then by first ascent date (ascending - earlier first)
    if (a.firstAscentDate && b.firstAscentDate) {
      return a.firstAscentDate - b.firstAscentDate;
    }
    if (a.firstAscentDate && !b.firstAscentDate) return -1;
    if (!a.firstAscentDate && b.firstAscentDate) return 1;
    
    // Finally by name (alphabetical)
    return a.name.localeCompare(b.name);
  });
  
  return athletes;
}

// Shared HTML generation function for climbs
export function generateClimbHtml(climb, type) {
  const ascentsList = climb.ascents.map(ascent => {
    const athleteName = ascent.athlete_name.replace(/\s+/g, '-').toLowerCase();
    const videoLink = ascent.web_link ? ` <a href="${ascent.web_link}" target="_blank">▶️</a>` : '';
    const ascentDate = ascent.date_of_ascent ? ` ${ascent.date_of_ascent}` : '';
    return `<li><a href="/athletes/${athleteName}">${ascent.athlete_name}</a>${videoLink}${ascentDate}</li>`;
  }).join('');
  
  const locationLink = climb.location_latitude && climb.location_longitude 
    ? `https://www.openstreetmap.org/?mlat=${climb.location_latitude}&mlon=${climb.location_longitude}&zoom=12`
    : '#';
  
  const locationText = climb.location_area && climb.location_country 
    ? `${climb.location_area}, ${climb.location_country}`
    : climb.location_country || 'Unknown location';
  
  const convertedGrade = convertGrade(climb.grade, type);
  const climbSlug = climb.name.replace(/\s+/g, '-').toLowerCase();
  return `
    <climb data-name="${climb.name.toLowerCase()}">
      <h2><a href="/${type}/${climbSlug}" class="link-light">${climb.name}</a></h2>
      <div class="climb-details">
        <b>Grade:</b> ${convertedGrade}<br>
        <b>Location:</b> <a href="${locationLink}" class="link-light" target="_blank">${locationText}</a><br>
      </div>
      <div class="ascents-section">
        <h3>Ascents</h3>
        <ul>
          ${ascentsList || '<li>No ascents recorded</li>'}
        </ul>
      </div>
    </climb>
  `;
}
export function generateBaseHeader(title, currentPage) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - Hardest Climbs</title>
        <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
        <div class="container">
            <header>
                <div class="header-content">
                    <div class="header-title">
                        <h1><a href="/">Hardest Climbs</a></h1>
                    </div>
                    <nav>
                        <a href="/" class="${currentPage === 'home' ? 'current' : ''}">Home</a>
                        <a href="/sport" class="${currentPage === 'sport' ? 'current' : ''}">Sport Climbs</a>
                        <a href="/boulder" class="${currentPage === 'boulder' ? 'current' : ''}">Boulders</a>
                        <a href="/athletes" class="${currentPage === 'athletes' ? 'current' : ''}">Athletes</a>
                        <a href="/export">Export</a>
                    </nav>
                </div>
            </header>
            
            <main>
  `;
}

export function generateBaseFooter() {
  return `
            </main>
        </div>
        
        <script>
          // System theme detection
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
          }
          
          // Listen for system theme changes
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
          });
        </script>
    </body>
    </html>
  `;
}

export function generateErrorPage(message) {
  return generateBaseHeader('Error', 'Error') + `
        <div class="error">
            <h2>Temporary Error</h2>
            <p>${message}</p>
            <p>Please try again later or <a href="/">return to home</a>.</p>
        </div>
      ` + generateBaseFooter();
}

// Shared HTML generation function for athletes
export function generateAthleteHtml(athlete) {
  // Separate ascents by type and sort by date
  const sportAscents = athlete.ascents
    .filter(ascent => ascent.climb_type === 'sport')
    .sort((a, b) => new Date(b.date_of_ascent || '9999') - new Date(a.date_of_ascent || '9999'));
    
  const boulderAscents = athlete.ascents
    .filter(ascent => ascent.climb_type === 'boulder')
    .sort((a, b) => new Date(b.date_of_ascent || '9999') - new Date(a.date_of_ascent || '9999'));
  
  const generateAscentsList = (ascents) => {
    if (ascents.length === 0) return '<li>No ascents recorded</li>';
    
    return ascents.map(ascent => {
      const climbSlug = ascent.climb_name.replace(/\s+/g, '-').toLowerCase();
      const climbType = ascent.climb_type === 'sport' ? 'sport' : 'boulder';
      const videoLink = ascent.web_link ? ` <a href="${ascent.web_link}" target="_blank">▶️</a>` : '';
      const ascentDate = ascent.date_of_ascent ? ` ${ascent.date_of_ascent}` : '';
      const convertedGrade = convertGrade(ascent.grade, climbType);
      return `<li><a href="/${climbType}/${climbSlug}">${ascent.climb_name}</a> - ${convertedGrade}${videoLink}${ascentDate}</li>`;
    }).join('');
  };
  
  const athleteSlug = athlete.name.replace(/\s+/g, '-').toLowerCase();
  
  return `
    <athlete data-name="${athlete.name.toLowerCase()}">
      <h2><a href="/athletes/${athleteSlug}" class="link-light">${athlete.name}</a></h2>
      <div class="athlete-details">
        <b>Nationality:</b> ${athlete.nationality || 'Unknown'}<br>
        <b>Gender:</b> ${athlete.gender || 'Unknown'}<br>
        <b>Year of Birth:</b> ${athlete.year_of_birth || 'Unknown'}<br>
        <b>Total Ascents:</b> ${athlete.totalAscentCount}
      </div>
      
      ${sportAscents.length > 0 ? `
        <div class="ascents-section">
          <h3>Sport Climbing Ascents (${athlete.sportAscentCount})</h3>
          <ul>
            ${generateAscentsList(sportAscents)}
          </ul>
        </div>
      ` : ''}
      
      ${boulderAscents.length > 0 ? `
        <div class="ascents-section">
          <h3>Bouldering Ascents (${athlete.boulderAscentCount})</h3>
          <ul>
            ${generateAscentsList(boulderAscents)}
          </ul>
        </div>
      ` : ''}
    </athlete>
  `;
}

export function generateNotFoundPage(type, name) {
  return generateBaseHeader('Not Found', 'Not Found') + `
        <div class="error">
            <h2>${type} Not Found</h2>
            <p>The ${type.toLowerCase()} "${name}" was not found in our database.</p>
            <p><a href="/${type.toLowerCase()}s">← Back to ${type}s</a></p>
        </div>
      ` + generateBaseFooter();
}