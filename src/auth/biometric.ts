/**
 * Biometric Authentication System for Enhanced Voter Verification
 * Implements WebAuthn and biometric verification for secure voter identity
 */

import { createHash, randomBytes } from 'crypto';

export interface BiometricCredential {
  id: string;
  publicKey: string;
  counter: number;
  transports: string[];
  type: 'biometric' | 'security-key';
}

export interface BiometricChallenge {
  challenge: string;
  timeout: number;
  userVerification: 'required' | 'preferred' | 'discouraged';
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    userVerification?: 'required' | 'preferred' | 'discouraged';
    requireResidentKey?: boolean;
  };
}

export interface BiometricVerificationResult {
  verified: boolean;
  credentialId: string;
  userHandle?: string;
  counter: number;
  errors?: string[];
}

/**
 * Biometric Authentication Manager
 * Handles WebAuthn-based biometric authentication for voters
 */
export class BiometricAuthManager {
  private readonly rpId: string;
  private readonly rpName: string;
  private challenges: Map<string, { challenge: string; timestamp: number }>;

  constructor(rpId: string = 'voting-system.com', rpName: string = 'Decentralized Voting System') {
    this.rpId = rpId;
    this.rpName = rpName;
    this.challenges = new Map();
  }

  /**
   * Generate registration challenge for new biometric credential
   * @param userId User identifier
   * @param userName User display name
   * @param userDisplayName User friendly name
   * @returns WebAuthn registration options
   */
  generateRegistrationChallenge(
    userId: string,
    userName: string,
    userDisplayName: string
  ): {
    challenge: string;
    rp: { id: string; name: string };
    user: { id: string; name: string; displayName: string };
    pubKeyCredParams: Array<{ alg: number; type: string }>;
    authenticatorSelection: any;
    timeout: number;
    attestation: string;
  } {
    const challenge = randomBytes(32).toString('base64url');
    const challengeId = createHash('sha256').update(userId + challenge).digest('hex');
    
    // Store challenge for verification
    this.challenges.set(challengeId, {
      challenge,
      timestamp: Date.now()
    });

    return {
      challenge,
      rp: {
        id: this.rpId,
        name: this.rpName
      },
      user: {
        id: Buffer.from(userId).toString('base64url'),
        name: userName,
        displayName: userDisplayName
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        requireResidentKey: true
      },
      timeout: 60000,
      attestation: 'direct'
    };
  }

  /**
   * Verify biometric registration
   * @param userId User identifier
   * @param registrationResponse WebAuthn registration response
   * @returns Verification result and credential info
   */
  async verifyRegistration(
    userId: string,
    registrationResponse: any
  ): Promise<{
    verified: boolean;
    credential?: BiometricCredential;
    errors?: string[];
  }> {
    const errors: string[] = [];

    try {
      // Verify challenge
      const challengeId = createHash('sha256').update(userId + registrationResponse.challenge).digest('hex');
      const storedChallenge = this.challenges.get(challengeId);
      
      if (!storedChallenge) {
        errors.push('Invalid or expired challenge');
        return { verified: false, errors };
      }

      // Check challenge expiry (5 minutes)
      if (Date.now() - storedChallenge.timestamp > 5 * 60 * 1000) {
        errors.push('Challenge expired');
        this.challenges.delete(challengeId);
        return { verified: false, errors };
      }

      // Verify attestation (simplified - in production use webauthn library)
      const attestationObject = this.parseAttestationObject(registrationResponse.attestationObject);
      const clientDataJSON = JSON.parse(Buffer.from(registrationResponse.clientDataJSON, 'base64url').toString());

      // Verify client data
      if (clientDataJSON.type !== 'webauthn.create') {
        errors.push('Invalid client data type');
      }

      if (clientDataJSON.challenge !== storedChallenge.challenge) {
        errors.push('Challenge mismatch');
      }

      if (clientDataJSON.origin !== `https://${this.rpId}`) {
        errors.push('Origin mismatch');
      }

      if (errors.length > 0) {
        return { verified: false, errors };
      }

      // Create credential record
      const credential: BiometricCredential = {
        id: registrationResponse.id,
        publicKey: attestationObject.authData.credentialPublicKey,
        counter: attestationObject.authData.signCount,
        transports: registrationResponse.transports || ['internal'],
        type: 'biometric'
      };

      // Clean up challenge
      this.challenges.delete(challengeId);

      return { verified: true, credential };

    } catch (error) {
      errors.push(`Registration verification failed: ${error.message}`);
      return { verified: false, errors };
    }
  }

