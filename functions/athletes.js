// Import shared functions
import { generateBaseHeader, generateBaseFooter, generateErrorPage, getAthletesWithAscents, generateAthleteHtml, generateSearchScript, CONFIG } from './shared/functions.js';

export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const athletes = await getAthletesWithAscents(env.DB);
    
    const athletesHtml = athletes.map(athlete => generateAthleteHtml(athlete)).join('');
    
    const html = generateBaseHeader('Athletes', 'athletes') + 
      `
        <h1>Athletes</h1>
        <div class="search-container">
          <input type="text" id="athlete-search" placeholder="Search athletes by name..." autocomplete="off">
        </div>
        
        <div id="no-results" class="no-results" style="display: none;">
          <p>No athletes found matching your search.</p>
        </div>
        
        <div class="athletes-grid">
          ${athletesHtml}
        </div>
        
        ${generateSearchScript('athlete-search', 'athlete[data-name]', 'No athletes found matching your search.')}
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