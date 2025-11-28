import { NextResponse } from 'next/server';
import { getCitySuggestions, getCitiesByZip, isValidCity } from '@/app/lib/cities';

// GET /api/cities/suggest?q=search_term
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit')) || 10;

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const trimmed = query.trim();

    // Check if it's a ZIP code
    const isZip = /^\d{5}$/.test(trimmed);
    if (isZip) {
      const cities = getCitiesByZip(trimmed);
      return NextResponse.json({
        suggestions: cities.slice(0, limit),
        isZip: true,
        isValid: cities.length > 0
      });
    }

    // City name search
    const suggestions = getCitySuggestions(trimmed, limit);
    const isValid = isValidCity(trimmed);

    return NextResponse.json({
      suggestions,
      isZip: false,
      isValid
    });
  } catch (error) {
    console.error('City suggest error:', error);
    return NextResponse.json({ suggestions: [], error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
