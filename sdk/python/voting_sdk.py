"""
Decentralized Voting System Python SDK
Provides easy integration with the voting API
Version: 1.0.0
"""

import json
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union
from urllib.parse import urlencode
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class VotingSDKError(Exception):
    """Custom exception for SDK errors"""
    
    def __init__(self, message: str, status_code: int = 0, details: Dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class VotingSDK:
    """Main SDK class for interacting with the Voting API"""
    
    def __init__(self, api_key: str, organization_id: str, 
                 api_url: str = "https://api.voting-system.com/api/v1",
                 timeout: int = 10):
        """
        Initialize the Voting SDK
        
        Args:
            api_key: Your API key
            organization_id: Your organization ID
            api_url: Base API URL
            timeout: Request timeout in seconds
        """
        if not api_key:
            raise VotingSDKError("API key is required")
        
        if not organization_id:
            raise VotingSDKError("Organization ID is required")
        
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self.organization_id = organization_id
        self.timeout = timeout
        
        # Setup session with retry strategy
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Default headers
        self.session.headers.update({
            'Content-Type': 'application/json',
            'X-API-Key': self.api_key,
            'X-Organization-ID': self.organization_id,
            'User-Agent': 'VotingSDK-Python/1.0.0'
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict:
        """Make authenticated API request"""
        url = f"{self.api_url}{endpoint}"
        
        try:
            response = self.session.request(
                method=method,
                url=url,
                timeout=self.timeout,
                **kwargs
            )
            
            if not response.ok:
                try:
                    error_data = response.json()
                except json.JSONDecodeError:
                    error_data = {}
                
                raise VotingSDKError(
                    error_data.get('message', f'HTTP {response.status_code}'),
                    response.status_code,
                    error_data
                )
            
            return response.json()
            
        except requests.exceptions.Timeout:
            raise VotingSDKError("Request timeout", 408)
        except requests.exceptions.ConnectionError:
            raise VotingSDKError("Connection error", 0)
        except requests.exceptions.RequestException as e:
            raise VotingSDKError(f"Request error: {str(e)}", 0)

    def get_elections(self, **filters) -> Dict:
        """
        Get all elections with optional filtering
        
        Args:
            **filters: Filter options (status, page, limit, etc.)
            
        Returns:
            Dict containing elections data
        """
        params = {k: v for k, v in filters.items() if v is not None}
        query_string = f"?{urlencode(params)}" if params else ""
        
        return self._request('GET', f'/elections{query_string}')

    def get_election(self, election_id: str) -> Dict:
        """
        Get specific election by ID
        
        Args:
            election_id: Election ID
            
        Returns:
            Dict containing election data
        """
        if not election_id:
            raise VotingSDKError("Election ID is required")
        
        return self._request('GET', f'/elections/{election_id}')

    def create_election(self, election_data: Dict) -> Dict:
        """
        Create new election
        
        Args:
            election_data: Election details
            
        Returns:
            Dict containing created election data
        """
        self._validate_election_data(election_data)
        
        return self._request('POST', '/elections', json=election_data)

    def update_election(self, election_id: str, updates: Dict) -> Dict:
        """
        Update election
        
        Args:
            election_id: Election ID
            updates: Election updates
            
        Returns:
            Dict containing updated election data
        """
        if not election_id:
            raise VotingSDKError("Election ID is required")
        
        return self._request('PUT', f'/elections/{election_id}', json=updates)

    def delete_election(self, election_id: str) -> Dict:
        """
        Delete election
        
        Args:
            election_id: Election ID
            
        Returns:
            Dict containing deletion result
        """
        if not election_id:
            raise VotingSDKError("Election ID is required")
        
        return self._request('DELETE', f'/elections/{election_id}')

    def cast_vote(self, election_id: str, vote_data: Dict) -> Dict:
        """
        Cast vote in election
        
        Args:
            election_id: Election ID
            vote_data: Vote details (candidateId, voterId)
            
        Returns:
            Dict containing vote result
        """
        if not election_id:
            raise VotingSDKError("Election ID is required")
        
        self._validate_vote_data(vote_data)
        
        return self._request('POST', f'/elections/{election_id}/vote', json=vote_data)

    def get_results(self, election_id: str) -> Dict:
        """
        Get election results
        
        Args:
            election_id: Election ID
            
        Returns:
            Dict containing election results
        """
        if not election_id:
            raise VotingSDKError("Election ID is required")
        
        return self._request('GET', f'/elections/{election_id}/results')

    def get_vote_history(self, voter_id: str) -> Dict:
        """
        Get voter's vote history
        
        Args:
            voter_id: Voter ID
            
        Returns:
            Dict containing vote history
        """
        if not voter_id:
            raise VotingSDKError("Voter ID is required")
        
        return self._request('GET', f'/voters/{voter_id}/votes')

    def has_voted(self, election_id: str, voter_id: str) -> bool:
        """
        Check if voter has voted in election
        
        Args:
            election_id: Election ID
            voter_id: Voter ID
            
        Returns:
            Boolean indicating if voter has voted
        """
        if not election_id or not voter_id:
            raise VotingSDKError("Election ID and Voter ID are required")
        
        try:
            result = self._request('GET', f'/elections/{election_id}/voters/{voter_id}/status')
            return result.get('data', {}).get('hasVoted', False)
        except VotingSDKError as e:
            if e.status_code == 404:
                return False
            raise

    def get_health(self) -> Dict:
        """
        Get API health status
        
        Returns:
            Dict containing health status
        """
        return self._request('GET', '/health')

    def _validate_election_data(self, data: Dict) -> None:
        """Validate election data"""
        required_fields = ['title', 'description', 'candidates', 'startDate', 'endDate']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            raise VotingSDKError(f"Missing required fields: {', '.join(missing_fields)}")

        candidates = data.get('candidates', [])
        if not isinstance(candidates, list) or len(candidates) < 2:
            raise VotingSDKError("At least 2 candidates are required")

        try:
            start_date = datetime.fromisoformat(data['startDate'].replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(data['endDate'].replace('Z', '+00:00'))
            
            if start_date >= end_date:
                raise VotingSDKError("End date must be after start date")
        except ValueError as e:
            raise VotingSDKError(f"Invalid date format: {str(e)}")

    def _validate_vote_data(self, data: Dict) -> None:
        """Validate vote data"""
        if not data.get('candidateId'):
            raise VotingSDKError("Candidate ID is required")
        
        if not data.get('voterId'):
            raise VotingSDKError("Voter ID is required")


class VotingUtils:
    """Utility functions for working with voting data"""
    
    @staticmethod
    def format_election(election: Dict) -> Dict:
        """Format election for display"""
        formatted = election.copy()
        
        try:
            formatted['startDate'] = datetime.fromisoformat(
                election['startDate'].replace('Z', '+00:00')
            )
            formatted['endDate'] = datetime.fromisoformat(
                election['endDate'].replace('Z', '+00:00')
            )
            formatted['isActive'] = VotingUtils.is_election_active(election)
            formatted['timeRemaining'] = VotingUtils.get_time_remaining(election['endDate'])
        except (ValueError, KeyError):
            pass
        
        return formatted

    @staticmethod
    def is_election_active(election: Dict) -> bool:
        """Check if election is currently active"""
        try:
            now = datetime.now(timezone.utc)
            start = datetime.fromisoformat(election['startDate'].replace('Z', '+00:00'))
            end = datetime.fromisoformat(election['endDate'].replace('Z', '+00:00'))
            return start <= now <= end
        except (ValueError, KeyError):
            return False

    @staticmethod
    def get_time_remaining(end_date: str) -> Optional[Dict]:
        """Get time remaining in election"""
        try:
            now = datetime.now(timezone.utc)
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            diff = end - now
            
            if diff.total_seconds() <= 0:
                return None
            
            days = diff.days
            hours, remainder = divmod(diff.seconds, 3600)
            minutes, _ = divmod(remainder, 60)
            
            return {
                'days': days,
                'hours': hours,
                'minutes': minutes,
                'total_seconds': int(diff.total_seconds())
            }
        except ValueError:
            return None

    @staticmethod
    def calculate_percentages(results: List[Dict]) -> List[Dict]:
        """Calculate vote percentages"""
        total_votes = sum(candidate.get('votes', 0) for candidate in results)
        
        formatted_results = []
        for candidate in results:
            votes = candidate.get('votes', 0)
            percentage = (votes / total_votes * 100) if total_votes > 0 else 0
            
            formatted_candidate = candidate.copy()
            formatted_candidate['percentage'] = round(percentage, 2)
            formatted_results.append(formatted_candidate)
        
        return formatted_results

    @staticmethod
    def is_valid_email(email: str) -> bool:
        """Validate email format"""
        import re
        pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        return re.match(pattern, email) is not None

    @staticmethod
    def generate_voter_id(prefix: str = "voter") -> str:
        """Generate unique voter ID"""
        import uuid
        timestamp = int(time.time())
        unique_id = str(uuid.uuid4())[:8]
        return f"{prefix}_{timestamp}_{unique_id}"


# Example usage
if __name__ == "__main__":
    # Initialize SDK
    sdk = VotingSDK(
        api_key="your-api-key",
        organization_id="your-org-id",
        api_url="https://api.voting-system.com/api/v1"
    )
    
    try:
        # Get all active elections
        elections = sdk.get_elections(status="active")
        print(f"Found {len(elections.get('data', {}).get('elections', []))} active elections")
        
        # Create new election
        new_election_data = {
            "title": "Student Council Election",
            "description": "Annual student council election",
            "candidates": [
                {"id": "1", "name": "John Doe", "description": "Senior student"},
                {"id": "2", "name": "Jane Smith", "description": "Junior student"}
            ],
            "startDate": "2024-03-01T00:00:00Z",
            "endDate": "2024-03-07T23:59:59Z"
        }
        
        # new_election = sdk.create_election(new_election_data)
        # print(f"Created election: {new_election['data']['id']}")
        
        # Cast vote (uncomment to test)
        # vote_result = sdk.cast_vote("election-id", {
        #     "candidateId": "1",
        #     "voterId": "voter-123"
        # })
        
        # Get results
        # results = sdk.get_results("election-id")
        # formatted_results = VotingUtils.calculate_percentages(
        #     results['data']['candidates']
        # )
        
    except VotingSDKError as e:
        print(f"SDK Error: {e} (Status: {e.status_code})")
    except Exception as e:
        print(f"Unexpected error: {e}")