  /**
   * Generate authentication challenge for existing credential
   * @param credentialIds Array of allowed credential IDs
   * @returns WebAuthn authentication options
   */
  generateAuthenticationChallenge(credentialIds: string[]): {
    challenge: string;
    timeout: number;
    rpId: string;
    allowCredentials: Array<{ id: string; type: string; transports?: string[] }>;
    userVerification: string;
  } {
    const challenge = randomBytes(32).toString('base64url');
    const challengeId = createHash('sha256').update(challenge).digest('hex');
    
    // Store challenge for verification
    this.challenges.set(challengeId, {
      challenge,
      timestamp: Date.now()
    });

    return {
      challenge,
      timeout: 60000,
      rpId: this.rpId,
      allowCredentials: credentialIds.map(id => ({
        id,
        type: 'public-key',
        transports: ['internal', 'usb', 'nfc', 'ble']
      })),
      userVerification: 'required'
    };
  }

  /**
   * Verify biometric authentication
   * @param authenticationResponse WebAuthn authentication response
   * @param storedCredential Stored credential to verify against
   * @returns Verification result
   */
  async verifyAuthentication(
    authenticationResponse: any,
    storedCredential: BiometricCredential
  ): Promise<BiometricVerificationResult> {
    const errors: string[] = [];

    try {
      // Verify challenge
      const challengeId = createHash('sha256').update(authenticationResponse.challenge).digest('hex');
      const storedChallenge = this.challenges.get(challengeId);
      
      if (!storedChallenge) {
        errors.push('Invalid or expired challenge');
        return { verified: false, credentialId: '', counter: 0, errors };
      }

      // Parse authentication data
      const clientDataJSON = JSON.parse(Buffer.from(authenticationResponse.clientDataJSON, 'base64url').toString());
      const authenticatorData = this.parseAuthenticatorData(authenticationResponse.authenticatorData);

      // Verify client data
      if (clientDataJSON.type !== 'webauthn.get') {
        errors.push('Invalid client data type');
      }

      if (clientDataJSON.challenge !== storedChallenge.challenge) {
        errors.push('Challenge mismatch');
      }

      // Verify counter (replay attack protection)
      if (authenticatorData.signCount <= storedCredential.counter) {
        errors.push('Invalid signature counter - possible replay attack');
      }

      // Verify signature (simplified - in production use crypto library)
      const signatureValid = await this.verifySignature(
        storedCredential.publicKey,
        authenticationResponse.signature,
        authenticatorData,
        clientDataJSON
      );

      if (!signatureValid) {
        errors.push('Invalid signature');
      }

      if (errors.length > 0) {
        return { verified: false, credentialId: authenticationResponse.id, counter: 0, errors };
      }

      // Clean up challenge
      this.challenges.delete(challengeId);

      return {
        verified: true,
        credentialId: authenticationResponse.id,
        counter: authenticatorData.signCount,
        userHandle: authenticationResponse.userHandle
      };

    } catch (error) {
      errors.push(`Authentication verification failed: ${error.message}`);
      return { verified: false, credentialId: '', counter: 0, errors };
    }
  }

