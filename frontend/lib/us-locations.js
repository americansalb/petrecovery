// Comprehensive US location validation for PetRecovery communities
// Includes cities, counties, and ZIP code validation

// ZIP Code validation
export function isValidZipCode(zip) {
  // Remove spaces and hyphens
  const cleaned = zip.replace(/[\s-]/g, '');

  // Check format: 5 digits or 9 digits (ZIP+4)
  if (!/^\d{5}(\d{4})?$/.test(cleaned)) {
    return false;
  }

  // Basic range validation (00001-99999)
  const zipNum = parseInt(cleaned.substring(0, 5));
  return zipNum >= 1 && zipNum <= 99999;
}

// Format ZIP code for display
export function formatZipCode(zip) {
  const cleaned = zip.replace(/[\s-]/g, '');
  if (cleaned.length === 9) {
    return `${cleaned.substring(0, 5)}-${cleaned.substring(5)}`;
  }
  return cleaned.substring(0, 5);
}

// Comprehensive US locations database
// Format: { value: "City, ST", label: "City Name", type: "CITY|COUNTY|METRO_AREA", state: "ST", population: number }
export const US_LOCATIONS = [
  // ALABAMA
  { value: 'Birmingham, AL', label: 'Birmingham', type: 'CITY', state: 'AL', population: 200733 },
  { value: 'Montgomery, AL', label: 'Montgomery', type: 'CITY', state: 'AL', population: 200603 },
  { value: 'Mobile, AL', label: 'Mobile', type: 'CITY', state: 'AL', population: 187041 },
  { value: 'Huntsville, AL', label: 'Huntsville', type: 'CITY', state: 'AL', population: 215006 },
  { value: 'Tuscaloosa, AL', label: 'Tuscaloosa', type: 'CITY', state: 'AL', population: 99543 },
  { value: 'Jefferson County, AL', label: 'Jefferson County', type: 'COUNTY', state: 'AL' },
  { value: 'Mobile County, AL', label: 'Mobile County', type: 'COUNTY', state: 'AL' },

  // ALASKA
  { value: 'Anchorage, AK', label: 'Anchorage', type: 'CITY', state: 'AK', population: 291247 },
  { value: 'Fairbanks, AK', label: 'Fairbanks', type: 'CITY', state: 'AK', population: 32515 },
  { value: 'Juneau, AK', label: 'Juneau', type: 'CITY', state: 'AK', population: 32255 },

  // ARIZONA
  { value: 'Phoenix, AZ', label: 'Phoenix', type: 'METRO_AREA', state: 'AZ', population: 1608139 },
  { value: 'Tucson, AZ', label: 'Tucson', type: 'METRO_AREA', state: 'AZ', population: 542629 },
  { value: 'Mesa, AZ', label: 'Mesa', type: 'CITY', state: 'AZ', population: 504258 },
  { value: 'Chandler, AZ', label: 'Chandler', type: 'CITY', state: 'AZ', population: 275987 },
  { value: 'Scottsdale, AZ', label: 'Scottsdale', type: 'CITY', state: 'AZ', population: 241361 },
  { value: 'Glendale, AZ', label: 'Glendale', type: 'CITY', state: 'AZ', population: 248325 },
  { value: 'Tempe, AZ', label: 'Tempe', type: 'CITY', state: 'AZ', population: 180587 },
  { value: 'Maricopa County, AZ', label: 'Maricopa County', type: 'COUNTY', state: 'AZ' },
  { value: 'Pima County, AZ', label: 'Pima County', type: 'COUNTY', state: 'AZ' },

  // ARKANSAS
  { value: 'Little Rock, AR', label: 'Little Rock', type: 'CITY', state: 'AR', population: 202591 },
  { value: 'Fort Smith, AR', label: 'Fort Smith', type: 'CITY', state: 'AR', population: 89142 },
  { value: 'Fayetteville, AR', label: 'Fayetteville', type: 'CITY', state: 'AR', population: 93949 },

  // CALIFORNIA
  { value: 'Los Angeles, CA', label: 'Los Angeles', type: 'METRO_AREA', state: 'CA', population: 3898747 },
  { value: 'San Diego, CA', label: 'San Diego', type: 'METRO_AREA', state: 'CA', population: 1386932 },
  { value: 'San Jose, CA', label: 'San Jose', type: 'CITY', state: 'CA', population: 1013240 },
  { value: 'San Francisco, CA', label: 'San Francisco', type: 'METRO_AREA', state: 'CA', population: 873965 },
  { value: 'Fresno, CA', label: 'Fresno', type: 'CITY', state: 'CA', population: 542107 },
  { value: 'Sacramento, CA', label: 'Sacramento', type: 'METRO_AREA', state: 'CA', population: 524943 },
  { value: 'Long Beach, CA', label: 'Long Beach', type: 'CITY', state: 'CA', population: 466742 },
  { value: 'Oakland, CA', label: 'Oakland', type: 'CITY', state: 'CA', population: 440646 },
  { value: 'Bakersfield, CA', label: 'Bakersfield', type: 'CITY', state: 'CA', population: 403455 },
  { value: 'Anaheim, CA', label: 'Anaheim', type: 'CITY', state: 'CA', population: 346824 },
  { value: 'Santa Ana, CA', label: 'Santa Ana', type: 'CITY', state: 'CA', population: 310227 },
  { value: 'Riverside, CA', label: 'Riverside', type: 'METRO_AREA', state: 'CA', population: 331360 },
  { value: 'Stockton, CA', label: 'Stockton', type: 'CITY', state: 'CA', population: 320804 },
  { value: 'Irvine, CA', label: 'Irvine', type: 'CITY', state: 'CA', population: 307670 },
  { value: 'Los Angeles County, CA', label: 'Los Angeles County', type: 'COUNTY', state: 'CA' },
  { value: 'San Diego County, CA', label: 'San Diego County', type: 'COUNTY', state: 'CA' },
  { value: 'Orange County, CA', label: 'Orange County', type: 'COUNTY', state: 'CA' },
  { value: 'Riverside County, CA', label: 'Riverside County', type: 'COUNTY', state: 'CA' },
  { value: 'San Bernardino County, CA', label: 'San Bernardino County', type: 'COUNTY', state: 'CA' },
  { value: 'Santa Clara County, CA', label: 'Santa Clara County', type: 'COUNTY', state: 'CA' },
  { value: 'Alameda County, CA', label: 'Alameda County', type: 'COUNTY', state: 'CA' },

  // COLORADO
  { value: 'Denver, CO', label: 'Denver', type: 'METRO_AREA', state: 'CO', population: 715522 },
  { value: 'Colorado Springs, CO', label: 'Colorado Springs', type: 'CITY', state: 'CO', population: 478961 },
  { value: 'Aurora, CO', label: 'Aurora', type: 'CITY', state: 'CO', population: 386261 },
  { value: 'Fort Collins, CO', label: 'Fort Collins', type: 'CITY', state: 'CO', population: 169810 },
  { value: 'Boulder, CO', label: 'Boulder', type: 'CITY', state: 'CO', population: 105673 },

  // CONNECTICUT
  { value: 'Bridgeport, CT', label: 'Bridgeport', type: 'CITY', state: 'CT', population: 148654 },
  { value: 'New Haven, CT', label: 'New Haven', type: 'CITY', state: 'CT', population: 134023 },
  { value: 'Hartford, CT', label: 'Hartford', type: 'CITY', state: 'CT', population: 121054 },
  { value: 'Stamford, CT', label: 'Stamford', type: 'CITY', state: 'CT', population: 135470 },

  // DELAWARE
  { value: 'Wilmington, DE', label: 'Wilmington', type: 'CITY', state: 'DE', population: 70898 },
  { value: 'Dover, DE', label: 'Dover', type: 'CITY', state: 'DE', population: 39403 },

  // FLORIDA
  { value: 'Jacksonville, FL', label: 'Jacksonville', type: 'CITY', state: 'FL', population: 949611 },
  { value: 'Miami, FL', label: 'Miami', type: 'METRO_AREA', state: 'FL', population: 467963 },
  { value: 'Tampa, FL', label: 'Tampa', type: 'METRO_AREA', state: 'FL', population: 399700 },
  { value: 'Orlando, FL', label: 'Orlando', type: 'METRO_AREA', state: 'FL', population: 307573 },
  { value: 'St. Petersburg, FL', label: 'St. Petersburg', type: 'CITY', state: 'FL', population: 258308 },
  { value: 'Hialeah, FL', label: 'Hialeah', type: 'CITY', state: 'FL', population: 223109 },
  { value: 'Tallahassee, FL', label: 'Tallahassee', type: 'CITY', state: 'FL', population: 196169 },
  { value: 'Fort Lauderdale, FL', label: 'Fort Lauderdale', type: 'CITY', state: 'FL', population: 182760 },
  { value: 'Miami-Dade County, FL', label: 'Miami-Dade County', type: 'COUNTY', state: 'FL' },
  { value: 'Broward County, FL', label: 'Broward County', type: 'COUNTY', state: 'FL' },
  { value: 'Palm Beach County, FL', label: 'Palm Beach County', type: 'COUNTY', state: 'FL' },
  { value: 'Hillsborough County, FL', label: 'Hillsborough County', type: 'COUNTY', state: 'FL' },

  // GEORGIA
  { value: 'Atlanta, GA', label: 'Atlanta', type: 'METRO_AREA', state: 'GA', population: 498715 },
  { value: 'Augusta, GA', label: 'Augusta', type: 'CITY', state: 'GA', population: 202081 },
  { value: 'Columbus, GA', label: 'Columbus', type: 'CITY', state: 'GA', population: 206922 },
  { value: 'Savannah, GA', label: 'Savannah', type: 'CITY', state: 'GA', population: 147780 },
  { value: 'Fulton County, GA', label: 'Fulton County', type: 'COUNTY', state: 'GA' },
  { value: 'Cobb County, GA', label: 'Cobb County', type: 'COUNTY', state: 'GA' },

  // HAWAII
  { value: 'Honolulu, HI', label: 'Honolulu', type: 'CITY', state: 'HI', population: 345064 },
  { value: 'Hilo, HI', label: 'Hilo', type: 'CITY', state: 'HI', population: 45248 },

  // IDAHO
  { value: 'Boise, ID', label: 'Boise', type: 'CITY', state: 'ID', population: 235684 },
  { value: 'Meridian, ID', label: 'Meridian', type: 'CITY', state: 'ID', population: 117635 },
  { value: 'Nampa, ID', label: 'Nampa', type: 'CITY', state: 'ID', population: 100200 },

  // ILLINOIS
  { value: 'Chicago, IL', label: 'Chicago', type: 'METRO_AREA', state: 'IL', population: 2746388 },
  { value: 'Aurora, IL', label: 'Aurora', type: 'CITY', state: 'IL', population: 180542 },
  { value: 'Naperville, IL', label: 'Naperville', type: 'CITY', state: 'IL', population: 149104 },
  { value: 'Joliet, IL', label: 'Joliet', type: 'CITY', state: 'IL', population: 150362 },
  { value: 'Rockford, IL', label: 'Rockford', type: 'CITY', state: 'IL', population: 148655 },
  { value: 'Springfield, IL', label: 'Springfield', type: 'CITY', state: 'IL', population: 114394 },
  { value: 'Cook County, IL', label: 'Cook County', type: 'COUNTY', state: 'IL' },
  { value: 'DuPage County, IL', label: 'DuPage County', type: 'COUNTY', state: 'IL' },

  // Continue with remaining states...
  // INDIANA
  { value: 'Indianapolis, IN', label: 'Indianapolis', type: 'METRO_AREA', state: 'IN', population: 887642 },
  { value: 'Fort Wayne, IN', label: 'Fort Wayne', type: 'CITY', state: 'IN', population: 270402 },
  { value: 'Evansville, IN', label: 'Evansville', type: 'CITY', state: 'IN', population: 116959 },
  { value: 'Marion County, IN', label: 'Marion County', type: 'COUNTY', state: 'IN' },

  // IOWA
  { value: 'Des Moines, IA', label: 'Des Moines', type: 'CITY', state: 'IA', population: 214133 },
  { value: 'Cedar Rapids, IA', label: 'Cedar Rapids', type: 'CITY', state: 'IA', population: 137710 },
  { value: 'Davenport, IA', label: 'Davenport', type: 'CITY', state: 'IA', population: 101724 },

  // KANSAS
  { value: 'Wichita, KS', label: 'Wichita', type: 'CITY', state: 'KS', population: 397532 },
  { value: 'Overland Park, KS', label: 'Overland Park', type: 'CITY', state: 'KS', population: 197238 },
  { value: 'Kansas City, KS', label: 'Kansas City', type: 'CITY', state: 'KS', population: 156607 },
  { value: 'Kansas City, MO', label: 'Kansas City Metro', type: 'METRO_AREA', state: 'MO', population: 508090 },

  // KENTUCKY
  { value: 'Louisville, KY', label: 'Louisville', type: 'METRO_AREA', state: 'KY', population: 633045 },
  { value: 'Lexington, KY', label: 'Lexington', type: 'CITY', state: 'KY', population: 322570 },

  // LOUISIANA
  { value: 'New Orleans, LA', label: 'New Orleans', type: 'METRO_AREA', state: 'LA', population: 383997 },
  { value: 'Baton Rouge, LA', label: 'Baton Rouge', type: 'CITY', state: 'LA', population: 227470 },
  { value: 'Shreveport, LA', label: 'Shreveport', type: 'CITY', state: 'LA', population: 187593 },

  // MAINE
  { value: 'Portland, ME', label: 'Portland', type: 'CITY', state: 'ME', population: 68408 },
  { value: 'Lewiston, ME', label: 'Lewiston', type: 'CITY', state: 'ME', population: 36792 },

  // MARYLAND
  { value: 'Baltimore, MD', label: 'Baltimore', type: 'METRO_AREA', state: 'MD', population: 585708 },
  { value: 'Columbia, MD', label: 'Columbia', type: 'CITY', state: 'MD', population: 104681 },
  { value: 'Montgomery County, MD', label: 'Montgomery County', type: 'COUNTY', state: 'MD' },
  { value: 'Prince George\'s County, MD', label: 'Prince George\'s County', type: 'COUNTY', state: 'MD' },

  // MASSACHUSETTS
  { value: 'Boston, MA', label: 'Boston', type: 'METRO_AREA', state: 'MA', population: 675647 },
  { value: 'Worcester, MA', label: 'Worcester', type: 'CITY', state: 'MA', population: 206518 },
  { value: 'Springfield, MA', label: 'Springfield', type: 'CITY', state: 'MA', population: 155929 },
  { value: 'Cambridge, MA', label: 'Cambridge', type: 'CITY', state: 'MA', population: 118403 },
  { value: 'Middlesex County, MA', label: 'Middlesex County', type: 'COUNTY', state: 'MA' },
  { value: 'Suffolk County, MA', label: 'Suffolk County', type: 'COUNTY', state: 'MA' },

  // MICHIGAN
  { value: 'Detroit, MI', label: 'Detroit', type: 'METRO_AREA', state: 'MI', population: 639111 },
  { value: 'Grand Rapids, MI', label: 'Grand Rapids', type: 'CITY', state: 'MI', population: 198893 },
  { value: 'Warren, MI', label: 'Warren', type: 'CITY', state: 'MI', population: 139387 },
  { value: 'Sterling Heights, MI', label: 'Sterling Heights', type: 'CITY', state: 'MI', population: 134346 },
  { value: 'Ann Arbor, MI', label: 'Ann Arbor', type: 'CITY', state: 'MI', population: 123851 },
  { value: 'Wayne County, MI', label: 'Wayne County', type: 'COUNTY', state: 'MI' },
  { value: 'Oakland County, MI', label: 'Oakland County', type: 'COUNTY', state: 'MI' },

  // MINNESOTA
  { value: 'Minneapolis, MN', label: 'Minneapolis', type: 'METRO_AREA', state: 'MN', population: 425115 },
  { value: 'St. Paul, MN', label: 'St. Paul', type: 'CITY', state: 'MN', population: 311527 },
  { value: 'Rochester, MN', label: 'Rochester', type: 'CITY', state: 'MN', population: 121395 },
  { value: 'Hennepin County, MN', label: 'Hennepin County', type: 'COUNTY', state: 'MN' },
  { value: 'Ramsey County, MN', label: 'Ramsey County', type: 'COUNTY', state: 'MN' },

  // MISSISSIPPI
  { value: 'Jackson, MS', label: 'Jackson', type: 'CITY', state: 'MS', population: 153701 },
  { value: 'Gulfport, MS', label: 'Gulfport', type: 'CITY', state: 'MS', population: 72926 },

  // MISSOURI
  { value: 'St. Louis, MO', label: 'St. Louis', type: 'METRO_AREA', state: 'MO', population: 301578 },
  { value: 'Springfield, MO', label: 'Springfield', type: 'CITY', state: 'MO', population: 169176 },
  { value: 'Columbia, MO', label: 'Columbia', type: 'CITY', state: 'MO', population: 126254 },

  // MONTANA
  { value: 'Billings, MT', label: 'Billings', type: 'CITY', state: 'MT', population: 117116 },
  { value: 'Missoula, MT', label: 'Missoula', type: 'CITY', state: 'MT', population: 73489 },

  // NEBRASKA
  { value: 'Omaha, NE', label: 'Omaha', type: 'CITY', state: 'NE', population: 486051 },
  { value: 'Lincoln, NE', label: 'Lincoln', type: 'CITY', state: 'NE', population: 291082 },

  // NEVADA
  { value: 'Las Vegas, NV', label: 'Las Vegas', type: 'METRO_AREA', state: 'NV', population: 641903 },
  { value: 'Henderson, NV', label: 'Henderson', type: 'CITY', state: 'NV', population: 320189 },
  { value: 'Reno, NV', label: 'Reno', type: 'CITY', state: 'NV', population: 264165 },
  { value: 'Clark County, NV', label: 'Clark County', type: 'COUNTY', state: 'NV' },

  // NEW HAMPSHIRE
  { value: 'Manchester, NH', label: 'Manchester', type: 'CITY', state: 'NH', population: 115644 },
  { value: 'Nashua, NH', label: 'Nashua', type: 'CITY', state: 'NH', population: 91322 },

  // NEW JERSEY
  { value: 'Newark, NJ', label: 'Newark', type: 'CITY', state: 'NJ', population: 311549 },
  { value: 'Jersey City, NJ', label: 'Jersey City', type: 'CITY', state: 'NJ', population: 292449 },
  { value: 'Paterson, NJ', label: 'Paterson', type: 'CITY', state: 'NJ', population: 159732 },
  { value: 'Bergen County, NJ', label: 'Bergen County', type: 'COUNTY', state: 'NJ' },
  { value: 'Essex County, NJ', label: 'Essex County', type: 'COUNTY', state: 'NJ' },

  // NEW MEXICO
  { value: 'Albuquerque, NM', label: 'Albuquerque', type: 'METRO_AREA', state: 'NM', population: 564559 },
  { value: 'Las Cruces, NM', label: 'Las Cruces', type: 'CITY', state: 'NM', population: 111385 },
  { value: 'Santa Fe, NM', label: 'Santa Fe', type: 'CITY', state: 'NM', population: 87505 },

  // NEW YORK
  { value: 'New York, NY', label: 'New York City', type: 'METRO_AREA', state: 'NY', population: 8336817 },
  { value: 'Buffalo, NY', label: 'Buffalo', type: 'METRO_AREA', state: 'NY', population: 278349 },
  { value: 'Rochester, NY', label: 'Rochester', type: 'METRO_AREA', state: 'NY', population: 211328 },
  { value: 'Yonkers, NY', label: 'Yonkers', type: 'CITY', state: 'NY', population: 211569 },
  { value: 'Syracuse, NY', label: 'Syracuse', type: 'CITY', state: 'NY', population: 148620 },
  { value: 'Albany, NY', label: 'Albany', type: 'CITY', state: 'NY', population: 99224 },
  { value: 'Kings County, NY', label: 'Kings County (Brooklyn)', type: 'COUNTY', state: 'NY' },
  { value: 'Queens County, NY', label: 'Queens County', type: 'COUNTY', state: 'NY' },
  { value: 'New York County, NY', label: 'New York County (Manhattan)', type: 'COUNTY', state: 'NY' },
  { value: 'Bronx County, NY', label: 'Bronx County', type: 'COUNTY', state: 'NY' },
  { value: 'Suffolk County, NY', label: 'Suffolk County', type: 'COUNTY', state: 'NY' },

  // NORTH CAROLINA
  { value: 'Charlotte, NC', label: 'Charlotte', type: 'METRO_AREA', state: 'NC', population: 874579 },
  { value: 'Raleigh, NC', label: 'Raleigh', type: 'METRO_AREA', state: 'NC', population: 474069 },
  { value: 'Greensboro, NC', label: 'Greensboro', type: 'CITY', state: 'NC', population: 299035 },
  { value: 'Durham, NC', label: 'Durham', type: 'CITY', state: 'NC', population: 283506 },
  { value: 'Winston-Salem, NC', label: 'Winston-Salem', type: 'CITY', state: 'NC', population: 247945 },
  { value: 'Mecklenburg County, NC', label: 'Mecklenburg County', type: 'COUNTY', state: 'NC' },
  { value: 'Wake County, NC', label: 'Wake County', type: 'COUNTY', state: 'NC' },

  // NORTH DAKOTA
  { value: 'Fargo, ND', label: 'Fargo', type: 'CITY', state: 'ND', population: 125990 },
  { value: 'Bismarck, ND', label: 'Bismarck', type: 'CITY', state: 'ND', population: 73622 },

  // OHIO
  { value: 'Columbus, OH', label: 'Columbus', type: 'METRO_AREA', state: 'OH', population: 905748 },
  { value: 'Cleveland, OH', label: 'Cleveland', type: 'METRO_AREA', state: 'OH', population: 372624 },
  { value: 'Cincinnati, OH', label: 'Cincinnati', type: 'METRO_AREA', state: 'OH', population: 309317 },
  { value: 'Toledo, OH', label: 'Toledo', type: 'CITY', state: 'OH', population: 270871 },
  { value: 'Akron, OH', label: 'Akron', type: 'CITY', state: 'OH', population: 190469 },
  { value: 'Dayton, OH', label: 'Dayton', type: 'CITY', state: 'OH', population: 140407 },
  { value: 'Franklin County, OH', label: 'Franklin County', type: 'COUNTY', state: 'OH' },
  { value: 'Cuyahoga County, OH', label: 'Cuyahoga County', type: 'COUNTY', state: 'OH' },
  { value: 'Hamilton County, OH', label: 'Hamilton County', type: 'COUNTY', state: 'OH' },

  // OKLAHOMA
  { value: 'Oklahoma City, OK', label: 'Oklahoma City', type: 'METRO_AREA', state: 'OK', population: 681054 },
  { value: 'Tulsa, OK', label: 'Tulsa', type: 'CITY', state: 'OK', population: 413066 },
  { value: 'Norman, OK', label: 'Norman', type: 'CITY', state: 'OK', population: 128026 },

  // OREGON
  { value: 'Portland, OR', label: 'Portland', type: 'METRO_AREA', state: 'OR', population: 652503 },
  { value: 'Eugene, OR', label: 'Eugene', type: 'CITY', state: 'OR', population: 176654 },
  { value: 'Salem, OR', label: 'Salem', type: 'CITY', state: 'OR', population: 175535 },
  { value: 'Multnomah County, OR', label: 'Multnomah County', type: 'COUNTY', state: 'OR' },

  // PENNSYLVANIA
  { value: 'Philadelphia, PA', label: 'Philadelphia', type: 'METRO_AREA', state: 'PA', population: 1584064 },
  { value: 'Pittsburgh, PA', label: 'Pittsburgh', type: 'METRO_AREA', state: 'PA', population: 302971 },
  { value: 'Allentown, PA', label: 'Allentown', type: 'CITY', state: 'PA', population: 125845 },
  { value: 'Erie, PA', label: 'Erie', type: 'CITY', state: 'PA', population: 94831 },
  { value: 'Philadelphia County, PA', label: 'Philadelphia County', type: 'COUNTY', state: 'PA' },
  { value: 'Allegheny County, PA', label: 'Allegheny County', type: 'COUNTY', state: 'PA' },

  // RHODE ISLAND
  { value: 'Providence, RI', label: 'Providence', type: 'CITY', state: 'RI', population: 190934 },

  // SOUTH CAROLINA
  { value: 'Columbia, SC', label: 'Columbia', type: 'CITY', state: 'SC', population: 137300 },
  { value: 'Charleston, SC', label: 'Charleston', type: 'CITY', state: 'SC', population: 150227 },
  { value: 'North Charleston, SC', label: 'North Charleston', type: 'CITY', state: 'SC', population: 114852 },

  // SOUTH DAKOTA
  { value: 'Sioux Falls, SD', label: 'Sioux Falls', type: 'CITY', state: 'SD', population: 192517 },
  { value: 'Rapid City, SD', label: 'Rapid City', type: 'CITY', state: 'SD', population: 74703 },

  // TENNESSEE
  { value: 'Nashville, TN', label: 'Nashville', type: 'METRO_AREA', state: 'TN', population: 689447 },
  { value: 'Memphis, TN', label: 'Memphis', type: 'METRO_AREA', state: 'TN', population: 633104 },
  { value: 'Knoxville, TN', label: 'Knoxville', type: 'CITY', state: 'TN', population: 190740 },
  { value: 'Chattanooga, TN', label: 'Chattanooga', type: 'CITY', state: 'TN', population: 181099 },

  // TEXAS
  { value: 'Houston, TX', label: 'Houston', type: 'METRO_AREA', state: 'TX', population: 2304580 },
  { value: 'San Antonio, TX', label: 'San Antonio', type: 'METRO_AREA', state: 'TX', population: 1547253 },
  { value: 'Dallas, TX', label: 'Dallas', type: 'METRO_AREA', state: 'TX', population: 1304379 },
  { value: 'Austin, TX', label: 'Austin', type: 'METRO_AREA', state: 'TX', population: 978908 },
  { value: 'Fort Worth, TX', label: 'Fort Worth', type: 'CITY', state: 'TX', population: 918915 },
  { value: 'El Paso, TX', label: 'El Paso', type: 'CITY', state: 'TX', population: 678815 },
  { value: 'Arlington, TX', label: 'Arlington', type: 'CITY', state: 'TX', population: 398121 },
  { value: 'Corpus Christi, TX', label: 'Corpus Christi', type: 'CITY', state: 'TX', population: 326586 },
  { value: 'Plano, TX', label: 'Plano', type: 'CITY', state: 'TX', population: 285494 },
  { value: 'Laredo, TX', label: 'Laredo', type: 'CITY', state: 'TX', population: 255205 },
  { value: 'Harris County, TX', label: 'Harris County', type: 'COUNTY', state: 'TX' },
  { value: 'Dallas County, TX', label: 'Dallas County', type: 'COUNTY', state: 'TX' },
  { value: 'Tarrant County, TX', label: 'Tarrant County', type: 'COUNTY', state: 'TX' },
  { value: 'Bexar County, TX', label: 'Bexar County', type: 'COUNTY', state: 'TX' },
  { value: 'Travis County, TX', label: 'Travis County', type: 'COUNTY', state: 'TX' },

  // UTAH
  { value: 'Salt Lake City, UT', label: 'Salt Lake City', type: 'METRO_AREA', state: 'UT', population: 200133 },
  { value: 'West Valley City, UT', label: 'West Valley City', type: 'CITY', state: 'UT', population: 140230 },
  { value: 'Provo, UT', label: 'Provo', type: 'CITY', state: 'UT', population: 115162 },

  // VERMONT
  { value: 'Burlington, VT', label: 'Burlington', type: 'CITY', state: 'VT', population: 44781 },

  // VIRGINIA
  { value: 'Virginia Beach, VA', label: 'Virginia Beach', type: 'CITY', state: 'VA', population: 459470 },
  { value: 'Norfolk, VA', label: 'Norfolk', type: 'CITY', state: 'VA', population: 238005 },
  { value: 'Chesapeake, VA', label: 'Chesapeake', type: 'CITY', state: 'VA', population: 247436 },
  { value: 'Richmond, VA', label: 'Richmond', type: 'METRO_AREA', state: 'VA', population: 230436 },
  { value: 'Arlington, VA', label: 'Arlington', type: 'CITY', state: 'VA', population: 238643 },
  { value: 'Fairfax County, VA', label: 'Fairfax County', type: 'COUNTY', state: 'VA' },

  // WASHINGTON
  { value: 'Seattle, WA', label: 'Seattle', type: 'METRO_AREA', state: 'WA', population: 753675 },
  { value: 'Spokane, WA', label: 'Spokane', type: 'CITY', state: 'WA', population: 229071 },
  { value: 'Tacoma, WA', label: 'Tacoma', type: 'CITY', state: 'WA', population: 219346 },
  { value: 'Vancouver, WA', label: 'Vancouver', type: 'CITY', state: 'WA', population: 190915 },
  { value: 'King County, WA', label: 'King County', type: 'COUNTY', state: 'WA' },
  { value: 'Pierce County, WA', label: 'Pierce County', type: 'COUNTY', state: 'WA' },

  // WASHINGTON DC
  { value: 'Washington, DC', label: 'Washington DC', type: 'METRO_AREA', state: 'DC', population: 705749 },

  // WEST VIRGINIA
  { value: 'Charleston, WV', label: 'Charleston', type: 'CITY', state: 'WV', population: 48864 },
  { value: 'Huntington, WV', label: 'Huntington', type: 'CITY', state: 'WV', population: 46842 },

  // WISCONSIN
  { value: 'Milwaukee, WI', label: 'Milwaukee', type: 'METRO_AREA', state: 'WI', population: 577222 },
  { value: 'Madison, WI', label: 'Madison', type: 'CITY', state: 'WI', population: 269840 },
  { value: 'Green Bay, WI', label: 'Green Bay', type: 'CITY', state: 'WI', population: 105207 },
  { value: 'Milwaukee County, WI', label: 'Milwaukee County', type: 'COUNTY', state: 'WI' },

  // WYOMING
  { value: 'Cheyenne, WY', label: 'Cheyenne', type: 'CITY', state: 'WY', population: 65132 },
  { value: 'Casper, WY', label: 'Casper', type: 'CITY', state: 'WY', population: 59038 },
];

