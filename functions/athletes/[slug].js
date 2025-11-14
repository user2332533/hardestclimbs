// Database functions for athlete detail page
async function getAthleteByName(db, name) {
  const query = `
    WITH latest_athletes AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY name ORDER BY record_created DESC, hash DESC) as rn
      FROM athletes 
      WHERE status = 'valid' AND LOWER(name) = LOWER(?)
    )
    SELECT name, nationality, gender, year_of_birth
    FROM latest_athletes 
    WHERE rn = 1
  `;
  
  const result = await db.prepare(query).bind(name).first();
  return result;
}

async function getAthleteAscents(db, athleteName) {
  const query = `
    WITH latest_ascents AS (
      SELECT a.*, c.grade, c.climb_type, c.location_country, c.location_area,
             ROW_NUMBER() OVER (PARTITION BY a.climb_name, a.athlete_name ORDER BY a.record_created DESC, a.hash DESC) as rn
      FROM ascents a 
      JOIN climbs c ON a.climb_name = c.name 
      WHERE a.status = 'valid' AND LOWER(a.athlete_name) = LOWER(?)
    )
    SELECT * FROM latest_ascents 
    WHERE rn = 1
    ORDER BY date_of_ascent DESC
  `;
  
  const result = await db.prepare(query).bind(athleteName).all();
  return result.results;
}

// Import shared functions
import { generateBaseHeader, generateBaseFooter, generateErrorPage, generateNotFoundPage, convertGrade } from '../shared/functions.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const { slug } = params; // e.g., "adam-ondra"
  
  try {
    // Convert slug back to name (replace hyphens with spaces)
    const athleteName = slug.replace(/-/g, ' ');
    
    // Get athlete data with case-insensitive matching
    const athlete = await getAthleteByName(env.DB, athleteName);
    if (!athlete) {
      return new Response(generateNotFoundPage('Athlete', athleteName), { 
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // Get athlete's ascents with case-insensitive matching
    const ascents = await getAthleteAscents(env.DB, athleteName);
    
    // Calculate statistics
    const sportAscents = ascents.filter(a => a.climb_type === 'sport');
    const boulderAscents = ascents.filter(a => a.climb_type === 'boulder');
    const hardestSport = sportAscents.sort((a, b) => b.grade.localeCompare(a.grade))[0];
    const hardestBoulder = boulderAscents.sort((a, b) => b.grade.localeCompare(a.grade))[0];
    
    // Generate ascents HTML
    const ascentsHtml = ascents.map(ascent => {
      const climbSlug = ascent.climb_name.replace(/\s+/g, '-').toLowerCase();
      return `
        <div class="card">
          <div class="climb-name">${ascent.climb_name}</div>
          <div class="text-muted mb-10">
            <span class="grade-badge ${ascent.climb_type}-badge">${convertGrade(ascent.grade, ascent.climb_type)}</span>
            ${ascent.climb_type === 'sport' ? 'Sport' : 'Boulder'}
            ${ascent.location_area ? ' • ' + ascent.location_area : ''}
            ${ascent.location_country ? ' • ' + ascent.location_country : ''}
            ${ascent.date_of_ascent ? ' • ' + new Date(ascent.date_of_ascent).getFullYear() : ''}
          </div>
          <a href="/${ascent.climb_type}/${climbSlug}" class="link">View Climb →</a>
        </div>
      `;
    }).join('');
    
    const html = generateBaseHeader(athlete.name, athlete.name) + 
      `
        <a href="/athletes" class="back-link">← Back to Athletes</a>
        
        <div class="card">
          <div class="profile-header">
            <div class="profile-info">
              <div class="profile-details">
                ${athlete.nationality ? '🏳️ ' + athlete.nationality : ''}
                ${athlete.gender ? ' • ' + athlete.gender : ''}
                ${athlete.year_of_birth ? ' • Born ' + athlete.year_of_birth : ''}
              </div>
            </div>
          </div>
          
          <div class="stats">
            <div class="stat-card">
              <div class="stat-number">${ascents.length}</div>
              <div class="stat-label">Total Ascents</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${sportAscents.length}</div>
              <div class="stat-label">Sport Climbs</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${boulderAscents.length}</div>
              <div class="stat-label">Boulders</div>
            </div>
            ${hardestSport ? `
            <div class="stat-card">
              <div class="stat-number">${convertGrade(hardestSport.grade, 'sport')}</div>
              <div class="stat-label">Hardest Sport</div>
            </div>
            ` : ''}
            ${hardestBoulder ? `
            <div class="stat-card">
              <div class="stat-number">${convertGrade(hardestBoulder.grade, 'boulder')}</div>
              <div class="stat-label">Hardest Boulder</div>
            </div>
            ` : ''}
          </div>
        </div>
        
        ${ascents.length > 0 ? `
        <div class="mb-30">
          <h2 class="section-title">Notable Ascents</h2>
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
        'Cache-Control': 'public, max-age=300' // 5 minutes
      }
    });
    
  } catch (error) {
    return new Response(generateErrorPage(error.message), {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}