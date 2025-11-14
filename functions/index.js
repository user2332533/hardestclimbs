// Import shared functions
import { generateBaseHeader, generateBaseFooter, generateErrorPage, getClimbsWithAscents, generateClimbHtml } from './shared/functions.js';



export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    // Get top 3 sport climbs and top 3 boulder problems with ascent data
    const [sportClimbs, boulderClimbs] = await Promise.all([
      getClimbsWithAscents(env.DB, 'sport'),
      getClimbsWithAscents(env.DB, 'boulder')
    ]);
    
    // Take first 3 results from each
    const topSportClimbs = sportClimbs.slice(0, 3);
    const topBoulderClimbs = boulderClimbs.slice(0, 3);
    
    const sportHtml = topSportClimbs.map(climb => generateClimbHtml(climb, 'sport')).join('');
    const boulderHtml = topBoulderClimbs.map(climb => generateClimbHtml(climb, 'boulder')).join('');
    
    const html = generateBaseHeader('Hardest Climbs', 'home') + 
      `
        <h2>Sport Climbing</h2>
        <div class="climbs-grid">
          ${sportHtml}
        </div>
        <div class="view-all-link">
          <a href="/sport" class="link">View all Sport Climbs →</a>
        </div>
        
        <h2>Bouldering</h2>
        <div class="climbs-grid">
          ${boulderHtml}
        </div>
        <div class="view-all-link">
          <a href="/boulder" class="link">View all Boulders →</a>
        </div>
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