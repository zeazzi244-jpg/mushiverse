import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Environment, SignedDataVerifier, VerificationException, VerificationStatus } from '@apple/app-store-server-library';
import { isAppleCoinProduct, validateProductionAppleCoinTransaction, validateVerifiedAppleCoinTransaction } from '../../supabase/functions/_shared/apple-coin-transaction-policy.mjs';

const secret = process.env.APPLE_SANDBOX_VERIFIER_SECRET;
if (!secret || !/^[a-f0-9]{64}$/.test(secret)) {
  throw new Error('Configure a 32-byte hex verifier secret');
}
const authorization = Buffer.from('Bearer ' + secret);
// Apple Root CA - G3, DER from Apple's certificate authority.
const root = Buffer.from('MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==', 'base64');
if (createHash('sha256').update(root).digest('hex') !==
  '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179') {
  throw new Error('Apple Root CA fingerprint mismatch');
}

const g2Root = Buffer.from('MIIFkjCCA3qgAwIBAgIIAeDltYNno+AwDQYJKoZIhvcNAQEMBQAwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEcyMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxMDA5WhcNMzkwNDMwMTgxMDA5WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzIxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBANgREkhI2imKScUcx+xuM23+TfvgHN6sXuI2pyT5f1BrTM65MFQn5bPW7SXmMLYFN14UIhHF6Kob0vuy0gmVOKTvKkmMXT5xZgM4+xb1hYjkWpIMBDLyyED7Ul+f9sDx47pFoFDVEovy3d6RhiPw9bZyLgHaC/YuOQhfGaFjQQscp5TBhsRTL3b2CtcM0YM/GlMZ81fVJ3/8E7j4ko380yhDPLVoACVdJ2LT3VXdRCCQgzWTxb+4Gftr49wIQuavbfqeQMpOhYV4SbHXw8EwOTKrfl+q04tvny0aIWhwZ7Oj8ZhBbZF8+NfbqOdfIRqMM78xdLe40fTgIvS/cjTf94FNcX1RoeKz8NMoFnNvzcytN31O661A4T+B/fc9Cj6i8b0xlilZ3MIZgIxbdMYs0xBTJh0UT8TUgWY8h2czJxQI6bR3hDRSj4n4aJgXv8O7qhOTH11UL6jHfPsNFL4VPSQ08prcdUFmIrQB1guvkJ4M6mL4m1k8COKWNORj3rw31OsMiANDC1CvoDTdUE0V+1ok2Az6DGOeHwOx4e7hqkP0ZmUoNwIx7wHHHtHMn23KVDpA287PT0aLSmWaasZobNfMmRtHsHLDd4/E92GcdB/O/WuhwpyUgquUoue9G7q5cDmVF8Up8zlYNPXEpMZ7YLlmQ1A/bmH8DvmGqmAMQ0uVAgMBAAGjQjBAMB0GA1UdDgQWBBTEmRNsGAPCe8CjoA1/coB6HHcmjTAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG9w0BAQwFAAOCAgEAUabz4vS4PZO/Lc4Pu1vhVRROTtHlznldgX/+tvCHM/jvlOV+3Gp5pxy+8JS3ptEwnMgNCnWefZKVfhidfsJxaXwU6s+DDuQUQp50DhDNqxq6EWGBeNjxtUVAeKuowM77fWM3aPbn+6/Gw0vsHzYmE1SGlHKy6gLti23kDKaQwFd1z4xCfVzmMX3zybKSaUYOiPjjLUKyOKimGY3xn83uamW8GrAlvacp/fQ+onVJv57byfenHmOZ4VxG/5IFjPoeIPmGlFYl5bRXOJ3riGQUIUkhOb9iZqmxospvPyFgxYnURTbImHy99v6ZSYA7LNKmp4gDBDEZt7Y6YUX6yfIjyGNzv1aJMbDZfGKnexWoiIqrOEDCzBL/FePwN983csvMmOa/orz6JopxVtfnJBtIRD6e/J/JzBrsQzwBvDR4yGn1xuZW7AYJNpDrFEobXsmII9oDMJELuDY++ee1KG++P+w8j2Ud5cAeh6Squpj9kuNsJnfdBrRkBof0Tta6SqoWqPQFZ2aWuuJVecMsXUmPgEkrihLHdoBR37q9ZV0+N0djMenl9MU/S60EinpxLK8JQzcPqOMyT/RFtm2XNuyE9QoB6he7hY1Ck3DDUOUUi78/w0EP3SIEIwiKum1xRKtzCTrJ+VKACd+66eYWyi4uTLLT3OUEVLLUNIAytbwPF+E=', 'base64');
if (createHash('sha256').update(g2Root).digest('hex') !==
  'c2b9b042dd57830e7d117dac55ac8ae19407d38e41d88f3215bc3a890444a050') {
  throw new Error('Apple G2 root fingerprint mismatch');
}
const testVerifier = new SignedDataVerifier([g2Root, root], true, Environment.SANDBOX, 'com.rikuto.mushiverse');

