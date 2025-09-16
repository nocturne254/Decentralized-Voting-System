"""
Enhanced API Endpoints
Extends existing FastAPI endpoints with new feature support
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime
import hashlib
import json

# Import existing dependencies
from .main import get_db_connection, verify_token

router = APIRouter()

# Pydantic Models for Enhanced Features

class EnhancedCandidateCreate(BaseModel):
    name: str
    election_id: str
    title: Optional[str] = None
    affiliation: Optional[str] = None
    short_summary: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}

class EnhancedCandidateResponse(BaseModel):
    id: str
    name: str
    election_id: str
    title: Optional[str]
    affiliation: Optional[str]
    short_summary: Optional[str]
    metadata: Dict[str, Any]
    photo_url: Optional[str]
    photo_thumbnail_url: Optional[str]
    photo_alt_text: Optional[str]
    manifesto_id: Optional[str]
    manifesto_published: Optional[bool]
    pledge_count: int
    created_at: datetime
    updated_at: datetime

class ManifestoCreate(BaseModel):
    candidate_id: str
    tenant_id: str
    content: str
    pledges: Optional[List[Dict[str, Any]]] = []

class ManifestoResponse(BaseModel):
    manifesto_id: str
    candidate_id: str
    content: str
    version: int
    hash: str
    published: bool
    published_at: Optional[datetime]
    pledges: List[Dict[str, Any]]
    attachments: List[Dict[str, Any]]

class PledgeRatingCreate(BaseModel):
    candidate_id: str
    pledge_id: str
    score: int = Field(..., ge=0, le=100)
    rating_period: str

class TallyConfigurationCreate(BaseModel):
    tenant_id: str
    election_id: str
    mode: str = Field(..., regex="^(live|delayed|admin_only|disabled)$")
    delay_minutes: Optional[int] = 0
    enable_deltas: bool = True
    delta_interval: int = 5

class VoteConfirmationCreate(BaseModel):
    candidate_id: str
    candidate_name: str
    grace_period_seconds: int = 20

# Enhanced Candidate Endpoints

@router.post("/candidates/enhanced", response_model=EnhancedCandidateResponse)
async def create_enhanced_candidate(
    candidate: EnhancedCandidateCreate,
    db=Depends(get_db_connection),
    current_user=Depends(verify_token)
):
    """Create enhanced candidate with additional metadata"""
    try:
        candidate_id = str(uuid.uuid4())
        
        query = """
        INSERT INTO candidates (id, name, election_id, title, affiliation, short_summary, metadata)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """
        
        cursor = db.cursor()
        cursor.execute(query, (
            candidate_id,
            candidate.name,
            candidate.election_id,
            candidate.title,
            candidate.affiliation,
            candidate.short_summary,
            json.dumps(candidate.metadata)
        ))
        
        result = cursor.fetchone()
        db.commit()
        
        # Get enhanced candidate data
        return await get_enhanced_candidate(candidate_id, db)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create candidate: {str(e)}")

@router.get("/candidates/{candidate_id}/enhanced", response_model=EnhancedCandidateResponse)
async def get_enhanced_candidate(candidate_id: str, db=Depends(get_db_connection)):
    """Get enhanced candidate with all related data"""
    try:
        query = """
        SELECT * FROM enhanced_candidates WHERE id = %s
        """
        
        cursor = db.cursor()
        cursor.execute(query, (candidate_id,))
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Convert to response model
        columns = [desc[0] for desc in cursor.description]
        candidate_data = dict(zip(columns, result))
        
        return EnhancedCandidateResponse(**candidate_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get candidate: {str(e)}")

@router.post("/candidates/{candidate_id}/photo")
async def upload_candidate_photo(
    candidate_id: str,
    photo: UploadFile = File(...),
    alt_text: str = Form(...),
    db=Depends(get_db_connection),
    current_user=Depends(verify_token)
):
    """Upload candidate photo with processing"""
    try:
        # Validate file
        if not photo.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        if photo.size > 5 * 1024 * 1024:  # 5MB limit
            raise HTTPException(status_code=400, detail="File too large (max 5MB)")
        
        # Read file content
        content = await photo.read()
        
        # Generate hash
        file_hash = hashlib.sha256(content).hexdigest()
        
        # In production, process and store images (resize, compress, upload to CDN)
        # For now, simulate URLs
        base_url = f"/api/photos/{candidate_id}/{file_hash}"
        original_url = f"{base_url}/original.jpg"
        thumbnail_url = f"{base_url}/thumb.jpg"
        medium_url = f"{base_url}/medium.jpg"
        
        # Store photo record
        photo_query = """
        INSERT INTO candidate_photos (candidate_id, original_url, thumbnail_url, medium_url, hash, alt_text, file_size, mime_type)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (hash) DO UPDATE SET
            alt_text = EXCLUDED.alt_text,
            uploaded_at = CURRENT_TIMESTAMP
        RETURNING *
        """
        
        cursor = db.cursor()
        cursor.execute(photo_query, (
            candidate_id,
            original_url,
            thumbnail_url,
            medium_url,
            file_hash,
            alt_text,
            len(content),
            photo.content_type
        ))
        
        photo_result = cursor.fetchone()
        
        # Update candidate with photo reference
        update_query = """
        UPDATE candidates SET 
            photo_url = %s,
            photo_hash = %s,
            photo_alt_text = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        """
        
        cursor.execute(update_query, (original_url, file_hash, alt_text, candidate_id))
        db.commit()
        
        return {
            "message": "Photo uploaded successfully",
            "photo_url": original_url,
            "thumbnail_url": thumbnail_url,
            "hash": file_hash
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to upload photo: {str(e)}")

# Manifesto Endpoints

@router.post("/manifestos", response_model=ManifestoResponse)
async def create_manifesto(
    manifesto: ManifestoCreate,
    db=Depends(get_db_connection),
    current_user=Depends(verify_token)
):
    """Create candidate manifesto"""
    try:
        manifesto_id = f"manifesto_{manifesto.candidate_id}_{int(datetime.now().timestamp())}"
        
        # Calculate content hash
        content_hash = hashlib.sha256(manifesto.content.encode()).hexdigest()
        
        # Get next version number
        version_query = """
        SELECT COALESCE(MAX(version), 0) + 1 as next_version
        FROM candidate_manifestos
        WHERE candidate_id = %s
        """
        
        cursor = db.cursor()
        cursor.execute(version_query, (manifesto.candidate_id,))
        version = cursor.fetchone()[0]
        
        # Insert manifesto
        manifesto_query = """
        INSERT INTO candidate_manifestos (manifesto_id, candidate_id, tenant_id, content, version, hash)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING *
        """
        
        cursor.execute(manifesto_query, (
            manifesto_id,
            manifesto.candidate_id,
            manifesto.tenant_id,
            manifesto.content,
            version,
            content_hash
        ))
        
        manifesto_result = cursor.fetchone()
        
        # Insert pledges if provided
        pledge_results = []
        for pledge_data in manifesto.pledges:
            pledge_id = f"pledge_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
            
            pledge_query = """
            INSERT INTO manifesto_pledges (pledge_id, manifesto_id, title, description, category, priority)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING *
            """
            
            cursor.execute(pledge_query, (
                pledge_id,
                manifesto_id,
                pledge_data.get('title', ''),
                pledge_data.get('description', ''),
                pledge_data.get('category', 'general'),
                pledge_data.get('priority', 'medium')
            ))
            
            pledge_results.append(dict(zip([desc[0] for desc in cursor.description], cursor.fetchone())))
        
        # Update candidate with manifesto reference
        update_query = """
        UPDATE candidates SET manifesto_id = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        """
        
        cursor.execute(update_query, (manifesto_id, manifesto.candidate_id))
        db.commit()
        
        # Return response
        columns = [desc[0] for desc in cursor.description]
        manifesto_data = dict(zip(columns, manifesto_result))
        manifesto_data['pledges'] = pledge_results
        manifesto_data['attachments'] = []
        
        return ManifestoResponse(**manifesto_data)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create manifesto: {str(e)}")

@router.put("/manifestos/{manifesto_id}/publish")
async def publish_manifesto(
    manifesto_id: str,
    db=Depends(get_db_connection),
    current_user=Depends(verify_token)
):
    """Publish manifesto"""
    try:
        query = """
        UPDATE candidate_manifestos 
        SET published = true, published_at = CURRENT_TIMESTAMP
        WHERE manifesto_id = %s
        RETURNING *
        """
        
        cursor = db.cursor()
        cursor.execute(query, (manifesto_id,))
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Manifesto not found")
        
        db.commit()
        
        # TODO: Anchor content hash on blockchain
        
        return {"message": "Manifesto published successfully"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to publish manifesto: {str(e)}")

# Live Tally Endpoints

@router.post("/tally/configure")
async def configure_tally(
    config: TallyConfigurationCreate,
    db=Depends(get_db_connection),
    current_user=Depends(verify_token)
):
    """Configure live tally for election"""
    try:
        query = """
        INSERT INTO tally_configurations (tenant_id, election_id, mode, delay_minutes, enable_deltas, delta_interval)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (tenant_id, election_id) DO UPDATE SET
            mode = EXCLUDED.mode,
            delay_minutes = EXCLUDED.delay_minutes,
            enable_deltas = EXCLUDED.enable_deltas,
            delta_interval = EXCLUDED.delta_interval,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
        """
        
        cursor = db.cursor()
        cursor.execute(query, (
            config.tenant_id,
            config.election_id,
            config.mode,
            config.delay_minutes,
            config.enable_deltas,
            config.delta_interval
        ))
        
        result = cursor.fetchone()
        db.commit()
        
        return {"message": "Tally configuration updated successfully"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to configure tally: {str(e)}")

@router.get("/tally/{election_id}")
async def get_live_tally(
    election_id: str,
    role: str = "voter",
    db=Depends(get_db_connection)
):
    """Get current live tally for election"""
    try:
        # Check tally configuration
        config_query = """
        SELECT * FROM tally_configurations 
        WHERE election_id = %s
        """
        
        cursor = db.cursor()
        cursor.execute(config_query, (election_id,))
        config = cursor.fetchone()
        
        if not config:
            raise HTTPException(status_code=404, detail="Tally configuration not found")
        
        mode = config[3]  # mode column
        
        # Check access permissions
        if mode == 'disabled':
            raise HTTPException(status_code=403, detail="Tally disabled for this election")
        
        if mode == 'admin_only' and role != 'admin':
            raise HTTPException(status_code=403, detail="Tally access restricted to admins")
        
        # Get latest tally data
        tally_query = """
        SELECT * FROM tally_history 
        WHERE election_id = %s 
        ORDER BY timestamp DESC 
        LIMIT 1
        """
        
        cursor.execute(tally_query, (election_id,))
        tally_result = cursor.fetchone()
        
        if not tally_result:
            return {
                "election_id": election_id,
                "total_votes": 0,
                "candidates": [],
                "last_update": None
            }
        
        columns = [desc[0] for desc in cursor.description]
        tally_data = dict(zip(columns, tally_result))
        
        return {
            "election_id": election_id,
            "total_votes": tally_data['total_votes'],
            "candidates": json.loads(tally_data['candidate_data']),
            "deltas": json.loads(tally_data.get('deltas', '[]')),
            "last_update": tally_data['timestamp']
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tally: {str(e)}")

# Performance Tracking Endpoints

@router.post("/ratings")
async def submit_pledge_rating(
    rating: PledgeRatingCreate,
    rater_id: str,
    tenant_id: str,
    db=Depends(get_db_connection),
    current_user=Depends(verify_token)
):
    """Submit pledge performance rating"""
    try:
        # Check rate limiting
        rate_limit_query = """
        SELECT count FROM rate_limits 
        WHERE rater_id = %s AND tenant_id = %s AND action_type = 'rating'
        AND reset_time > CURRENT_TIMESTAMP
        """
        
        cursor = db.cursor()
        cursor.execute(rate_limit_query, (rater_id, tenant_id))
        rate_limit = cursor.fetchone()
        
        if rate_limit and rate_limit[0] >= 10:  # Default limit
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        
        # Check for existing rating
        existing_query = """
        SELECT id FROM pledge_ratings 
        WHERE tenant_id = %s AND pledge_id = %s AND rater_id = %s AND rating_period = %s
        """
        
        cursor.execute(existing_query, (
            tenant_id,
            rating.pledge_id,
            rater_id,
            rating.rating_period
        ))
        
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Rating already submitted for this period")
        
        # Insert rating
        rating_id = f"rating_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
        
        insert_query = """
        INSERT INTO pledge_ratings (rating_id, tenant_id, candidate_id, pledge_id, rater_id, score, rating_period)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """
        
        cursor.execute(insert_query, (
            rating_id,
            tenant_id,
            rating.candidate_id,
            rating.pledge_id,
            rater_id,
            rating.score,
            rating.rating_period
        ))
        
        # Update rate limit
        rate_limit_upsert = """
        INSERT INTO rate_limits (rater_id, tenant_id, action_type, count, reset_time)
        VALUES (%s, %s, 'rating', 1, CURRENT_DATE + INTERVAL '1 day')
        ON CONFLICT (rater_id, tenant_id, action_type) DO UPDATE SET
            count = rate_limits.count + 1
        """
        
        cursor.execute(rate_limit_upsert, (rater_id, tenant_id))
        
        # Update performance cache (simplified)
        update_performance_query = """
        INSERT INTO pledge_performances (pledge_id, candidate_id, average_score, total_ratings)
        VALUES (%s, %s, %s, 1)
        ON CONFLICT (pledge_id) DO UPDATE SET
            average_score = (pledge_performances.average_score * pledge_performances.total_ratings + %s) / (pledge_performances.total_ratings + 1),
            total_ratings = pledge_performances.total_ratings + 1,
            last_updated = CURRENT_TIMESTAMP
        """
        
        cursor.execute(update_performance_query, (
            rating.pledge_id,
            rating.candidate_id,
            rating.score,
            rating.score
        ))
        
        db.commit()
        
        return {"message": "Rating submitted successfully", "rating_id": rating_id}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to submit rating: {str(e)}")

@router.get("/candidates/{candidate_id}/performance")
async def get_candidate_performance(
    candidate_id: str,
    tenant_id: str,
    db=Depends(get_db_connection)
):
    """Get candidate performance summary"""
    try:
        query = """
        SELECT * FROM candidate_performance_summary 
        WHERE candidate_id = %s
        """
        
        cursor = db.cursor()
        cursor.execute(query, (candidate_id,))
        result = cursor.fetchone()
        
        if not result:
            return {
                "candidate_id": candidate_id,
                "overall_score": 0,
                "total_pledges": 0,
                "total_ratings": 0,
                "pledge_performances": []
            }
        
        columns = [desc[0] for desc in cursor.description]
        performance_data = dict(zip(columns, result))
        
        # Get detailed pledge performances
        pledge_query = """
        SELECT pp.*, mp.title, mp.description, mp.category
        FROM pledge_performances pp
        JOIN manifesto_pledges mp ON pp.pledge_id = mp.pledge_id
        WHERE pp.candidate_id = %s
        """
        
        cursor.execute(pledge_query, (candidate_id,))
        pledge_results = cursor.fetchall()
        
        pledge_columns = [desc[0] for desc in cursor.description]
        pledge_performances = [dict(zip(pledge_columns, row)) for row in pledge_results]
        
        performance_data['pledge_performances'] = pledge_performances
        
        return performance_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get performance: {str(e)}")

# Vote Enhancement Endpoints

@router.post("/votes/confirm")
async def create_vote_confirmation(
    confirmation: VoteConfirmationCreate,
    db=Depends(get_db_connection),
    current_user=Depends(verify_token)
):
    """Create vote confirmation with grace period"""
    try:
        vote_id = f"vote_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
        grace_period_end = datetime.now().timestamp() + confirmation.grace_period_seconds
        
        query = """
        INSERT INTO vote_confirmations (vote_id, candidate_id, candidate_name, grace_period_end)
        VALUES (%s, %s, %s, to_timestamp(%s))
        RETURNING *
        """
        
        cursor = db.cursor()
        cursor.execute(query, (
            vote_id,
            confirmation.candidate_id,
            confirmation.candidate_name,
            grace_period_end
        ))
        
        result = cursor.fetchone()
        db.commit()
        
        columns = [desc[0] for desc in cursor.description]
        confirmation_data = dict(zip(columns, result))
        
        return confirmation_data
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create confirmation: {str(e)}")

@router.put("/votes/{vote_id}/undo")
async def undo_vote(
    vote_id: str,
    db=Depends(get_db_connection),
    current_user=Depends(verify_token)
):
    """Undo vote during grace period"""
    try:
        query = """
        UPDATE vote_confirmations 
        SET undone = true 
        WHERE vote_id = %s 
        AND grace_period_end > CURRENT_TIMESTAMP 
        AND confirmed = false 
        AND undone = false
        RETURNING *
        """
        
        cursor = db.cursor()
        cursor.execute(query, (vote_id,))
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=400, detail="Cannot undo vote (expired or already processed)")
        
        db.commit()
        
        return {"message": "Vote undone successfully"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to undo vote: {str(e)}")

# Tenant Configuration Endpoints

@router.post("/tenants/configure")
async def configure_tenant(
    tenant_config: Dict[str, Any],
    db=Depends(get_db_connection),
    current_user=Depends(verify_token)
):
    """Configure tenant features and settings"""
    try:
        query = """
        INSERT INTO tenant_configurations (tenant_id, organization_name, features, settings, data_region)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (tenant_id) DO UPDATE SET
            organization_name = EXCLUDED.organization_name,
            features = EXCLUDED.features,
            settings = EXCLUDED.settings,
            data_region = EXCLUDED.data_region,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
        """
        
        cursor = db.cursor()
        cursor.execute(query, (
            tenant_config['tenant_id'],
            tenant_config['organization_name'],
            json.dumps(tenant_config['features']),
            json.dumps(tenant_config['settings']),
            tenant_config.get('data_region', 'global')
        ))
        
        result = cursor.fetchone()
        db.commit()
        
        return {"message": "Tenant configured successfully"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to configure tenant: {str(e)}")

@router.get("/tenants/{tenant_id}/config")
async def get_tenant_config(
    tenant_id: str,
    db=Depends(get_db_connection)
):
    """Get tenant configuration"""
    try:
        query = """
        SELECT * FROM tenant_configurations WHERE tenant_id = %s
        """
        
        cursor = db.cursor()
        cursor.execute(query, (tenant_id,))
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Tenant configuration not found")
        
        columns = [desc[0] for desc in cursor.description]
        config_data = dict(zip(columns, result))
        
        # Parse JSON fields
        config_data['features'] = json.loads(config_data['features'])
        config_data['settings'] = json.loads(config_data['settings'])
        
        return config_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tenant config: {str(e)}")

# Health Check and Status Endpoints

@router.get("/health/enhanced")
async def enhanced_health_check(db=Depends(get_db_connection)):
    """Enhanced health check for new features"""
    try:
        cursor = db.cursor()
        
        # Check database tables
        tables_to_check = [
            'candidate_photos', 'candidate_manifestos', 'manifesto_pledges',
            'tally_configurations', 'vote_commitments', 'pledge_ratings',
            'tenant_configurations'
        ]
        
        table_status = {}
        for table in tables_to_check:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            table_status[table] = {"exists": True, "count": count}
        
        return {
            "status": "healthy",
            "enhanced_features": "enabled",
            "database_tables": table_status,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