// Helper function to search locations (with fuzzy matching)
export function searchLocations(query) {
  if (!query || query.length < 2) {
    return US_LOCATIONS.slice(0, 50); // Return first 50 by default
  }

  const searchTerm = query.toLowerCase().trim();

  // Check if it's a valid ZIP code
  if (isValidZipCode(searchTerm)) {
    return [{
      value: formatZipCode(searchTerm),
      label: `ZIP Code ${formatZipCode(searchTerm)}`,
      type: 'ZIP',
      state: 'US',
      isZip: true
    }];
  }

  // Search by name, state, or type
  const results = US_LOCATIONS.filter(location => {
    const nameMatch = location.label.toLowerCase().includes(searchTerm);
    const valueMatch = location.value.toLowerCase().includes(searchTerm);
    const stateMatch = location.state.toLowerCase() === searchTerm;

    return nameMatch || valueMatch || stateMatch;
  });

  // Sort by population (descending) for cities, alphabetically for others
  return results.sort((a, b) => {
    if (a.population && b.population) {
      return b.population - a.population;
    }
    return a.label.localeCompare(b.label);
  });
}

// Get location by value
export function getLocation(value) {
  return US_LOCATIONS.find(loc => loc.value === value);
}

// Validate location exists
export function isValidLocation(value) {
  // Check if it's a valid location from our database
  if (US_LOCATIONS.some(loc => loc.value === value)) {
    return true;
  }

  // Accept ANY valid ZIP code format (00001-99999)
  // This covers all ~42,000 US ZIP codes without storing them
  if (isValidZipCode(value)) {
    return true;
  }

  return false;
}

// Group locations by state
export function getLocationsByState() {
  const grouped = {};
  US_LOCATIONS.forEach(location => {
    if (!grouped[location.state]) {
      grouped[location.state] = [];
    }
    grouped[location.state].push(location);
  });

  // Sort each state's locations by population/name
  Object.keys(grouped).forEach(state => {
    grouped[state].sort((a, b) => {
      if (a.population && b.population) {
        return b.population - a.population;
      }
      return a.label.localeCompare(b.label);
    });
  });

  return grouped;
}

// Get all states
export function getAllStates() {
  const states = new Set(US_LOCATIONS.map(loc => loc.state));
  return Array.from(states).sort();
}

// Filter by type
export function getLocationsByType(type) {
  return US_LOCATIONS.filter(loc => loc.type === type);
}

// Get user-friendly type label
export function getTypeLabel(type) {
  const labels = {
    'METRO_AREA': 'City/Metro Area',
    'CITY': 'City/Metro Area',
    'COUNTY': 'County',
    'SUBCOMMUNITY': 'Neighborhood',
    'ZIP': 'ZIP Code'
  };
  return labels[type] || type;
}
