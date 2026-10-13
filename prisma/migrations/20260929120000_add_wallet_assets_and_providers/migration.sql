-- A linked wallet is now one asset on one network. Existing rows are mapped
-- to the native/primary asset for their network so old links keep working.
ALTER TABLE "WalletSettings"
    ADD COLUMN "USDT_ERC20" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "USDC_ERC20" TEXT NOT NULL DEFAULT '';

ALTER TABLE "LinkedWallet"
    ADD COLUMN "asset" TEXT NOT NULL DEFAULT 'BTC',
    ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE "WalletChallenge"
    ADD COLUMN "asset" TEXT NOT NULL DEFAULT 'BTC',
    ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'manual';

UPDATE "LinkedWallet"
SET "asset" = CASE "chain"
    WHEN 'ethereum' THEN 'ETH'
    WHEN 'bsc' THEN 'BNB'
    WHEN 'polygon' THEN 'USDC'
    WHEN 'tron' THEN 'USDT'
    WHEN 'bitcoin' THEN 'BTC'
END;

UPDATE "WalletChallenge"
SET "asset" = CASE "chain"
    WHEN 'ethereum' THEN 'ETH'
    WHEN 'bsc' THEN 'BNB'
    WHEN 'polygon' THEN 'USDC'
    WHEN 'tron' THEN 'USDT'
    WHEN 'bitcoin' THEN 'BTC'
END;

DROP INDEX IF EXISTS "LinkedWallet_userId_chain_key";
DROP INDEX IF EXISTS "LinkedWallet_chain_address_key";
DROP INDEX IF EXISTS "LinkedWallet_userId_chain_idx";
DROP INDEX IF EXISTS "WalletChallenge_userId_chain_address_createdAt_idx";

CREATE UNIQUE INDEX "LinkedWallet_userId_chain_asset_key"
    ON "LinkedWallet"("userId", "chain", "asset");
CREATE UNIQUE INDEX "LinkedWallet_chain_address_asset_key"
    ON "LinkedWallet"("chain", "address", "asset");
CREATE INDEX "LinkedWallet_userId_chain_asset_idx"
    ON "LinkedWallet"("userId", "chain", "asset");
CREATE INDEX "WalletChallenge_userId_chain_address_asset_createdAt_idx"
    ON "WalletChallenge"("userId", "chain", "address", "asset", "createdAt");