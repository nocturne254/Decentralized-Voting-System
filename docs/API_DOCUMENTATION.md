# Voting System API Documentation

## Overview

The Decentralized Voting System provides a comprehensive REST API that allows organizations to integrate secure blockchain-based voting into their applications and websites. The system is designed to be multi-tenant, allowing multiple organizations to use the same infrastructure with their own branding and configurations.

## Base URL

```
Production: https://api.voting-system.com/api/v1
Development: http://localhost:3000/api/v1
```

## Authentication

All API requests require authentication using API keys. Include the following headers:

```http
X-API-Key: your_api_key_here
X-Organization-ID: your_organization_id
Content-Type: application/json
```

### Getting API Keys

Contact your system administrator or use the organization dashboard to generate API keys. Each organization has unique API keys for security.

## Rate Limiting

- **Limit**: 100 requests per 15-minute window per IP address
- **Headers**: Rate limit information is included in response headers
- **Exceeded**: Returns `429 Too Many Requests` with retry information

## Response Format

All API responses follow this structure:

```json
{
  "success": boolean,
  "data": object | array,
  "error": string (only if success: false),
  "code": string (error code if applicable)
}
```

## Endpoints

### Elections

#### List Elections

```http
GET /elections
```

**Query Parameters:**
- `status` (optional): Filter by status (`active`, `upcoming`, `ended`)
- `limit` (optional): Number of results (1-100, default: 10)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "elections": [
      {
        "id": 1,
        "name": "Student Council Elections 2024",
        "description": "Annual student council elections",
        "startTime": "2024-03-01T09:00:00Z",
        "endTime": "2024-03-01T17:00:00Z",
        "status": "upcoming",
        "candidates": [
          {
            "id": 0,
            "name": "John Doe",
            "description": "Computer Science student",
            "voteCount": 0
          }
        ]
      }
    ],
    "total": 5,
    "limit": 10,
    "offset": 0
  }
}
```

#### Create Election

```http
POST /elections
```

**Request Body:**
```json
{
  "name": "Election Name",
  "description": "Election description (optional)",
  "startTime": "2024-03-01T09:00:00Z",
  "endTime": "2024-03-01T17:00:00Z",
  "candidates": [
    {
      "name": "Candidate Name",
      "description": "Candidate description (optional)",
      "imageUrl": "https://example.com/image.jpg (optional)"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "electionId": 1,
    "name": "Election Name",
    "description": "Election description",
    "startTime": "2024-03-01T09:00:00Z",
    "endTime": "2024-03-01T17:00:00Z",
    "candidates": [...],
    "status": "upcoming"
  }
}
```

#### Get Election Details

```http
GET /elections/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Election Name",
    "description": "Election description",
    "startTime": "2024-03-01T09:00:00Z",
    "endTime": "2024-03-01T17:00:00Z",
    "candidates": [...],
    "totalVotes": 150,
    "status": "active"
  }
}
```

#### Cast Vote

```http
POST /elections/{id}/vote
```

**Request Body:**
```json
{
  "candidateId": 0,
  "voterAddress": "0x742d35Cc6634C0532925a3b8D4C2C7C9C4d5c3e1"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionHash": "0xabc123...",
    "electionId": 1,
    "candidateId": 0,
    "voterAddress": "0x742d35Cc...",
    "timestamp": "2024-03-01T10:30:00Z"
  }
}
```

#### Get Election Results

```http
GET /elections/{id}/results
```

**Response:**
```json
{
  "success": true,
  "data": {
    "electionId": 1,
    "name": "Election Name",
    "totalVotes": 150,
    "candidates": [
      {
        "id": 0,
        "name": "Candidate Name",
        "voteCount": 75,
        "percentage": 50.0
      }
    ],
    "status": "ended",
    "endTime": "2024-03-01T17:00:00Z"
  }
}
```

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-03-01T10:00:00Z",
    "version": "2.0.0",
    "institution": "Your Organization Name",
    "uptime": 86400
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `MISSING_CREDENTIALS` | API key or organization ID missing |
| `INVALID_CREDENTIALS` | Invalid API key or organization ID |
| `VALIDATION_ERROR` | Request validation failed |
| `ELECTION_NOT_FOUND` | Election does not exist |
| `ELECTION_NOT_ACTIVE` | Election is not currently active |
| `ALREADY_VOTED` | Voter has already cast a vote |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

## Embedding Widget

### Basic Iframe Embed

```html
<iframe 
  src="https://api.voting-system.com/embed/voting-widget?organizationId=your_org_id&theme=light"
  width="600" 
  height="400"
  frameborder="0">
