# Integration Examples

This document provides practical examples of how organizations can integrate the Decentralized Voting System into their websites and applications.

## Quick Start Examples

### 1. Simple HTML Integration

The easiest way to add voting to your website:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Organization Elections</title>
</head>
<body>
    <h1>Student Council Elections</h1>
    
    <!-- Voting Widget Container -->
    <div id="voting-widget"></div>
    
    <!-- Load the widget script -->
    <script src="https://cdn.voting-system.com/widget.js"></script>
    <script>
        const widget = new VotingWidget({
            container: '#voting-widget',
            organizationId: 'org_university_2024',
            apiUrl: 'https://api.voting-system.com/api/v1',
            theme: 'light'
        });
        
        widget.init();
    </script>
</body>
</html>
```

### 2. Iframe Embed

For the simplest integration without JavaScript:

```html
<iframe 
    src="https://api.voting-system.com/embed/voting-widget?organizationId=org_university_2024&theme=light"
    width="100%" 
    height="600"
    frameborder="0"
    style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
</iframe>
```

### 3. Auto-Initialize with Data Attributes

```html
<div 
    data-voting-widget
    data-organization-id="org_university_2024"
    data-api-url="https://api.voting-system.com/api/v1"
    data-theme="light">
</div>

<script src="https://cdn.voting-system.com/widget.js"></script>
<!-- Widget will auto-initialize -->
```

## Framework-Specific Examples

### React Integration

```jsx
import React, { useEffect, useRef } from 'react';

const VotingWidget = ({ organizationId, theme = 'light' }) => {
    const widgetRef = useRef(null);
    const votingWidgetInstance = useRef(null);

    useEffect(() => {
        // Load the widget script dynamically
        const script = document.createElement('script');
        script.src = 'https://cdn.voting-system.com/widget.js';
        script.onload = () => {
            if (window.VotingWidget && widgetRef.current) {
                votingWidgetInstance.current = new window.VotingWidget({
                    container: widgetRef.current,
                    organizationId,
                    apiUrl: 'https://api.voting-system.com/api/v1',
                    theme
                });
                
                votingWidgetInstance.current.init();
            }
        };
        document.head.appendChild(script);

        return () => {
            // Cleanup
            if (votingWidgetInstance.current) {
                votingWidgetInstance.current.destroy();
            }
            document.head.removeChild(script);
        };
    }, [organizationId, theme]);

    return (
        <div className="voting-widget-container">
            <h2>Elections</h2>
            <div ref={widgetRef} style={{ minHeight: '400px' }}></div>
        </div>
    );
};

export default VotingWidget;
```

### Vue.js Integration

```vue
<template>
    <div class="voting-container">
        <h2>{{ title }}</h2>
        <div ref="votingWidget" class="voting-widget"></div>
    </div>
</template>

<script>
export default {
    name: 'VotingWidget',
    props: {
        organizationId: {
            type: String,
            required: true
        },
        title: {
            type: String,
            default: 'Elections'
        },
        theme: {
            type: String,
            default: 'light'
        }
    },
    data() {
        return {
            widgetInstance: null
        };
    },
    async mounted() {
        await this.loadWidget();
        this.initializeWidget();
    },
    beforeUnmount() {
        if (this.widgetInstance) {
            this.widgetInstance.destroy();
        }
    },
    methods: {
        loadWidget() {
            return new Promise((resolve) => {
                if (window.VotingWidget) {
                    resolve();
                    return;
                }
                
                const script = document.createElement('script');
                script.src = 'https://cdn.voting-system.com/widget.js';
                script.onload = resolve;
                document.head.appendChild(script);
            });
        },
        initializeWidget() {
            this.widgetInstance = new window.VotingWidget({
                container: this.$refs.votingWidget,
                organizationId: this.organizationId,
                apiUrl: 'https://api.voting-system.com/api/v1',
                theme: this.theme
            });
            
            this.widgetInstance.init();
        }
    }
};
</script>

<style scoped>
.voting-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
}

