CREATE TYPE "WalletChain" AS ENUM ('ethereum', 'bsc', 'polygon', 'tron', 'bitcoin');

CREATE TABLE "LinkedWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chain" "WalletChain" NOT NULL,
    "address" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LinkedWallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chain" "WalletChain" NOT NULL,
    "address" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChainDeposit" (
    "id" TEXT NOT NULL,
    "chain" "WalletChain" NOT NULL,
    "txHash" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "sourceAddress" TEXT,
    "asset" TEXT NOT NULL,
    "tokenAddress" TEXT,
    "amount" TEXT NOT NULL,
    "blockNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'detected',
    "providerPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChainDeposit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LinkedWallet_chain_address_key" ON "LinkedWallet"("chain", "address");
CREATE INDEX "LinkedWallet_userId_chain_idx" ON "LinkedWallet"("userId", "chain");
CREATE INDEX "WalletChallenge_userId_chain_address_createdAt_idx" ON "WalletChallenge"("userId", "chain", "address", "createdAt");
CREATE INDEX "WalletChallenge_expiresAt_idx" ON "WalletChallenge"("expiresAt");
CREATE UNIQUE INDEX "ChainDeposit_chain_txHash_destination_asset_key" ON "ChainDeposit"("chain", "txHash", "destination", "asset");
CREATE INDEX "ChainDeposit_createdAt_idx" ON "ChainDeposit"("createdAt");
CREATE INDEX "ChainDeposit_chain_destination_idx" ON "ChainDeposit"("chain", "destination");

ALTER TABLE "LinkedWallet"
    ADD CONSTRAINT "LinkedWallet_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WalletChallenge"
    ADD CONSTRAINT "WalletChallenge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;