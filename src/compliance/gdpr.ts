/**
 * GDPR Compliance System for Blockchain Voting
 * Implements data protection, pseudonymization, and privacy-by-design
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export interface PersonalData {
  id: string;
  type: 'voter_identity' | 'contact_info' | 'audit_log' | 'biometric_template';
  data: any;
  pseudonym: string;
  encrypted: boolean;
  consentGiven: boolean;
  consentTimestamp: number;
  retentionPeriod: number; // in milliseconds
  lawfulBasis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests';
}

export interface DataSubjectRequest {
  id: string;
  subjectId: string;
  type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestDate: number;
  completionDate?: number;
  reason?: string;
}

export interface ConsentRecord {
  subjectId: string;
  purpose: string;
  consentGiven: boolean;
  timestamp: number;
  version: string;
  withdrawalDate?: number;
  ipAddress: string;
  userAgent: string;
}

/**
 * GDPR Compliance Manager
 * Handles all aspects of GDPR compliance for the voting system
 */
export class GDPRComplianceManager {
  private readonly encryptionKey: Buffer;
  private personalDataStore: Map<string, PersonalData>;
  private pseudonymMap: Map<string, string>; // pseudonym -> original ID
  private consentRecords: Map<string, ConsentRecord[]>;
  private dataRequests: Map<string, DataSubjectRequest>;

  constructor(encryptionKey?: string) {
    this.encryptionKey = Buffer.from(encryptionKey || process.env.GDPR_ENCRYPTION_KEY || randomBytes(32).toString('hex'), 'hex');
    this.personalDataStore = new Map();
    this.pseudonymMap = new Map();
    this.consentRecords = new Map();
    this.dataRequests = new Map();
  }

  /**
   * Store personal data with GDPR compliance
   * @param data Personal data to store
   * @param consentGiven Whether consent was given
   * @param lawfulBasis Legal basis for processing
   * @param retentionDays Retention period in days
   * @returns Pseudonymized identifier
   */
  storePersonalData(
    data: any,
    type: PersonalData['type'],
    consentGiven: boolean,
    lawfulBasis: PersonalData['lawfulBasis'],
    retentionDays: number = 365
  ): string {
    const id = randomBytes(16).toString('hex');
    const pseudonym = this.generatePseudonym(id);
    
    // Encrypt sensitive data
    const encryptedData = this.encryptData(JSON.stringify(data));
    
    const personalData: PersonalData = {
      id,
      type,
      data: encryptedData,
      pseudonym,
      encrypted: true,
      consentGiven,
      consentTimestamp: Date.now(),
      retentionPeriod: retentionDays * 24 * 60 * 60 * 1000,
      lawfulBasis
    };

    this.personalDataStore.set(id, personalData);
    this.pseudonymMap.set(pseudonym, id);

    return pseudonym;
  }

  /**
   * Retrieve personal data using pseudonym
   * @param pseudonym Pseudonymized identifier
   * @returns Decrypted personal data or null
   */
  getPersonalData(pseudonym: string): any | null {
    const originalId = this.pseudonymMap.get(pseudonym);
    if (!originalId) return null;

    const personalData = this.personalDataStore.get(originalId);
    if (!personalData) return null;

    // Check if data has expired
    if (this.isDataExpired(personalData)) {
      this.deletePersonalData(pseudonym);
      return null;
    }

    // Decrypt and return data
    if (personalData.encrypted) {
      const decryptedData = this.decryptData(personalData.data);
      return JSON.parse(decryptedData);
    }

    return personalData.data;
  }

  /**
   * Record consent for data processing
   * @param subjectId Data subject identifier
   * @param purpose Purpose of data processing
   * @param consentGiven Whether consent was given
   * @param version Consent version
   * @param ipAddress User's IP address
   * @param userAgent User's browser info
   */
  recordConsent(
    subjectId: string,
    purpose: string,
    consentGiven: boolean,
    version: string,
    ipAddress: string,
    userAgent: string
  ): void {
    const consentRecord: ConsentRecord = {
      subjectId,
      purpose,
      consentGiven,
      timestamp: Date.now(),
      version,
      ipAddress,
      userAgent
    };

    const existingRecords = this.consentRecords.get(subjectId) || [];
    existingRecords.push(consentRecord);
    this.consentRecords.set(subjectId, existingRecords);
  }

