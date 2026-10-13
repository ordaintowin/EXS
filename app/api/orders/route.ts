import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'ethers';
import { getTokenFromRequest, verifyToken } from '@/app/api/lib/jwt';
import { prisma } from '@/app/api/lib/prisma';
import { sendEmail } from '@/app/api/lib/email';
import { orderConfirmationEmail, adminNewOrderEmail } from '@/app/api/lib/email-templates';
import { OrderType, ServiceType, WalletChain } from '@prisma/client';

function parsePositiveNumber(value: unknown): number | null {
  if (
    typeof value !== 'number' &&
    (typeof value !== 'string' || value.trim().length === 0)
  ) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function walletChainForAsset(asset: string): WalletChain | null {
  if (asset === 'BTC') return WalletChain.bitcoin;
  if (asset === 'USDT_TRC20') return WalletChain.tron;
  if (asset === 'USDT_ERC20' || asset === 'USDC_ERC20' || asset === 'ETH') return WalletChain.ethereum;
  if (asset === 'USDT_BEP20' || asset === 'USDC_BEP20' || asset === 'BNB') return WalletChain.bsc;
  if (asset === 'USDT_POLYGON' || asset === 'USDC_POLYGON') return WalletChain.polygon;
  return null;
}

function walletAssetForOrder(asset: string): string | null {
  if (asset === 'BTC' || asset === 'ETH' || asset === 'BNB' || asset === 'POL') return asset;
  if (asset.startsWith('USDT')) return 'USDT';
  if (asset.startsWith('USDC')) return 'USDC';
  return null;
}

function isValidExternalWalletAddress(chain: WalletChain, address: string) {
  if (chain === WalletChain.ethereum || chain === WalletChain.bsc || chain === WalletChain.polygon) {
    return isAddress(address);
  }
  if (chain === WalletChain.tron) return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
  if (chain === WalletChain.bitcoin) {
    return /^(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address);
  }
  return false;
}

function requireAuth(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// GET /api/orders — get all orders for authenticated user
export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const orders = await prisma.order.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: { receipt: true },
    });
    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST /api/orders — create a new order
