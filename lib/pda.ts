import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, PLATFORM_CONFIG_SEED, DROP_SEED, VAULT_SEED, CLAIM_SEED } from "./constants";

export function getPlatformConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PLATFORM_CONFIG_SEED], PROGRAM_ID);
}

export function getDropPda(creator: PublicKey, dropId: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [DROP_SEED, creator.toBytes(), Buffer.from(dropId)],
    PROGRAM_ID
  );
}

export function getVaultPda(dropPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_SEED, dropPubkey.toBytes()], PROGRAM_ID);
}

export function getClaimRecordPda(dropPubkey: PublicKey, claimer: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CLAIM_SEED, dropPubkey.toBytes(), claimer.toBytes()],
    PROGRAM_ID
  );
}
