// Import shared functions
import { generateBaseHeader, generateBaseFooter, generateErrorPage, getAthletesWithAscents, generateAthleteHtml } from './shared/functions.js';

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
        
        <script>
          const searchInput = document.getElementById('athlete-search');
          const athleteCards = document.querySelectorAll('athlete[data-name]');
          const noResults = document.getElementById('no-results');
          
          searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            let visibleCount = 0;
            
            athleteCards.forEach(card => {
              const athleteName = card.getAttribute('data-name');
              const matches = athleteName.includes(searchTerm);
              
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