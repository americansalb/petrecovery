#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Smart city name capitalizer that handles special cases
 */
function capitalizeCityName(name) {
  if (!name) return name;

  // Special case replacements (known city names)
  const specialCases = {
    'lake in the hill': 'Lake in the Hills',
    'lake in the hills': 'Lake in the Hills',
    'mcallen': 'McAllen',
    'mckenzie': 'McKenzie',
    'mckinney': 'McKinney',
    'o\'fallon': 'O\'Fallon',
    'o\'neill': 'O\'Neill',
    'dekalb': 'DeKalb',
    'desoto': 'DeSoto',
    'lapeer': 'Lapeer',
    'laplace': 'LaPlace',
    'lavergne': 'LaVergne',
  };

  const lowerName = name.toLowerCase().trim();
  if (specialCases[lowerName]) {
    return specialCases[lowerName];
  }

  // Split on spaces and hyphens, capitalize each part
  const parts = name.split(/(\s+|-)/);

  const capitalized = parts.map((part, idx) => {
    // Keep separators as-is
    if (/^\s+$/.test(part) || part === '-') {
      return part;
    }

    if (part.length === 0) return part;

    // Handle Mc prefix (McDonald, McKinley, etc.)
    if (part.toLowerCase().startsWith('mc') && part.length > 2) {
      return 'Mc' + part.charAt(2).toUpperCase() + part.slice(3).toLowerCase();
    }

    // Handle Mac prefix (MacDonald, MacArthur, etc.)
    if (part.toLowerCase().startsWith('mac') && part.length > 3) {
      return 'Mac' + part.charAt(3).toUpperCase() + part.slice(4).toLowerCase();
    }

    // Handle O' prefix (O'Brien, O'Neill, etc.)
    if (part.toLowerCase().startsWith("o'") && part.length > 2) {
      return "O'" + part.charAt(2).toUpperCase() + part.slice(3).toLowerCase();
    }

    // Handle De prefix (DeKalb, DeSoto, etc.)
    if (part.toLowerCase().startsWith('de') && part.length > 2) {
      // Check if next letter is uppercase in original
      if (part.length > 2 && part.charAt(2) === part.charAt(2).toUpperCase()) {
        return 'De' + part.charAt(2).toUpperCase() + part.slice(3).toLowerCase();
      }
    }

    // Handle La prefix (LaPlace, LaVergne, etc.)
    if (part.toLowerCase().startsWith('la') && part.length > 2) {
      // Check if next letter is uppercase in original
      if (part.length > 2 && part.charAt(2) === part.charAt(2).toUpperCase()) {
        return 'La' + part.charAt(2).toUpperCase() + part.slice(3).toLowerCase();
      }
    }

    // Handle St. abbreviation
    if (part.toLowerCase() === 'st.' || part.toLowerCase() === 'st') {
      return 'St.';
    }

    // Handle Mt. abbreviation
    if (part.toLowerCase() === 'mt.' || part.toLowerCase() === 'mt') {
      return 'Mt.';
    }

    // Handle Fort → Fort
    if (part.toLowerCase() === 'fort') {
      return 'Fort';
    }

    // Handle San, Las, Los, etc. (Spanish articles)
    const spanishArticles = ['san', 'santa', 'las', 'los', 'el', 'la'];
    if (spanishArticles.includes(part.toLowerCase())) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }

    // Handle small words that should be lowercase in middle of name
    const smallWords = ['the', 'of', 'and', 'in', 'at', 'by', 'for', 'on', 'a', 'an'];
    if (idx > 0 && smallWords.includes(part.toLowerCase())) {
      // Keep lowercase unless it's the first word
      return part.toLowerCase();
    }

    // Default: capitalize first letter, lowercase rest
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  });

  return capitalized.join('');
}

// Load cities
const filePath = path.join(__dirname, '../app/lib/uscities.full.json');
const cities = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log(`Processing ${cities.length} cities...`);

let fixedCount = 0;
const examples = [];

cities.forEach(city => {
  const original = city.city;
  const fixed = capitalizeCityName(original);

  if (original !== fixed) {
    fixedCount++;
    if (examples.length < 50) {
      examples.push({ original, fixed });
    }
    city.city = fixed;
  }
});

console.log(`\nFixed ${fixedCount} city names`);
console.log('\nFirst 50 examples:');
examples.forEach(ex => {
  console.log(`  "${ex.original}" → "${ex.fixed}"`);
});

// Save updated data
fs.writeFileSync(filePath, JSON.stringify(cities), 'utf-8');
console.log(`\n✅ Saved updated cities to ${filePath}`);

// Re-check specific cases
const testCases = [
  'Lake in the Hills',
  'Fort Worth',
  'San Antonio',
  'New York',
  'St. Petersburg',
  'McAllen',
  'O\'Fallon'
];

console.log('\nVerifying known cities:');
testCases.forEach(name => {
  const found = cities.find(c => c.city.toLowerCase() === name.toLowerCase());
  if (found) {
    console.log(`  ✓ "${found.city}"`);
  } else {
    console.log(`  ✗ "${name}" not found`);
  }
});
