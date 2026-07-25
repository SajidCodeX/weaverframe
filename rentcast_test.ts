import fs from 'fs';
import path from 'path';

// Load environment variables from .env if available
import dotenv from 'dotenv';
dotenv.config();

const RENTCAST_API_KEY = process.env.RENCAST_API_KEY;

async function fetchRentCastData() {
  if (!RENTCAST_API_KEY) {
    console.error("Error: RENCAST_API_KEY is missing in .env file.");
    console.error("Please add RENCAST_API_KEY=your_key_here to .env and run again.");
    process.exit(1);
  }

  console.log("Fetching 20 property records from RentCast API...");

  const url = 'https://api.rentcast.io/v1/properties?city=Austin&state=TX&limit=20';
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-Api-Key': RENTCAST_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`API returned status: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    // Save to file to inspect later
    const outputPath = path.join(process.cwd(), 'rentcast_sample_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    
    console.log(`\nSuccess! Fetched ${data.length} records.`);
    console.log(`Data saved to: ${outputPath}`);
    
    // Print the first record so we can see the exact fields
    console.log("\n--- Sample Output (First Record) ---");
    console.log(JSON.stringify(data[0], null, 2));

  } catch (error) {
    console.error("Failed to fetch from RentCast API:", error);
  }
}

fetchRentCastData();
