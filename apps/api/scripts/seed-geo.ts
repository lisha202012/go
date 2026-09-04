import { PrismaClient } from '@prisma/client';
import { getCitiesOfState, getCountries, getStatesOfCountry } from '@countrystatecity/countries';

const prisma = new PrismaClient();

// Set ['IN'] for a quick smoke-test, or null to seed the full dataset.
const SEED_COUNTRY_CODES: string[] | null = ['IN'];

async function seedCountry(country: { iso2: string; name: string }) {
  const code = country.iso2?.trim().toUpperCase();
  const name = country.name?.trim();

  if (!code || !name) return;

  await prisma.$transaction(async (tx) => {
    const countryRow = await tx.geoCountry.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });

    const states = await getStatesOfCountry(code);
    let stateCount = 0;
    let cityCount = 0;

    for (const state of states) {
      const stateName = state.name?.trim();
      if (!stateName) continue;

      const stateRow = await tx.geoState.upsert({
        where: {
          countryId_name: {
            countryId: countryRow.id,
            name: stateName,
          },
        },
        update: {},
        create: {
          countryId: countryRow.id,
          name: stateName,
        },
      });

      stateCount += 1;

      const cities = await getCitiesOfState(code, state.iso2);
      for (const city of cities) {
        const cityName = city.name?.trim();
        if (!cityName) continue;

        await tx.geoCity.upsert({
          where: {
            stateId_name: {
              stateId: stateRow.id,
              name: cityName,
            },
          },
          update: {},
          create: {
            stateId: stateRow.id,
            name: cityName,
          },
        });

        cityCount += 1;
      }
    }

    console.log(`✓ ${name}: ${stateCount} states, ${cityCount} cities`);
  }, { timeout: 120_000, maxWait: 10_000 });
}

async function main() {
  await prisma.geoCity.deleteMany();
  await prisma.geoState.deleteMany();
  await prisma.geoCountry.deleteMany();

  const countries = await getCountries();

  const filteredCountries = SEED_COUNTRY_CODES
    ? countries.filter((country) => SEED_COUNTRY_CODES.includes(country.iso2?.trim().toUpperCase() ?? ''))
    : countries;

  console.log(`Seeding ${filteredCountries.length} countries from @countrystatecity/countries`);

  for (const country of filteredCountries) {
    await seedCountry(country);
  }

  const totalCountries = await prisma.geoCountry.count();
  const totalStates = await prisma.geoState.count();
  const totalCities = await prisma.geoCity.count();

  console.log(`Geo seed complete: ${totalCountries} countries, ${totalStates} states, ${totalCities} cities`);
}

main()
  .catch((error) => {
    console.error('Geo seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
