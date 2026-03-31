import { PrismaClient } from '@prisma/client';
import { DEFAULT_WALLET_ADDRESSES } from '@/app/lib/crypto';

const prisma = new PrismaClient();

const MTN_BUNDLES = [
  { label: 'No Expiry - 9.05GB', priceGhs: 100, sortOrder: 1 },
  { label: 'No Expiry - 10.86GB', priceGhs: 120, sortOrder: 2 },
  { label: 'No Expiry - 13.57GB', priceGhs: 150, sortOrder: 3 },
  { label: 'No Expiry - 30.47GB', priceGhs: 200, sortOrder: 4 },
  { label: 'No Expiry - 38.09GB', priceGhs: 250, sortOrder: 5 },
  { label: 'No Expiry - 91.55GB', priceGhs: 300, sortOrder: 6 },
  { label: 'No Expiry - 106.81GB', priceGhs: 350, sortOrder: 7 },
  { label: 'No Expiry - 214.53GB', priceGhs: 399, sortOrder: 8 },
];

const TELECEL_BUNDLES = [
  { label: 'No Expiry - 10GB', priceGhs: 100, sortOrder: 1 },
  { label: '30 days - 12.81GB', priceGhs: 100, sortOrder: 2 },
  { label: 'No Expiry - 33.4GB', priceGhs: 200, sortOrder: 3 },
  { label: '30 days - 39GB', priceGhs: 200, sortOrder: 4 },
  { label: 'No Expiry - 100.29GB', priceGhs: 300, sortOrder: 5 },
  { label: '30 days - 111.43GB', priceGhs: 300, sortOrder: 6 },
  { label: 'No Expiry - 253.25GB', priceGhs: 400, sortOrder: 7 },
  { label: '30 days - 263.38GB', priceGhs: 400, sortOrder: 8 },
];

const AIRTELTIGO_BUNDLES = [
  { label: 'No Expiry - 10GB', priceGhs: 100, sortOrder: 1 },
  { label: 'No Expiry - 33.4GB', priceGhs: 200, sortOrder: 2 },
  { label: 'No Expiry - 100.3GB', priceGhs: 300, sortOrder: 3 },
  { label: 'No Expiry - 117GB', priceGhs: 350, sortOrder: 4 },
  { label: 'No Expiry - 253.3GB', priceGhs: 400, sortOrder: 5 },
  { label: '30 days - XXL 12.8GB', priceGhs: 99, sortOrder: 6 },
  { label: '30 days - XXL 39GB', priceGhs: 200, sortOrder: 7 },
  { label: '30 days - XXL Pack 130.4GB', priceGhs: 350, sortOrder: 8 },
];

async function main() {
  console.log('Seeding database...');

  // Seed wallet settings singleton
  await prisma.walletSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      USDT_TRC20: DEFAULT_WALLET_ADDRESSES.USDT_TRC20,
      USDT_BEP20: DEFAULT_WALLET_ADDRESSES.USDT_BEP20,
      USDT_POLYGON: DEFAULT_WALLET_ADDRESSES.USDT_POLYGON,
      USDC_BEP20: DEFAULT_WALLET_ADDRESSES.USDC_BEP20,
      USDC_POLYGON: DEFAULT_WALLET_ADDRESSES.USDC_POLYGON,
      BTC: DEFAULT_WALLET_ADDRESSES.BTC,
      BNB: DEFAULT_WALLET_ADDRESSES.BNB,
      ETH: DEFAULT_WALLET_ADDRESSES.ETH,
      BINANCE_PAY: DEFAULT_WALLET_ADDRESSES.BINANCE_PAY,
      BYBIT_PAY: DEFAULT_WALLET_ADDRESSES.BYBIT_PAY,
    },
  });
  console.log('Wallet settings seeded.');

  // Seed initial exchange rate
  const existingRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!existingRate) {
    await prisma.exchangeRate.create({
      data: { ghsPerUsd: 15.5, setByAdmin: 'system', note: 'Initial seed rate' },
    });
    console.log('Exchange rate seeded.');
  }

  // Seed MTN bundles
  const mtnCount = await prisma.dataBundle.count({ where: { network: 'MTN' } });
  if (mtnCount === 0) {
    await prisma.dataBundle.createMany({
      data: MTN_BUNDLES.map(b => ({ ...b, network: 'MTN' })),
    });
    console.log('MTN bundles seeded.');
  }

  // Seed Telecel bundles
  const telecelCount = await prisma.dataBundle.count({ where: { network: 'Telecel' } });
  if (telecelCount === 0) {
    await prisma.dataBundle.createMany({
      data: TELECEL_BUNDLES.map(b => ({ ...b, network: 'Telecel' })),
    });
    console.log('Telecel bundles seeded.');
  }

  // Seed AirtelTigo bundles
  const airteltigoCount = await prisma.dataBundle.count({ where: { network: 'AirtelTigo' } });
  if (airteltigoCount === 0) {
    await prisma.dataBundle.createMany({
      data: AIRTELTIGO_BUNDLES.map(b => ({ ...b, network: 'AirtelTigo' })),
    });
    console.log('AirtelTigo bundles seeded.');
  }

  console.log('Seeding complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
