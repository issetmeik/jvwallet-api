import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

const kmsClient = new KMSClient({ region: process.env.AWS_REGION });

export class KMSHelper {
  private static keyId = process.env.KMS_KEY_ARN || '';

  static async encrypt(text: string): Promise<string> {
    const command = new EncryptCommand({
      KeyId: this.keyId,
      Plaintext: Buffer.from(text),
    });

    const response = await kmsClient.send(command);
    return Buffer.from(response.CiphertextBlob || '').toString('base64');
  }

  static async decrypt(encryptedText: string): Promise<string> {
    const encryptedBuffer = Buffer.from(encryptedText, 'base64');

    const command = new DecryptCommand({
      CiphertextBlob: encryptedBuffer,
    });

    const response = await kmsClient.send(command);

    if (!response.Plaintext) {
      throw new Error('Failed to decrypt private key');
    }

    return Buffer.from(response.Plaintext).toString('utf-8');
  }
}
