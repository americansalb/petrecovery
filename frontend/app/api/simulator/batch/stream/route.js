/**
 * Streaming Batch Simulator API - Real-time progress via Server-Sent Events
 *
 * POST /api/simulator/batch/stream - Run batch with SSE progress updates
 *
 * Returns a stream of events:
 * - start: { total, requestId }
 * - status: { message }
 * - simulation: { individual simulation result - streamed as each completes }
 * - progress: { completed, total, percent, successRate, outcomes, convergence }
 * - converged: { message } - sent when CoV drops below threshold
 * - complete: { batch summary with all simulations }
 * - error: { error message }
 *
 * CONVERGENCE DIAGNOSTICS:
 * Uses Coefficient of Variation (CoV) = std deviation / mean
 * When CoV < 0.05 (5%), the estimate is considered converged.
 * This is calculated incrementally using Welford's online algorithm.
 *
 * Memory-safe: Uses incremental aggregation, streams results instead of storing.
 * Supports up to 100,000 simulations (will take time but won't crash).
 */

import {
  LegacyEmergentSimulationEngine as SimulationEngine,
  OUTCOMES,
  loadTerrain,
} from '@/app/lib/simulator/emergent/adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Maximum batch size - memory safe due to incremental aggregation
const MAX_BATCH_SIZE = 100000;

// Convergence threshold - CoV must be below this for statistical convergence
const CONVERGENCE_THRESHOLD = 0.05; // 5% relative precision

/**
 * Welford's Online Algorithm for calculating variance incrementally
 * This allows us to calculate standard deviation without storing all values
 *
 * Reference: Welford, B.P. (1962). "Note on a method for calculating
 * corrected sums of squares and products". Technometrics. 4(3): 419–420.
 */
class WelfordAggregator {
  constructor() {
    this.n = 0;
    this.mean = 0;
    this.M2 = 0; // Sum of squared differences from mean
  }

  /**
   * Add a new value to the running statistics
   * @param {number} x - New value to add
   */
  update(x) {
    this.n++;
    const delta = x - this.mean;
    this.mean += delta / this.n;
    const delta2 = x - this.mean;
    this.M2 += delta * delta2;
  }

  /**
   * Get current variance (sample variance, n-1 denominator)
   */
  get variance() {
    if (this.n < 2) return 0;
    return this.M2 / (this.n - 1);
  }

  /**
   * Get current standard deviation
   */
  get stdDev() {
    return Math.sqrt(this.variance);
  }

  /**
   * Get Coefficient of Variation (CV or CoV)
   * CV = std deviation / mean
   * Lower is better - indicates more precise estimate
   */
  get coefficientOfVariation() {
    if (this.mean === 0 || this.n < 2) return Infinity;
    return this.stdDev / Math.abs(this.mean);
  }

  /**
   * Get standard error of the mean
   * SE = stdDev / sqrt(n)
   */
  get standardError() {
    if (this.n < 2) return Infinity;
    return this.stdDev / Math.sqrt(this.n);
  }

  /**
   * Check if we've converged based on CoV threshold
   * @param {number} threshold - CoV threshold (default 0.05 = 5%)
   */
  hasConverged(threshold = CONVERGENCE_THRESHOLD) {
    return this.n >= 30 && this.coefficientOfVariation < threshold;
  }
}

