// Import shared functions
import { generateBaseHeader, generateBaseFooter, generateErrorPage, generateNotFoundPage, convertGrade, generateLocationLink, CONFIG, getAthleteByName } from '../shared/functions.js';

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

export async function onRequestGet(context) {
  const { env, params } = context;
  const { slug } = params; // e.g., "adam-ondra"
  
  try {
    // Convert slug back to name (decode URL then replace hyphens with spaces)
    const athleteName = decodeURIComponent(slug).replace(/-/g, ' ');
    
    // Get athlete data with case-insensitive matching
    const athlete = await getAthleteByName(env.DB, athleteName);
    if (!athlete) {
      return new Response(generateNotFoundPage('Athlete', athleteName), { 
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // Get athlete's ascents with case-insensitive matching
    const ascents = await getAthleteAscents(env.DB, athlete.name);
    
    // Separate ascents by type and sort by date
    const sportAscents = ascents.filter(a => a.climb_type === 'sport').sort((a, b) => new Date(b.date_of_ascent || '9999') - new Date(a.date_of_ascent || '9999'));
    const boulderAscents = ascents.filter(a => a.climb_type === 'boulder').sort((a, b) => new Date(b.date_of_ascent || '9999') - new Date(a.date_of_ascent || '9999'));
    
    // Get hardest ascents for stats
    const sportAscentsSorted = [...sportAscents].sort((a, b) => {
      const gradeOrder = ['9a+', '9a', '9a/b', '9a+/b', '9b', '9b/+', '9b+', '9b/c', '9c', '9c/+', '9c+'];
      const aIndex = gradeOrder.indexOf(a.grade);
      const bIndex = gradeOrder.indexOf(b.grade);
      return bIndex - aIndex;
    });
    
    const boulderAscentsSorted = [...boulderAscents].sort((a, b) => {
      const gradeOrder = ['8B+', '8C', '8C/+', '8C+', '8C+/9A', '9A', '9A/+', '9A+'];
      const aIndex = gradeOrder.indexOf(a.grade);
      const bIndex = gradeOrder.indexOf(b.grade);
      return bIndex - aIndex;
    });
    
    // Generate sport ascents HTML
    const sportAscentsHtml = sportAscentsSorted.map(ascent => {
      const climbSlug = ascent.climb_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').toLowerCase();
      const videoLink = ascent.web_link ? ` <a href="${ascent.web_link}" target="_blank">▶️</a>` : '';
      return `
        <div class="card">
          <div class="climb-name">
            <a href="/${ascent.climb_type}/${climbSlug}" class="link">${ascent.climb_name}</a>${videoLink}
          </div>
          <div class="text-muted mb-10">
            <span class="grade-badge sport-badge">${convertGrade(ascent.grade, 'sport')}</span>
            ${ascent.date_of_ascent ? new Date(ascent.date_of_ascent).toLocaleDateString() : ''}
          </div>
        </div>
      `;
    }).join('');
    
    // Generate boulder ascents HTML
    const boulderAscentsHtml = boulderAscentsSorted.map(ascent => {
      const climbSlug = ascent.climb_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').toLowerCase();
      const videoLink = ascent.web_link ? ` <a href="${ascent.web_link}" target="_blank">▶️</a>` : '';
      return `
        <div class="card">
          <div class="climb-name">
            <a href="/${ascent.climb_type}/${climbSlug}" class="link">${ascent.climb_name}</a>${videoLink}
          </div>
          <div class="text-muted mb-10">
            <span class="grade-badge boulder-badge">${convertGrade(ascent.grade, 'boulder')}</span>
            ${ascent.date_of_ascent ? new Date(ascent.date_of_ascent).toLocaleDateString() : ''}
          </div>
        </div>
      `;
    }).join('');
    
    const html = generateBaseHeader(athlete.name, athlete.name) + 
      `
        <h1>${athlete.name}</h1>
        
        <div class="card">
          <div class="profile-header">
            <div class="profile-info">
              <div class="profile-details">
                🏳️ ${athlete.nationality || 'Unknown'}<br>
                👤 ${athlete.gender || 'Unknown'}<br>
                🎂 ${athlete.year_of_birth || 'Unknown'}
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
          </div>
        </div>
        
        ${sportAscents.length > 0 ? `
        <div class="mb-30">
          <h2 class="section-title">Sport Climbing</h2>
          <div class="grid">
            ${sportAscentsHtml}
          </div>
        </div>
        ` : ''}
        
        ${boulderAscents.length > 0 ? `
        <div class="mb-30">
          <h2 class="section-title">Bouldering</h2>
          <div class="grid">
            ${boulderAscentsHtml}
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