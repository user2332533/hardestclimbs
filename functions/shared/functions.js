// Shared functions for all pages

// Configuration constants
export const CONFIG = {
  CACHE_DURATIONS: {
    SHORT: 300,   // 5 minutes
    MEDIUM: 600, // 10 minutes
    LONG: 1800   // 30 minutes
  },
  GRADE_MAPPINGS: {
    sport: {
      '9a+/b': '5.15a/b',
      '9b': '5.15b',
      '9b/+': '5.15b/c',
      '9b+': '5.15c',
      '9b/c': '5.15c/d',
      '9c': '5.15d',
      '9c/+': '5.15d/16a',
      '9c+': '5.16a'
    },
    boulder: {
      '8C': 'V15',
      '8C/+': 'V15/V16',
      '8C+': 'V16',
      '8C+/9A': 'V16/V17',
      '9A': 'V17',
      '9A/+': 'V17/18',
      '9A+': 'V18'
    }
  }
};

// Database functions for climb detail pages
export async function getClimbByName(db, name, type) {
  const query = `
    WITH latest_climbs AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY name ORDER BY record_created DESC, hash DESC) as rn
      FROM climbs 
      WHERE status = 'valid' AND LOWER(name) = LOWER(?) AND climb_type = ?
    )
    SELECT name, climb_type, grade, location_country, location_area, location_latitude, location_longitude
    FROM latest_climbs 
    WHERE rn = 1
  `;
  
  const result = await db.prepare(query).bind(name, type).first();
  return result;
}

export async function getClimbAscents(db, climbName) {
  const query = `
    WITH latest_ascents AS (
      SELECT a.*, c.grade, c.climb_type, c.location_country, c.location_area,
             ROW_NUMBER() OVER (PARTITION BY a.climb_name, a.athlete_name ORDER BY a.record_created DESC, a.hash DESC) as rn
      FROM ascents a 
      JOIN climbs c ON a.climb_name = c.name 
      WHERE a.status = 'valid' AND LOWER(a.climb_name) = LOWER(?)
    )
    SELECT * FROM latest_ascents 
    WHERE rn = 1
    ORDER BY date_of_ascent DESC
  `;
  
  const result = await db.prepare(query).bind(climbName).all();
  return result.results;
}

// Grade conversion function
export function convertGrade(frenchGrade, climbType) {
  if (!frenchGrade) return frenchGrade;
  
  const mapping = CONFIG.GRADE_MAPPINGS[climbType];
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

// Shared function for getting athlete by name with accent handling
export async function getAthleteByName(db, name) {
  // Try exact match first
  const exactQuery = `
    WITH latest_athletes AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY name ORDER BY record_created DESC, hash DESC) as rn
      FROM athletes 
      WHERE status = 'valid' AND LOWER(name) = LOWER(?)
    )
    SELECT name, nationality, gender, year_of_birth
    FROM latest_athletes 
    WHERE rn = 1
  `;
  
  let result = await db.prepare(exactQuery).bind(name).first();
  
  // If not found, try accent-insensitive match
  if (!result) {
    const allQuery = `
      WITH latest_athletes AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY name ORDER BY record_created DESC, hash DESC) as rn
        FROM athletes 
        WHERE status = 'valid'
      )
      SELECT name, nationality, gender, year_of_birth
      FROM latest_athletes 
      WHERE rn = 1
    `;
    
    const allAthletes = await db.prepare(allQuery).all();
    const normalizedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    
    result = allAthletes.results.find(athlete => 
      athlete.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/-/g, ' ').toLowerCase() === normalizedName
    );
  }
  
  return result;
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
  const climbSlug = climb.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').toLowerCase();
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
      const climbSlug = ascent.climb_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').toLowerCase();
      const climbType = ascent.climb_type === 'sport' ? 'sport' : 'boulder';
      const videoLink = ascent.web_link ? ` <a href="${ascent.web_link}" target="_blank">▶️</a>` : '';
      const ascentDate = ascent.date_of_ascent ? ` ${ascent.date_of_ascent}` : '';
      const convertedGrade = convertGrade(ascent.grade, climbType);
      return `<li><a href="/${climbType}/${climbSlug}">${ascent.climb_name}</a> - ${convertedGrade}${videoLink}${ascentDate}</li>`;
    }).join('');
  };
  
  const athleteSlug = athlete.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').toLowerCase();
  
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

// Location link generation function
export function generateLocationLink(climb) {
  const locationLink = climb.location_latitude && climb.location_longitude 
    ? `https://www.openstreetmap.org/?mlat=${climb.location_latitude}&mlon=${climb.location_longitude}&zoom=12`
    : '#';
  
  const locationText = climb.location_area && climb.location_country 
    ? `${climb.location_area}, ${climb.location_country}`
    : climb.location_country || 'Unknown location';
    
  return { link: locationLink, text: locationText };
}