</iframe>
```

### JavaScript Integration

```html
<div id="voting-widget"></div>
<script>
  // Load the voting widget
  const widget = new VotingWidget({
    container: '#voting-widget',
    organizationId: 'your_org_id',
    apiUrl: 'https://api.voting-system.com/api/v1',
    theme: 'light'
  });
  
  widget.init();
</script>
```

## SDK Examples

### JavaScript/Node.js

```javascript
const VotingAPI = require('@voting-system/sdk');

const client = new VotingAPI({
  apiKey: 'your_api_key',
  organizationId: 'your_org_id',
  baseUrl: 'https://api.voting-system.com/api/v1'
});

// List elections
const elections = await client.elections.list({ status: 'active' });

// Create election
const election = await client.elections.create({
  name: 'My Election',
  startTime: '2024-03-01T09:00:00Z',
  endTime: '2024-03-01T17:00:00Z',
  candidates: [
    { name: 'Candidate 1' },
    { name: 'Candidate 2' }
  ]
});

// Cast vote
const vote = await client.elections.vote(electionId, {
  candidateId: 0,
  voterAddress: '0x742d35Cc...'
});
```

### Python

```python
from voting_system import VotingAPI

client = VotingAPI(
    api_key='your_api_key',
    organization_id='your_org_id',
    base_url='https://api.voting-system.com/api/v1'
)

# List elections
elections = client.elections.list(status='active')

# Create election
election = client.elections.create({
    'name': 'My Election',
    'startTime': '2024-03-01T09:00:00Z',
    'endTime': '2024-03-01T17:00:00Z',
    'candidates': [
        {'name': 'Candidate 1'},
        {'name': 'Candidate 2'}
    ]
})

# Cast vote
vote = client.elections.vote(election_id, {
    'candidateId': 0,
    'voterAddress': '0x742d35Cc...'
})
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Institution Configuration
VITE_INSTITUTION_NAME="Your Organization"
VITE_INSTITUTION_SHORT_NAME="ORG"
VITE_PRIMARY_COLOR="#1e40af"

# API Configuration
PORT=3000
ALLOWED_ORIGINS=https://yoursite.com,https://app.yoursite.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/voting

# Blockchain
ETHEREUM_NETWORK=mainnet
INFURA_PROJECT_ID=your_infura_id
```

### Customization

The system supports extensive customization:

1. **Branding**: Colors, logos, institution name
2. **Features**: Enable/disable specific voting features
3. **Authentication**: Configure authentication methods
4. **Notifications**: Set up email notifications
5. **Blockchain**: Configure blockchain network settings

## Security

### Best Practices

1. **API Keys**: Keep API keys secure and rotate regularly
2. **HTTPS**: Always use HTTPS in production
3. **Rate Limiting**: Implement client-side rate limiting
4. **Validation**: Validate all user inputs
5. **Monitoring**: Monitor API usage and errors

### Blockchain Security

- All votes are stored on the blockchain for immutability
- Voter addresses are used for authentication
- Double voting is prevented by smart contract logic
- Transaction hashes provide audit trails

## Support

For technical support and questions:

- **Documentation**: [https://docs.voting-system.com](https://docs.voting-system.com)
- **Email**: support@voting-system.com
- **GitHub**: [https://github.com/voting-system/api](https://github.com/voting-system/api)

## Changelog

### v2.0.0 (Current)
- Multi-tenant support
- REST API with comprehensive endpoints
- Embeddable widgets
- Enhanced security and rate limiting
- Production-ready deployment options

### v1.0.0
- Initial release with basic voting functionality
- Single-tenant Murang'a University implementation
