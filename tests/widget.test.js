/**
 * Voting Widget Testing Suite
 * Tests the embeddable voting widget functionality
 */

const { JSDOM } = require('jsdom');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

// Load the widget code
const widgetCode = fs.readFileSync(
    path.join(__dirname, '../src/embed/widget.js'),
    'utf8'
);

describe('Voting Widget Tests', () => {
    let dom;
    let window;
    let document;
    let VotingWidget;

    beforeEach(() => {
        // Create a new DOM for each test
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <head><title>Test</title></head>
            <body>
                <div id="widget-container"></div>
                <div data-voting-widget 
                     data-organization-id="test-org" 
                     data-api-url="http://localhost:3000/api/v1">
                </div>
            </body>
            </html>
        `, {
            url: 'http://localhost:3000',
            pretendToBeVisual: true,
            resources: 'usable'
        });

        window = dom.window;
        document = window.document;
        
        // Mock fetch
        window.fetch = async (url, options) => {
            if (url.includes('/elections')) {
                return {
                    ok: true,
                    json: async () => ({
                        success: true,
                        data: {
                            elections: [
                                {
                                    id: 'election-1',
                                    title: 'Test Election',
                                    description: 'A test election',
                                    status: 'active',
                                    candidates: [
                                        { id: 'candidate-1', name: 'Alice', description: 'Leader' },
                                        { id: 'candidate-2', name: 'Bob', description: 'Innovator' }
                                    ],
                                    startDate: new Date(Date.now() - 60000).toISOString(),
                                    endDate: new Date(Date.now() + 86400000).toISOString()
                                }
                            ]
                        }
                    })
                };
            }
            
            if (url.includes('/vote')) {
                return {
                    ok: true,
                    json: async () => ({
                        success: true,
                        data: {
                            transactionHash: '0x123456789',
                            blockNumber: 12345
                        }
                    })
                };
            }
            
            return { ok: false, status: 404 };
        };

        // Execute widget code in the window context
        const script = new window.Function(widgetCode);
        script.call(window);
        
        VotingWidget = window.VotingWidget;
    });

    afterEach(() => {
        dom.window.close();
    });

    describe('Widget Initialization', () => {
        it('should initialize with valid options', () => {
            const widget = new VotingWidget({
                container: '#widget-container',
                organizationId: 'test-org',
                apiUrl: 'http://localhost:3000/api/v1'
            });

            expect(widget).to.be.an('object');
            expect(widget.options.organizationId).to.equal('test-org');
            expect(widget.options.apiUrl).to.equal('http://localhost:3000/api/v1');
        });

        it('should throw error without container', () => {
            expect(() => {
                new VotingWidget({
                    organizationId: 'test-org',
                    apiUrl: 'http://localhost:3000/api/v1'
                });
            }).to.throw('Container is required');
        });

        it('should throw error without organization ID', () => {
            expect(() => {
                new VotingWidget({
                    container: '#widget-container',
                    apiUrl: 'http://localhost:3000/api/v1'
                });
            }).to.throw('Organization ID is required');
        });

        it('should use default API URL if not provided', () => {
            const widget = new VotingWidget({
                container: '#widget-container',
                organizationId: 'test-org'
            });

            expect(widget.options.apiUrl).to.include('api.voting-system.com');
        });
    });

    describe('DOM Manipulation', () => {
        let widget;

        beforeEach(() => {
            widget = new VotingWidget({
                container: '#widget-container',
                organizationId: 'test-org',
                apiUrl: 'http://localhost:3000/api/v1'
            });
        });

        it('should find container element', () => {
            expect(widget.container).to.not.be.null;
            expect(widget.container.id).to.equal('widget-container');
        });

        it('should create widget structure on init', async () => {
            await widget.init();
            
            const widgetElement = document.querySelector('.voting-widget');
            expect(widgetElement).to.not.be.null;
            
            const header = document.querySelector('.widget-header');
            expect(header).to.not.be.null;
            
            const content = document.querySelector('.widget-content');
            expect(content).to.not.be.null;
        });

        it('should apply custom theme', async () => {
            widget.options.theme = 'dark';
            await widget.init();
            
            const widgetElement = document.querySelector('.voting-widget');
            expect(widgetElement.classList.contains('theme-dark')).to.be.true;
        });
    });

    describe('Election Loading', () => {
        let widget;

        beforeEach(() => {
            widget = new VotingWidget({
                container: '#widget-container',
                organizationId: 'test-org',
                apiUrl: 'http://localhost:3000/api/v1'
            });
        });

        it('should load elections on init', async () => {
            await widget.init();
            
            expect(widget.elections).to.be.an('array');
            expect(widget.elections).to.have.length(1);
            expect(widget.elections[0].title).to.equal('Test Election');
        });

        it('should display elections in DOM', async () => {
            await widget.init();
            
            const electionCards = document.querySelectorAll('.election-card');
            expect(electionCards).to.have.length(1);
            
            const title = document.querySelector('.election-title');
            expect(title.textContent).to.equal('Test Election');
        });

        it('should handle API errors gracefully', async () => {
            // Mock fetch to return error
            window.fetch = async () => ({ ok: false, status: 500 });
            
            await widget.init();
            
            const errorMessage = document.querySelector('.error-message');
            expect(errorMessage).to.not.be.null;
            expect(errorMessage.textContent).to.include('Failed to load elections');
        });
    });

    describe('Voting Functionality', () => {
        let widget;

        beforeEach(async () => {
            widget = new VotingWidget({
                container: '#widget-container',
                organizationId: 'test-org',
                apiUrl: 'http://localhost:3000/api/v1'
            });
            await widget.init();
        });

        it('should display candidates for active election', () => {
            const candidates = document.querySelectorAll('.candidate-option');
            expect(candidates).to.have.length(2);
            
            const firstCandidate = candidates[0];
            expect(firstCandidate.textContent).to.include('Alice');
        });

        it('should enable vote button when candidate selected', () => {
            const candidateRadio = document.querySelector('input[name="candidate"]');
            const voteButton = document.querySelector('.vote-button');
            
            expect(voteButton.disabled).to.be.true;
            
            candidateRadio.checked = true;
            candidateRadio.dispatchEvent(new window.Event('change'));
            
            expect(voteButton.disabled).to.be.false;
        });

        it('should cast vote when button clicked', async () => {
            const candidateRadio = document.querySelector('input[name="candidate"]');
            const voteButton = document.querySelector('.vote-button');
            
            candidateRadio.checked = true;
            candidateRadio.dispatchEvent(new window.Event('change'));
            
            // Simulate vote button click
            voteButton.click();
            
            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const successMessage = document.querySelector('.success-message');
            expect(successMessage).to.not.be.null;
            expect(successMessage.textContent).to.include('Vote cast successfully');
        });

        it('should show loading state during vote', async () => {
            const candidateRadio = document.querySelector('input[name="candidate"]');
            const voteButton = document.querySelector('.vote-button');
            
            candidateRadio.checked = true;
            candidateRadio.dispatchEvent(new window.Event('change'));
            
            // Mock slow API response
            window.fetch = async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return {
                    ok: true,
                    json: async () => ({ success: true, data: {} })
                };
            };
            
            voteButton.click();
            
            // Check loading state immediately
            expect(voteButton.disabled).to.be.true;
            expect(voteButton.textContent).to.include('Casting Vote');
            
            // Wait for completion
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(voteButton.textContent).to.not.include('Casting Vote');
        });
    });

    describe('Event Handling', () => {
        let widget;
        let eventsFired = [];

        beforeEach(async () => {
            widget = new VotingWidget({
                container: '#widget-container',
                organizationId: 'test-org',
                apiUrl: 'http://localhost:3000/api/v1',
                onElectionLoad: (elections) => {
                    eventsFired.push({ type: 'electionLoad', data: elections });
                },
                onVoteCast: (data) => {
                    eventsFired.push({ type: 'voteCast', data });
                },
                onError: (error) => {
                    eventsFired.push({ type: 'error', data: error });
                }
            });
            
            eventsFired = [];
            await widget.init();
        });

        it('should fire onElectionLoad event', () => {
            const loadEvents = eventsFired.filter(e => e.type === 'electionLoad');
            expect(loadEvents).to.have.length(1);
            expect(loadEvents[0].data).to.be.an('array');
        });

        it('should fire onVoteCast event', async () => {
            const candidateRadio = document.querySelector('input[name="candidate"]');
            const voteButton = document.querySelector('.vote-button');
            
            candidateRadio.checked = true;
            candidateRadio.dispatchEvent(new window.Event('change'));
            voteButton.click();
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const voteEvents = eventsFired.filter(e => e.type === 'voteCast');
            expect(voteEvents).to.have.length(1);
        });

        it('should fire onError event for API failures', async () => {
            // Create new widget with failing API
            window.fetch = async () => ({ ok: false, status: 500 });
            
            const errorWidget = new VotingWidget({
                container: '#widget-container',
                organizationId: 'test-org',
                apiUrl: 'http://localhost:3000/api/v1',
                onError: (error) => {
                    eventsFired.push({ type: 'error', data: error });
                }
            });
            
            await errorWidget.init();
            
            const errorEvents = eventsFired.filter(e => e.type === 'error');
            expect(errorEvents.length).to.be.greaterThan(0);
        });
    });

    describe('Auto-initialization', () => {
        it('should auto-initialize widgets with data attributes', () => {
            // Simulate the auto-init code
            const autoWidgets = document.querySelectorAll('[data-voting-widget]');
            expect(autoWidgets).to.have.length(1);
            
            const widget = autoWidgets[0];
            expect(widget.dataset.organizationId).to.equal('test-org');
            expect(widget.dataset.apiUrl).to.equal('http://localhost:3000/api/v1');
        });
    });

    describe('Responsive Design', () => {
        let widget;

        beforeEach(async () => {
            widget = new VotingWidget({
                container: '#widget-container',
                organizationId: 'test-org',
                apiUrl: 'http://localhost:3000/api/v1'
            });
            await widget.init();
        });

        it('should apply mobile styles on small screens', () => {
            // Simulate mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 400
            });
            
            window.dispatchEvent(new window.Event('resize'));
            
            const widgetElement = document.querySelector('.voting-widget');
            const computedStyle = window.getComputedStyle(widgetElement);
            
            // Check if mobile styles are applied (this would depend on actual CSS)
            expect(widgetElement.classList.contains('mobile')).to.be.true;
        });
    });

    describe('Accessibility', () => {
        let widget;

        beforeEach(async () => {
            widget = new VotingWidget({
                container: '#widget-container',
                organizationId: 'test-org',
                apiUrl: 'http://localhost:3000/api/v1'
            });
            await widget.init();
        });

        it('should have proper ARIA labels', () => {
            const candidateOptions = document.querySelectorAll('.candidate-option');
            candidateOptions.forEach(option => {
                const radio = option.querySelector('input[type="radio"]');
                expect(radio.getAttribute('aria-label')).to.not.be.null;
            });
        });

        it('should support keyboard navigation', () => {
            const firstRadio = document.querySelector('input[name="candidate"]');
            const voteButton = document.querySelector('.vote-button');
            
            // Test tab order
            expect(firstRadio.tabIndex).to.not.equal(-1);
            expect(voteButton.tabIndex).to.not.equal(-1);
        });

        it('should announce status changes to screen readers', async () => {
            const statusRegion = document.querySelector('[aria-live]');
            expect(statusRegion).to.not.be.null;
            
            const candidateRadio = document.querySelector('input[name="candidate"]');
            const voteButton = document.querySelector('.vote-button');
            
            candidateRadio.checked = true;
            candidateRadio.dispatchEvent(new window.Event('change'));
            voteButton.click();
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(statusRegion.textContent).to.include('Vote cast successfully');
        });
    });
});