// Shared detail page handler for both boulder and sport climbs
export async function generateClimbDetailPage(context, climbType) {
  const { env, params } = context;
  const { slug } = params;
  
  try {
    const climbName = decodeURIComponent(slug).replace(/-/g, ' ');
    
    // Get climb data with case-insensitive matching
    const climb = await getClimbByName(env.DB, climbName, climbType);
    if (!climb) {
      return new Response(generateNotFoundPage(`${climbType === 'boulder' ? 'Boulder Problem' : 'Sport Climb'}`, climbName), { 
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // Get climb's ascents with case-insensitive matching
    const ascents = await getClimbAscents(env.DB, climbName);
    
    // Get unique athletes
    const uniqueAthletes = [...new Set(ascents.map(a => a.athlete_name))];
    
    // Get first ascent and most recent
    const sortedAscents = ascents.filter(a => a.date_of_ascent).sort((a, b) => new Date(a.date_of_ascent) - new Date(b.date_of_ascent));
    const firstAscent = sortedAscents[0];
    const mostRecent = sortedAscents[sortedAscents.length - 1];
    
    // Generate ascents HTML
    const ascentsHtml = ascents.map(ascent => {
      const athleteSlug = ascent.athlete_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').toLowerCase();
      return `
        <div class="card">
          <div class="profile-name">
            <a href="/athletes/${athleteSlug}" class="link">${ascent.athlete_name}</a>
          </div>
          <div class="text-muted mb-10">
            ${ascent.date_of_ascent ? new Date(ascent.date_of_ascent).toLocaleDateString() : ''}
            ${ascent.web_link ? ' • <a href="' + ascent.web_link + '" target="_blank">▶️</a>' : ''}
          </div>
        </div>
      `;
    }).join('');
    
    const location = generateLocationLink(climb);
    
    const html = generateBaseHeader(climb.name, climb.name) + 
      `
        <h1>${climb.name}</h1>
        
        <div class="card">
          <div class="profile-header">
            <div class="profile-info">
              <div class="grade-badge large ${climbType}-badge">${convertGrade(climb.grade, climbType)}</div>
              <div class="profile-details">
                📍 <a href="${location.link}" class="link-light" target="_blank">${location.text}</a>
              </div>
            </div>
          </div>
          
          <div class="stats">
            <div class="stat-card">
              <div class="stat-number">${ascents.length}</div>
              <div class="stat-label">Total Ascents</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${uniqueAthletes.length}</div>
              <div class="stat-label">Different Athletes</div>
            </div>
            ${firstAscent ? `
            <div class="stat-card">
              <div class="stat-number">${new Date(firstAscent.date_of_ascent).getFullYear()}</div>
              <div class="stat-label">First Ascent</div>
            </div>
            ` : ''}
            ${mostRecent && mostRecent.date_of_ascent !== firstAscent?.date_of_ascent ? `
            <div class="stat-card">
              <div class="stat-number">${new Date(mostRecent.date_of_ascent).getFullYear()}</div>
              <div class="stat-label">Most Recent</div>
            </div>
            ` : ''}
          </div>
        </div>
        
        ${ascents.length > 0 ? `
        <div class="mb-30">
          <h2 class="section-title">Ascents</h2>
          <div class="grid">
            ${ascentsHtml}
          </div>
        </div>
        ` : ''}
      ` + 
      generateBaseFooter();
    
    return new Response(html, {
      headers: { 
        'Content-Type': 'text/html',
        'Cache-Control': `public, max-age=${CONFIG.CACHE_DURATIONS.MEDIUM}`
      }
    });
    
  } catch (error) {
    return new Response(generateErrorPage(error.message), {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Shared search JavaScript generation
export function generateSearchScript(inputId, cardSelector, noResultsMessage) {
  return `
        <script>
          const searchInput = document.getElementById('${inputId}');
          const cards = document.querySelectorAll('${cardSelector}');
          const noResults = document.getElementById('no-results');
          
          searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            let visibleCount = 0;
            
            cards.forEach(card => {
              const name = card.getAttribute('data-name');
              const matches = name.includes(searchTerm);
              
              if (matches) {
                card.style.display = 'block';
                visibleCount++;
              } else {
                card.style.display = 'none';
              }
            });
            
            // Show/hide no results message
            if (visibleCount === 0 && searchTerm !== '') {
              noResults.style.display = 'block';
            } else {
              noResults.style.display = 'none';
            }
          });
        </script>
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