.voting-widget {
    min-height: 400px;
}
</style>
```

### Angular Integration

```typescript
// voting-widget.component.ts
import { Component, Input, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';

declare global {
    interface Window {
        VotingWidget: any;
    }
}

@Component({
    selector: 'app-voting-widget',
    template: `
        <div class="voting-container">
            <h2>{{ title }}</h2>
            <div #votingWidget class="voting-widget"></div>
        </div>
    `,
    styles: [`
        .voting-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .voting-widget {
            min-height: 400px;
        }
    `]
})
export class VotingWidgetComponent implements OnInit, OnDestroy {
    @Input() organizationId!: string;
    @Input() title: string = 'Elections';
    @Input() theme: string = 'light';
    @ViewChild('votingWidget', { static: true }) votingWidgetRef!: ElementRef;

    private widgetInstance: any;

    async ngOnInit() {
        await this.loadWidget();
        this.initializeWidget();
    }

    ngOnDestroy() {
        if (this.widgetInstance) {
            this.widgetInstance.destroy();
        }
    }

    private loadWidget(): Promise<void> {
        return new Promise((resolve) => {
            if (window.VotingWidget) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.voting-system.com/widget.js';
            script.onload = () => resolve();
            document.head.appendChild(script);
        });
    }

    private initializeWidget() {
        this.widgetInstance = new window.VotingWidget({
            container: this.votingWidgetRef.nativeElement,
            organizationId: this.organizationId,
            apiUrl: 'https://api.voting-system.com/api/v1',
            theme: this.theme
        });

        this.widgetInstance.init();
    }
}
```

## API Integration Examples

### Node.js/Express Backend

```javascript
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Configuration
const VOTING_API_URL = 'https://api.voting-system.com/api/v1';
const API_KEY = process.env.VOTING_API_KEY;
const ORG_ID = process.env.ORGANIZATION_ID;

// Middleware for API authentication
const votingApiHeaders = {
    'X-API-Key': API_KEY,
    'X-Organization-ID': ORG_ID,
    'Content-Type': 'application/json'
};

// Get all elections
app.get('/api/elections', async (req, res) => {
    try {
        const response = await axios.get(`${VOTING_API_URL}/elections`, {
            headers: votingApiHeaders,
            params: req.query
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch elections' });
    }
});

// Create new election
app.post('/api/elections', async (req, res) => {
    try {
        const response = await axios.post(`${VOTING_API_URL}/elections`, req.body, {
            headers: votingApiHeaders
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create election' });
    }
});

// Cast vote
app.post('/api/elections/:id/vote', async (req, res) => {
    try {
        const response = await axios.post(
            `${VOTING_API_URL}/elections/${req.params.id}/vote`,
            req.body,
            { headers: votingApiHeaders }
        );
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to cast vote' });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
```

### Python/Django Integration

```python
# views.py
import requests
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json

VOTING_API_URL = 'https://api.voting-system.com/api/v1'
API_HEADERS = {
    'X-API-Key': settings.VOTING_API_KEY,
    'X-Organization-ID': settings.ORGANIZATION_ID,
    'Content-Type': 'application/json'
}

def get_elections(request):
    """Get all elections"""
    try:
        response = requests.get(
            f'{VOTING_API_URL}/elections',
            headers=API_HEADERS,
            params=request.GET
        )
        return JsonResponse(response.json())
    except requests.RequestException:
        return JsonResponse({'error': 'Failed to fetch elections'}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def create_election(request):
    """Create new election"""
    try:
        data = json.loads(request.body)
        response = requests.post(
            f'{VOTING_API_URL}/elections',
            headers=API_HEADERS,
            json=data
        )
        return JsonResponse(response.json())
    except requests.RequestException:
        return JsonResponse({'error': 'Failed to create election'}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def cast_vote(request, election_id):
    """Cast vote in election"""
    try:
        data = json.loads(request.body)
        response = requests.post(
            f'{VOTING_API_URL}/elections/{election_id}/vote',
            headers=API_HEADERS,
            json=data
        )
        return JsonResponse(response.json())
    except requests.RequestException:
        return JsonResponse({'error': 'Failed to cast vote'}, status=500)

# urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('api/elections/', views.get_elections, name='get_elections'),
    path('api/elections/create/', views.create_election, name='create_election'),
    path('api/elections/<int:election_id>/vote/', views.cast_vote, name='cast_vote'),
]
```

## WordPress Plugin Example

```php
<?php
/**
 * Plugin Name: Voting System Integration
 * Description: Integrate decentralized voting into WordPress
 * Version: 1.0.0
 */

class VotingSystemPlugin {
    
    private $api_url = 'https://api.voting-system.com/api/v1';
    private $api_key;
    private $org_id;
    
    public function __construct() {
        $this->api_key = get_option('voting_api_key');
        $this->org_id = get_option('voting_org_id');
        
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_shortcode('voting_widget', array($this, 'voting_widget_shortcode'));
        add_action('wp_ajax_get_elections', array($this, 'get_elections'));
        add_action('wp_ajax_nopriv_get_elections', array($this, 'get_elections'));
    }
    
    public function enqueue_scripts() {
        wp_enqueue_script('voting-widget', 'https://cdn.voting-system.com/widget.js', array(), '1.0.0', true);
    }
    
    public function voting_widget_shortcode($atts) {
        $atts = shortcode_atts(array(
            'theme' => 'light',
            'height' => '600px'
        ), $atts);
        
        $widget_id = 'voting-widget-' . uniqid();
        
        ob_start();
        ?>
        <div id="<?php echo $widget_id; ?>" style="height: <?php echo $atts['height']; ?>"></div>
        <script>
        document.addEventListener('DOMContentLoaded', function() {
            const widget = new VotingWidget({
                container: '#<?php echo $widget_id; ?>',
                organizationId: '<?php echo $this->org_id; ?>',
                apiUrl: '<?php echo $this->api_url; ?>',
                theme: '<?php echo $atts['theme']; ?>'
            });
            widget.init();
        });
        </script>
        <?php
        return ob_get_clean();
    }
    
    public function get_elections() {
        $response = wp_remote_get($this->api_url . '/elections', array(
            'headers' => array(
                'X-API-Key' => $this->api_key,
                'X-Organization-ID' => $this->org_id
            )
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error('Failed to fetch elections');
        }
        
        $body = wp_remote_retrieve_body($response);
        wp_send_json(json_decode($body, true));
    }
}

new VotingSystemPlugin();
?>
```

## Customization Examples

### Custom Styling

```css
/* Override widget styles */
.voting-widget {
    --color-primary: #your-brand-color;
    --color-secondary: #your-secondary-color;
    --font-primary: 'Your Font', sans-serif;
}

.voting-widget .election-card {
    border: 2px solid var(--color-primary);
    background: linear-gradient(135deg, #f8f9fa, #ffffff);
}

.voting-widget .vote-button {
    background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
```

### Custom Event Handling

```javascript
const widget = new VotingWidget({
    container: '#voting-widget',
    organizationId: 'your_org_id',
    apiUrl: 'https://api.voting-system.com/api/v1',
    onVoteCast: function(data) {
        console.log('Vote cast:', data);
        // Send analytics event
        gtag('event', 'vote_cast', {
            'election_id': data.electionId,
            'candidate_id': data.candidateId
        });
    },
    onElectionLoad: function(elections) {
        console.log('Elections loaded:', elections.length);
        // Update page title
        document.title = `${elections.length} Active Elections`;
    },
    onError: function(error) {
        console.error('Widget error:', error);
        // Show user-friendly error message
        showNotification('Voting system temporarily unavailable', 'error');
    }
});
```

## Environment Configuration

### Development Setup

```bash
# .env.development
VITE_INSTITUTION_NAME="Development University"
VITE_INSTITUTION_SHORT_NAME="DEV"
VITE_PRIMARY_COLOR="#3b82f6"
VITE_API_BASE_URL="http://localhost:3000"
```

### Production Setup

```bash
# .env.production
VITE_INSTITUTION_NAME="Your University"
VITE_INSTITUTION_SHORT_NAME="YU"
VITE_PRIMARY_COLOR="#1e40af"
VITE_API_BASE_URL="https://api.voting-system.com"
ALLOWED_ORIGINS="https://youruniversity.edu,https://portal.youruniversity.edu"
```

## Security Best Practices

### API Key Management

```javascript
// ❌ Don't expose API keys in frontend
const widget = new VotingWidget({
    apiKey: 'sk_live_123456789', // NEVER DO THIS
    // ...
});

// ✅ Use your backend as a proxy
const widget = new VotingWidget({
    apiUrl: '/api/voting-proxy', // Your backend endpoint
    // ...
});
```

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' https://cdn.voting-system.com;
    connect-src 'self' https://api.voting-system.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
">
```

## Testing

### Unit Tests

```javascript
// widget.test.js
describe('VotingWidget', () => {
    let widget;
    
    beforeEach(() => {
        document.body.innerHTML = '<div id="test-widget"></div>';
        widget = new VotingWidget({
            container: '#test-widget',
            organizationId: 'test_org',
            apiUrl: 'http://localhost:3000/api/v1'
        });
    });
    
    test('initializes correctly', () => {
        expect(widget.options.organizationId).toBe('test_org');
        expect(widget.container).toBeTruthy();
    });
    
    test('loads elections', async () => {
        // Mock API response
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    success: true,
                    data: { elections: [] }
                })
            })
        );
        
        await widget.loadElections();
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:3000/api/v1/elections?status=active',
            expect.any(Object)
        );
    });
});
```

This comprehensive guide should help organizations integrate the voting system into their existing infrastructure while maintaining security and performance best practices.