  /**
   * Withdraw consent for data processing
   * @param subjectId Data subject identifier
   * @param purpose Purpose to withdraw consent for
   */
  withdrawConsent(subjectId: string, purpose: string): void {
    const records = this.consentRecords.get(subjectId) || [];
    const latestRecord = records
      .filter(r => r.purpose === purpose && r.consentGiven)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (latestRecord) {
      latestRecord.withdrawalDate = Date.now();
      
      // Mark related personal data for erasure if consent was the lawful basis
      this.markDataForErasureOnConsentWithdrawal(subjectId, purpose);
    }
  }

  /**
   * Handle data subject access request (Article 15)
   * @param subjectId Data subject identifier
   * @returns All personal data for the subject
   */
  handleAccessRequest(subjectId: string): {
    personalData: any[];
    consentRecords: ConsentRecord[];
    processingPurposes: string[];
    retentionPeriods: { [key: string]: number };
  } {
    const requestId = this.createDataSubjectRequest(subjectId, 'access');
    
    // Collect all personal data for the subject
    const personalData: any[] = [];
    const processingPurposes: string[] = [];
    const retentionPeriods: { [key: string]: number } = {};

    for (const [id, data] of this.personalDataStore.entries()) {
      if (this.isDataRelatedToSubject(data, subjectId)) {
        const decryptedData = data.encrypted ? 
          JSON.parse(this.decryptData(data.data)) : data.data;
        
        personalData.push({
          type: data.type,
          data: decryptedData,
          lawfulBasis: data.lawfulBasis,
          consentGiven: data.consentGiven,
          processingDate: new Date(data.consentTimestamp).toISOString()
        });

        processingPurposes.push(data.type);
        retentionPeriods[data.type] = data.retentionPeriod;
      }
    }

    const consentRecords = this.consentRecords.get(subjectId) || [];

    this.completeDataSubjectRequest(requestId);

    return {
      personalData,
      consentRecords,
      processingPurposes: [...new Set(processingPurposes)],
      retentionPeriods
    };
  }

  /**
   * Handle data erasure request (Article 17 - Right to be Forgotten)
   * @param subjectId Data subject identifier
   * @param reason Reason for erasure
   * @returns Erasure result
   */
  handleErasureRequest(subjectId: string, reason: string): {
    erased: boolean;
    itemsErased: number;
    itemsRetained: number;
    retentionReasons: string[];
  } {
    const requestId = this.createDataSubjectRequest(subjectId, 'erasure');
    
    let itemsErased = 0;
    let itemsRetained = 0;
    const retentionReasons: string[] = [];

    // Find and erase personal data
    const dataToErase: string[] = [];
    
    for (const [id, data] of this.personalDataStore.entries()) {
      if (this.isDataRelatedToSubject(data, subjectId)) {
        // Check if data can be erased
        if (this.canEraseData(data)) {
          dataToErase.push(id);
          itemsErased++;
        } else {
          itemsRetained++;
          retentionReasons.push(`${data.type}: ${this.getRetentionReason(data)}`);
        }
      }
    }

    // Perform erasure
    for (const id of dataToErase) {
      const data = this.personalDataStore.get(id);
      if (data) {
        this.pseudonymMap.delete(data.pseudonym);
        this.personalDataStore.delete(id);
      }
    }

    // Erase consent records (unless needed for legal compliance)
    if (reason !== 'legal_compliance') {
      this.consentRecords.delete(subjectId);
    }

    this.completeDataSubjectRequest(requestId);

    return {
      erased: itemsErased > 0,
      itemsErased,
      itemsRetained,
      retentionReasons
    };
  }

  /**
   * Handle data portability request (Article 20)
   * @param subjectId Data subject identifier
   * @returns Portable data in structured format
   */
  handlePortabilityRequest(subjectId: string): {
    data: any;
    format: string;
    exportDate: string;
  } {
    const requestId = this.createDataSubjectRequest(subjectId, 'portability');
    
    const portableData: any = {
      subject: subjectId,
      exportDate: new Date().toISOString(),
      data: {}
    };

    // Collect portable data (only data provided by the subject)
    for (const [id, data] of this.personalDataStore.entries()) {
      if (this.isDataRelatedToSubject(data, subjectId) && this.isDataPortable(data)) {
        const decryptedData = data.encrypted ? 
          JSON.parse(this.decryptData(data.data)) : data.data;
        
        if (!portableData.data[data.type]) {
          portableData.data[data.type] = [];
        }
        
        portableData.data[data.type].push({
          data: decryptedData,
          processingDate: new Date(data.consentTimestamp).toISOString(),
          lawfulBasis: data.lawfulBasis
        });
      }
    }

    this.completeDataSubjectRequest(requestId);

    return {
      data: portableData,
      format: 'JSON',
      exportDate: portableData.exportDate
    };
  }

