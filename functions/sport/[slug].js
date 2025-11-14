// Import shared functions
import { generateClimbDetailPage } from '../shared/functions.js';

export async function onRequestGet(context) {
  return await generateClimbDetailPage(context, 'sport');
}