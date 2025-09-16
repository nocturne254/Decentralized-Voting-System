/**
 * Candidate Enhancement System
 * Extends existing candidate functionality with photos, manifestos, and rich content
 */

import { createHash } from 'crypto';

export interface EnhancedCandidate {
  // Existing fields from current system
  id: string;
  name: string;
  electionId: string;
  
  // New enhanced fields
  title?: string;
  affiliation?: string;
  photo?: CandidatePhoto;
  manifestoId?: string;
  shortSummary?: string;
  metadata?: CandidateMetadata;
  createdAt: number;
  updatedAt: number;
}

export interface CandidatePhoto {
  originalUrl: string;
  thumbnailUrl: string;
  mediumUrl: string;
  hash: string;
  altText: string;
  uploadedAt: number;
  fileSize: number;
  mimeType: string;
}

export interface CandidateMetadata {
  age?: number;
  runningMate?: string;
  tagline?: string;
  party?: string;
  experience?: string;
  website?: string;
  socialMedia?: {
    twitter?: string;
    linkedin?: string;
    facebook?: string;
  };
}

export interface CandidateManifesto {
  manifestoId: string;
  candidateId: string;
  tenantId: string;
  content: string; // Sanitized Markdown
  attachedFiles: ManifestoAttachment[];
  version: number;
  hash: string;
  createdAt: number;
  published: boolean;
  publishedAt?: number;
  pledges?: ManifestoPledge[];
}

export interface ManifestoAttachment {
  fileId: string;
  filename: string;
  url: string;
  hash: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: number;
}

export interface ManifestoPledge {
  pledgeId: string;
  title: string;
  description: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  measurable: boolean;
  targetDate?: number;
  createdAt: number;
}

/**
 * Candidate Enhancement Manager
 * Extends existing candidate system with new features
 */
export class CandidateEnhancementManager {
  private candidates: Map<string, EnhancedCandidate> = new Map();
  private manifestos: Map<string, CandidateManifesto> = new Map();
  private photoStorage: PhotoStorageService;
  private manifestoEditor: ManifestoEditorService;

  constructor() {
    this.photoStorage = new PhotoStorageService();
    this.manifestoEditor = new ManifestoEditorService();
  }

  /**
   * Enhance existing candidate with new features
   * @param candidateId Existing candidate ID
   * @param enhancements New candidate data
   */
  async enhanceCandidate(candidateId: string, enhancements: Partial<EnhancedCandidate>): Promise<EnhancedCandidate> {
    let candidate = this.candidates.get(candidateId);
    
    if (!candidate) {
      // Create new enhanced candidate
      candidate = {
        id: candidateId,
        name: enhancements.name || '',
        electionId: enhancements.electionId || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...enhancements
      };
    } else {
      // Update existing candidate
      candidate = {
        ...candidate,
        ...enhancements,
        updatedAt: Date.now()
      };
    }

    this.candidates.set(candidateId, candidate);
    return candidate;
  }

  /**
   * Upload and process candidate photo
   * @param candidateId Candidate ID
   * @param photoFile Photo file data
   * @param altText Accessibility alt text
   */
  async uploadCandidatePhoto(
    candidateId: string, 
    photoFile: File | Buffer, 
    altText: string
  ): Promise<CandidatePhoto> {
    // Validate file
    this.validatePhotoFile(photoFile);
    
    // Process and store photo
    const processedPhoto = await this.photoStorage.processAndStore(photoFile, candidateId);
    
    // Create photo record
    const photo: CandidatePhoto = {
      originalUrl: processedPhoto.originalUrl,
      thumbnailUrl: processedPhoto.thumbnailUrl,
      mediumUrl: processedPhoto.mediumUrl,
      hash: processedPhoto.hash,
      altText: altText,
      uploadedAt: Date.now(),
      fileSize: processedPhoto.fileSize,
      mimeType: processedPhoto.mimeType
    };

    // Update candidate with photo
    const candidate = this.candidates.get(candidateId);
    if (candidate) {
      candidate.photo = photo;
      candidate.updatedAt = Date.now();
      this.candidates.set(candidateId, candidate);
    }

    return photo;
  }