  /**
   * Pseudonymize voter identity for blockchain storage
   * @param voterIdentity Original voter identity
   * @param electionId Election identifier
   * @returns Pseudonymized identity and mapping
   */
  pseudonymizeVoterIdentity(voterIdentity: string, electionId: string): {
    pseudonym: string;
    commitment: string;
  } {
    // Create deterministic pseudonym for the election
    const pseudonym = createHash('sha256')
      .update(voterIdentity + electionId + this.encryptionKey.toString('hex'))
      .digest('hex');
    
    // Create commitment for zero-knowledge proofs
    const commitment = createHash('sha256')
      .update(pseudonym + randomBytes(32).toString('hex'))
      .digest('hex');

    // Store mapping securely (encrypted)
    const mappingData = {
      originalIdentity: voterIdentity,
      pseudonym,
      electionId,
      timestamp: Date.now()
    };

    this.storePersonalData(
      mappingData,
      'voter_identity',
      true,
      'consent',
      30 // 30 days retention
    );

    return { pseudonym, commitment };
  }

  /**
   * Generate privacy notice for voters
   * @param processingPurposes Array of processing purposes
   * @param retentionPeriod Retention period in days
   * @returns Privacy notice text
   */
  generatePrivacyNotice(processingPurposes: string[], retentionPeriod: number): string {
    return `
PRIVACY NOTICE - DECENTRALIZED VOTING SYSTEM

Data Controller: [Organization Name]
Contact: [Data Protection Officer Email]

WHAT DATA WE COLLECT:
- Voter identity information for eligibility verification
- Biometric data (if biometric authentication is used)
- Voting preferences (pseudonymized on blockchain)
- Technical data (IP addresses, browser information)

PURPOSE OF PROCESSING:
${processingPurposes.map(purpose => `- ${purpose}`).join('\n')}

LAWFUL BASIS:
- Consent (Article 6(1)(a) GDPR)
- Performance of a task carried out in the public interest (Article 6(1)(e) GDPR)

DATA RETENTION:
Your personal data will be retained for ${retentionPeriod} days after the election, 
unless you withdraw consent or request erasure.

YOUR RIGHTS:
- Right of access (Article 15)
- Right to rectification (Article 16)
- Right to erasure (Article 17)
- Right to restrict processing (Article 18)
- Right to data portability (Article 20)
- Right to object (Article 21)

BLOCKCHAIN CONSIDERATIONS:
Voting data is stored on a blockchain for transparency and immutability. 
Personal identifiers are pseudonymized before blockchain storage.

To exercise your rights, contact: [Contact Information]
    `.trim();
  }

  /**
   * Audit GDPR compliance
   * @returns Compliance audit report
   */
  auditCompliance(): {
    compliant: boolean;
    issues: string[];
    recommendations: string[];
    dataInventory: {
      totalRecords: number;
      expiredRecords: number;
      consentWithdrawn: number;
      lawfulBasisBreakdown: { [key: string]: number };
    };
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const lawfulBasisBreakdown: { [key: string]: number } = {};
    let expiredRecords = 0;
    let consentWithdrawn = 0;

    // Audit personal data
    for (const [id, data] of this.personalDataStore.entries()) {
      // Check for expired data
      if (this.isDataExpired(data)) {
        expiredRecords++;
        issues.push(`Expired data not automatically erased: ${id}`);
      }

      // Check consent status
      if (data.lawfulBasis === 'consent' && !data.consentGiven) {
        consentWithdrawn++;
        issues.push(`Data processed without valid consent: ${id}`);
      }

      // Count lawful basis
      lawfulBasisBreakdown[data.lawfulBasis] = (lawfulBasisBreakdown[data.lawfulBasis] || 0) + 1;
    }

    // Check for missing encryption
    const unencryptedSensitiveData = Array.from(this.personalDataStore.values())
      .filter(data => !data.encrypted && this.isSensitiveData(data));
    
    if (unencryptedSensitiveData.length > 0) {
      issues.push(`${unencryptedSensitiveData.length} sensitive data records not encrypted`);
    }

    // Generate recommendations
    if (expiredRecords > 0) {
      recommendations.push('Implement automated data retention and deletion');
    }
    
    if (consentWithdrawn > 0) {
      recommendations.push('Review and erase data where consent has been withdrawn');
    }

    return {
      compliant: issues.length === 0,
      issues,
      recommendations,
      dataInventory: {
        totalRecords: this.personalDataStore.size,
        expiredRecords,
        consentWithdrawn,
        lawfulBasisBreakdown
      }
    };
  }

