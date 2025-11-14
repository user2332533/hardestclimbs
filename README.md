# Hardest Climbs

A simple, dependency-free website tracking the hardest sport climbs and boulder problems in the world, built with **Server-Side Rendering (SSR)** on Cloudflare Pages and D1.

## 🎯 Project Overview

This project demonstrates a **complete SSR migration** from a traditional API-based architecture to a secure, server-side rendered application with **zero public API endpoints**.

## 📁 Project Structure

```
├── public/                 # Static assets only
│   └── styles.css         # Main stylesheet
├── functions/             # Cloudflare Pages Functions (SSR)
│   ├── index.js           # Home page with top climbs
│   ├── athletes.js        # Athletes listing page
│   ├── sport.js           # Sport climbs listing page
│   ├── boulder.js         # Boulder problems listing page
│   ├── athletes/[slug].js # Individual athlete pages
│   ├── sport/[slug].js    # Individual sport climb pages
│   └── boulder/[slug].js  # Individual boulder problem pages
├── schema.sql            # Database schema
├── migrate.py            # Data migration script
├── migrate_*.sql          # Generated migration files
├── inputs/                # Source JSON data
│   ├── boulder.json      # Boulder problems data
│   └── lead.json         # Sport climbs data
└── wrangler.toml         # Cloudflare configuration
```

## ✨ Features

- **Home page**: Top 3 hardest sport climbs and boulder problems
- **Sport climbs page**: All sport climbs sorted by difficulty
- **Boulders page**: All boulder problems sorted by difficulty  
- **Athletes page**: All climbers with nationality and stats
- **Individual athlete pages**: `/athletes/adam-ondra`
  - Complete ascent history
  - Statistics (total ascents, hardest grades)
  - Links to individual climb pages
- **Individual sport climb pages**: `/sport/silence`
  - Location information with maps
  - Complete ascent history
  - Athlete statistics
- **Individual boulder pages**: `/boulder/burden-of-dreams`
  - Location information with maps
  - Complete ascent history
  - Athlete statistics

## 🛠 Tech Stack

- **Frontend**: Vanilla HTML/CSS (no JavaScript frameworks)
- **Backend**: Cloudflare Pages Functions (Server-Side Rendering)
- **Database**: Cloudflare D1 (SQLite)
- **Deployment**: Cloudflare Pages

## 🌐 URL Structure

### Static Pages
- `/` - Home page
- `/athletes` - All athletes listing
- `/sport` - All sport climbs listing
- `/boulder` - All boulder problems listing

### Dynamic Pages (SSR)
- `/athletes/adam-ondra` - Individual athlete profile
- `/sport/silence` - Individual sport climb details
- `/boulder/burden-of-dreams` - Individual boulder problem details

**Note**: All dynamic routes support case-insensitive matching (e.g., `/athletes/ADAM-ONDRA` works the same as `/athletes/adam-ondra`).

## 🗄 Database Schema

Uses composite primary keys with versioning for data integrity:
- `athletes`: name, record_created (PK), nationality, gender, year_of_birth, status, hash
- `climbs`: name, record_created (PK), climb_type, grade, location fields, status, hash
- `ascents`: climb_name, athlete_name, record_created (PK), date_of_ascent, web_link, status, hash

### Key Features
- **Status values**: `valid`, `pending`, `rejected`
- **Hashes**: UUIDs for review system
- **Versioning**: Latest valid record selected by CTEs with ROW_NUMBER()
- **Case-insensitive matching**: Uses `LOWER()` in SQL queries for robust slug handling
- **Indexes**: Optimized for name-based lookups and performance

## 🔄 SSR Implementation Details

### Dynamic Routing
Uses Cloudflare Pages Functions bracket notation:
```
functions/athletes/[slug].js  →  /athletes/:slug
functions/sport/[slug].js     →  /sport/:slug
functions/boulder/[slug].js   →  /boulder/:slug
```

## 🚀 Getting Started

1. **Create D1 database** in Cloudflare dashboard
2. **Update `wrangler.toml`** with your database ID
3. **Create schema and populate data**:
   ```bash
   python3 migrate.py
   npx wrangler d1 execute climbing-db --file=schema.sql --remote
   npx wrangler d1 execute climbing-db --file=migrate_athletes.sql --remote
   npx wrangler d1 execute climbing-db --file=migrate_climbs.sql --remote
   npx wrangler d1 execute climbing-db --file=migrate_ascents.sql --remote
   ```
4. **Deploy to Cloudflare Pages**: 
   ```bash
   npx wrangler pages deploy public --project-name=climbing-database
   ```
5. **Configure D1 binding** in Cloudflare Dashboard (Pages → Settings → D1 bindings)

## 🛠 Development

No build steps, no dependencies, no complexity - just simple files that work. The migration script handles proper SQL escaping for all string fields including names with apostrophes.

### SSR Development Notes
- Each function file contains all necessary code inline (no imports)
- Database functions are duplicated across files for Cloudflare compatibility
- Template functions are included inline for HTML generation
- Error handling is comprehensive for all edge cases

## 🌍 Live Demo

See the SSR implementation in action at: `https://climbing-database.pages.dev`
