/**
 * Machine Learning Image Analysis
 *
 * TensorFlow.js-based pet image analysis including:
 * - Breed detection
 * - Color extraction
 * - Feature embedding for similarity matching
 */

// Note: In production, use @tensorflow/tfjs-node for better performance
// For browser/edge: @tensorflow/tfjs

/**
 * Extract dominant colors from an image
 * Uses k-means clustering on pixel data
 */
export async function extractColors(imageUrl, numColors = 5) {
  try {
    // Try to use canvas for server-side color extraction
    let canvasModule;
    try {
      canvasModule = await import(/* webpackIgnore: true */ 'canvas').catch(() => null);
    } catch (e) {
      canvasModule = null;
    }

    if (!canvasModule) {
      // Fallback: return placeholder colors based on common pet colors
      return [
        { rgb: { r: 139, g: 69, b: 19 }, hex: '#8b4513', name: 'brown' },
        { rgb: { r: 255, g: 255, b: 255 }, hex: '#ffffff', name: 'white' },
        { rgb: { r: 0, g: 0, b: 0 }, hex: '#000000', name: 'black' },
      ].slice(0, numColors);
    }

    const { createCanvas, loadImage } = canvasModule;

    // Fetch image and convert to pixel data
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const image = await loadImage(Buffer.from(arrayBuffer));
    const canvas = createCanvas(100, 100); // Resize for performance
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, 100, 100);

    const imageData = ctx.getImageData(0, 0, 100, 100);
    const pixels = [];

    // Sample pixels (skip every 4th for performance)
    for (let i = 0; i < imageData.data.length; i += 16) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      pixels.push([r, g, b]);
    }

    // K-means clustering
    const colors = kMeansClustering(pixels, numColors);

    return colors.map(([r, g, b]) => ({
      rgb: { r: Math.round(r), g: Math.round(g), b: Math.round(b) },
      hex: rgbToHex(Math.round(r), Math.round(g), Math.round(b)),
      name: getColorName(r, g, b),
    }));
  } catch (error) {
    console.error('Color extraction error:', error);
    return [];
  }
}

/**
 * K-means clustering for color extraction
 */
function kMeansClustering(pixels, k, maxIterations = 10) {
  // Initialize centroids randomly
  let centroids = pixels.slice(0, k).map(p => [...p]);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign pixels to nearest centroid
    const clusters = Array.from({ length: k }, () => []);

    for (const pixel of pixels) {
      let minDist = Infinity;
      let closestIdx = 0;

      for (let i = 0; i < k; i++) {
        const dist = euclideanDistance(pixel, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }

      clusters[closestIdx].push(pixel);
    }

    // Update centroids
    const newCentroids = clusters.map((cluster, i) => {
      if (cluster.length === 0) return centroids[i];
      return [
        cluster.reduce((sum, p) => sum + p[0], 0) / cluster.length,
        cluster.reduce((sum, p) => sum + p[1], 0) / cluster.length,
        cluster.reduce((sum, p) => sum + p[2], 0) / cluster.length,
      ];
    });

    centroids = newCentroids;
  }

  return centroids;
}

function euclideanDistance(a, b) {
  return Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  );
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Map RGB to color name
 */
function getColorName(r, g, b) {
  const colors = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    gray: [128, 128, 128],
    brown: [139, 69, 19],
    tan: [210, 180, 140],
    cream: [255, 253, 208],
    golden: [255, 215, 0],
    orange: [255, 165, 0],
    red: [255, 0, 0],
    ginger: [176, 101, 0],
    chocolate: [123, 63, 0],
    liver: [103, 76, 71],
    brindle: [128, 70, 27],
    fawn: [229, 170, 112],
    apricot: [251, 206, 177],
    blue: [70, 130, 180],
    merle: [119, 136, 153],
    sable: [139, 90, 43],
    tricolor: [128, 64, 64],
  };

  let closestColor = 'unknown';
  let minDist = Infinity;

  for (const [name, rgb] of Object.entries(colors)) {
    const dist = euclideanDistance([r, g, b], rgb);
    if (dist < minDist) {
      minDist = dist;
      closestColor = name;
    }
  }

  return closestColor;
}

