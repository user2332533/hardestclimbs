#!/usr/bin/env node

/**
 * Script to update athletes table with CSV data
 * Downloads CSV, matches athletes, and updates database
 */

import https from 'https';
import { createHash } from 'crypto';

// CSV URL
const CSV_URL = 'https://raw.githubusercontent.com/9cpluss/hardest-climbs/refs/heads/master/data/climbers_table.csv';

/**
 * Download CSV data from URL
 */
function downloadCSV() {
  return new Promise((resolve, reject) => {
    let data = '';
    
    https.get(CSV_URL, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse CSV data into array of objects
 */
function parseCSV(csvData) {
  const lines = csvData.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
  
  const athletes = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
    
    if (values.length === headers.length) {
      const athlete = {};
      headers.forEach((header, index) => {
        athlete[header] = values[index];
      });
      
      // Combine first and last name
      athlete.fullName = `${athlete.first_name} ${athlete.last_name}`;
      
      // Handle NA values
      athlete.year_of_birth = athlete.year_of_birth === 'NA' ? null : 
                               athlete.year_of_birth ? parseInt(athlete.year_of_birth) : null;
      
      athletes.push(athlete);
    }
  }
  
  return athletes;
}

/**
 * Generate UUID hash for database record
 */
function generateHash() {
  return createHash('sha256').update(Date.now().toString() + Math.random().toString()).digest('hex').substring(0, 32);
}

/**
 * Create SQL UPDATE statements for matched athletes
 */
function createUpdateStatements(csvAthletes, dbAthletes) {
  const updates = [];
  const matched = [];
  const unmatched = [];
  
  // Create lookup for database athletes
  const dbAthleteMap = new Map();
  dbAthletes.forEach(athlete => {
    dbAthleteMap.set(athlete.name.toLowerCase(), athlete);
  });
  
  // Match CSV athletes with database athletes
  csvAthletes.forEach(csvAthlete => {
    const csvName = csvAthlete.fullName.toLowerCase();
    const dbAthlete = dbAthleteMap.get(csvName);
    
    if (dbAthlete) {
      // Create update statement
      const hash = generateHash();
      const update = {
        name: dbAthlete.name,
        nationality: csvAthlete.country || null,
        gender: csvAthlete.gender || null,
        year_of_birth: csvAthlete.year_of_birth,
        hash: hash
      };
      
      updates.push(update);
      matched.push({
        csvName: csvAthlete.fullName,
        dbName: dbAthlete.name,
        nationality: csvAthlete.country,
        gender: csvAthlete.gender,
        year_of_birth: csvAthlete.year_of_birth
      });
    } else {
      unmatched.push(csvAthlete.fullName);
    }
  });
  
  return { updates, matched, unmatched };
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🏗️  Starting athletes table update...\n');
    
    // Step 1: Download CSV
    console.log('📥 Downloading CSV data...');
    const csvData = await downloadCSV();
    console.log(`✅ Downloaded ${csvData.length} bytes of CSV data\n`);
    
    // Step 2: Parse CSV
    console.log('📊 Parsing CSV data...');
    const csvAthletes = parseCSV(csvData);
    console.log(`✅ Parsed ${csvAthletes.length} athletes from CSV\n`);
    
    // Show sample of CSV data
    console.log('📋 Sample CSV athletes:');
    csvAthletes.slice(0, 5).forEach(athlete => {
      console.log(`   ${athlete.fullName} - ${athlete.country}, ${athlete.gender}, ${athlete.year_of_birth || 'NA'}`);
    });
    console.log();
    
    // Step 3: Get current database athletes (would need DB connection here)
    console.log('🗄️  Would fetch current database athletes here...');
    console.log('   (This requires database connection in actual execution)\n');
    
    // For now, create a mock structure to show the process
    console.log('🔧 Processing would continue with:');
    console.log(`   - Matching ${csvAthletes.length} CSV athletes against database`);
    console.log('   - Creating UPDATE statements for matches');
    console.log('   - Executing database updates');
    console.log('   - Validating results\n');
    
    console.log('🎯 Script structure ready for execution!');
    console.log('   Next step: Integrate with actual database connection\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { downloadCSV, parseCSV, createUpdateStatements };