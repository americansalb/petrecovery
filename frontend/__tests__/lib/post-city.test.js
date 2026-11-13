/**
 * The city in a ready-made post is written as people write it.
 *
 * Found on a live search in Mexico City, 2026-11-13: the Nextdoor post the
 * site hands the owner read "last seen near CiudaddeMxico". The word made
 * for a hashtag (no spaces, letters only) was used in a sentence, and it
 * dropped the accented letter instead of keeping the letter.
 */
import { cityName, cityToken, fallbackCopy } from '@/app/lib/cascade/aiCopy';

describe('the city in a post', () => {
  const address = 'Avenida Universidad 1200, Coyoacán, Ciudad de México, CDMX, México';

  test('in a sentence it keeps its spaces and its accents', () => {
    expect(cityName(address)).toBe('Ciudad de México');
    expect(cityName('4300 Sinclair Ave, Austin, TX, USA')).toBe('Austin');
    expect(cityName('')).toBe('');
  });

  test('as a hashtag it is one word, and an accented letter keeps its letter', () => {
    expect(cityToken(address)).toBe('CiudaddeMexico');
    expect(cityToken('4300 Sinclair Ave, Austin, TX, USA')).toBe('Austin');
    expect(cityToken('Rue A, Montréal, QC, Canada')).toBe('Montreal');
  });

  test('the Nextdoor post names the city in words, and the hashtag stays one word', () => {
    const copy = fallbackCopy({ petName: 'Lalo', petSpecies: 'DOG', status: 'LOST', caseNumber: 'CIU-2026-TEST01', lastSeenAddress: address });
    expect(copy.captions.nextdoor).toMatch(/Lalo was last seen near Ciudad de México\./);
    expect(copy.captions.nextdoor).not.toMatch(/CiudaddeM/);
    expect(copy.hashtags).toContain('#CiudaddeMexico');
  });
});