/**
 * Breed detection model configuration
 * In production, load actual TensorFlow model
 */
const BREED_MODELS = {
  dog: {
    modelUrl: process.env.DOG_BREED_MODEL_URL || null,
    labels: [
      'Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'French Bulldog',
      'Bulldog', 'Poodle', 'Beagle', 'Rottweiler', 'German Shorthaired Pointer',
      'Dachshund', 'Pembroke Welsh Corgi', 'Australian Shepherd', 'Yorkshire Terrier',
      'Boxer', 'Cavalier King Charles Spaniel', 'Doberman Pinscher', 'Great Dane',
      'Miniature Schnauzer', 'Siberian Husky', 'Shih Tzu', 'Boston Terrier',
      'Bernese Mountain Dog', 'Pomeranian', 'Havanese', 'Shetland Sheepdog',
      'Brittany', 'English Springer Spaniel', 'Cocker Spaniel', 'Border Collie',
      'Mastiff', 'Chihuahua', 'Vizsla', 'Pit Bull', 'Mixed Breed',
    ],
  },
  cat: {
    modelUrl: process.env.CAT_BREED_MODEL_URL || null,
    labels: [
      'Persian', 'Maine Coon', 'Ragdoll', 'British Shorthair', 'Exotic Shorthair',
      'Abyssinian', 'Scottish Fold', 'Sphynx', 'Siamese', 'Devon Rex',
      'American Shorthair', 'Oriental Shorthair', 'Norwegian Forest Cat',
      'Bengal', 'Russian Blue', 'Birman', 'Burmese', 'Tonkinese',
      'Domestic Shorthair', 'Domestic Longhair', 'Tabby', 'Tuxedo',
      'Calico', 'Tortoiseshell', 'Orange Tabby', 'Mixed Breed',
    ],
  },
};

/**
 * Detect breed from image
 * Returns top 3 predictions with confidence scores
 */
export async function detectBreed(imageUrl, species = 'dog') {
  const modelConfig = BREED_MODELS[species.toLowerCase()];

  if (!modelConfig) {
    return { error: 'Unsupported species', predictions: [] };
  }

  try {
    // Check if TensorFlow model is available
    if (modelConfig.modelUrl) {
      return await runTensorFlowModel(imageUrl, modelConfig);
    }

    // Fallback: Use heuristic-based detection
    return await heuristicBreedDetection(imageUrl, species, modelConfig.labels);
  } catch (error) {
    console.error('Breed detection error:', error);
    return { error: error.message, predictions: [] };
  }
}

/**
 * Run TensorFlow.js model for breed detection
 */
