/**
 * Comprehensive API Testing Suite
 * Tests all voting API endpoints with various scenarios
 */

const request = require('supertest');
const { expect } = require('chai');
const app = require('../src/api/server');

describe('Voting API Tests', () => {
    let server;
    let apiKey = 'test-api-key';
    let orgId = 'test-org-123';
    let electionId;
    let voterId = 'voter-test-123';

    before(async () => {
        // Start test server
        server = app.listen(0);
        process.env.NODE_ENV = 'test';
    });

    after(async () => {
        if (server) {
            server.close();
        }
    });

    describe('Health Check', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/api/v1/health')
                .expect(200);

            expect(response.body).to.have.property('status', 'healthy');
            expect(response.body).to.have.property('timestamp');
            expect(response.body).to.have.property('uptime');
        });
    });

    describe('Authentication', () => {
        it('should reject requests without API key', async () => {
            const response = await request(app)
                .get('/api/v1/elections')
                .expect(401);

            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('API key');
        });

        it('should reject requests without organization ID', async () => {
            const response = await request(app)
                .get('/api/v1/elections')
                .set('X-API-Key', apiKey)
                .expect(401);

            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('Organization ID');
        });

        it('should accept requests with valid credentials', async () => {
            const response = await request(app)
                .get('/api/v1/elections')
                .set('X-API-Key', apiKey)
                .set('X-Organization-ID', orgId)
                .expect(200);

            expect(response.body).to.have.property('success', true);
        });
    });

    describe('Elections Management', () => {
        const validElection = {
            title: 'Test Election',
            description: 'A test election for automated testing',
            candidates: [
                {
                    id: 'candidate-1',
                    name: 'Alice Johnson',
                    description: 'Experienced leader'
                },
                {
                    id: 'candidate-2',
                    name: 'Bob Smith',
                    description: 'Innovation focused'
                }
            ],
            startDate: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
            endDate: new Date(Date.now() + 86400000).toISOString() // 1 day from now
        };

        describe('GET /elections', () => {
            it('should return elections list', async () => {
                const response = await request(app)
                    .get('/api/v1/elections')
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .expect(200);

                expect(response.body).to.have.property('success', true);
                expect(response.body).to.have.property('data');
                expect(response.body.data).to.have.property('elections');
                expect(response.body.data.elections).to.be.an('array');
            });

            it('should support filtering by status', async () => {
                const response = await request(app)
                    .get('/api/v1/elections?status=active')
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .expect(200);

                expect(response.body.success).to.be.true;
            });

            it('should support pagination', async () => {
                const response = await request(app)
                    .get('/api/v1/elections?page=1&limit=5')
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .expect(200);

                expect(response.body.success).to.be.true;
                expect(response.body.data).to.have.property('pagination');
            });
        });

        describe('POST /elections', () => {
            it('should create new election with valid data', async () => {
                const response = await request(app)
                    .post('/api/v1/elections')
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .send(validElection)
                    .expect(201);

                expect(response.body).to.have.property('success', true);
                expect(response.body.data).to.have.property('election');
                expect(response.body.data.election).to.have.property('id');
                
                electionId = response.body.data.election.id;
            });

            it('should reject election without title', async () => {
                const invalidElection = { ...validElection };
                delete invalidElection.title;

                const response = await request(app)
                    .post('/api/v1/elections')
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .send(invalidElection)
                    .expect(400);

                expect(response.body).to.have.property('success', false);
                expect(response.body).to.have.property('errors');
            });

            it('should reject election with insufficient candidates', async () => {
                const invalidElection = {
                    ...validElection,
                    candidates: [validElection.candidates[0]]
                };

                const response = await request(app)
                    .post('/api/v1/elections')
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .send(invalidElection)
                    .expect(400);

                expect(response.body.success).to.be.false;
            });

            it('should reject election with invalid date range', async () => {
                const invalidElection = {
                    ...validElection,
                    startDate: new Date(Date.now() + 86400000).toISOString(),
                    endDate: new Date(Date.now() + 60000).toISOString()
                };

                const response = await request(app)
                    .post('/api/v1/elections')
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .send(invalidElection)
                    .expect(400);

                expect(response.body.success).to.be.false;
            });
        });

        describe('GET /elections/:id', () => {
            it('should return specific election', async () => {
                const response = await request(app)
                    .get(`/api/v1/elections/${electionId}`)
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .expect(200);

                expect(response.body.success).to.be.true;
                expect(response.body.data.election).to.have.property('id', electionId);
                expect(response.body.data.election).to.have.property('title');
                expect(response.body.data.election).to.have.property('candidates');
            });

            it('should return 404 for non-existent election', async () => {
                const response = await request(app)
                    .get('/api/v1/elections/non-existent-id')
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .expect(404);

                expect(response.body.success).to.be.false;
            });
        });
    });

    describe('Voting Operations', () => {
        const validVote = {
            candidateId: 'candidate-1',
            voterId: voterId
        };

        describe('POST /elections/:id/vote', () => {
            it('should cast valid vote', async () => {
                // Wait for election to start
                await new Promise(resolve => setTimeout(resolve, 2000));

                const response = await request(app)
                    .post(`/api/v1/elections/${electionId}/vote`)
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .send(validVote)
                    .expect(200);

                expect(response.body.success).to.be.true;
                expect(response.body.data).to.have.property('transactionHash');
                expect(response.body.data).to.have.property('blockNumber');
            });

            it('should reject duplicate vote from same voter', async () => {
                const response = await request(app)
                    .post(`/api/v1/elections/${electionId}/vote`)
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .send(validVote)
                    .expect(400);

                expect(response.body.success).to.be.false;
                expect(response.body.error).to.include('already voted');
            });

            it('should reject vote without candidate ID', async () => {
                const invalidVote = { voterId: 'voter-test-456' };

                const response = await request(app)
                    .post(`/api/v1/elections/${electionId}/vote`)
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .send(invalidVote)
                    .expect(400);

                expect(response.body.success).to.be.false;
            });

            it('should reject vote for non-existent candidate', async () => {
                const invalidVote = {
                    candidateId: 'non-existent-candidate',
                    voterId: 'voter-test-789'
                };

                const response = await request(app)
                    .post(`/api/v1/elections/${electionId}/vote`)
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .send(invalidVote)
                    .expect(400);

                expect(response.body.success).to.be.false;
            });
        });

        describe('GET /elections/:id/results', () => {
            it('should return election results', async () => {
                const response = await request(app)
                    .get(`/api/v1/elections/${electionId}/results`)
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .expect(200);

                expect(response.body.success).to.be.true;
                expect(response.body.data).to.have.property('results');
                expect(response.body.data.results).to.have.property('candidates');
                expect(response.body.data.results).to.have.property('totalVotes');
                expect(response.body.data.results.candidates).to.be.an('array');
            });

            it('should include vote counts for each candidate', async () => {
                const response = await request(app)
                    .get(`/api/v1/elections/${electionId}/results`)
                    .set('X-API-Key', apiKey)
                    .set('X-Organization-ID', orgId)
                    .expect(200);

                const candidates = response.body.data.results.candidates;
                candidates.forEach(candidate => {
                    expect(candidate).to.have.property('id');
                    expect(candidate).to.have.property('name');
                    expect(candidate).to.have.property('votes');
                    expect(candidate.votes).to.be.a('number');
                });
            });
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limits', async () => {
            const requests = [];
            
            // Make multiple rapid requests
            for (let i = 0; i < 110; i++) {
                requests.push(
                    request(app)
                        .get('/api/v1/health')
                        .set('X-API-Key', apiKey)
                        .set('X-Organization-ID', orgId)
                );
            }

            const responses = await Promise.all(requests);
            const rateLimitedResponses = responses.filter(res => res.status === 429);
            
            expect(rateLimitedResponses.length).to.be.greaterThan(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed JSON', async () => {
            const response = await request(app)
                .post('/api/v1/elections')
                .set('X-API-Key', apiKey)
                .set('X-Organization-ID', orgId)
                .set('Content-Type', 'application/json')
                .send('{ invalid json }')
                .expect(400);

            expect(response.body).to.have.property('success', false);
        });

        it('should handle missing content-type', async () => {
            const response = await request(app)
                .post('/api/v1/elections')
                .set('X-API-Key', apiKey)
                .set('X-Organization-ID', orgId)
                .send('some data')
                .expect(400);

            expect(response.body.success).to.be.false;
        });
    });

    describe('CORS Headers', () => {
        it('should include proper CORS headers', async () => {
            const response = await request(app)
                .options('/api/v1/elections')
                .set('Origin', 'https://example.com')
                .expect(200);

            expect(response.headers).to.have.property('access-control-allow-origin');
            expect(response.headers).to.have.property('access-control-allow-methods');
            expect(response.headers).to.have.property('access-control-allow-headers');
        });
    });

    describe('Security Headers', () => {
        it('should include security headers', async () => {
            const response = await request(app)
                .get('/api/v1/health')
                .expect(200);

            expect(response.headers).to.have.property('x-content-type-options');
            expect(response.headers).to.have.property('x-frame-options');
            expect(response.headers).to.have.property('x-xss-protection');
        });
    });
});
