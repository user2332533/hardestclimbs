// Import shared functions
import { generateBaseHeader, generateBaseFooter, generateErrorPage, getPendingSubmissions } from '../shared/functions.js';

export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    // Get all pending submissions
    const pending = await getPendingSubmissions(env.DB);
    
    // Generate HTML for each type of submission
    const generateAthleteCard = (athlete) => `
      <div class="card pending-card">
        <h3>New Athlete: ${athlete.name}</h3>
        <div class="pending-details">
          <p><strong>Nationality:</strong> ${athlete.nationality || 'Not specified'}</p>
          <p><strong>Gender:</strong> ${athlete.gender || 'Not specified'}</p>
          <p><strong>Year of Birth:</strong> ${athlete.year_of_birth || 'Not specified'}</p>
          <p><strong>Submitted:</strong> ${new Date(athlete.record_created).toLocaleString()}</p>
        </div>
        <div class="pending-actions">
          <input type="password" id="password-${athlete.hash}" placeholder="Password" required class="shared-password">
          <div class="action-buttons">
            <form method="POST" action="/review/approve" class="action-form">
              <input type="hidden" name="table" value="athletes">
              <input type="hidden" name="hash" value="${athlete.hash}">
              <button type="submit" class="btn btn-success">Approve</button>
            </form>
            <form method="POST" action="/review/reject" class="action-form">
              <input type="hidden" name="table" value="athletes">
              <input type="hidden" name="hash" value="${athlete.hash}">
              <button type="submit" class="btn btn-danger">Reject</button>
            </form>
          </div>
        </div>
      </div>
    `;
    
    const generateClimbCard = (climb) => `
      <div class="card pending-card">
        <h3>New ${climb.climb_type === 'boulder' ? 'Boulder' : 'Sport Climb'}: ${climb.name}</h3>
        <div class="pending-details">
          <p><strong>Type:</strong> ${climb.climb_type}</p>
          <p><strong>Grade:</strong> ${climb.grade}</p>
          <p><strong>Location:</strong> ${climb.location_area ? `${climb.location_area}, ` : ''}${climb.location_country || 'Not specified'}</p>
          <p><strong>Submitted:</strong> ${new Date(climb.record_created).toLocaleString()}</p>
        </div>
        <div class="pending-actions">
          <input type="password" id="password-${climb.hash}" placeholder="Password" required class="shared-password">
          <div class="action-buttons">
            <form method="POST" action="/review/approve" class="action-form">
              <input type="hidden" name="table" value="climbs">
              <input type="hidden" name="hash" value="${climb.hash}">
              <button type="submit" class="btn btn-success">Approve</button>
            </form>
            <form method="POST" action="/review/reject" class="action-form">
              <input type="hidden" name="table" value="climbs">
              <input type="hidden" name="hash" value="${climb.hash}">
              <button type="submit" class="btn btn-danger">Reject</button>
            </form>
          </div>
        </div>
      </div>
    `;
    
    const generateAscentCard = (ascent) => `
      <div class="card pending-card ${!ascent.canApprove ? 'cannot-approve' : ''}">
        <h3>New Ascent: ${ascent.climb_name} by ${ascent.athlete_name}</h3>
        <div class="pending-details">
          <p><strong>Athlete:</strong> ${ascent.athlete_name}</p>
          <p><strong>Climb:</strong> ${ascent.climb_name}</p>
          <p><strong>Date:</strong> ${ascent.date_of_ascent}</p>
          ${ascent.web_link ? `<p><strong>Video:</strong> <a href="${ascent.web_link}" target="_blank">Watch</a></p>` : ''}
          <p><strong>Submitted:</strong> ${new Date(ascent.record_created).toLocaleString()}</p>
          ${!ascent.canApprove ? `<p class="approval-warning"><strong>⚠️ Cannot approve:</strong> ${ascent.approvalReason}</p>` : ''}
        </div>
        <div class="pending-actions">
          <input type="password" id="password-${ascent.hash}" placeholder="Password" required class="shared-password">
          <div class="action-buttons">
            <form method="POST" action="/review/approve" class="action-form">
              <input type="hidden" name="table" value="ascents">
              <input type="hidden" name="hash" value="${ascent.hash}">
              ${ascent.canApprove ? 
                `<button type="submit" class="btn btn-success">Approve</button>` :
                `<button type="button" class="btn btn-success disabled" title="${ascent.approvalReason}">Approve</button>`
              }
            </form>
            <form method="POST" action="/review/reject" class="action-form">
              <input type="hidden" name="table" value="ascents">
              <input type="hidden" name="hash" value="${ascent.hash}">
              <button type="submit" class="btn btn-danger">Reject</button>
            </form>
          </div>
        </div>
      </div>
    `;
    
    // Generate sections for each type
    const athleteCards = pending.athletes.map(generateAthleteCard).join('');
    const climbCards = pending.climbs.map(generateClimbCard).join('');
    const ascentCards = pending.ascents.map(generateAscentCard).join('');
    
    const totalPending = pending.athletes.length + pending.climbs.length + pending.ascents.length;
    
    const html = generateBaseHeader('Review Pending Submissions', 'review') + 
      `
        <h1>Review Pending Submissions</h1>
        
        ${totalPending === 0 ? 
          `<div class="card">
            <p>No pending submissions to review.</p>
          </div>` :
          ''
        }
        
        ${pending.athletes.length > 0 ? `
          <div class="review-section">
            <h2>Pending Athletes (${pending.athletes.length})</h2>
            <div class="pending-grid">
              ${athleteCards}
            </div>
          </div>` : 
          ''
        }
        
        ${pending.climbs.length > 0 ? `
          <div class="review-section">
            <h2>Pending Climbs (${pending.climbs.length})</h2>
            <div class="pending-grid">
              ${climbCards}
            </div>
          </div>` : 
          ''
        }
        
        ${pending.ascents.length > 0 ? `
          <div class="review-section">
            <h2>Pending Ascents (${pending.ascents.length})</h2>
            <div class="pending-grid">
              ${ascentCards}
            </div>
          </div>` :
          ''
        }
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
          
          // Handle URL parameters for initial toast
          function handleUrlParams() {
            const urlParams = new URLSearchParams(window.location.search);
            const toastType = urlParams.get('toast');
            const message = urlParams.get('message');
            
            if (toastType && message) {
              showToast(decodeURIComponent(message), toastType);
              // Clean URL parameters
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
          
          // Handle approve/reject actions
          async function handleAction(form, action) {
            const card = form.closest('.pending-card');
            const passwordField = card.querySelector('.shared-password');
            const submitButton = form.querySelector('button[type="submit"], button[type="button"]');
            const originalText = submitButton.textContent;
            
            // Validate password
            if (!passwordField.value) {
              showToast('Please enter a password', 'error');
              passwordField.focus();
              return;
            }
            
            // Create FormData with password from shared field
            const formData = new FormData(form);
            formData.set('password', passwordField.value);
            
            // Disable button and show loading
            submitButton.disabled = true;
            submitButton.textContent = 'Processing...';
            
            try {
              const response = await fetch(form.action, {
                method: 'POST',
                body: formData
              });
              
              const result = await response.json();
              
              if (result.success) {
                // Remove the card from DOM
                card.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                  card.remove();
                  // Update counts
                  updateCounts();
                }, 300);
                
                showToast(result.message, 'success');
              } else {
                showToast(result.message, 'error');
              }
            } catch (error) {
              showToast('Network error. Please try again.', 'error');
            } finally {
              // Re-enable button
              submitButton.disabled = false;
              submitButton.textContent = originalText;
            }
          }
          
          // Update submission counts
          function updateCounts() {
            const totalCards = document.querySelectorAll('.pending-card').length;
            const summary = document.querySelector('.review-summary');
            
            if (summary && totalCards === 0) {
              // Show empty state
              window.location.reload();
            } else if (summary) {
              // Update total count
              const totalElement = summary.querySelector('strong');
              if (totalElement) {
                totalElement.textContent = totalCards;
              }
            }
          }
          
          // Add event listeners to all approve/reject forms
          document.addEventListener('DOMContentLoaded', function() {
            // Handle URL parameters
            handleUrlParams();
            
            // Add submit handlers to all forms
            const forms = document.querySelectorAll('.action-form');
            forms.forEach(form => {
              form.addEventListener('submit', function(e) {
                e.preventDefault();
                const action = form.action.includes('approve') ? 'approve' : 'reject';
                handleAction(form, action);
              });
            });
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