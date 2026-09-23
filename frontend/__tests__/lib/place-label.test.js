/**
 * parsePlace turns a last-seen address into "Town, ST".
 *
 * Every address below is a real shape from the live case list. The old
 * parser took the last two comma parts, so these read "19136, UN",
 * "Philadelphia, PE", "60110, UN" and "Texas, UN" on the site and in
 * every link preview.
 */

import { parsePlace, placeLabel } from '@/app/lib/placeLabel';

describe('placeLabel', () => {
  test.each([
    ['Walmart, 3838 South Semoran Boulevard, Orlando, Florida', 'Orlando, FL'],
    ['4410, Teesdale Street, Mayfair, Northeast Philadelphia, Philadelphia, Philadelphia County, Pennsylvania, 19136, United States', 'Philadelphia, PA'],
    ['11000 Roosevelt Boulevard, Philadelphia, Pennsylvania', 'Philadelphia, PA'],
    ['6701, Pine Lane, Carpentersville, Dundee Township, Kane County, Illinois, 60110, United States', 'Carpentersville, IL'],
    ['7095, Westwood Drive, Country Homes at Kimball Farms, Carpentersville, Dundee Township, Kane County, Illinois, 60110, United States', 'Carpentersville, IL'],
    ['13107, Southeast 169th Avenue, Happy Valley, Clackamas County, Oregon, 97086, United States', 'Happy Valley, OR'],
    ['6705, Starnes Road, North Richland Hills, Tarrant County, Texas, 76148, United States', 'North Richland Hills, TX'],
    ['26451 Camino de Vista, San Juan Capistrano, California', 'San Juan Capistrano, CA'],
    ['48th Street, Sacramento, California', 'Sacramento, CA'],
    ['123 Main St, Austin, TX 78701', 'Austin, TX'],
    ['Austin, TX', 'Austin, TX'],
    ['New York, NY 10001', 'New York, NY'],
    ['Brooklyn, New York, 11201, United States', 'Brooklyn, NY'],
    ['Seattle, Washington', 'Seattle, WA'],
    ['Washington, District of Columbia, 20001, United States', 'Washington, DC'],
    ['St. Louis, Missouri', 'St. Louis, MO'],
  ])('%s -> %s', (address, label) => {
    expect(placeLabel(address)).toBe(label);
  });

  test('a rural address with no town falls back to the county', () => {
    expect(placeLabel('R Ch Road 1051, Uvalde County, Texas, United States')).toBe('Uvalde County, TX');
  });

  test('a state on its own is the state, not "Texas, UN"', () => {
    expect(placeLabel('Texas')).toBe('Texas');
  });

  test('outside the US it names the town and the country', () => {
    expect(placeLabel('Calle C, Urbanización Tricentenaria, La Montañita, Barcelona, Municipio Juan Antonio Sotillo, Anzoátegui, 6001, Venezuela'))
      .toBe('Barcelona, Venezuela');
    expect(placeLabel('Minna, Chanchaga, Niger, 920101, Nigeria')).toMatch(/, Nigeria$/);
  });

  test('coordinates and nothing at all have no label', () => {
    expect(placeLabel('42.1297, -88.3244')).toBeNull();
    expect(placeLabel('')).toBeNull();
    expect(placeLabel(null)).toBeNull();
    expect(placeLabel(undefined)).toBeNull();
  });

  test('"In" in a street name is not Indiana', () => {
    expect(parsePlace('12 In Street, Portland, Oregon')).toMatchObject({ city: 'Portland', state: 'OR' });
  });
});
