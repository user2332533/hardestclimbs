export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env, url);
    }
    
    // Athlete profile routing
    if (url.pathname.startsWith('/athletes/') && url.pathname !== '/athletes/') {
      return handleAthleteProfile(request, env, url);
    }
    
    // Climb profile routing
    if ((url.pathname.startsWith('/sport/') || url.pathname.startsWith('/boulder/')) && 
        url.pathname !== '/sport/' && url.pathname !== '/boulder/') {
      return handleClimbProfile(request, env, url);
    }
    
    // Direct export routing
    if (url.pathname === '/export') {
      return await getExportData(env.DB);
    }
    
    // Serve static files
    return env.ASSETS.fetch(request);
  },
};

async function handleAPI(request, env, url) {
  const path = url.pathname.replace('/api', '');
  
  try {
    switch (path) {
      case '/climbs':
        return await getClimbs(env.DB, url.searchParams);
      case '/athletes':
        return await getAthletes(env.DB, url.searchParams);
      case '/ascents':
        return await getAscents(env.DB, url.searchParams);
      case '/export':
        return await getExportData(env.DB);
      default:
        return new Response('Not Found', { status: 404 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function getClimbs(db, params) {
  // Validate and sanitize inputs
  const type = validateInput(params.get('type'), 20);
  const name = validateInput(params.get('name'), 100);
  const limit = Math.min(parseInt(params.get('limit')) || 50, 1000); // Cap at 1000
  
  let query = `
    WITH latest_climbs AS (
      SELECT *, 
             ROW_NUMBER() OVER (PARTITION BY name ORDER BY record_created DESC, hash DESC) as rn
      FROM climbs 
      WHERE status = 'valid'
    )
    SELECT * FROM latest_climbs 
    WHERE rn = 1`;
  
  const queryParams = [];
  
  if (type) {
    // Additional validation for climb type
    const validTypes = ['sport', 'boulder'];
    if (validTypes.includes(type)) {
      query += ` AND climb_type = ?`;
      queryParams.push(type);
    }
  }
  if (name) {
    query += ` AND name = ?`;
    queryParams.push(name);
  }
  
  query += ` ORDER BY grade DESC, record_created DESC LIMIT ?`;
  queryParams.push(limit);
  
  const stmt = db.prepare(query);
  const result = await stmt.bind(...queryParams).all();
  
  return new Response(JSON.stringify(result.results), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getAthletes(db, params) {
  // Validate and sanitize input
  const name = validateInput(params.get('name'), 100);
  
  let query = `
    WITH latest_athletes AS (
      SELECT *, 
             ROW_NUMBER() OVER (PARTITION BY name ORDER BY record_created DESC, hash DESC) as rn
      FROM athletes 
      WHERE status = 'valid'
    )
    SELECT * FROM latest_athletes 
    WHERE rn = 1`;
  
  const queryParams = [];
  
  if (name) {
    query += ` AND name = ?`;
    queryParams.push(name);
  }
  
  query += ' ORDER BY name';
  
  const stmt = db.prepare(query);
  const result = await stmt.bind(...queryParams).all();
  
  return new Response(JSON.stringify(result.results), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getAscents(db, params) {
  // Validate and sanitize inputs
  const climbName = validateInput(params.get('climb'), 100);
  const athleteName = validateInput(params.get('athlete_name'), 100);
  
  let query = `
    WITH latest_ascents AS (
      SELECT a.*, c.grade, c.climb_type, c.location,
             ROW_NUMBER() OVER (PARTITION BY a.climb_name, a.athlete_name ORDER BY a.record_created DESC, a.hash DESC) as rn
      FROM ascents a 
      JOIN climbs c ON a.climb_name = c.name 
      WHERE a.status = 'valid'
    )
    SELECT * FROM latest_ascents 
    WHERE rn = 1`;
  
  const queryParams = [];
  
  if (climbName) {
    query += ` AND climb_name = ?`;
    queryParams.push(climbName);
  }
  if (athleteName) {
    query += ` AND athlete_name = ?`;
    queryParams.push(athleteName);
  }
  
  query += ' ORDER BY date_of_ascent DESC';
  
  const stmt = db.prepare(query);
  const result = await stmt.bind(...queryParams).all();
  
  return new Response(JSON.stringify(result.results), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Input validation helper
function validateInput(input, maxLength = 255) {
  if (!input || typeof input !== 'string') return null;
  
  // Remove any potentially harmful characters
  const sanitized = input
    .replace(/[<>'";\\]/g, '') // Remove HTML/SQL injection chars
    .trim()
    .substring(0, maxLength);
  
  return sanitized || null;
}

async function handleAthleteProfile(request, env, url) {
  // Extract athlete name from URL path
  const pathParts = url.pathname.split('/');
  let athleteName = decodeURIComponent(pathParts[pathParts.length - 1]);
  
  // Validate and sanitize input
  athleteName = validateInput(athleteName, 100);
  
  if (!athleteName) {
    return new Response('Athlete not found', { status: 404 });
  }
  
  // Serve the athlete.html template
  const response = await env.ASSETS.fetch(new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body
  }));
  
  // If athlete.html doesn't exist, return 404
  if (response.status === 404) {
    return new Response('Athlete profile template not found', { status: 404 });
  }
  
  return response;
}

async function handleClimbProfile(request, env, url) {
  // Extract climb type and name from URL path
  const pathParts = url.pathname.split('/');
  const climbType = pathParts[pathParts.length - 2];
  let climbName = decodeURIComponent(pathParts[pathParts.length - 1]);
  
  // Validate and sanitize inputs
  climbName = validateInput(climbName, 100);
  const validTypes = ['sport', 'boulder'];
  const isValidType = validTypes.includes(climbType);
  
  if (!climbName || !isValidType) {
    return new Response('Climb not found', { status: 404 });
  }
  
  // Serve the climb.html template
  const response = await env.ASSETS.fetch(new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body
  }));
  
  // If climb.html doesn't exist, return 404
  if (response.status === 404) {
    return new Response('Climb profile template not found', { status: 404 });
  }
  
  return response;
}

async function getExportData(db) {
  const query = `
    WITH latest_athletes AS (
      SELECT name, nationality, gender, year_of_birth,
             ROW_NUMBER() OVER (PARTITION BY name ORDER BY record_created DESC, hash DESC) as rn
      FROM athletes 
      WHERE status = 'valid'
    ),
    latest_climbs AS (
      SELECT name, climb_type, grade, location, country, area, latitude, longitude,
             ROW_NUMBER() OVER (PARTITION BY name ORDER BY record_created DESC, hash DESC) as rn
      FROM climbs 
      WHERE status = 'valid'
    ),
    latest_ascents AS (
      SELECT climb_name, athlete_name, date_of_ascent, web_link,
             ROW_NUMBER() OVER (PARTITION BY climb_name, athlete_name ORDER BY record_created DESC, hash DESC) as rn
      FROM ascents 
      WHERE status = 'valid'
    )
    SELECT 
      a.name as athlete_name,
      a.nationality,
      a.gender,
      a.year_of_birth,
      c.name as climb_name,
      c.climb_type,
      c.grade,
      c.location,
      c.country,
      c.area,
      c.latitude,
      c.longitude,
      asc.date_of_ascent,
      asc.web_link
    FROM latest_ascents asc
    JOIN latest_athletes a ON asc.athlete_name = a.name AND a.rn = 1
    JOIN latest_climbs c ON asc.climb_name = c.name AND c.rn = 1
    WHERE asc.rn = 1
    ORDER BY asc.date_of_ascent DESC, c.grade DESC`;
  
  const result = await db.prepare(query).all();
  
  return new Response(JSON.stringify(result.results), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Content-Disposition': `attachment; filename="climbs-dataset-${new Date().toISOString().split('T')[0]}.json"`
    }
  });
}