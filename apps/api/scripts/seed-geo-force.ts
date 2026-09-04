import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const geoData: Record<string, { name: string; states: Record<string, { name: string; cities: string[] }> }> = {
  IN: {
    name: 'India',
    states: {
      TN: { name: 'Tamil Nadu', cities: ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Trichy', 'Erode', 'Tiruppur', 'Kanyakumari'] },
      MH: { name: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur'] },
      KA: { name: 'Karnataka', cities: ['Bangalore', 'Mysore', 'Belgaum', 'Mangalore', 'Hubballi', 'Shimoga', 'Hassan'] },
      AP: { name: 'Andhra Pradesh', cities: ['Hyderabad', 'Visakhapatnam', 'Vijayawada', 'Tirupati', 'Kakinada', 'Guntur'] },
      TS: { name: 'Telangana', cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Khammam'] },
      DL: { name: 'Delhi', cities: ['New Delhi', 'Central Delhi', 'South Delhi', 'East Delhi', 'West Delhi'] },
      UP: { name: 'Uttar Pradesh', cities: ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Noida', 'Ghaziabad', 'Meerut'] },
      RJ: { name: 'Rajasthan', cities: ['Jaipur', 'Jodhpur', 'Udaipur', 'Bikaner', 'Kota', 'Ajmer'] },
      GJ: { name: 'Gujarat', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Junagadh'] },
      MP: { name: 'Madhya Pradesh', cities: ['Indore', 'Bhopal', 'Jabalpur', 'Ujjain', 'Sagar', 'Gwalior'] },
      WB: { name: 'West Bengal', cities: ['Kolkata', 'Asansol', 'Darjeeling', 'Siliguri', 'Durgapur'] },
      PB: { name: 'Punjab', cities: ['Chandigarh', 'Amritsar', 'Ludhiana', 'Jalandhar', 'Patiala'] },
      KL: { name: 'Kerala', cities: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Ernakulam'] },
      OR: { name: 'Odisha', cities: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Sambalpur'] },
      AS: { name: 'Assam', cities: ['Guwahati', 'Silchar', 'Dibrugarh', 'Nagaon'] },
      HR: { name: 'Haryana', cities: ['Faridabad', 'Gurgaon', 'Hisar', 'Rohtak', 'Panipat'] },
    },
  },
  US: {
    name: 'United States',
    states: {
      CA: { name: 'California', cities: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'Oakland'] },
      TX: { name: 'Texas', cities: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth'] },
      FL: { name: 'Florida', cities: ['Miami', 'Tampa', 'Orlando', 'Jacksonville', 'Fort Lauderdale'] },
      NY: { name: 'New York', cities: ['New York City', 'Buffalo', 'Rochester', 'Albany', 'Yonkers'] },
      IL: { name: 'Illinois', cities: ['Chicago', 'Aurora', 'Rockford', 'Joliet', 'Naperville'] },
      WA: { name: 'Washington', cities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver'] },
      GA: { name: 'Georgia', cities: ['Atlanta', 'Augusta', 'Savannah', 'Athens', 'Columbus'] },
      NC: { name: 'North Carolina', cities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham'] },
    },
  },
  GB: {
    name: 'United Kingdom',
    states: {
      ENG: { name: 'England', cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool'] },
      SCT: { name: 'Scotland', cities: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee'] },
      WLS: { name: 'Wales', cities: ['Cardiff', 'Swansea', 'Newport', 'Wrexham'] },
      NIR: { name: 'Northern Ireland', cities: ['Belfast', 'Derry', 'Lisburn'] },
    },
  },
  CA: {
    name: 'Canada',
    states: {
      ON: { name: 'Ontario', cities: ['Toronto', 'Ottawa', 'Hamilton', 'London', 'Mississauga'] },
      QC: { name: 'Quebec', cities: ['Montreal', 'Quebec City', 'Laval', 'Gatineau'] },
      BC: { name: 'British Columbia', cities: ['Vancouver', 'Victoria', 'Surrey', 'Kelowna'] },
      AB: { name: 'Alberta', cities: ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge'] },
    },
  },
  AU: {
    name: 'Australia',
    states: {
      NSW: { name: 'New South Wales', cities: ['Sydney', 'Newcastle', 'Wollongong', 'Central Coast'] },
      VIC: { name: 'Victoria', cities: ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo'] },
      QLD: { name: 'Queensland', cities: ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Cairns'] },
      WA: { name: 'Western Australia', cities: ['Perth', 'Fremantle', 'Mandurah'] },
    },
  },
};

async function forceSeedGeo() {
  await prisma.user.updateMany({
    data: {
      countryId: null,
      stateId: null,
      cityId: null,
    },
  });

  await prisma.organization.updateMany({
    data: {
      cityId: null,
    },
  });

  await prisma.geoCity.deleteMany();
  await prisma.geoState.deleteMany();
  await prisma.geoCountry.deleteMany();

  const countriesToCreate = Object.entries(geoData).map(([code, data]) => ({
    code,
    name: data.name,
  }));

  const createdCountries = await prisma.geoCountry.createMany({ data: countriesToCreate });
  console.log(`Seeded ${createdCountries.count} countries`);

  const allCountries = await prisma.geoCountry.findMany();
  const countryMap = Object.fromEntries(allCountries.map((country) => [country.code, country.id]));

  const statesToCreate: Array<{ countryId: string; name: string }> = [];
  for (const [countryCode, countryData] of Object.entries(geoData)) {
    const countryId = countryMap[countryCode];
    for (const stateData of Object.values(countryData.states)) {
      statesToCreate.push({ countryId, name: stateData.name });
    }
  }

  const stateCreateResult = await prisma.geoState.createMany({ data: statesToCreate });
  console.log(`Seeded ${stateCreateResult.count} states`);

  const allStates = await prisma.geoState.findMany();
  const stateMap = Object.fromEntries(
    allStates.map((state) => [`${state.countryId}|${state.name}`, state.id]),
  );

  const citiesToCreate: Array<{ stateId: string; name: string }> = [];
  for (const [countryCode, countryData] of Object.entries(geoData)) {
    const countryId = countryMap[countryCode];
    for (const [stateCode, stateData] of Object.entries(countryData.states)) {
      const stateKey = `${countryId}|${stateData.name}`;
      const stateId = stateMap[stateKey];
      if (!stateId) continue;
      for (const cityName of stateData.cities) {
        citiesToCreate.push({ stateId, name: cityName });
      }
    }
  }

  const cityCreateResult = await prisma.geoCity.createMany({ data: citiesToCreate });
  console.log(`Seeded ${cityCreateResult.count} cities`);
  console.log('Geo seed complete. India is first in the country list and city data is rebuilt.');
}

async function main() {
  try {
    await forceSeedGeo();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Force geo reseed failed:', error);
  process.exit(1);
});
