// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title ElectionFactoryV2
 * @dev Modern election factory contract with enhanced security and features
 */
contract ElectionFactoryV2 is Ownable, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;

    struct Candidate {
        uint256 id;
        string name;
        string party;
        uint256 voteCount;
        bool isActive;
    }

    struct Election {
        uint256 id;
        string name;
        uint256 startTime;
        uint256 endTime;
        uint256 candidateCount;
        bool isActive;
        address creator;
        mapping(uint256 => Candidate) candidates;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) voterChoice;
    }

    Counters.Counter private _electionIds;
    mapping(uint256 => Election) public elections;
    mapping(address => bool) public authorizedCreators;
    
    uint256 public constant MAX_CANDIDATES = 20;
    uint256 public constant MIN_ELECTION_DURATION = 1 hours;
    uint256 public constant MAX_ELECTION_DURATION = 30 days;

    event ElectionCreated(
        uint256 indexed electionId,
        string name,
        address indexed creator,
        uint256 startTime,
        uint256 endTime
    );

    event CandidateAdded(
        uint256 indexed electionId,
        uint256 indexed candidateId,
        string name,
        string party
    );

    event VoteCast(
        uint256 indexed electionId,
        uint256 indexed candidateId,
        address indexed voter
    );

    event ElectionEnded(uint256 indexed electionId, uint256 winningCandidateId);

    modifier onlyAuthorized() {
        require(
            authorizedCreators[msg.sender] || msg.sender == owner(),
            "Not authorized to create elections"
        );
        _;
    }

    modifier validElection(uint256 _electionId) {
        require(_electionId > 0 && _electionId <= _electionIds.current(), "Invalid election ID");
        _;
    }

    modifier electionActive(uint256 _electionId) {
        Election storage election = elections[_electionId];
        require(election.isActive, "Election is not active");
        require(block.timestamp >= election.startTime, "Election has not started");
        require(block.timestamp <= election.endTime, "Election has ended");
        _;
    }

    constructor() {
        authorizedCreators[msg.sender] = true;
    }

    /**
     * @dev Create a new election
     */
    function createElection(
        string memory _name,
        uint256 _startTime,
        uint256 _endTime
    ) external onlyAuthorized whenNotPaused nonReentrant returns (uint256) {
        require(bytes(_name).length > 0, "Election name cannot be empty");
        require(_startTime > block.timestamp, "Start time must be in the future");
        require(_endTime > _startTime, "End time must be after start time");
        require(
            _endTime - _startTime >= MIN_ELECTION_DURATION,
            "Election duration too short"
        );
        require(
            _endTime - _startTime <= MAX_ELECTION_DURATION,
            "Election duration too long"
        );

        _electionIds.increment();
        uint256 newElectionId = _electionIds.current();

        Election storage newElection = elections[newElectionId];
        newElection.id = newElectionId;
        newElection.name = _name;
        newElection.startTime = _startTime;
        newElection.endTime = _endTime;
        newElection.isActive = true;
        newElection.creator = msg.sender;

        emit ElectionCreated(newElectionId, _name, msg.sender, _startTime, _endTime);
        return newElectionId;
    }

    /**
     * @dev Add a candidate to an election
     */
    function addCandidate(
        uint256 _electionId,
        string memory _name,
        string memory _party
    ) external validElection(_electionId) whenNotPaused nonReentrant {
        Election storage election = elections[_electionId];
        require(
            msg.sender == election.creator || msg.sender == owner(),
            "Only election creator or owner can add candidates"
        );
        require(block.timestamp < election.startTime, "Cannot add candidates after election starts");
        require(election.candidateCount < MAX_CANDIDATES, "Maximum candidates reached");
        require(bytes(_name).length > 0, "Candidate name cannot be empty");
        require(bytes(_party).length > 0, "Party name cannot be empty");

        election.candidateCount++;
        uint256 candidateId = election.candidateCount;

        election.candidates[candidateId] = Candidate({
            id: candidateId,
            name: _name,
            party: _party,
            voteCount: 0,
            isActive: true
        });

        emit CandidateAdded(_electionId, candidateId, _name, _party);
    }

    /**
     * @dev Cast a vote in an election
     */
    function vote(
        uint256 _electionId,
        uint256 _candidateId
    ) external validElection(_electionId) electionActive(_electionId) whenNotPaused nonReentrant {
        Election storage election = elections[_electionId];
        require(!election.hasVoted[msg.sender], "Already voted in this election");
        require(_candidateId > 0 && _candidateId <= election.candidateCount, "Invalid candidate ID");
        require(election.candidates[_candidateId].isActive, "Candidate is not active");

        election.hasVoted[msg.sender] = true;
        election.voterChoice[msg.sender] = _candidateId;
        election.candidates[_candidateId].voteCount++;

        emit VoteCast(_electionId, _candidateId, msg.sender);
    }

    /**
     * @dev End an election (can be called by anyone after end time)
     */
    function endElection(uint256 _electionId) external validElection(_electionId) whenNotPaused {
        Election storage election = elections[_electionId];
        require(election.isActive, "Election is not active");
        require(block.timestamp > election.endTime, "Election has not ended yet");

        election.isActive = false;

        // Find winning candidate
        uint256 winningCandidateId = 1;
        uint256 maxVotes = election.candidates[1].voteCount;

        for (uint256 i = 2; i <= election.candidateCount; i++) {
            if (election.candidates[i].voteCount > maxVotes) {
                maxVotes = election.candidates[i].voteCount;
                winningCandidateId = i;
            }
        }

        emit ElectionEnded(_electionId, winningCandidateId);
    }

    /**
     * @dev Get election details
     */
    function getElection(uint256 _electionId)
        external
        view
        validElection(_electionId)
        returns (
            uint256 id,
            string memory name,
            uint256 startTime,
            uint256 endTime,
            uint256 candidateCount,
            bool isActive,
            address creator
        )
    {
        Election storage election = elections[_electionId];
        return (
            election.id,
            election.name,
            election.startTime,
            election.endTime,
            election.candidateCount,
            election.isActive,
            election.creator
        );
    }

    /**
     * @dev Get candidate details
     */
    function getCandidate(uint256 _electionId, uint256 _candidateId)
        external
        view
        validElection(_electionId)
        returns (
            uint256 id,
            string memory name,
            string memory party,
            uint256 voteCount,
            bool isActive
        )
    {
        require(_candidateId > 0 && _candidateId <= elections[_electionId].candidateCount, "Invalid candidate ID");
        Candidate storage candidate = elections[_electionId].candidates[_candidateId];
        return (candidate.id, candidate.name, candidate.party, candidate.voteCount, candidate.isActive);
    }

    /**
     * @dev Check if an address has voted in an election
     */
    function hasVoted(uint256 _electionId, address _voter)
        external
        view
        validElection(_electionId)
        returns (bool)
    {
        return elections[_electionId].hasVoted[_voter];
    }

    /**
     * @dev Get voter's choice in an election
     */
    function getVoterChoice(uint256 _electionId, address _voter)
        external
        view
        validElection(_electionId)
        returns (uint256)
    {
        require(elections[_electionId].hasVoted[_voter], "Voter has not voted");
        return elections[_electionId].voterChoice[_voter];
    }

    /**
     * @dev Get total number of elections
     */
    function getElectionCount() external view returns (uint256) {
        return _electionIds.current();
    }

    /**
     * @dev Check if an election is currently active for voting
     */
    function isElectionActive(uint256 _electionId) external view validElection(_electionId) returns (bool) {
        Election storage election = elections[_electionId];
        return election.isActive && 
               block.timestamp >= election.startTime && 
               block.timestamp <= election.endTime;
    }

    /**
     * @dev Authorize an address to create elections
     */
    function authorizeCreator(address _creator) external onlyOwner {
        authorizedCreators[_creator] = true;
    }

    /**
     * @dev Revoke authorization to create elections
     */
    function revokeCreator(address _creator) external onlyOwner {
        authorizedCreators[_creator] = false;
    }

    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency function to deactivate a candidate
     */
    function deactivateCandidate(uint256 _electionId, uint256 _candidateId) 
        external 
        onlyOwner 
        validElection(_electionId) 
    {
        require(_candidateId > 0 && _candidateId <= elections[_electionId].candidateCount, "Invalid candidate ID");
        elections[_electionId].candidates[_candidateId].isActive = false;
    }

    /**
     * @dev Get election results (only after election ends)
     */
    function getElectionResults(uint256 _electionId)
        external
        view
        validElection(_electionId)
        returns (uint256[] memory candidateIds, uint256[] memory voteCounts)
    {
        Election storage election = elections[_electionId];
        require(!election.isActive || block.timestamp > election.endTime, "Election is still active");

        candidateIds = new uint256[](election.candidateCount);
        voteCounts = new uint256[](election.candidateCount);

        for (uint256 i = 1; i <= election.candidateCount; i++) {
            candidateIds[i - 1] = i;
            voteCounts[i - 1] = election.candidates[i].voteCount;
        }
    }
}