  /**
   * Multi-factor authentication combining biometric + PIN/password
   * @param userId User identifier
   * @param biometricResponse WebAuthn response
   * @param additionalFactor PIN or password
   * @param storedCredential Stored biometric credential
   * @param storedHash Stored hash of additional factor
   * @returns Combined verification result
   */
  async verifyMultiFactor(
    userId: string,
    biometricResponse: any,
    additionalFactor: string,
    storedCredential: BiometricCredential,
    storedHash: string
  ): Promise<{
    verified: boolean;
    factors: {
      biometric: boolean;
      additional: boolean;
    };
    errors?: string[];
  }> {
    const errors: string[] = [];

    // Verify biometric factor
    const biometricResult = await this.verifyAuthentication(biometricResponse, storedCredential);
    
    // Verify additional factor
    const additionalHash = createHash('sha256').update(userId + additionalFactor).digest('hex');
    const additionalValid = additionalHash === storedHash;

    if (!additionalValid) {
      errors.push('Invalid PIN/password');
    }

    if (biometricResult.errors) {
      errors.push(...biometricResult.errors);
    }

    return {
      verified: biometricResult.verified && additionalValid,
      factors: {
        biometric: biometricResult.verified,
        additional: additionalValid
      },
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Generate secure voter token after successful biometric authentication
   * @param userId User identifier
   * @param electionId Election identifier
   * @param credentialId Verified credential ID
   * @returns Secure voter token
   */
  generateVoterToken(userId: string, electionId: string, credentialId: string): string {
    const tokenData = {
      userId,
      electionId,
      credentialId,
      timestamp: Date.now(),
      nonce: randomBytes(16).toString('hex')
    };

    const tokenString = JSON.stringify(tokenData);
    const signature = createHash('sha256').update(tokenString + process.env.JWT_SECRET).digest('hex');

    return Buffer.from(JSON.stringify({ ...tokenData, signature })).toString('base64url');
  }

  /**
   * Verify voter token
   * @param token Voter token to verify
   * @param expectedElectionId Expected election ID
   * @returns Verification result
   */
  verifyVoterToken(token: string, expectedElectionId: string): {
    valid: boolean;
    userId?: string;
    credentialId?: string;
    errors?: string[];
  } {
    try {
      const tokenData = JSON.parse(Buffer.from(token, 'base64url').toString());
      const { signature, ...data } = tokenData;

      // Verify signature
      const expectedSignature = createHash('sha256').update(JSON.stringify(data) + process.env.JWT_SECRET).digest('hex');
      if (signature !== expectedSignature) {
        return { valid: false, errors: ['Invalid token signature'] };
      }

      // Check expiry (1 hour)
      if (Date.now() - data.timestamp > 60 * 60 * 1000) {
        return { valid: false, errors: ['Token expired'] };
      }

      // Check election ID
      if (data.electionId !== expectedElectionId) {
        return { valid: false, errors: ['Token not valid for this election'] };
      }

      return {
        valid: true,
        userId: data.userId,
        credentialId: data.credentialId
      };

    } catch (error) {
      return { valid: false, errors: [`Token verification failed: ${error.message}`] };
    }
  }

  // Private helper methods

  private parseAttestationObject(attestationObject: string): any {
    // Simplified parsing - in production use CBOR library
    const buffer = Buffer.from(attestationObject, 'base64url');
    return {
      authData: {
        credentialPublicKey: buffer.slice(37, 77).toString('hex'),
        signCount: buffer.readUInt32BE(33)
      }
    };
  }

  private parseAuthenticatorData(authenticatorData: string): any {
    // Simplified parsing - in production use proper WebAuthn library
    const buffer = Buffer.from(authenticatorData, 'base64url');
    return {
      signCount: buffer.readUInt32BE(33),
      flags: buffer[32]
    };
  }

  private async verifySignature(
    publicKey: string,
    signature: string,
    authenticatorData: any,
    clientDataJSON: any
  ): Promise<boolean> {
    // Simplified signature verification - in production use crypto library
    // This would involve proper ECDSA/RSA signature verification
    return publicKey.length > 0 && signature.length > 0;
  }

  /**
   * Clean up expired challenges
   */
  cleanupExpiredChallenges(): void {
    const now = Date.now();
    const expiredChallenges: string[] = [];

    for (const [id, challenge] of this.challenges.entries()) {
      if (now - challenge.timestamp > 5 * 60 * 1000) { // 5 minutes
        expiredChallenges.push(id);
      }
    }

    expiredChallenges.forEach(id => this.challenges.delete(id));
  }
}

/**
 * Biometric Voting Integration
 * Integrates biometric authentication with the voting system
 */
export class BiometricVotingIntegration {
  private authManager: BiometricAuthManager;
  private voterCredentials: Map<string, BiometricCredential[]>;

  constructor(rpId?: string, rpName?: string) {
    this.authManager = new BiometricAuthManager(rpId, rpName);
    this.voterCredentials = new Map();
  }

  /**
   * Register voter with biometric authentication
   * @param voterId Voter identifier
   * @param voterName Voter name
   * @param voterDisplayName Voter display name
   * @returns Registration challenge
   */
  registerVoterBiometric(voterId: string, voterName: string, voterDisplayName: string) {
    return this.authManager.generateRegistrationChallenge(voterId, voterName, voterDisplayName);
  }

  /**
   * Complete voter biometric registration
   * @param voterId Voter identifier
   * @param registrationResponse WebAuthn registration response
   * @returns Registration result
   */
  async completeVoterRegistration(voterId: string, registrationResponse: any) {
    const result = await this.authManager.verifyRegistration(voterId, registrationResponse);
    
    if (result.verified && result.credential) {
      const existingCredentials = this.voterCredentials.get(voterId) || [];
      existingCredentials.push(result.credential);
      this.voterCredentials.set(voterId, existingCredentials);
    }

    return result;
  }

  /**
   * Authenticate voter for voting
   * @param voterId Voter identifier
   * @param electionId Election identifier
   * @returns Authentication challenge
   */
  authenticateVoterForVoting(voterId: string, electionId: string) {
    const credentials = this.voterCredentials.get(voterId) || [];
    const credentialIds = credentials.map(cred => cred.id);
    
    if (credentialIds.length === 0) {
      throw new Error('No biometric credentials registered for voter');
    }

    return this.authManager.generateAuthenticationChallenge(credentialIds);
  }

  /**
   * Verify voter authentication and generate voting token
   * @param voterId Voter identifier
   * @param electionId Election identifier
   * @param authenticationResponse WebAuthn authentication response
   * @returns Verification result and voting token
   */
  async verifyVoterAuthentication(
    voterId: string,
    electionId: string,
    authenticationResponse: any
  ): Promise<{
    verified: boolean;
    votingToken?: string;
    errors?: string[];
  }> {
    const credentials = this.voterCredentials.get(voterId) || [];
    const matchingCredential = credentials.find(cred => cred.id === authenticationResponse.id);

    if (!matchingCredential) {
      return { verified: false, errors: ['Credential not found'] };
    }

    const result = await this.authManager.verifyAuthentication(authenticationResponse, matchingCredential);

    if (result.verified) {
      // Update counter
      matchingCredential.counter = result.counter;
      
      // Generate voting token
      const votingToken = this.authManager.generateVoterToken(voterId, electionId, result.credentialId);
      
      return { verified: true, votingToken };
    }

    return { verified: false, errors: result.errors };
  }

  /**
   * Verify voting token before allowing vote cast
   * @param votingToken Voting token
   * @param electionId Election identifier
   * @returns Token verification result
   */
  verifyVotingToken(votingToken: string, electionId: string) {
    return this.authManager.verifyVoterToken(votingToken, electionId);
  }

  /**
   * Get voter's registered credentials
   * @param voterId Voter identifier
   * @returns Array of registered credentials
   */
  getVoterCredentials(voterId: string): BiometricCredential[] {
    return this.voterCredentials.get(voterId) || [];
  }

  /**
   * Remove voter credential
   * @param voterId Voter identifier
   * @param credentialId Credential ID to remove
   * @returns Success status
   */
  removeVoterCredential(voterId: string, credentialId: string): boolean {
    const credentials = this.voterCredentials.get(voterId) || [];
    const filteredCredentials = credentials.filter(cred => cred.id !== credentialId);
    
    if (filteredCredentials.length < credentials.length) {
      this.voterCredentials.set(voterId, filteredCredentials);
      return true;
    }
    
    return false;
  }
}