  // Private helper methods

  private generatePseudonym(originalId: string): string {
    return createHash('sha256').update(originalId + this.encryptionKey.toString('hex')).digest('hex');
  }

  private encryptData(data: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private decryptData(encryptedData: string): string {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private isDataExpired(data: PersonalData): boolean {
    return Date.now() > (data.consentTimestamp + data.retentionPeriod);
  }

  private isDataRelatedToSubject(data: PersonalData, subjectId: string): boolean {
    // This would need to be implemented based on your data structure
    // For now, we'll check if the data contains the subject ID
    try {
      const decryptedData = data.encrypted ? 
        JSON.parse(this.decryptData(data.data)) : data.data;
      return JSON.stringify(decryptedData).includes(subjectId);
    } catch {
      return false;
    }
  }

  private canEraseData(data: PersonalData): boolean {
    // Check if data can be erased based on lawful basis and other factors
    if (data.lawfulBasis === 'legal_obligation') return false;
    if (data.lawfulBasis === 'vital_interests') return false;
    
    // Check if data is needed for legal compliance
    if (data.type === 'audit_log') return false;
    
    return true;
  }

  private getRetentionReason(data: PersonalData): string {
    switch (data.lawfulBasis) {
      case 'legal_obligation':
        return 'Required by law';
      case 'vital_interests':
        return 'Vital interests of data subject';
      default:
        return data.type === 'audit_log' ? 'Audit and compliance requirements' : 'Unknown';
    }
  }

  private isDataPortable(data: PersonalData): boolean {
    // Data is portable if it was provided by the data subject and processed by automated means
    return data.lawfulBasis === 'consent' && 
           ['voter_identity', 'contact_info'].includes(data.type);
  }

  private isSensitiveData(data: PersonalData): boolean {
    return ['biometric_template', 'voter_identity'].includes(data.type);
  }

  private createDataSubjectRequest(subjectId: string, type: DataSubjectRequest['type']): string {
    const requestId = randomBytes(16).toString('hex');
    const request: DataSubjectRequest = {
      id: requestId,
      subjectId,
      type,
      status: 'processing',
      requestDate: Date.now()
    };
    
    this.dataRequests.set(requestId, request);
    return requestId;
  }

  private async completeDataSubjectRequest(requestId: string): Promise<void> {
    const request = this.dataRequests.get(requestId);
    if (request) {
      request.status = 'completed';
      request.completionDate = Date.now();
      if (request.type === 'erasure') {
        await this.deletePersonalData(request.subjectId);
      }
    }
  }

  private async deletePersonalData(subjectId: string): Promise<void> {
    // Implementation for deleting personal data
    console.log(`Deleting personal data for subject: ${subjectId}`);
  }

  private markDataForErasureOnConsentWithdrawal(subjectId: string, purpose: string): void {
    // Mark related personal data for erasure when consent is withdrawn
    for (const [id, data] of this.personalDataStore.entries()) {
      if (data.lawfulBasis === 'consent' && 
          this.isDataRelatedToSubject(data, subjectId) &&
          data.type === purpose) {
        // In a real implementation, you might mark for deletion rather than immediate deletion
        this.personalDataStore.delete(id);
        this.pseudonymMap.delete(data.pseudonym);
      }
    }
  }

  /**
   * Automated cleanup of expired data
   */
  async performAutomatedCleanup(): Promise<{
    deletedRecords: number;
    errors: string[];
  }> {
    const deletedRecords: string[] = [];
    const errors: string[] = [];

    for (const [id, data] of this.personalDataStore.entries()) {
      if (this.isDataExpired(data) && this.canEraseData(data)) {
        try {
          this.personalDataStore.delete(id);
          this.pseudonymMap.delete(data.pseudonym);
          deletedRecords.push(id);
        } catch (error) {
          errors.push(`Failed to delete record ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    return {
      deletedRecords: deletedRecords.length,
      errors
    };
  }
}
