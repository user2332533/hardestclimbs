// Import shared functions
import { generateBaseHeader, generateBaseFooter, generateErrorPage, getClimbsWithAscents, generateClimbHtml } from './shared/functions.js';



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
        
        <script>
          const searchInput = document.getElementById('climb-search');
          const climbCards = document.querySelectorAll('climb[data-name]');
          const noResults = document.getElementById('no-results');
          
          searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            let visibleCount = 0;
            
            climbCards.forEach(card => {
              const climbName = card.getAttribute('data-name');
              const matches = climbName.includes(searchTerm);
              
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