// POST /api/orders — create a new order
export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    const service = typeof body.service === 'string' ? body.service.trim() : '';
    const serviceType = body.serviceType;
    const recipient = body.recipient ?? null;
    const recipientName = body.recipientName ?? null;
    const bankName = body.bankName ?? null;
    const amountGhs = body.amountGhs ?? body.amount ?? 0;
    const cryptoAsset = body.cryptoAsset ?? body.crypto ?? '';
    const cryptoAmount = body.cryptoAmount;
    const cryptoRateGhs = body.cryptoRateGhs ?? 15.5;
    const cryptoRateUsd = body.cryptoRateUsd ?? null;
    const reference = body.reference ?? null;
    const bundleLabel = body.bundleLabel ?? null;
    const orderType = body.orderType ?? 'spend';
    const userWalletAddress = typeof body.userWalletAddress === 'string'
      ? body.userWalletAddress.trim() || null
      : null;
    const sellPayoutPhone = body.sellPayoutPhone ?? null;
    const sellPayoutBank = body.sellPayoutBank ?? null;
    // Payment method fields (for buy orders)
    const paymentMethod = body.paymentMethod ?? null;
    const paymentBankName = body.paymentBankName ?? null;
    const paymentBankAcct = body.paymentBankAcct ?? null;
    const paymentAcctName = body.paymentAcctName ?? null;
    const paymentMomoProvider = body.paymentMomoProvider ?? null;
    const paymentMomoNumber = body.paymentMomoNumber ?? null;

    const validOrderTypes = Object.values(OrderType);
    const validServiceTypes = Object.values(ServiceType);
    if (
      !service ||
      service.length > 120 ||
      !validOrderTypes.includes(orderType) ||
      !validServiceTypes.includes(serviceType) ||
      typeof cryptoAsset !== 'string' ||
      !cryptoAsset ||
      !cryptoAmount
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user is banned
    const ghsAmount = parsePositiveNumber(amountGhs);
    const cryptoAmountNumber = parsePositiveNumber(cryptoAmount);
    const cryptoRateGhsNumber = parsePositiveNumber(cryptoRateGhs);
    const cryptoRateUsdNumber = cryptoRateUsd === null ? null : parsePositiveNumber(cryptoRateUsd);
    if (ghsAmount === null || cryptoAmountNumber === null || cryptoRateGhsNumber === null || (cryptoRateUsd !== null && cryptoRateUsdNumber === null)) {
      return NextResponse.json({ error: 'Amounts and exchange rates must be valid positive numbers.' }, { status: 400 });
    }

    const expectedChain = walletChainForAsset(String(cryptoAsset));
    const expectedAsset = walletAssetForOrder(String(cryptoAsset));
    if (orderType === 'spend' && !userWalletAddress) {
      return NextResponse.json({ error: 'Select one of your linked wallets before spending.' }, { status: 400 });
    }
    if (orderType === 'sell' && expectedChain && !userWalletAddress) {
      return NextResponse.json({ error: 'Choose a linked or external wallet before selling.' }, { status: 400 });
    }

    if (orderType === 'buy' && !userWalletAddress) {
      return NextResponse.json({ error: 'Enter a wallet address to receive the crypto.' }, { status: 400 });
    }

    if (userWalletAddress && (orderType === 'spend' || orderType === 'sell' || orderType === 'buy')) {
      const linkedWallet = await prisma.linkedWallet.findFirst({
        where: {
          userId: user.userId,
          address: userWalletAddress,
          ...(expectedChain ? { chain: expectedChain } : {}),
          ...(expectedAsset ? { asset: expectedAsset } : {}),
        },
        select: { id: true, chain: true, asset: true },
      });
      if (!linkedWallet && orderType === 'spend') {
        return NextResponse.json({ error: 'Select one of your verified linked wallets as the debit source.' }, { status: 400 });
      }
      if (linkedWallet && expectedChain && linkedWallet.chain !== expectedChain) {
        return NextResponse.json({ error: 'The selected source wallet is on the wrong network for this asset.' }, { status: 400 });
      }
      if (linkedWallet && expectedAsset && linkedWallet.asset !== expectedAsset) {
        return NextResponse.json({ error: 'The selected wallet is not linked for this asset.' }, { status: 400 });
      }
      if (!linkedWallet && orderType === 'sell' && expectedChain && !isValidExternalWalletAddress(expectedChain, userWalletAddress)) {
        return NextResponse.json({ error: 'Enter a valid external wallet address for this network.' }, { status: 400 });
      }
      if (!linkedWallet && orderType === 'buy' && expectedChain && !isValidExternalWalletAddress(expectedChain, userWalletAddress)) {
        return NextResponse.json({ error: 'Enter a valid external wallet address for this network.' }, { status: 400 });
      }
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { kycVerified: true, isBanned: true },
    });
    if (userRecord?.isBanned) {
      return NextResponse.json({ error: 'banned', message: 'Your account has been restricted. Please contact support.' }, { status: 403 });
    }

    // Check daily quota for spend and sell orders
    if (orderType === 'spend' || orderType === 'sell') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get user's kycVerified status for quota limit
      const dailyLimit = userRecord?.kycVerified ? 30000 : 5000;

      const quotaResult = await prisma.order.aggregate({
        where: {
          userId: user.userId,
          orderType: { in: ['spend', 'sell'] },
          status: 'successful',
          createdAt: { gte: today },
        },
        _sum: { amountGhs: true },
      });
      const totalSpentToday = quotaResult._sum.amountGhs ?? 0;
      if (totalSpentToday + ghsAmount > dailyLimit) {
        const remaining = Math.max(0, dailyLimit - totalSpentToday);
        return NextResponse.json({
          error: `Daily limit reached. You have GHS ${remaining.toFixed(2)} remaining today.`,
        }, { status: 400 });
      }
    }

    const newOrder = await prisma.order.create({
      data: {
        userId: user.userId,
        orderType: orderType as OrderType,
        serviceType: serviceType as ServiceType,
        service,
        recipient,
        recipientName,
        bankName,
        reference,
        bundleLabel,
        amountGhs: ghsAmount,
        cryptoAsset,
        cryptoAmount: String(cryptoAmount),
        cryptoRateGhs: cryptoRateGhsNumber,
        cryptoRateUsd: cryptoRateUsdNumber,
        userWalletAddress,
        sellPayoutPhone,
        sellPayoutBank,
        paymentMethod,
        paymentBankName,
        paymentBankAcct,
        paymentAcctName,
        paymentMomoProvider,
        paymentMomoNumber,
        quotaUsed: (orderType === 'spend' || orderType === 'sell') ? ghsAmount : null,
        // All orders start as 'waiting' (user must confirm payment/sending)
        status: 'waiting',
      },
    });

    // Fire-and-forget emails
    Promise.resolve().then(async () => {
      const orderUser = await prisma.user.findUnique({ where: { id: user.userId } });
      if (!orderUser) return;

      const settings = await prisma.walletSettings.findUnique({ where: { id: 'singleton' } });
      const walletAddress = settings
        ? (settings as Record<string, unknown>)[cryptoAsset] as string || ''
        : '';

      await sendEmail({
        to: orderUser.email,
        subject: `Order Confirmed — #${newOrder.id.slice(0, 8).toUpperCase()}`,
        html: orderConfirmationEmail({
          userName: orderUser.name,
          orderId: newOrder.id,
          service: newOrder.service,
          amount: newOrder.amountGhs,
          cryptoAmount: newOrder.cryptoAmount,
          crypto: newOrder.cryptoAsset,
          walletAddress,
          recipient: newOrder.recipient ?? '',
          recipientName: newOrder.recipientName ?? '',
          reference: newOrder.reference ?? undefined,
        }),
      });

      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
      if (adminEmail) {
        await sendEmail({
          to: adminEmail,
          subject: `New Order — #${newOrder.id.slice(0, 8).toUpperCase()}`,
          html: adminNewOrderEmail({
            orderId: newOrder.id,
            service: newOrder.service,
            amount: newOrder.amountGhs,
            cryptoAmount: newOrder.cryptoAmount,
            crypto: newOrder.cryptoAsset,
            recipient: newOrder.recipient ?? '',
            recipientName: newOrder.recipientName ?? '',
            userName: orderUser.name,
            userEmail: orderUser.email,
          }),
        });
      }
    }).catch(console.error);

    // In-app notification for order creation (user)
    Promise.resolve().then(async () => {
      await prisma.notification.create({
        data: {
          userId: newOrder.userId,
          recipientType: 'user',
          title: '📋 Order Placed',
          message: `Your order #${newOrder.id.slice(0, 8).toUpperCase()} for ${newOrder.service} (GHS ${newOrder.amountGhs.toFixed(2)}) has been received. Please send the crypto payment.`,
          link: `/orders/${newOrder.id}`,
          relatedOrderId: newOrder.id,
        },
      });

      // Notify all admins about the new order
      const admins = await prisma.user.findMany({
        where: { isAdmin: true },
        select: { id: true },
      });
      const orderUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { name: true, email: true },
      });
      if (admins.length > 0 && orderUser) {
        await prisma.notification.createMany({
          data: admins.map(admin => ({
            userId: admin.id,
            recipientType: 'admin',
            title: '🆕 New Order',
            message: `${orderUser.name} placed order #${newOrder.id.slice(0, 8).toUpperCase()} for ${newOrder.service} — GHS ${newOrder.amountGhs.toFixed(2)}`,
            link: `/admin/orders/${newOrder.id}`,
            relatedOrderId: newOrder.id,
          })),
        });
      }
    }).catch(console.error);

    return NextResponse.json({ order: newOrder }, { status: 201 });
  } catch (err) {
    console.error('ORDER CREATE ERROR:', err);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