export async function POST(request) {
  const requestId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[${requestId}] 🚀 Streaming batch request received`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event, data) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const body = await request.json();
        const {
          config,
          batchSize = 100,
          useTerrain = true
        } = body;

        console.log(`[${requestId}] Config:`, {
          species: config?.petSpecies,
          batchSize,
          lat: config?.centerLatitude,
          lng: config?.centerLongitude,
        });

        if (!config || !config.centerLatitude || !config.centerLongitude) {
          sendEvent('error', { error: 'Configuration with location is required' });
          controller.close();
          return;
        }

        const size = Math.min(Math.max(1, batchSize), MAX_BATCH_SIZE);

        // Warn for large batches
        if (batchSize > 10000) {
          const estimatedMinutes = Math.round((batchSize * 10) / 60000); // ~10ms per sim
          console.log(`[${requestId}] ⚠️ Large batch: ~${estimatedMinutes} minutes estimated`);
        }

        // Send initial event
        sendEvent('start', { total: size, requestId });

        // Load terrain
        let terrainInfo = null;
        if (useTerrain) {
          try {
            sendEvent('status', { message: 'Loading terrain data...' });
            terrainInfo = await loadTerrain(
              config.centerLatitude,
              config.centerLongitude,
              config.searchRadiusMiles || 2.0
            );
          } catch (e) {
            console.warn(`[${requestId}] Terrain failed:`, e.message);
          }
        }

        sendEvent('status', { message: 'Running simulations...' });

        // Run simulations with progress
        const outcomes = {};
        Object.values(OUTCOMES).forEach(o => outcomes[o] = 0);
        let totalTimeToFind = 0;
        let foundCount = 0;
        let totalPetDistance = 0;
        const timesToFind = [];
        const startTime = Date.now();

        // Convergence tracking using Welford's algorithm
        // Track success rate as binary outcomes (1 = success, 0 = timeout)
        const successRateAgg = new WelfordAggregator();
        const timeToFindAgg = new WelfordAggregator();
        let hasConverged = false;
        let convergedAt = null;

        for (let i = 0; i < size; i++) {
          try {
            const engine = new SimulationEngine(config);
            const result = engine.run();

            outcomes[result.outcome]++;
            totalPetDistance += result.petDistanceMiles || 0;

            // Track success as binary (1 = found, 0 = not found)
            // FIXED: Check for REUNITED outcomes (new format) or non-TIMEOUT (legacy format)
            const isSuccess = result.outcome.startsWith('REUNITED_') ||
              result.isFound === true ||
              (!result.outcome.startsWith('TIMEOUT') &&
               !result.outcome.startsWith('DECEASED_') &&
               !result.outcome.startsWith('STILL_') &&
               !result.outcome.startsWith('WITH_STRANGER') &&
               !result.outcome.startsWith('AT_SHELTER') &&
               !result.outcome.startsWith('ADOPTED_') &&
               !result.outcome.startsWith('SIGHTED_') &&
               !result.outcome.startsWith('FERAL_'))
              ? 1 : 0;
            successRateAgg.update(isSuccess);

            // FIXED: Check for successful outcomes (REUNITED_ prefix)
            if (result.foundAtMinute && result.outcome.startsWith('REUNITED_')) {
              totalTimeToFind += result.foundAtMinute;
              foundCount++;
              timesToFind.push(result.foundAtMinute);
              timeToFindAgg.update(result.foundAtMinute);
            }

            // Check for convergence (only trigger once)
            if (!hasConverged && successRateAgg.hasConverged()) {
              hasConverged = true;
              convergedAt = i + 1;
              sendEvent('converged', {
                message: `Statistical convergence reached at ${i + 1} simulations`,
                runsToConvergence: i + 1,
                finalCoV: (successRateAgg.coefficientOfVariation * 100).toFixed(2) + '%',
                successRate: (successRateAgg.mean * 100).toFixed(1) + '%',
                standardError: (successRateAgg.standardError * 100).toFixed(2) + '%',
              });
              console.log(`[${requestId}] ✅ Converged at ${i + 1} sims, CoV=${(successRateAgg.coefficientOfVariation * 100).toFixed(2)}%`);
            }

            // Send the individual simulation result (without full path data to save bandwidth)
            const simResult = {
              id: `sim_${result.seed}_${i}`,
              index: i,
              randomSeed: result.seed,
              outcome: result.outcome,
              foundAtMinute: result.foundAtMinute,
              foundLatitude: result.foundLatitude,
              foundLongitude: result.foundLongitude,
              petDistanceMiles: result.petDistanceMiles,
              finalPetState: result.finalPetState,
              wasTransported: result.wasTransported || false,
              createdAt: new Date().toISOString(),
            };
            sendEvent('simulation', simResult);

            // Send progress summary every 10 simulations (or every sim for small batches)
            if (size <= 100 || (i + 1) % 10 === 0 || i === size - 1) {
              // FIXED: Count REUNITED_ outcomes as success
              const successSoFar = Object.entries(outcomes)
                .filter(([k, v]) => k.startsWith('REUNITED_'))
                .reduce((sum, [k, v]) => sum + v, 0);

              // Calculate convergence metrics
              const cov = successRateAgg.n >= 2 ? successRateAgg.coefficientOfVariation : null;
              const se = successRateAgg.n >= 2 ? successRateAgg.standardError : null;

              sendEvent('progress', {
                completed: i + 1,
                total: size,
                percent: Math.round(((i + 1) / size) * 100),
                successRate: ((successSoFar / (i + 1)) * 100).toFixed(1),
                outcomes: { ...outcomes },
                // Convergence diagnostics
                convergence: {
                  coefficientOfVariation: cov != null ? (cov * 100).toFixed(2) : null,
                  standardError: se != null ? (se * 100).toFixed(2) : null,
                  hasConverged,
                  convergedAt,
                  threshold: (CONVERGENCE_THRESHOLD * 100).toFixed(0) + '%',
                },
              });
            }

          } catch (simError) {
            console.error(`[${requestId}] Sim ${i} failed:`, simError.message);
            sendEvent('simError', { index: i, error: simError.message });
          }

          // Yield to allow stream flushing and GC
          if (i % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }

          // Log progress for large batches
          if (size > 1000 && (i + 1) % 1000 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[${requestId}] Progress: ${i + 1}/${size} (${elapsed}s)`);
          }
        }

        // Calculate final stats
        timesToFind.sort((a, b) => a - b);
        const medianTimeToFind = timesToFind.length > 0
          ? timesToFind[Math.floor(timesToFind.length / 2)]
          : null;

        // Count outcomes by category using emergent outcome codes
        // REUNITED outcomes (success)
        const returnedHomeCount = outcomes['REUNITED_SELF_RETURN'] || 0;
        const foundBySearcherCount = (outcomes['REUNITED_OWNER_SEARCH'] || 0) +
          (outcomes['REUNITED_SEARCH_TEAM'] || 0) +
          (outcomes['REUNITED_CALLED'] || 0) +
          (outcomes['REUNITED_TRAP'] || 0);
        const foundViaShelterCount = outcomes['REUNITED_SHELTER'] || 0;
        const foundViaSocialCount = (outcomes['REUNITED_STRANGER_DIRECT'] || 0) +
          (outcomes['REUNITED_STRANGER_POST'] || 0);

        // DECEASED outcomes
        const deceasedCount = (outcomes['DECEASED_TRAFFIC'] || 0) +
          (outcomes['DECEASED_PREDATOR'] || 0) +
          (outcomes['DECEASED_EXPOSURE'] || 0) +
          (outcomes['DECEASED_DEHYDRATION'] || 0) +
          (outcomes['DECEASED_STARVATION'] || 0) +
          (outcomes['DECEASED_INJURY'] || 0) +
          (outcomes['DECEASED_EUTHANIZED'] || 0);

        // STILL MISSING / TIMEOUT outcomes
        const stillMissingCount = (outcomes['STILL_MISSING'] || 0) +
          (outcomes['SIGHTED_NOT_CAPTURED'] || 0) +
          (outcomes['WITH_STRANGER_PENDING'] || 0) +
          (outcomes['ADOPTED_BY_FINDER'] || 0) +
          (outcomes['FERAL_PERMANENTLY'] || 0);

        // SHELTERED but unclaimed
        const atShelterCount = (outcomes['AT_SHELTER_PENDING'] || 0) +
          (outcomes['ADOPTED_FROM_SHELTER'] || 0);

        const successCount = returnedHomeCount + foundBySearcherCount +
          foundViaShelterCount + foundViaSocialCount;
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

        const batch = {
          id: `batch_${Date.now()}`,
          status: 'COMPLETED',
          totalRuns: size,
          successRate: (successCount / size) * 100,
          avgTimeToFindMins: foundCount > 0 ? totalTimeToFind / foundCount : null,
          medianTimeToFindMins: medianTimeToFind,
          avgPetDistanceMiles: totalPetDistance / size,
          foundBySearcherCount,
          returnedHomeCount,
          foundViaShelterCount,
          foundViaSocialCount,
          foundViaPlatformCount: 0,  // Not used in emergent simulation
          // Map to legacy timeout counts for UI compatibility
          timeoutSearchingCount: stillMissingCount + deceasedCount,
          timeoutShelteredCount: atShelterCount,
          // New granular counts
          deceasedCount,
          stillMissingCount,
          atShelterCount,
          executionTimeSeconds: parseFloat(totalTime),
          // Convergence diagnostics
          convergence: {
            coefficientOfVariation: (successRateAgg.coefficientOfVariation * 100).toFixed(2) + '%',
            standardError: (successRateAgg.standardError * 100).toFixed(2) + '%',
            hasConverged,
            convergedAt,
            threshold: (CONVERGENCE_THRESHOLD * 100).toFixed(0) + '%',
            recommendation: hasConverged
              ? 'Estimate is statistically stable'
              : size < 100
              ? 'Run more simulations for stable estimate (recommend 100+)'
              : 'Estimate may still have high variance',
          },
          // Time to find statistics
          timeToFindStats: foundCount >= 2 ? {
            mean: timeToFindAgg.mean.toFixed(1),
            stdDev: timeToFindAgg.stdDev.toFixed(1),
            coefficientOfVariation: (timeToFindAgg.coefficientOfVariation * 100).toFixed(2) + '%',
          } : null,
        };

        console.log(`[${requestId}] 🎉 Complete: ${batch.successRate.toFixed(1)}% in ${totalTime}s`);

        sendEvent('complete', { batch, terrainInfo });
        controller.close();

      } catch (error) {
        console.error(`[${requestId}] ❌ Error:`, error);
        sendEvent('error', { error: error.message, requestId });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
