// Database functions for boulder detail page
async function getClimbByName(db, name, type) {
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

async function getClimbAscents(db, climbName) {
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

// Import shared functions
import { generateBaseHeader, generateBaseFooter, generateErrorPage, generateNotFoundPage, convertGrade } from '../shared/functions.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const { slug } = params; // e.g., "burden-of-dreams"
  
  try {
    const climbName = slug.replace(/-/g, ' ');
    
    // Get climb data with case-insensitive matching
    const climb = await getClimbByName(env.DB, climbName, 'boulder');
    if (!climb) {
      return new Response(generateNotFoundPage('Boulder Problem', climbName), { 
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
      const athleteSlug = ascent.athlete_name.replace(/\s+/g, '-').toLowerCase();
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
    
    const locationLink = climb.location_latitude && climb.location_longitude 
      ? `https://www.openstreetmap.org/?mlat=${climb.location_latitude}&mlon=${climb.location_longitude}&zoom=12`
      : '#';
    
    const locationText = climb.location_area && climb.location_country 
      ? `${climb.location_area}, ${climb.location_country}`
      : climb.location_country || 'Unknown location';
    
    const html = generateBaseHeader(climb.name, climb.name) + 
      `
        <h1>${climb.name}</h1>
        
        <div class="card">
          <div class="profile-header">
            <div class="profile-info">
              <div class="grade-badge large boulder-badge">${convertGrade(climb.grade, 'boulder')}</div>
              <div class="profile-details">
                📍 <a href="${locationLink}" class="link-light" target="_blank">${locationText}</a>
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
        'Cache-Control': 'public, max-age=600' // 10 minutes
      }
    });
    
  } catch (error) {
    return new Response(generateErrorPage(error.message), {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}