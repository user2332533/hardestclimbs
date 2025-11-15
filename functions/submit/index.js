// Import shared functions
import { generateBaseHeader, generateBaseFooter, generateErrorPage, getValidAthletes, getValidClimbs, submitNewAscent } from '../shared/functions.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  
  try {
    // Get pre-populated values from URL parameters
    const prePopulatedAthlete = url.searchParams.get('athlete') || '';
    const prePopulatedClimb = url.searchParams.get('climb') || '';
    
    // Get valid athletes and climbs for autocomplete
    const [validAthletes, validClimbs] = await Promise.all([
      getValidAthletes(env.DB),
      getValidClimbs(env.DB)
    ]);
    
    // Generate datalist options
    const athleteOptions = validAthletes.map(name => `<option value="${name}">`).join('');
    const climbOptions = validClimbs.map(name => `<option value="${name}">`).join('');
    
    const html = generateBaseHeader('Submit New Ascent', 'submit') + 
      `
        <h1>Submit New Ascent</h1>
        
        <form id="ascent-form" method="POST" class="card">
          <div class="form-group">
            <label for="athlete-name">Athlete Name *</label>
            <input 
              type="text" 
              id="athlete-name" 
              name="athleteName" 
              list="athletes-list"
              value="${prePopulatedAthlete}"
              required
            >
            <datalist id="athletes-list">
              ${athleteOptions}
            </datalist>
          </div>
          
          <div id="new-athlete-section" class="athlete-fields" style="display: none;">
            <div class="form-group">
              <label for="nationality">Nationality</label>
              <input type="text" id="nationality" name="nationality">
            </div>
            
            <div class="form-group">
              <label for="gender">Gender</label>
              <select id="gender" name="gender">
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="year-of-birth">Year of Birth</label>
              <input type="number" id="year-of-birth" name="yearOfBirth" min="1950" max="2010">
            </div>
          </div>
          
          <div class="form-group">
            <label for="climb-name">Climb Name *</label>
            <input 
              type="text" 
              id="climb-name" 
              name="climbName" 
              list="climbs-list"
              value="${prePopulatedClimb}"
              required
            >
            <datalist id="climbs-list">
              ${climbOptions}
            </datalist>
          </div>
          
          <div id="new-climb-section" class="climb-fields" style="display: none;">
            <div class="form-group">
              <label for="climb-type">Climb Type *</label>
              <select id="climb-type" name="climbType" required>
                <option value="">Select...</option>
                <option value="sport">Sport</option>
                <option value="boulder">Boulder</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="grade">Grade *</label>
              <input type="text" id="grade" name="grade" required>
            </div>
            
            <div class="form-group">
              <label for="location-country">Country</label>
              <input type="text" id="location-country" name="locationCountry">
            </div>
            
            <div class="form-group">
              <label for="location-area">Area/Crag</label>
              <input type="text" id="location-area" name="locationArea">
            </div>
            
            <div class="form-group">
              <label for="location-latitude">Latitude</label>
              <input type="number" id="location-latitude" name="locationLatitude" step="0.000001">
            </div>
            
            <div class="form-group">
              <label for="location-longitude">Longitude</label>
              <input type="number" id="location-longitude" name="locationLongitude" step="0.000001">
            </div>
          </div>
          
          <div class="form-group">
            <label for="date-of-ascent">Date of Ascent *</label>
            <input 
              type="date" 
              id="date-of-ascent" 
              name="dateOfAscent"
              required
            >
          </div>
          
          <div class="form-group">
            <label for="web-link">Video Link (optional)</label>
            <input 
              type="url" 
              id="web-link" 
              name="webLink"
              placeholder="https://youtube.com/watch?v=..."
            >
          </div>
          
          <button type="submit" class="btn btn-primary">Submit Ascent</button>
        </form>
        
        <div id="success-message" class="success-message" style="display: none;">
          <h3>Submission Successful!</h3>
          <p>Your ascent has been submitted for review. It will appear in the database once approved.</p>
          <a href="/submit" class="btn">Submit Another Ascent</a>
        </div>
        
        <div id="error-message" class="error-message" style="display: none;">
          <h3>Submission Failed</h3>
          <p id="error-text">There was an error submitting your ascent. Please try again.</p>
        </div>
      ` + 
      generateBaseFooter() + 
      `
        <script>
          // Toast notification system
          function showToast(message, type = 'info') {
            // Create toast container if it doesn't exist
            let container = document.querySelector('.toast-container');
            if (!container) {
              container = document.createElement('div');
              container.className = 'toast-container';
              document.body.appendChild(container);
            }
            
            // Create toast element
            const toast = document.createElement('div');
            toast.className = \`toast \${type}\`;
            toast.textContent = message;
            
            // Add click to dismiss
            toast.addEventListener('click', () => {
              toast.style.animation = 'slideOut 0.3s ease';
              setTimeout(() => toast.remove(), 300);
            });
            
            // Add to container
            container.appendChild(toast);
            
            // Auto dismiss after 5 seconds
            setTimeout(() => {
              if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
              }
            }, 5000);
          }
          
          // Arrays of valid athletes and climbs for checking
          const validAthletes = ${JSON.stringify(validAthletes)};
          const validClimbs = ${JSON.stringify(validClimbs)};
          
          // Get form elements
          const athleteNameInput = document.getElementById('athlete-name');
          const climbNameInput = document.getElementById('climb-name');
          const newAthleteSection = document.getElementById('new-athlete-section');
          const newClimbSection = document.getElementById('new-climb-section');
          const form = document.getElementById('ascent-form');
          const submitButton = form.querySelector('button[type="submit"]');
          
          // Function to check if athlete name is new
          function isNewAthlete(name) {
            return name && !validAthletes.some(athlete => 
              athlete.toLowerCase() === name.toLowerCase().trim()
            );
          }
          
          // Function to check if climb name is new
          function isNewClimb(name) {
            return name && !validClimbs.some(climb => 
              climb.toLowerCase() === name.toLowerCase().trim()
            );
          }
          
          // Function to update athlete section visibility
          function updateAthleteSection() {
            const athleteName = athleteNameInput.value.trim();
            if (isNewAthlete(athleteName)) {
              newAthleteSection.style.display = 'block';
              // Make athlete fields required if new athlete
              document.getElementById('nationality').required = false;
              document.getElementById('gender').required = false;
              document.getElementById('year-of-birth').required = false;
            } else {
              newAthleteSection.style.display = 'none';
              // Clear and remove required from athlete fields
              document.getElementById('nationality').value = '';
              document.getElementById('gender').value = '';
              document.getElementById('year-of-birth').value = '';
              document.getElementById('nationality').required = false;
              document.getElementById('gender').required = false;
              document.getElementById('year-of-birth').required = false;
            }
          }
          
          // Function to update climb section visibility
          function updateClimbSection() {
            const climbName = climbNameInput.value.trim();
            if (isNewClimb(climbName)) {
              newClimbSection.style.display = 'block';
              // Make climb fields required if new climb
              document.getElementById('climb-type').required = true;
              document.getElementById('grade').required = true;
            } else {
              newClimbSection.style.display = 'none';
              // Clear and remove required from climb fields
              document.getElementById('climb-type').value = '';
              document.getElementById('grade').value = '';
              document.getElementById('location-country').value = '';
              document.getElementById('location-area').value = '';
              document.getElementById('location-latitude').value = '';
              document.getElementById('location-longitude').value = '';
              document.getElementById('climb-type').required = false;
              document.getElementById('grade').required = false;
            }
          }
          
          // Add event listeners for real-time checking
          athleteNameInput.addEventListener('input', updateAthleteSection);
          athleteNameInput.addEventListener('change', updateAthleteSection);
          climbNameInput.addEventListener('input', updateClimbSection);
          climbNameInput.addEventListener('change', updateClimbSection);
          
          // Initial check for pre-populated values
          updateAthleteSection();
          updateClimbSection();
          
          // AJAX form submission
          form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const athleteName = athleteNameInput.value.trim();
            const climbName = climbNameInput.value.trim();
            
            // Validation
            if (isNewAthlete(athleteName)) {
              const nationality = document.getElementById('nationality').value.trim();
              const gender = document.getElementById('gender').value;
              const yearOfBirth = document.getElementById('year-of-birth').value;
              
              if (!nationality && !gender && !yearOfBirth) {
                showToast('Please provide at least one detail (nationality, gender, or year of birth) for the new athlete.', 'error');
                return;
              }
            }
            
            if (isNewClimb(climbName)) {
              const climbType = document.getElementById('climb-type').value;
              const grade = document.getElementById('grade').value.trim();
              
              if (!climbType || !grade) {
                showToast('Please provide climb type and grade for the new climb.', 'error');
                return;
              }
            }
            
            // Disable submit button and show loading
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';
            
            try {
              const formData = new FormData(form);
              const response = await fetch('/submit', {
                method: 'POST',
                body: formData
              });
              
              const result = await response.json();
              
              if (result.success) {
                // Redirect to review page with toast
                window.location.href = result.redirect;
              } else {
                showToast(result.message, 'error');
              }
            } catch (error) {
              showToast('Network error. Please try again.', 'error');
            } finally {
              // Re-enable submit button
              submitButton.disabled = false;
              submitButton.textContent = 'Submit Ascent';
            }
          });
        </script>
      `;
    
    return new Response(html, {
      headers: { 
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    return new Response(generateErrorPage(error.message), {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const formData = await request.formData();
    const data = {
      athleteName: formData.get('athleteName'),
      climbName: formData.get('climbName'),
      dateOfAscent: formData.get('dateOfAscent'),
      webLink: formData.get('webLink') || null,
      nationality: formData.get('nationality') || null,
      gender: formData.get('gender') || null,
      yearOfBirth: formData.get('yearOfBirth') ? parseInt(formData.get('yearOfBirth')) : null,
      climbType: formData.get('climbType') || null,
      grade: formData.get('grade') || null,
      locationCountry: formData.get('locationCountry') || null,
      locationArea: formData.get('locationArea') || null,
      locationLatitude: formData.get('locationLatitude') ? parseFloat(formData.get('locationLatitude')) : null,
      locationLongitude: formData.get('locationLongitude') ? parseFloat(formData.get('locationLongitude')) : null
    };
    
    // Validate required fields
    if (!data.athleteName || !data.climbName || !data.dateOfAscent) {
      throw new Error('Athlete name, climb name, and date of ascent are required');
    }
    
    // If new climb details are provided, validate them
    if (data.climbType && !data.grade) {
      throw new Error('Grade is required when climb type is specified');
    }
    
    // Submit the ascent
    await submitNewAscent(env.DB, data);
    
    // Return JSON success response
    return new Response(JSON.stringify({
      success: true,
      message: 'Your ascent has been submitted for review. It will appear in the database once approved.',
      redirect: '/review?toast=success&message=' + encodeURIComponent('Submission successful! Your ascent is pending review.')
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    // Return JSON error response
    return new Response(JSON.stringify({
      success: false,
      message: error.message
    }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }
}