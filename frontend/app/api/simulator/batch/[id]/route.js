/**
 * Batch Detail API - Get specific batch with simulations
 *
 * GET /api/simulator/batch/[id] - Get batch details and simulations
 * DELETE /api/simulator/batch/[id] - Delete a batch and its simulations
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

/**
 * GET - Get batch details with simulations
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const { searchParams } = new URL(request.url);
    const includeSimulations = searchParams.get('simulations') !== 'false';
    const simulationLimit = parseInt(searchParams.get('limit') || '100');
    const simulationOffset = parseInt(searchParams.get('offset') || '0');

    const batch = await prisma.simulationBatch.findUnique({
      where: { id },
      include: {
        config: true,
        simulations: includeSimulations ? {
          take: simulationLimit,
          skip: simulationOffset,
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            randomSeed: true,
            outcome: true,
            foundAtMinute: true,
            foundBySearcher: true,
            foundLatitude: true,
            foundLongitude: true,
            petDistanceMiles: true,
            searcherDistanceMiles: true,
            finalPetState: true,
            wasTransported: true,
            transportedAtMinute: true,
            eventsJson: true,
            // Omit full path data by default to save memory
          },
        } : false,
        _count: {
          select: { simulations: true },
        },
      },
    });

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      batch: {
        ...batch,
        simulationCount: batch._count.simulations,
        _count: undefined,
      },
      pagination: includeSimulations ? {
        total: batch._count.simulations,
        limit: simulationLimit,
        offset: simulationOffset,
        hasMore: simulationOffset + (batch.simulations?.length || 0) < batch._count.simulations,
      } : undefined,
    });

  } catch (error) {
    console.error('Error fetching batch:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batch', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a batch and all its simulations
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Check if batch exists
    const batch = await prisma.simulationBatch.findUnique({
      where: { id },
      select: { id: true, configId: true },
    });

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    // Delete batch (cascades to simulations)
    await prisma.simulationBatch.delete({
      where: { id },
    });

    // Also delete the config if it has no other batches
    const otherBatches = await prisma.simulationBatch.count({
      where: { configId: batch.configId },
    });

    if (otherBatches === 0) {
      await prisma.simulationConfig.delete({
        where: { id: batch.configId },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Batch deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting batch:', error);
    return NextResponse.json(
      { error: 'Failed to delete batch', details: error.message },
      { status: 500 }
    );
  }
}