  /**
   * Create or update candidate manifesto
   * @param candidateId Candidate ID
   * @param manifestoData Manifesto content and metadata
   */
  async createManifesto(
    candidateId: string, 
    manifestoData: {
      content: string;
      tenantId: string;
      attachments?: File[];
      pledges?: Omit<ManifestoPledge, 'pledgeId' | 'createdAt'>[];
    }
  ): Promise<CandidateManifesto> {
    const manifestoId = `manifesto_${candidateId}_${Date.now()}`;
    
    // Sanitize content
    const sanitizedContent = this.manifestoEditor.sanitizeContent(manifestoData.content);
    
    // Process attachments
    const attachedFiles: ManifestoAttachment[] = [];
    if (manifestoData.attachments) {
      for (const file of manifestoData.attachments) {
        const attachment = await this.processManifestoAttachment(file, manifestoId);
        attachedFiles.push(attachment);
      }
    }

    // Process pledges
    const pledges: ManifestoPledge[] = [];
    if (manifestoData.pledges) {
      pledges.push(...manifestoData.pledges.map(pledge => ({
        ...pledge,
        pledgeId: `pledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now()
      })));
    }

    // Calculate content hash
    const contentForHash = {
      content: sanitizedContent,
      attachments: attachedFiles.map(f => f.hash),
      pledges: pledges
    };
    const hash = createHash('sha256').update(JSON.stringify(contentForHash)).digest('hex');

    // Get current version
    const existingManifestos = Array.from(this.manifestos.values())
      .filter(m => m.candidateId === candidateId);
    const version = existingManifestos.length + 1;

    const manifesto: CandidateManifesto = {
      manifestoId,
      candidateId,
      tenantId: manifestoData.tenantId,
      content: sanitizedContent,
      attachedFiles,
      version,
      hash,
      createdAt: Date.now(),
      published: false,
      pledges
    };

    this.manifestos.set(manifestoId, manifesto);

    // Update candidate with manifesto reference
    const candidate = this.candidates.get(candidateId);
    if (candidate) {
      candidate.manifestoId = manifestoId;
      candidate.updatedAt = Date.now();
      this.candidates.set(candidateId, candidate);
    }

    return manifesto;
  }

  /**
   * Publish manifesto
   * @param manifestoId Manifesto ID
   */
  async publishManifesto(manifestoId: string): Promise<void> {
    const manifesto = this.manifestos.get(manifestoId);
    if (!manifesto) {
      throw new Error('Manifesto not found');
    }

    manifesto.published = true;
    manifesto.publishedAt = Date.now();
    this.manifestos.set(manifestoId, manifesto);

    // Anchor content hash on blockchain (integrate with existing blockchain module)
    await this.anchorManifestoOnChain(manifesto);
  }

  /**
   * Get enhanced candidate data
   * @param candidateId Candidate ID
   */
  getEnhancedCandidate(candidateId: string): EnhancedCandidate | null {
    return this.candidates.get(candidateId) || null;
  }

  /**
   * Get candidate manifesto
   * @param manifestoId Manifesto ID
   */
  getManifesto(manifestoId: string): CandidateManifesto | null {
    return this.manifestos.get(manifestoId) || null;
  }

  /**
   * Get candidate's current manifesto
   * @param candidateId Candidate ID
   */
  getCurrentManifesto(candidateId: string): CandidateManifesto | null {
    const candidate = this.candidates.get(candidateId);
    if (!candidate?.manifestoId) return null;
    
    return this.manifestos.get(candidate.manifestoId) || null;
  }

  /**
   * Get manifesto versions for candidate
   * @param candidateId Candidate ID
   */
  getManifestoVersions(candidateId: string): CandidateManifesto[] {
    return Array.from(this.manifestos.values())
      .filter(m => m.candidateId === candidateId)
      .sort((a, b) => b.version - a.version);
  }

  /**
   * Generate candidate card data for UI
   * @param candidateId Candidate ID
   */
  generateCandidateCard(candidateId: string): {
    candidate: EnhancedCandidate;
    manifesto?: CandidateManifesto;
    hasPhoto: boolean;
    hasManifesto: boolean;
    pledgeCount: number;
  } | null {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) return null;

    const manifesto = candidate.manifestoId ? this.manifestos.get(candidate.manifestoId) : undefined;

    return {
      candidate,
      manifesto,
      hasPhoto: !!candidate.photo,
      hasManifesto: !!manifesto?.published,
      pledgeCount: manifesto?.pledges?.length || 0
    };
  }

  // Private helper methods

  private validatePhotoFile(file: File | Buffer): void {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (file instanceof File) {
      if (file.size > maxSize) {
        throw new Error('Photo file too large. Maximum size is 5MB.');
      }
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
      }
    } else {
      if (file.length > maxSize) {
        throw new Error('Photo file too large. Maximum size is 5MB.');
      }
    }
  }

  private async processManifestoAttachment(file: File, manifestoId: string): Promise<ManifestoAttachment> {
    // Validate attachment
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'];

    if (file.size > maxSize) {
      throw new Error('Attachment too large. Maximum size is 10MB.');
    }
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid attachment type.');
    }

    // Generate file hash
    const buffer = await file.arrayBuffer();
    const hash = createHash('sha256').update(Buffer.from(buffer)).digest('hex');

    // Store file (integrate with existing storage)
    const url = await this.storeAttachment(file, manifestoId, hash);

    return {
      fileId: `attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filename: file.name,
      url,
      hash,
      fileSize: file.size,
      mimeType: file.type,
      uploadedAt: Date.now()
    };
  }

  private async storeAttachment(file: File, manifestoId: string, hash: string): Promise<string> {
    // Integrate with existing file storage system
    // For now, return a placeholder URL
    return `/api/attachments/${manifestoId}/${hash}`;
  }

  private async anchorManifestoOnChain(manifesto: CandidateManifesto): Promise<void> {
    // Integrate with existing blockchain system to anchor content hash
    console.log(`Anchoring manifesto ${manifesto.manifestoId} with hash ${manifesto.hash} on blockchain`);
  }
}

/**
 * Photo Storage Service
 * Handles photo processing and storage
 */
class PhotoStorageService {
  async processAndStore(file: File | Buffer, candidateId: string): Promise<{
    originalUrl: string;
    thumbnailUrl: string;
    mediumUrl: string;
    hash: string;
    fileSize: number;
    mimeType: string;
  }> {
    // Generate file hash
    const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;
    const hash = createHash('sha256').update(buffer).digest('hex');

    // In production, integrate with image processing service (Sharp, Cloudinary, etc.)
    // For now, return placeholder URLs
    const baseUrl = `/api/photos/${candidateId}/${hash}`;
    
    return {
      originalUrl: `${baseUrl}/original.jpg`,
      thumbnailUrl: `${baseUrl}/thumb.jpg`,
      mediumUrl: `${baseUrl}/medium.jpg`,
      hash,
      fileSize: buffer.length,
      mimeType: file instanceof File ? file.type : 'image/jpeg'
    };
  }
}

/**
 * Manifesto Editor Service
 * Handles content sanitization and processing
 */
class ManifestoEditorService {
  sanitizeContent(content: string): string {
    // Integrate with existing sanitization library (DOMPurify, sanitize-html)
    // For now, basic sanitization
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  convertMarkdownToHtml(markdown: string): string {
    // Integrate with markdown processor (marked, markdown-it)
    // For now, basic conversion
    return markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\n/gim, '<br>');
  }

  extractPledgesFromContent(content: string): Omit<ManifestoPledge, 'pledgeId' | 'createdAt'>[] {
    // Extract pledges from manifesto content using patterns
    const pledgePattern = /(?:^|\n)(?:I pledge|I promise|I will|My commitment):\s*(.+?)(?=\n|$)/gi;
    const pledges: Omit<ManifestoPledge, 'pledgeId' | 'createdAt'>[] = [];
    
    let match;
    while ((match = pledgePattern.exec(content)) !== null) {
      pledges.push({
        title: match[1].trim(),
        description: match[1].trim(),
        category: 'general',
        priority: 'medium',
        measurable: false
      });
    }
    
    return pledges;
  }
}
