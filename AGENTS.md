# Agent Guidelines

## Build 
- We test remotely with npx wrangler pages deploy public --project-name=climbing-database
- No local testing

## Database Schema
- Uses composite primary keys (name + record_created) for versioning
- athletes: name, record_created (PK), nationality, gender, year_of_birth, status, hash
- climbs: name, record_created (PK), climb_type, grade, location fields, status, hash  
- ascents: climb_name, athlete_name, record_created (PK), date_of_ascent, web_link, status, hash
- All tables have status field (valid/pending/rejected) and UUID hash for review system
- Queries select latest valid record by MAX(record_created) for each name

## Code Style
- Use ES6+ imports/exports
- Follow existing file naming conventions
- Add types for all function parameters and return values
- Handle errors with try/catch blocks
- Use descriptive variable and function names
- Keep functions small and focused
- Add JSDoc comments for complex functions