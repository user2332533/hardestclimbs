// Import shared functions
import { getLatestAthletes, getLatestClimbs, getLatestAscents } from './shared/functions.js';

export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const [athletes, climbs, ascents] = await Promise.all([
      getLatestAthletes(env.DB),
      getLatestClimbs(env.DB), 
      getLatestAscents(env.DB)
    ]);
    
    const exportData = {
      exported_at: new Date().toISOString(),
      athletes,
      climbs,
      ascents
    };
    
    return new Response(JSON.stringify(exportData, null, 2), {
      headers: { 
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="climbing-database.json"',
        'Cache-Control': 'public, max-age=3600' // 1 hour
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}