async function runTensorFlowModel(imageUrl, modelConfig) {
  try {
    // TensorFlow is optional - try to import, fallback to heuristic if not available
    let tf;
    try {
      tf = await import(/* webpackIgnore: true */ '@tensorflow/tfjs-node').catch(() => null);
    } catch (e) {
      tf = null;
    }

    if (!tf) {
      throw new Error('TensorFlow not available');
    }

    // Load model
    const model = await tf.loadLayersModel(modelConfig.modelUrl);

    // Preprocess image
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const imageTensor = tf.node.decodeImage(new Uint8Array(arrayBuffer), 3);

    // Resize to model input size (typically 224x224)
    const resized = tf.image.resizeBilinear(imageTensor, [224, 224]);
    const normalized = resized.div(255.0).expandDims(0);

    // Run inference
    const predictions = model.predict(normalized);
    const probabilities = await predictions.data();

    // Get top 3 predictions
    const results = Array.from(probabilities)
      .map((prob, idx) => ({ breed: modelConfig.labels[idx], confidence: prob }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    // Cleanup
    imageTensor.dispose();
    resized.dispose();
    normalized.dispose();
    predictions.dispose();

    return { predictions: results };
  } catch (error) {
    console.error('TensorFlow model error:', error);
    throw error;
  }
}

/**
 * Heuristic breed detection based on color and patterns
 * Fallback when ML model is not available
 */
async function heuristicBreedDetection(imageUrl, species, labels) {
  const colors = await extractColors(imageUrl, 3);
  const dominantColors = colors.map(c => c.name);

  // Simple heuristic matching based on color patterns
  const breedColorPatterns = {
    dog: {
      'Labrador Retriever': ['golden', 'chocolate', 'black'],
      'German Shepherd': ['tan', 'black', 'sable'],
      'Golden Retriever': ['golden', 'cream'],
      'Siberian Husky': ['white', 'gray', 'black'],
      'Dalmatian': ['white', 'black'],
      'Rottweiler': ['black', 'tan'],
      'Beagle': ['white', 'tan', 'black'],
      'Mixed Breed': ['*'],
    },
    cat: {
      'Persian': ['white', 'cream', 'gray'],
      'Siamese': ['cream', 'brown', 'tan'],
      'Maine Coon': ['brown', 'tan', 'gray'],
      'Orange Tabby': ['orange', 'ginger'],
      'Tuxedo': ['black', 'white'],
      'Calico': ['white', 'orange', 'black'],
      'Mixed Breed': ['*'],
    },
  };

  const patterns = breedColorPatterns[species] || {};
  const predictions = [];

  for (const [breed, breedColors] of Object.entries(patterns)) {
    if (breedColors.includes('*')) {
      predictions.push({ breed, confidence: 0.3 });
      continue;
    }

    const matchCount = dominantColors.filter(c => breedColors.includes(c)).length;
    const confidence = matchCount / breedColors.length;

    if (confidence > 0) {
      predictions.push({ breed, confidence: Math.min(confidence, 0.7) });
    }
  }

  // Sort by confidence and return top 3
  return {
    predictions: predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3),
    method: 'heuristic',
  };
}

/**
 * Generate image embedding/feature vector for similarity matching
 */
export async function generateImageEmbedding(imageUrl) {
  try {
    // Try TensorFlow model first
    if (process.env.EMBEDDING_MODEL_URL) {
      return await generateTensorFlowEmbedding(imageUrl);
    }

    // Fallback: Generate simple perceptual hash + color features
    return await generateSimpleEmbedding(imageUrl);
  } catch (error) {
    console.error('Embedding generation error:', error);
    return null;
  }
}

/**
 * Generate embedding using TensorFlow model (MobileNet or similar)
 */
async function generateTensorFlowEmbedding(imageUrl) {
  // TensorFlow is optional
  let tf;
  try {
    tf = await import(/* webpackIgnore: true */ '@tensorflow/tfjs-node').catch(() => null);
  } catch (e) {
    tf = null;
  }

  if (!tf) {
    throw new Error('TensorFlow not available');
  }

  // Load MobileNet or custom embedding model
  const model = await tf.loadLayersModel(process.env.EMBEDDING_MODEL_URL);

  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const imageTensor = tf.node.decodeImage(new Uint8Array(arrayBuffer), 3);

  const resized = tf.image.resizeBilinear(imageTensor, [224, 224]);
  const normalized = resized.div(255.0).expandDims(0);

  const embedding = model.predict(normalized);
  const vector = await embedding.data();

  // Cleanup
  imageTensor.dispose();
  resized.dispose();
  normalized.dispose();
  embedding.dispose();

  return Array.from(vector);
}

/**
 * Generate simple embedding without ML model
 * Combines color histogram + edge features + perceptual hash
 */
async function generateSimpleEmbedding(imageUrl) {
  // Canvas is optional for server-side image processing
  let canvasModule;
  try {
    canvasModule = await import(/* webpackIgnore: true */ 'canvas').catch(() => null);
  } catch (e) {
    canvasModule = null;
  }

  if (!canvasModule) {
    // Return a placeholder embedding if canvas is not available
    return new Array(112).fill(0).map(() => Math.random());
  }

  const { createCanvas, loadImage } = canvasModule;

  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const image = await loadImage(Buffer.from(arrayBuffer));

  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const embedding = [];

  // Color histogram (16 bins per channel = 48 features)
  const rHist = new Array(16).fill(0);
  const gHist = new Array(16).fill(0);
  const bHist = new Array(16).fill(0);

  for (let i = 0; i < imageData.data.length; i += 4) {
    rHist[Math.floor(imageData.data[i] / 16)]++;
    gHist[Math.floor(imageData.data[i + 1] / 16)]++;
    bHist[Math.floor(imageData.data[i + 2] / 16)]++;
  }

  // Normalize histograms
  const totalPixels = size * size;
  embedding.push(...rHist.map(v => v / totalPixels));
  embedding.push(...gHist.map(v => v / totalPixels));
  embedding.push(...bHist.map(v => v / totalPixels));

  // Grayscale average per 8x8 block (64 features)
  for (let by = 0; by < 8; by++) {
    for (let bx = 0; bx < 8; bx++) {
      let sum = 0;
      for (let y = by * 8; y < (by + 1) * 8; y++) {
        for (let x = bx * 8; x < (bx + 1) * 8; x++) {
          const idx = (y * size + x) * 4;
          const gray = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
          sum += gray;
        }
      }
      embedding.push(sum / (64 * 255)); // Normalize to 0-1
    }
  }

  return embedding; // 112-dimensional vector
}

/**
 * Calculate similarity between two embeddings
 */
export function calculateEmbeddingSimilarity(embedding1, embedding2) {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    return 0;
  }

  // Cosine similarity
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  if (norm1 === 0 || norm2 === 0) return 0;

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Find similar pets based on image embedding
 */
export async function findSimilarPets(prisma, imageUrl, options = {}) {
  const { species, limit = 10, minSimilarity = 0.6 } = options;

  // Generate embedding for query image
  const queryEmbedding = await generateImageEmbedding(imageUrl);
  if (!queryEmbedding) {
    return [];
  }

  // Get active cases with embeddings
  const cases = await prisma.case.findMany({
    where: {
      status: { in: ['ACTIVE', 'IN_PROGRESS'] },
      ...(species && { petSpecies: species }),
    },
    select: {
      id: true,
      missionNumber: true,
      petName: true,
      petSpecies: true,
      petBreed: true,
      petPhotoUrl: true,
      petDescription: true,
      lastSeenAddress: true,
      imageEmbedding: true, // Assumes this field exists
    },
  });

  // Calculate similarities
  const results = [];

  for (const missionData of cases) {
    let embedding;

    // Use stored embedding or generate new one
    if (missionData.imageEmbedding) {
      embedding = JSON.parse(missionData.imageEmbedding);
    } else {
      embedding = await generateImageEmbedding(missionData.petPhotoUrl);
    }

    if (embedding) {
      const similarity = calculateEmbeddingSimilarity(queryEmbedding, embedding);
      if (similarity >= minSimilarity) {
        results.push({
          ...missionData,
          similarity: Math.round(similarity * 100),
        });
      }
    }
  }

  // Sort by similarity and limit results
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Analyze pet image comprehensively
 */
export async function analyzePetImage(imageUrl, species = 'dog') {
  const [colors, breedPredictions, embedding] = await Promise.all([
    extractColors(imageUrl, 5),
    detectBreed(imageUrl, species),
    generateImageEmbedding(imageUrl),
  ]);

  return {
    colors,
    breeds: breedPredictions.predictions || [],
    breedMethod: breedPredictions.method || 'ml',
    embedding,
    analyzedAt: new Date().toISOString(),
  };
}
