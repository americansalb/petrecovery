/**
 * Streaming Batch Simulator API - Real-time progress via Server-Sent Events
 *
 * POST /api/simulator/batch/stream - Run batch with SSE progress updates
 *
 * Returns a stream of events:
 * - start: { total, requestId }
 * - status: { message }
 * - simulation: { individual simulation result - streamed as each completes }
 * - progress: { completed, total, percent, successRate, outcomes }
 * - complete: { batch summary with all simulations }
 * - error: { error message }
 *
 * Memory-safe: Uses incremental aggregation, streams results instead of storing.
 * Supports up to 100,000 simulations (will take time but won't crash).
 */

import { SimulationEngine, loadTerrain, OUTCOMES } from '@/app/lib/simulator/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Maximum batch size - memory safe due to incremental aggregation
const MAX_BATCH_SIZE = 100000;

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

        for (let i = 0; i < size; i++) {
          try {
            const engine = new SimulationEngine(config);
            const result = engine.run();

            outcomes[result.outcome]++;
            totalPetDistance += result.petDistanceMiles || 0;

            if (result.foundAtMinute && !result.outcome.startsWith('TIMEOUT')) {
              totalTimeToFind += result.foundAtMinute;
              foundCount++;
              timesToFind.push(result.foundAtMinute);
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
              const successSoFar = (i + 1) - (outcomes[OUTCOMES.TIMEOUT_SEARCHING] || 0) - (outcomes[OUTCOMES.TIMEOUT_SHELTERED] || 0);
              sendEvent('progress', {
                completed: i + 1,
                total: size,
                percent: Math.round(((i + 1) / size) * 100),
                successRate: ((successSoFar / (i + 1)) * 100).toFixed(1),
                outcomes: { ...outcomes },
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

        const successCount = size - (outcomes[OUTCOMES.TIMEOUT_SEARCHING] || 0) - (outcomes[OUTCOMES.TIMEOUT_SHELTERED] || 0);
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

        const batch = {
          id: `batch_${Date.now()}`,
          status: 'COMPLETED',
          totalRuns: size,
          successRate: (successCount / size) * 100,
          avgTimeToFindMins: foundCount > 0 ? totalTimeToFind / foundCount : null,
          medianTimeToFindMins: medianTimeToFind,
          avgPetDistanceMiles: totalPetDistance / size,
          foundBySearcherCount: outcomes[OUTCOMES.FOUND_BY_SEARCHER] || 0,
          returnedHomeCount: outcomes[OUTCOMES.RETURNED_HOME] || 0,
          foundViaShelterCount: outcomes[OUTCOMES.FOUND_VIA_SHELTER] || 0,
          foundViaSocialCount: outcomes[OUTCOMES.FOUND_VIA_SOCIAL] || 0,
          foundViaPlatformCount: outcomes[OUTCOMES.FOUND_VIA_PLATFORM] || 0,
          timeoutSearchingCount: outcomes[OUTCOMES.TIMEOUT_SEARCHING] || 0,
          timeoutShelteredCount: outcomes[OUTCOMES.TIMEOUT_SHELTERED] || 0,
          executionTimeSeconds: parseFloat(totalTime),
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
