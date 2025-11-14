// Import shared functions
import { generateBaseHeader, generateBaseFooter, generateErrorPage, getClimbsWithAscents, generateClimbHtml, generateSearchScript, CONFIG } from './shared/functions.js';



export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const climbs = await getClimbsWithAscents(env.DB, 'boulder');
    
    const climbsHtml = climbs.map(climb => generateClimbHtml(climb, 'boulder')).join('');
    
    const html = generateBaseHeader('Bouldering', 'boulder') + 
      `
        <h1>Boulders</h1>
        <div class="search-container">
          <input type="text" id="climb-search" placeholder="Search boulder problems by name..." autocomplete="off">
        </div>
        
        <div id="no-results" class="no-results" style="display: none;">
          <p>No boulder problems found matching your search.</p>
        </div>
        
        <div class="climbs-grid">
          ${climbsHtml}
        </div>
        
        ${generateSearchScript('climb-search', 'climb[data-name]', 'No boulder problems found matching your search.')}
      ` + 
      generateBaseFooter();
    
    return new Response(html, {
      headers: { 
        'Content-Type': 'text/html',
        'Cache-Control': `public, max-age=${CONFIG.CACHE_DURATIONS.SHORT}`
      }
    });
    
  } catch (error) {
    return new Response(generateErrorPage(error.message), {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}