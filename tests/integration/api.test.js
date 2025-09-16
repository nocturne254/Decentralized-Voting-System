/**
 * Integration Tests for Enhanced API Endpoints
 */

const request = require('supertest');
const { expect } = require('chai');

const API_BASE = process.env.API_URL || 'http://localhost:8000';

describe('Enhanced API Integration Tests', () => {
  let authToken;
  let candidateId;
  let manifestoId;
  let electionId;

  before(async () => {
    // Setup test data
    electionId = 'test_election_001';
    candidateId = 'test_candidate_001';
  });

  describe('Authentication', () => {
    it('should login successfully', async () => {
      const response = await request(API_BASE)
        .post('/api/login')
        .send({
          voterId: 'test_voter',
          password: 'test_password'
        });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('token');
      authToken = response.body.token;
    });

    it('should reject invalid credentials', async () => {
      const response = await request(API_BASE)
        .post('/api/login')
        .send({
          voterId: 'invalid_user',
          password: 'wrong_password'
        });

      expect(response.status).to.equal(401);
    });
  });

  describe('Enhanced Candidate Endpoints', () => {
    it('should create enhanced candidate', async () => {
      const response = await request(API_BASE)
        .post('/api/candidates/enhanced')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Candidate',
          election_id: electionId,
          title: 'Student Representative',
          affiliation: 'Student Union',
          short_summary: 'Experienced leader committed to student welfare',
          metadata: {
            experience: '3 years',
            education: 'Computer Science'
          }
        });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('id');
      candidateId = response.body.id;
    });

    it('should get enhanced candidate', async () => {
      const response = await request(API_BASE)
        .get(`/api/candidates/${candidateId}/enhanced`);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('name', 'Test Candidate');
      expect(response.body).to.have.property('title', 'Student Representative');
    });

    it('should upload candidate photo', async () => {
      const response = await request(API_BASE)
        .post(`/api/candidates/${candidateId}/photo`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photo', Buffer.from('fake-image-data'), 'test.jpg')
        .field('alt_text', 'Professional headshot of candidate');

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('photo_url');
    });
  });

  describe('Manifesto System', () => {
    it('should create manifesto', async () => {
      const response = await request(API_BASE)
        .post('/api/manifestos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          candidate_id: candidateId,
          tenant_id: 'test_tenant',
          content: '# My Vision\n\nI pledge to improve student facilities and advocate for better resources.',
          pledges: [
            {
              title: 'Improve Library Hours',
              description: 'Extend library hours to 24/7 during exam periods',
              category: 'facilities',
              priority: 'high'
            }
          ]
        });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('manifesto_id');
      manifestoId = response.body.manifesto_id;
    });

    it('should publish manifesto', async () => {
      const response = await request(API_BASE)
        .put(`/api/manifestos/${manifestoId}/publish`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).to.equal(200);
      expect(response.body.message).to.include('published');
    });
  });

  describe('Live Tally System', () => {
    it('should configure tally', async () => {
      const response = await request(API_BASE)
        .post('/api/tally/configure')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tenant_id: 'test_tenant',
          election_id: electionId,
          mode: 'live',
          delay_minutes: 0,
          enable_deltas: true,
          delta_interval: 5
        });

      expect(response.status).to.equal(200);
    });

    it('should get live tally', async () => {
      const response = await request(API_BASE)
        .get(`/api/tally/${electionId}`)
        .query({ role: 'admin' });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('election_id', electionId);
      expect(response.body).to.have.property('total_votes');
    });
  });

  describe('Performance Tracking', () => {
    it('should submit pledge rating', async () => {
      const response = await request(API_BASE)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          candidate_id: candidateId,
          pledge_id: 'pledge_001',
          score: 85,
          rating_period: '2024-Q1'
        })
        .query({
          rater_id: 'test_rater',
          tenant_id: 'test_tenant'
        });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('rating_id');
    });

    it('should get candidate performance', async () => {
      const response = await request(API_BASE)
        .get(`/api/candidates/${candidateId}/performance`)
        .query({ tenant_id: 'test_tenant' });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('candidate_id', candidateId);
    });
  });

  describe('Vote Enhancement', () => {
    it('should create vote confirmation', async () => {
      const response = await request(API_BASE)
        .post('/api/votes/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          candidate_id: candidateId,
          candidate_name: 'Test Candidate',
          grace_period_seconds: 20
        });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('vote_id');
    });
  });

  describe('Tenant Configuration', () => {
    it('should configure tenant', async () => {
      const response = await request(API_BASE)
        .post('/api/tenants/configure')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tenant_id: 'test_tenant',
          organization_name: 'Test University',
          features: {
            candidate_photos: true,
            manifestos: true,
            live_tally: true,
            performance_tracking: true
          },
          settings: {
            max_photo_size: 5242880,
            grace_period_seconds: 20
          },
          data_region: 'us-east-1'
        });

      expect(response.status).to.equal(200);
    });

    it('should get tenant config', async () => {
      const response = await request(API_BASE)
        .get('/api/tenants/test_tenant/config');

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('tenant_id', 'test_tenant');
      expect(response.body.features).to.have.property('candidate_photos', true);
    });
  });

  describe('Health Checks', () => {
    it('should return enhanced health status', async () => {
      const response = await request(API_BASE)
        .get('/api/health/enhanced');

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('status', 'healthy');
      expect(response.body).to.have.property('enhanced_features', 'enabled');
    });
  });

  describe('Error Handling', () => {
    it('should handle unauthorized access', async () => {
      const response = await request(API_BASE)
        .post('/api/candidates/enhanced')
        .send({
          name: 'Unauthorized Candidate',
          election_id: electionId
        });

      expect(response.status).to.equal(401);
    });

    it('should handle invalid data', async () => {
      const response = await request(API_BASE)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          candidate_id: candidateId,
          pledge_id: 'pledge_001',
          score: 150, // Invalid score > 100
          rating_period: '2024-Q1'
        });

      expect(response.status).to.equal(422);
    });

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(15).fill().map(() =>
        request(API_BASE)
          .post('/api/ratings')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            candidate_id: candidateId,
            pledge_id: 'pledge_002',
            score: 75,
            rating_period: '2024-Q1'
          })
          .query({
            rater_id: 'test_rater',
            tenant_id: 'test_tenant'
          })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).to.be.greaterThan(0);
    });
  });
});
