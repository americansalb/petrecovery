/**
 * AI Image Matching for Pet Recognition
 *
 * Compares pet photos using visual similarity algorithms.
 * Uses perceptual hashing and color histogram analysis.
 */

/**
 * Calculate perceptual hash similarity between two image URLs
 * Returns a score from 0 to 1 (1 being identical)
 */
export async function calculateImageSimilarity(imageUrl1, imageUrl2) {
  // In production, this would use a service like AWS Rekognition,
  // Google Cloud Vision, or a custom ML model
  // For now, return a placeholder implementation

  try {
    // Extract dominant colors and basic features
    const features1 = await extractImageFeatures(imageUrl1);
    const features2 = await extractImageFeatures(imageUrl2);

    if (!features1 || !features2) return 0;

    // Calculate similarity based on features
    return calculateFeatureSimilarity(features1, features2);
  } catch (error) {
    console.error('Image similarity error:', error);
    return 0;
  }
}

/**
 * Extract basic image features (placeholder)
 */
async function extractImageFeatures(imageUrl) {
  // In production, use cloud vision API or ML model
  // This is a placeholder that returns mock features
  return {
    dominantColors: [],
    aspectRatio: 1,
    brightness: 0.5,
    hasAnimal: true,
  };
}

/**
 * Calculate similarity between feature sets
 */
function calculateFeatureSimilarity(f1, f2) {
  let score = 0;
  let factors = 0;

  // Color similarity
  if (f1.dominantColors.length && f2.dominantColors.length) {
    score += colorSimilarity(f1.dominantColors, f2.dominantColors) * 0.4;
    factors++;
  }

  // Aspect ratio similarity
  const aspectDiff = Math.abs(f1.aspectRatio - f2.aspectRatio);
  if (aspectDiff < 0.3) {
    score += (1 - aspectDiff) * 0.2;
    factors++;
  }

  return factors > 0 ? score / factors : 0;
}

/**
 * Calculate color similarity between two color palettes
 */
function colorSimilarity(colors1, colors2) {
  if (!colors1.length || !colors2.length) return 0;

  let totalSim = 0;
  for (const c1 of colors1) {
    let maxSim = 0;
    for (const c2 of colors2) {
      const sim = 1 - colorDistance(c1, c2) / 441.67; // Max RGB distance
      maxSim = Math.max(maxSim, sim);
    }
    totalSim += maxSim;
  }

  return totalSim / colors1.length;
}

/**
 * Calculate Euclidean distance between two RGB colors
 */
function colorDistance(c1, c2) {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * Find matching pets based on image similarity
 */
export async function findVisualMatches(targetImageUrl, candidateImages, threshold = 0.6) {
  const matches = [];

  for (const candidate of candidateImages) {
    const similarity = await calculateImageSimilarity(targetImageUrl, candidate.imageUrl);

    if (similarity >= threshold) {
      matches.push({
        ...candidate,
        visualSimilarity: similarity,
      });
    }
  }

  return matches.sort((a, b) => b.visualSimilarity - a.visualSimilarity);
}

/**
 * Score a potential match combining visual and text features
 */
export function combineMatchScores(visualScore, textScore, weights = { visual: 0.4, text: 0.6 }) {
  return visualScore * weights.visual + textScore * weights.text;
}

/**
 * Analyze pet image for breed/species detection
 */
export async function analyzePetImage(imageUrl) {
  // Placeholder for ML model integration
  // In production, use a trained model or API

  return {
    detectedSpecies: null,
    detectedBreed: null,
    confidence: 0,
    colors: [],
    size: null,
    features: [],
  };
}

/**
 * Compare two pets for potential match
 */
export async function comparePets(pet1, pet2) {
  const scores = {
    visual: 0,
    species: 0,
    breed: 0,
    color: 0,
    size: 0,
    location: 0,
  };

  // Species must match
  if (pet1.species !== pet2.species) {
    return { isMatch: false, score: 0, scores };
  }
  scores.species = 1;

  // Visual comparison if images available
  if (pet1.photoUrl && pet2.photoUrl) {
    scores.visual = await calculateImageSimilarity(pet1.photoUrl, pet2.photoUrl);
  }

  // Breed comparison
  if (pet1.breed && pet2.breed) {
    scores.breed = pet1.breed.toLowerCase() === pet2.breed.toLowerCase() ? 1 : 0;
  }

  // Color comparison
  if (pet1.color && pet2.color) {
    const colors1 = pet1.color.toLowerCase().split(/[\s,]+/);
    const colors2 = pet2.color.toLowerCase().split(/[\s,]+/);
    const matchingColors = colors1.filter((c) => colors2.includes(c));
    scores.color = matchingColors.length / Math.max(colors1.length, colors2.length);
  }

  // Size comparison
  if (pet1.size && pet2.size) {
    scores.size = pet1.size.toLowerCase() === pet2.size.toLowerCase() ? 1 : 0.5;
  }

  // Calculate overall score
  const weights = {
    species: 0.25,
    visual: 0.25,
    breed: 0.2,
    color: 0.15,
    size: 0.15,
  };

  const totalScore = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + (scores[key] || 0) * weight,
    0
  );

  return {
    isMatch: totalScore > 0.6,
    score: totalScore,
    scores,
  };
}