const productionSecret = process.env.APPLE_PRODUCTION_VERIFIER_SECRET;
const productionAuthorization = /^[a-f0-9]{64}$/.test(productionSecret ?? '') && productionSecret !== secret
  ? Buffer.from('Bearer ' + productionSecret)
  : null;
const productionVerifier = new SignedDataVerifier([g2Root, root], true, Environment.PRODUCTION,
  'com.rikuto.mushiverse', 6826061606);

const verifier = new SignedDataVerifier([root], true, Environment.SANDBOX, 'com.rikuto.mushiverse');

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json');
  const send = (status, body) => {
    response.writeHead(status);
    response.end(JSON.stringify(body));
  };

  if (request.method === 'GET' && request.url === '/healthz') return send(200, { ok: true });
  const testNotification = request.url === '/verify-sandbox-test';
  const productionPurchase = request.url === '/verify-production-purchase';
  if (request.method !== 'POST' || (!testNotification && !productionPurchase && request.url !== '/verify')) return send(404, { error: 'not_found' });
  const provided = Buffer.from(request.headers.authorization ?? '');
  const expectedAuthorization = productionPurchase ? productionAuthorization : authorization;
  if (!expectedAuthorization || provided.length !== expectedAuthorization.length ||
      !timingSafeEqual(provided, expectedAuthorization)) {
    return send(401, { error: 'unauthorized' });
  }

  try {
    const parts = [];
    let length = 0;
    for await (const chunk of request) {
      length += chunk.length;
      if (length > (testNotification ? 45000 : 18000)) return send(413, { error: 'request_too_large' });
      parts.push(chunk);
    }
    const input = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (testNotification) {
      const signedPayload = input?.signedPayload;
      if (typeof signedPayload !== 'string' || signedPayload.length > 44000 ||
          !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(signedPayload)) {
        return send(400, { error: 'invalid_request' });
      }
      const header = JSON.parse(Buffer.from(signedPayload.split('.')[0], 'base64url'));
      if (header?.alg !== 'ES256') return send(422, { error: 'invalid_notification' });
      const notification = await testVerifier.verifyAndDecodeNotification(signedPayload);
      if (notification.notificationType !== 'TEST' ||
          notification.data?.environment !== Environment.SANDBOX ||
          (notification.data.appAppleId != null && notification.data.appAppleId !== 6826061606)) {
        return send(422, { error: 'invalid_notification' });
      }
      response.writeHead(204);
      return response.end();
    }
    const { signedTransaction, expected } = input;
    if (typeof signedTransaction !== 'string' || signedTransaction.length > 16384 ||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(signedTransaction) ||
        expected?.environment !== (productionPurchase ? 'Production' : 'Sandbox') || !isAppleCoinProduct(expected.productId) ||
        (productionPurchase && expected.productId !== 'mushiverse.coins.100') ||
        !['transactionId', 'originalTransactionId'].every(key =>
          typeof expected[key] === 'string' && /^\d{6,30}$/.test(expected[key])) ||
        typeof expected.appAccountToken !== 'string' ||
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(expected.appAccountToken)) {
      return send(400, { error: 'invalid_request' });
    }
    const header = JSON.parse(Buffer.from(signedTransaction.split('.')[0], 'base64url'));
    if (header?.alg !== 'ES256') return send(422, { error: 'invalid_transaction' });
    if (productionPurchase) {
      const transaction = await productionVerifier.verifyAndDecodeTransaction(signedTransaction);
      validateProductionAppleCoinTransaction(transaction, expected);
      // Return only signed evidence used by the Edge Function's policy.
      const { bundleId, environment, productId, transactionId, originalTransactionId, appAccountToken,
        purchaseDate, signedDate, type, quantity, inAppOwnershipType, revocationDate, revocationReason,
        isUpgraded, transactionReason, subscriptionGroupIdentifier, expiresDate, webOrderLineItemId,
        offerType, offerIdentifier, offerDiscountType, offerPeriod } = transaction;
      return send(200, { verified: { bundleId, environment, productId, transactionId, originalTransactionId,
        appAccountToken, purchaseDate, signedDate, type, quantity, inAppOwnershipType, revocationDate,
        revocationReason, isUpgraded, transactionReason, subscriptionGroupIdentifier, expiresDate, webOrderLineItemId,
        offerType, offerIdentifier, offerDiscountType, offerPeriod } });
    }
    const transaction = await verifier.verifyAndDecodeTransaction(signedTransaction);
    const verified = validateVerifiedAppleCoinTransaction(transaction, expected);
    // Preserve only fields already cryptographically verified and policy checked.
    // The Edge Function independently revalidates this signed evidence; never
    // return a stripped policy summary or echo untrusted expected fields.
    return send(200, { verified: {
      ...verified,
      bundleId: transaction.bundleId,
      appAccountToken: transaction.appAccountToken,
      revocationDate: transaction.revocationDate ?? null,
      revocationReason: transaction.revocationReason ?? null,
      type: transaction.type,
      quantity: transaction.quantity,
      inAppOwnershipType: transaction.inAppOwnershipType,
      purchaseDate: transaction.purchaseDate,
      signedDate: transaction.signedDate,
      isUpgraded: transaction.isUpgraded ?? null,
      transactionReason: transaction.transactionReason ?? null,
    } });
  } catch (error) {
    // A signed transaction may contain private purchase/account data.
    // Record only a fixed diagnostic category; never log the JWS, Apple
    // transaction, request body, secret or arbitrary exception message.
    const policyRejections = new Set([
      'invalid_transaction', 'bundle_mismatch', 'environment_mismatch',
      'product_mismatch', 'type_mismatch', 'subscription_metadata_on_consumable',
      'invalid_consumable_transaction_reason', 'unsupported_quantity',
      'unsupported_ownership_type', 'invalid_transaction_id',
      'invalid_original_transaction_id', 'revoked', 'upgraded_transaction',
      'invalid_purchase_date', 'invalid_signed_date',
      'app_account_token_mismatch', 'consumable_transaction_chain_mismatch',
      'transaction_mismatch', 'original_transaction_mismatch'
    ]);
    // Classify only Apple's fixed public status enum, never an arbitrary exception
    // message (which could include sensitive material from a nested library).
    const appleStatuses = new Map([
      [VerificationStatus.VERIFICATION_FAILURE, 'apple_signature_or_certificate_failure'],
      [VerificationStatus.RETRYABLE_VERIFICATION_FAILURE, 'apple_ocsp_temporarily_unavailable'],
      [VerificationStatus.INVALID_APP_IDENTIFIER, 'apple_app_identifier_mismatch'],
      [VerificationStatus.INVALID_ENVIRONMENT, 'apple_environment_mismatch'],
      [VerificationStatus.INVALID_CHAIN_LENGTH, 'apple_certificate_chain_length'],
      [VerificationStatus.INVALID_CERTIFICATE, 'apple_certificate_invalid'],
      [VerificationStatus.FAILURE, 'apple_verification_failure'],
    ]);
    const reason = error instanceof Error && policyRejections.has(error.message)
      ? error.message
      : error instanceof VerificationException
        ? appleStatuses.get(error.status) ?? 'apple_verification_unknown'
        : 'apple_crypto_or_runtime_rejected';
    const retryable = error instanceof VerificationException
      && error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE;
    console.warn('sandbox verifier rejected:', reason);
    response.setHeader('X-Mushiverse-Verify-Reason', reason);
    return send(retryable ? 503 : 422, { error: retryable ? 'verification_temporarily_unavailable' : 'verification_failed' });
  }
});
server.requestTimeout = 20000;
server.listen(Number(process.env.PORT || 8080), '0.0.0.0');
