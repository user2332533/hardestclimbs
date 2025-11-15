// Import shared functions
import { generateBaseHeader, generateBaseFooter, generateErrorPage, updateSubmissionStatus } from '../shared/functions.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const formData = await request.formData();
    const table = formData.get('table');
    const hash = formData.get('hash');
    const password = formData.get('password');
    
    // Simple password protection (you should use environment variables in production)
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD;
    
    if (!password || password !== ADMIN_PASSWORD) {
      return new Response(generateErrorPage('Invalid password'), {
        status: 401,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    if (!table || !hash) {
      throw new Error('Missing table or hash');
    }
    
    // Update the submission status
    await updateSubmissionStatus(env.DB, table, hash, 'rejected');
    
    // Return JSON success response
    return new Response(JSON.stringify({
      success: true,
      message: 'Submission rejected successfully',
      table: table,
      hash: hash
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