export function buildSignInMessage(
  domain: string,
  walletAddress: string,
  nonce: string,
  issuedAt?: string
): string {
  let message = `${domain} wants you to sign in with your Solana account:
${walletAddress}

Nonce: ${nonce}`;

  if (issuedAt) {
    message += `\nIssued At: ${issuedAt}`;
  }

  return message;
}