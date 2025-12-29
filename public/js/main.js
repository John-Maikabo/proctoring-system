// ProctoringApp.js - Complete Fixed Version with Cross-Network Support
class ProctoringApp {
    constructor() {
        console.log('🚀 ProctoringApp constructor called');
        this.peerConnections = new Map();
        this.localStream = null;
        this.screenStream = null;
        this.signaling = null;
        this.roomId = null;
        this.userId = 'user_' + Math.random().toString(36).substring(2, 10);
        this.userType = null;
        this.userName = '';
        this.isAudioMuted = false;
        this.isVideoHidden = false;
        this.isScreenSharing = false;
        this.participants = new Map();
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.snapshots = [];
        this.remoteStreams = new Map();
        
        // Check for existing proctor session
        this.checkSavedProctorSession();
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    checkSavedProctorSession() {
        const savedRoom = localStorage.getItem('proctorRoom');
        const savedUserId = localStorage.getItem('proctorUserId');
        
        if (savedRoom && savedUserId === this.userId) {
            console.log('🔍 Found saved proctor session for room:', savedRoom);
            this.roomId = savedRoom;
            this.userType = 'proctor';
            this.userName = localStorage.getItem('proctorName') || 'Proctor';
            
            // Update URL to show proctor type
            const url = new URL(window.location);
            url.searchParams.set('room', savedRoom);
            url.searchParams.set('type', 'proctor');
            window.history.replaceState({}, '', url);
            
            // Update name input if exists
            const nameInput = document.getElementById('userName');
            if (nameInput) {
                nameInput.value = this.userName;
            }
        }
    }
    
    init() {
        console.log('🔧 App init called');
        
        setTimeout(() => {
            this.bindEvents();
            this.updateStatus('Ready to start', 'disconnected');
            
            const params = new URLSearchParams(window.location.search);
            const roomId = params.get('room');
            let userType = params.get('type');
            
            // Override with saved proctor session if applicable
            const savedRoom = localStorage.getItem('proctorRoom');
            const savedUserId = localStorage.getItem('proctorUserId');
            
            if (roomId && savedRoom === roomId && savedUserId === this.userId) {
                console.log('🎯 Proctor rejoining their own room, forcing proctor role');
                userType = 'proctor';
                this.userType = 'proctor';
            }
            
            if (roomId && userType) {
                this.roomId = roomId;
                this.userType = userType;
                
                const nameInput = document.getElementById('userName');
                if (nameInput) {
                    const savedName = localStorage.getItem('proctorName');
                    this.userName = savedName || (this.userType === 'proctor' ? 'Proctor' : 'Candidate');
                    nameInput.value = this.userName;
                }
                
                console.log('Auto-joining room:', this.roomId, 'as', this.userType);
                this.joinExistingRoom();
            }
            
            // Show proctor rejoin panel if applicable
            this.showProctorRejoinPanel();
        }, 100);
    }
    
    showProctorRejoinPanel() {
        const savedRoom = localStorage.getItem('proctorRoom');
        const savedUserId = localStorage.getItem('proctorUserId');
        
        if (savedRoom && savedUserId === this.userId) {
            // Create or show rejoin panel
            let panel = document.getElementById('proctorRejoinPanel');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'proctorRejoinPanel';
                panel.className = 'panel';
                panel.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0,0,0,0.9);
                    border: 2px solid #4cc9f0;
                    z-index: 1000;
                    padding: 20px;
                    border-radius: 10px;
                    min-width: 300px;
                `;
                
                panel.innerHTML = `
                    <h3><i class="fas fa-user-shield"></i> Proctor Session Detected</h3>
                    <p>You have an existing proctor session for room: <strong>${savedRoom}</strong></p>
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button id="rejoinAsProctorBtn" class="btn btn-primary">
                            <i class="fas fa-user-shield"></i> Rejoin as Proctor
                        </button>
                        <button id="joinAsCandidateBtn" class="btn btn-secondary">
                            <i class="fas fa-user"></i> Join as Candidate
                        </button>
                        <button id="dismissRejoinBtn" class="btn btn-warning">
                            <i class="fas fa-times"></i> Dismiss
                        </button>
                    </div>
                `;
                
                document.body.appendChild(panel);
                
                document.getElementById('rejoinAsProctorBtn').addEventListener('click', () => {
                    this.roomId = savedRoom;
                    this.userType = 'proctor';
                    this.userName = localStorage.getItem('proctorName') || 'Proctor';
                    this.joinExistingRoom();
                    panel.remove();
                });
                
                document.getElementById('joinAsCandidateBtn').addEventListener('click', () => {
                    localStorage.removeItem('proctorRoom');
                    localStorage.removeItem('proctorUserId');
                    panel.remove();
                });
                
                document.getElementById('dismissRejoinBtn').addEventListener('click', () => {
                    panel.remove();
                });
            }
        }
    }
    
    bindEvents() {
        console.log('🔗 Binding events...');
        
        // Create room button
        const createBtn = document.getElementById('createRoomBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.createRoom());
        }
        
        // Join room button
        const joinBtn = document.getElementById('joinRoomBtn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => this.showJoinModal());
        }
        
        // Start/End call buttons
        document.getElementById('startCallBtn')?.addEventListener('click', () => this.startCall());
        document.getElementById('endCallBtn')?.addEventListener('click', () => this.endCall());
        document.getElementById('copyLinkBtn')?.addEventListener('click', () => this.copyLink());
        document.getElementById('confirmJoinBtn')?.addEventListener('click', () => this.confirmJoin());
        document.getElementById('cancelJoinBtn')?.addEventListener('click', () => this.cancelJoin());
        document.getElementById('toggleAudioBtn')?.addEventListener('click', () => this.toggleAudio());
        document.getElementById('toggleVideoBtn')?.addEventListener('click', () => this.toggleVideo());
        document.getElementById('screenShareBtn')?.addEventListener('click', () => this.toggleScreenShare());
        document.getElementById('snapshotBtn')?.addEventListener('click', () => this.takeSnapshot());
        document.getElementById('recordBtn')?.addEventListener('click', () => this.toggleRecording());
        document.getElementById('sendChatBtn')?.addEventListener('click', () => this.sendChat());
        
        // Chat input Enter key
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendChat();
            });
        }
        
        console.log('✅ All events bound');
    }
    
    updateStatus(text, state = '') {
        const statusText = document.getElementById('statusText');
        const statusIndicator = document.getElementById('statusIndicator');
        
        if (statusText) statusText.textContent = text;
        if (statusIndicator) statusIndicator.className = 'status-indicator ' + state;
    }
    
    showMessage(text, type = 'info') {
        const toast = document.createElement('div');
        toast.textContent = text;
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#333'};
            color: white; padding: 12px 20px; border-radius: 5px;
            z-index: 1000; font-size: 14px; max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
    
    async createRoom() {
        try {
            this.updateStatus('Creating session...', 'connecting');
            this.showMessage('Creating session...');
            
            const nameInput = document.getElementById('userName');
            if (nameInput && nameInput.value.trim()) {
                this.userName = nameInput.value.trim();
            } else {
                this.userName = 'Proctor';
            }
            
            this.userType = 'proctor';
            
            console.log('Creating room for:', this.userName);
            const response = await fetch('/api/create-room?userId=' + this.userId + '&name=' + encodeURIComponent(this.userName));
            const data = await response.json();
            
            if (data.success) {
                this.roomId = data.roomId;
                
                // Save proctor session
                localStorage.setItem('proctorRoom', this.roomId);
                localStorage.setItem('proctorUserId', this.userId);
                localStorage.setItem('proctorName', this.userName);
                
                this.updateRoomUI();
                this.updateStatus('Session created', 'connected');
                this.showMessage('✅ Session created! Room ID: ' + this.roomId, 'success');
                this.connectWebSocket();
            }
        } catch (error) {
            console.error('❌ Error creating room:', error);
            this.updateStatus('Error', 'disconnected');
            this.showMessage('❌ Error: ' + error.message, 'error');
        }
    }
    
    updateRoomUI() {
        document.getElementById('roomIdDisplay').textContent = this.roomId;
        document.getElementById('userRole').textContent = this.userType === 'proctor' ? 'Proctor' : 'Candidate';
        document.getElementById('displayUserName').textContent = this.userName;
        document.getElementById('localName').textContent = this.userName;
        document.getElementById('localRole').textContent = this.userType === 'proctor' ? 'Proctor' : 'Candidate';
        
        const shareLink = `${window.location.protocol}//${window.location.host}/?room=${this.roomId}&type=candidate`;
        document.getElementById('shareLink').value = shareLink;
        
        // Show UI elements
        document.getElementById('roomInfo').classList.remove('hidden');
        document.getElementById('mediaControls').classList.remove('hidden');
        document.getElementById('chatPanel').classList.remove('hidden');
        document.getElementById('participantListContainer').classList.remove('hidden');
        
        // Show/hide proctoring controls
        if (this.userType === 'proctor') {
            document.getElementById('proctoringControls').classList.remove('hidden');
        } else {
            document.getElementById('proctoringControls').classList.add('hidden');
        }
        
        // Hide create button
        const createBtn = document.getElementById('createRoomBtn');
        if (createBtn) createBtn.style.display = 'none';
        
        // Set button states
        document.getElementById('endCallBtn').disabled = true;
        document.getElementById('toggleAudioBtn').disabled = true;
        document.getElementById('toggleVideoBtn').disabled = true;
        document.getElementById('screenShareBtn').disabled = true;
        document.getElementById('snapshotBtn').disabled = true;
        document.getElementById('recordBtn').disabled = true;
    }
    
    showJoinModal() {
        const modal = document.getElementById('joinModal');
        if (modal) modal.classList.remove('hidden');
        
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        const joinRoomIdInput = document.getElementById('joinRoomId');
        
        if (roomId && joinRoomIdInput && !joinRoomIdInput.value) {
            joinRoomIdInput.value = roomId;
        }
        
        const joinUserNameInput = document.getElementById('joinUserName');
        if (joinUserNameInput && !joinUserNameInput.value) {
            joinUserNameInput.value = this.userName || 'Candidate';
        }
    }
    
    cancelJoin() {
        const modal = document.getElementById('joinModal');
        if (modal) modal.classList.add('hidden');
    }
    
    confirmJoin() {
        const roomIdInput = document.getElementById('joinRoomId');
        if (!roomIdInput) {
            this.showMessage('❌ Join input not found', 'error');
            return;
        }
        
        const roomId = roomIdInput.value.trim().toUpperCase();
        if (!roomId) {
            this.showMessage('❌ Please enter Room ID', 'error');
            return;
        }
        
        const nameInput = document.getElementById('joinUserName');
        if (nameInput && nameInput.value.trim()) {
            this.userName = nameInput.value.trim();
        } else {
            this.userName = 'Candidate';
        }
        
        this.roomId = roomId;
        this.userType = 'candidate';
        this.joinExistingRoom();
        this.cancelJoin();
    }
    
    joinExistingRoom() {
        this.updateRoomUI();
        this.updateStatus('Joined session', 'connected');
        this.showMessage('✅ Joined as ' + this.userName, 'success');
        this.connectWebSocket();
    }
    
    connectWebSocket() {
        // Determine correct user type
        let wsType = this.userType;
        const savedRoom = localStorage.getItem('proctorRoom');
        const savedUserId = localStorage.getItem('proctorUserId');
        
        if (savedRoom && savedUserId === this.userId && this.roomId === savedRoom) {
            wsType = 'proctor'; // Force proctor for room creator
            this.userType = 'proctor';
            console.log('🎯 Forcing proctor role for room creator');
        }
        
        // DEBUG: Log current location info
        console.log('🌐 Current protocol:', window.location.protocol);
        console.log('🌐 Current host:', window.location.host);
        console.log('🌐 Full URL:', window.location.href);
        
        // FIXED: Use correct protocol and host (no port 3000)
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        const wsUrl = `${wsProtocol}${window.location.host}?room=${this.roomId}&userId=${this.userId}&type=${wsType}&name=${encodeURIComponent(this.userName)}`;
        console.log('🔌 Connecting to WebSocket:', wsUrl);
        
        this.signaling = new WebSocket(wsUrl);
        
        this.signaling.onopen = () => {
            console.log('✅ WebSocket connected');
            this.updateStatus('Connected to server', 'connected');
            this.showMessage('Connected to signaling server', 'success');
        };
        
        this.signaling.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 WebSocket message received:', data.type);
                this.handleSignalingMessage(data);
            } catch (error) {
                console.error('❌ Error parsing WebSocket message:', error);
            }
        };
        
        this.signaling.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            this.updateStatus('Server disconnected', 'disconnected');
            this.showMessage('Disconnected from server', 'error');
        };
        
        this.signaling.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            this.updateStatus('Connection error', 'disconnected');
            this.showMessage('WebSocket connection error', 'error');
        };
    }
    
    handleSignalingMessage(data) {
        console.log('📨 Processing message:', data.type);
        
        switch (data.type) {
            case 'welcome':
                console.log('🎉 Welcome to room:', data.roomId);
                console.log('Participants list:', data.participants);
                
                this.participants.clear();
                this.remoteStreams.clear();
                
                if (data.participants && Array.isArray(data.participants)) {
                    data.participants.forEach(participant => {
                        if (participant.id !== this.userId) {
                            this.participants.set(participant.id, {
                                id: participant.id,
                                name: participant.name,
                                type: participant.type,
                                isScreenSharing: false
                            });
                            
                            console.log('👤 Found existing participant:', participant.name);
                        }
                    });
                }
                
                this.updateParticipantList();
                this.showMessage(`✅ Connected as ${this.userName}`, 'success');
                
                // If we already have local stream, connect to existing participants
                if (this.localStream) {
                    setTimeout(() => {
                        console.log('🔗 Connecting to existing participants after welcome');
                        this.participants.forEach((participant, userId) => {
                            this.connectToPeer(userId, participant.name, participant.type);
                        });
                    }, 1000);
                }
                break;
                
            case 'user-joined':
                console.log('👤 User joined:', data.userName);
                
                // Add new participant
                this.participants.set(data.userId, {
                    id: data.userId,
                    type: data.userType,
                    name: data.userName,
                    isScreenSharing: false
                });
                
                this.updateParticipantList();
                this.showMessage(`👤 ${data.userName} joined`, 'success');
                
                // Connect to the new participant if we have local stream
                if (this.localStream) {
                    setTimeout(() => {
                        console.log('🔗 Connecting to new participant:', data.userName);
                        this.connectToPeer(data.userId, data.userName, data.userType);
                    }, 500);
                }
                break;
                
            case 'connect-to-peer':
                console.log('🔄 Server requesting connection to peer:', data.peerId, data.peerName);
                
                // Don't connect to ourselves
                if (data.peerId === this.userId) {
                    console.log('⚠️ Ignoring connection to self');
                    return;
                }
                
                // Check if we already have a connection
                if (!this.peerConnections.has(data.peerId)) {
                    console.log('🔗 Creating peer connection to:', data.peerName);
                    
                    // Add to participants if not already there
                    if (!this.participants.has(data.peerId)) {
                        this.participants.set(data.peerId, {
                            id: data.peerId,
                            name: data.peerName,
                            type: data.peerType,
                            isScreenSharing: false
                        });
                        this.updateParticipantList();
                    }
                    
                    // Create connection if we have local stream
                    if (this.localStream) {
                        setTimeout(() => {
                            console.log('🔗 Connecting to peer from server request:', data.peerName);
                            this.connectToPeer(data.peerId, data.peerName, data.peerType);
                        }, 300);
                    } else {
                        console.log('⏳ Waiting for local stream before connecting to peer');
                    }
                } else {
                    console.log('✅ Already connected to', data.peerName);
                }
                break;
                
            case 'user-left':
                console.log('👋 User left:', data.userName);
                this.participants.delete(data.userId);
                this.updateParticipantList();
                this.showMessage(`👤 ${data.userName} left`, 'info');
                
                if (this.peerConnections.has(data.userId)) {
                    this.peerConnections.get(data.userId).close();
                    this.peerConnections.delete(data.userId);
                }
                
                this.removeRemoteVideo(data.userId);
                break;
                
            case 'screen-sharing':
                const participant = this.participants.get(data.userId);
                if (participant) {
                    participant.isScreenSharing = data.active;
                    this.updateParticipantList();
                    
                    const videoContainer = document.getElementById(`remoteVideoContainer-${data.userId}`);
                    if (videoContainer) {
                        const title = videoContainer.querySelector('.video-header h3');
                        if (title) {
                            title.innerHTML = `${data.userName} ${data.active ? '🖥️' : '📹'}`;
                        }
                    }
                }
                break;
                
            case 'chat':
                this.displayChatMessage(data.senderName, data.message, data.senderId !== this.userId);
                break;
                
            case 'offer':
                console.log('📨 Received offer from:', data.senderName);
                this.handleOffer(data);
                break;
                
            case 'answer':
                console.log('📨 Received answer from:', data.senderName);
                this.handleAnswer(data);
                break;
                
            case 'candidate':
                console.log('🧊 Received ICE candidate from:', data.senderName);
                this.handleCandidate(data);
                break;
                
            case 'proctor-left':
                this.showMessage('❌ Proctor left the session', 'error');
                this.endCall();
                break;
                
            default:
                console.log('❓ Unknown message type:', data.type);
        }
    }
    
    updateParticipantList() {
        const count = this.participants.size + 1;
        document.getElementById('participantCount').textContent = count;
        
        const participantList = document.getElementById('participantList');
        if (participantList) {
            let html = `<div class="participant self">
                <i class="fas fa-user${this.userType === 'proctor' ? '-shield' : ''}"></i>
                <span>${this.userName} (You) - ${this.userType}</span>
                ${this.isScreenSharing ? '<span class="screen-sharing-badge"><i class="fas fa-desktop"></i> Sharing</span>' : ''}
            </div>`;
            
            this.participants.forEach(participant => {
                html += `<div class="participant">
                    <i class="fas fa-user${participant.type === 'proctor' ? '-shield' : ''}"></i>
                    <span>${participant.name} - ${participant.type}</span>
                    ${participant.isScreenSharing ? '<span class="screen-sharing-badge"><i class="fas fa-desktop"></i> Sharing</span>' : ''}
                </div>`;
            });
            
            participantList.innerHTML = html;
        }
        
        const remoteVideosTitle = document.getElementById('remoteVideosTitle');
        if (remoteVideosTitle) {
            if (this.participants.size > 0) {
                remoteVideosTitle.classList.remove('hidden');
            } else {
                remoteVideosTitle.classList.add('hidden');
            }
        }
    }
    
    async startCall() {
        try {
            this.updateStatus('Starting camera...', 'connecting');
            this.showMessage('🔄 Starting camera...');
            
            console.log('🎥 Requesting user media...');
            
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 24 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            console.log('✅ User media obtained');
            console.log('Video tracks:', this.localStream.getVideoTracks().length);
            console.log('Audio tracks:', this.localStream.getAudioTracks().length);
            
            this.localStream.getTracks().forEach((track, i) => {
                console.log(`Track ${i}: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
            });
            
            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = this.localStream;
            
            // Wait for video to be ready
            localVideo.onloadedmetadata = () => {
                console.log('✅ Local video metadata loaded');
                localVideo.play().catch(e => console.log('Play error:', e));
            };
            
            document.getElementById('localStatus').textContent = 'Camera on';
            
            // Enable controls
            document.getElementById('startCallBtn').disabled = true;
            document.getElementById('endCallBtn').disabled = false;
            document.getElementById('toggleAudioBtn').disabled = false;
            document.getElementById('toggleVideoBtn').disabled = false;
            document.getElementById('screenShareBtn').disabled = false;
            
            if (this.userType === 'proctor') {
                document.getElementById('snapshotBtn').disabled = false;
                document.getElementById('recordBtn').disabled = false;
            }
            
            this.updateStatus('Call started', 'connected');
            this.showMessage('✅ Camera and microphone started!', 'success');
            
            // Connect to all existing participants
            console.log(`🔗 Connecting to ${this.participants.size} existing participants`);
            
            // Add a delay to ensure local stream is fully ready
            setTimeout(() => {
                this.participants.forEach((participant, userId) => {
                    if (userId !== this.userId) {
                        console.log(`🔗 Connecting to: ${participant.name} (${userId})`);
                        this.connectToPeer(userId, participant.name, participant.type);
                    }
                });
            }, 1000);
            
        } catch (error) {
            console.error('❌ Error starting call:', error);
            this.updateStatus('Camera/microphone error', 'disconnected');
            
            if (error.name === 'NotAllowedError') {
                this.showMessage('❌ Camera/microphone access was denied. Please check permissions.', 'error');
            } else if (error.name === 'NotFoundError') {
                this.showMessage('❌ No camera/microphone found. Please connect one.', 'error');
            } else if (error.name === 'NotReadableError') {
                this.showMessage('❌ Camera/microphone is in use by another application.', 'error');
            } else {
                this.showMessage('❌ Error: ' + error.message, 'error');
            }
        }
    }
    
    connectToPeer(peerId, peerName, peerType) {
        if (peerId === this.userId) {
            console.log('⚠️ Skipping connection to self');
            return;
        }
        
        // Check if connection already exists
        if (this.peerConnections.has(peerId)) {
            console.log(`✅ Already connected to ${peerName} (${peerId})`);
            return;
        }
        
        console.log(`🔗 Creating peer connection to ${peerName} (${peerId})`);
        
        // Create the peer connection
        const peerConnection = this.createPeerConnection(peerId, peerName, peerType);
        
        // Add local tracks
        if (this.localStream) {
            console.log(`➕ Adding ${this.localStream.getTracks().length} tracks to peer ${peerId}`);
            this.localStream.getTracks().forEach(track => {
                console.log(`Adding ${track.kind} track`);
                peerConnection.addTrack(track, this.localStream);
            });
        } else {
            console.log('⏳ No local stream available yet for peer', peerId);
        }
        
        // Add connection timeout for different networks
        setTimeout(() => {
            const pc = this.peerConnections.get(peerId);
            if (pc && pc.iceConnectionState === 'checking') {
                console.log(`⚠️ Connection to ${peerName} is taking too long (different network), forcing ICE restart`);
                pc.restartIce();
                
                // Recreate offer
                setTimeout(() => {
                    this.createOfferForPeer(peerId);
                }, 1000);
            }
        }, 10000); // 10 second timeout for different networks
    }
    
    createPeerConnection(peerId, peerName, peerType) {
        console.log(`🚀 Creating RTCPeerConnection for ${peerName} (${peerId})`);
        
        // FIXED: Added TURN servers for cross-network connectivity
const iceServers = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:global.stun.twilio.com:3478"
    ]
  },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp"
    ],
    username: "openrelayproject",
    credential: "openrelayproject"
  }
];

const config = { iceServers }; // You can add iceTransportPolicy: 'all' here too
const peerConnection = new RTCPeerConnection(config);

        
        const peerConnection = new RTCPeerConnection(config);
        this.peerConnections.set(peerId, peerConnection);
        
        console.log(`✅ PeerConnection created for ${peerName} with TURN support`);
        
        // Handle remote tracks - CRITICAL FIX
        peerConnection.ontrack = (event) => {
            console.log(`🎥 Received ${event.track.kind} track from ${peerName}`);
            console.log('Track details:', {
                track: event.track,
                streams: event.streams,
                transceiver: event.transceiver
            });
            
            // Process track immediately
            this.processRemoteTrack(peerId, peerName, peerType, event);
        };
        
        // Handle ICE candidates - WITH DETAILED LOGGING
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log(`❄️ ICE candidate for ${peerName}:`, 
                    `${event.candidate.type} (${event.candidate.protocol}) - ${event.candidate.address}:${event.candidate.port}`);
                
                // Check if it's a relay candidate (works across networks)
                if (event.candidate.type === 'relay') {
                    console.log(`🚀 Found RELAY candidate for ${peerName}! This will work across networks.`);
                } else if (event.candidate.type === 'srflx') {
                    console.log(`🌐 Found server reflexive candidate for ${peerName} (via STUN)`);
                } else if (event.candidate.type === 'host') {
                    console.log(`🏠 Found host candidate for ${peerName} (same network)`);
                }
                
                if (this.signaling && this.signaling.readyState === WebSocket.OPEN) {
                    this.signaling.send(JSON.stringify({
                        type: 'candidate',
                        candidate: event.candidate,
                        targetPeerId: peerId,
                        senderId: this.userId
                    }));
                }
            } else {
                console.log(`✅ All ICE candidates gathered for ${peerName}`);
            }
        };
        
        // Handle connection state
        peerConnection.onconnectionstatechange = () => {
            console.log(`🔗 Connection state with ${peerName}: ${peerConnection.connectionState}`);
            
            if (peerConnection.connectionState === 'connected') {
                this.showMessage(`✅ Connected to ${peerName}`, 'success');
                console.log(`🎉 Successfully connected to ${peerName}!`);
                
                // Check for existing tracks after connection
                setTimeout(() => {
                    this.checkExistingTracks(peerId, peerName);
                }, 500);
            } else if (peerConnection.connectionState === 'failed') {
                console.log(`❌ Connection failed with ${peerName}, attempting to reconnect...`);
                
                setTimeout(() => {
                    if (this.peerConnections.has(peerId) && this.localStream) {
                        console.log(`🔄 Reconnecting to ${peerName}`);
                        this.peerConnections.delete(peerId);
                        this.removeRemoteVideo(peerId);
                        this.connectToPeer(peerId, peerName, peerType);
                    }
                }, 3000);
            }
        };
        
        // Handle ICE connection state - IMPROVED LOGGING
        peerConnection.oniceconnectionstatechange = () => {
            console.log(`🧊 ICE state with ${peerName}: ${peerConnection.iceConnectionState}`);
            
            // Add specific handling for different states
            switch(peerConnection.iceConnectionState) {
                case 'checking':
                    console.log(`⏳ ICE checking for ${peerName} - gathering candidates...`);
                    break;
                case 'connected':
                    console.log(`✅ ICE connected to ${peerName}! Video should work now.`);
                    
                    // Log candidate types
                    const stats = peerConnection.getStats();
                    stats.then(results => {
                        results.forEach(report => {
                            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                                console.log(`📊 Candidate pair succeeded for ${peerName}:`, 
                                    `Local: ${report.localCandidateId}, Remote: ${report.remoteCandidateId}`);
                            }
                        });
                    });
                    break;
                case 'failed':
                    console.error(`❌ ICE failed for ${peerName}. Network issue or no TURN server.`);
                    
                    // Try to reconnect with different configuration
                    setTimeout(() => {
                        if (this.peerConnections.has(peerId)) {
                            console.log(`🔄 Attempting ICE restart for ${peerName}`);
                            peerConnection.restartIce();
                            
                            // Recreate offer
                            setTimeout(() => {
                                this.createOfferForPeer(peerId);
                            }, 1000);
                        }
                    }, 2000);
                    break;
                case 'disconnected':
                    console.log(`⚠️ ICE disconnected from ${peerName}`);
                    break;
                case 'closed':
                    console.log(`🔒 ICE closed for ${peerName}`);
                    break;
            }
        };
        
        // Also add ICE gathering state monitoring
        peerConnection.onicegatheringstatechange = () => {
            console.log(`🌐 ICE gathering state for ${peerName}: ${peerConnection.iceGatheringState}`);
            
            if (peerConnection.iceGatheringState === 'complete') {
                console.log(`✅ ICE gathering complete for ${peerName}`);
                
                // Log local description (first 10 lines)
                if (peerConnection.localDescription?.sdp) {
                    console.log(`📊 Local description (first 10 lines):`);
                    const lines = peerConnection.localDescription.sdp.split('\n').slice(0, 10);
                    lines.forEach(line => console.log(`  ${line}`));
                }
            }
        };
        
        // Create offer immediately
        setTimeout(() => {
            this.createOfferForPeer(peerId);
        }, 500);
        
        return peerConnection;
    }
    
    checkExistingTracks(peerId, peerName) {
        const peerConnection = this.peerConnections.get(peerId);
        if (!peerConnection) return;
        
        const receivers = peerConnection.getReceivers();
        console.log(`🔍 Checking ${receivers.length} receivers for ${peerName}`);
        
        receivers.forEach((receiver, i) => {
            if (receiver.track) {
                console.log(`📹 Found existing ${receiver.track.kind} track for ${peerName}`);
                
                // Create event for existing track
                const event = {
                    track: receiver.track,
                    streams: [new MediaStream([receiver.track])],
                    receiver: receiver,
                    transceiver: null
                };
                
                // Process the track
                const participant = this.participants.get(peerId);
                if (participant) {
                    this.processRemoteTrack(peerId, participant.name, participant.type, event);
                }
            }
        });
    }
    
    processRemoteTrack(peerId, peerName, peerType, event) {
        console.log(`🎬 Processing remote track for ${peerName}`);
        
        // Get or create stream for this peer
        let stream = this.remoteStreams.get(peerId);
        if (!stream) {
            stream = new MediaStream();
            this.remoteStreams.set(peerId, stream);
            console.log(`✅ Created new stream for ${peerName}`);
        }
        
        // Add track to stream if not already present
        const existingTrack = stream.getTracks().find(t => t.id === event.track.id);
        if (!existingTrack && event.track) {
            // Remove old tracks of same kind
            const oldTracks = stream.getTracks().filter(t => t.kind === event.track.kind);
            oldTracks.forEach(track => {
                console.log(`➖ Removing old ${track.kind} track`);
                stream.removeTrack(track);
            });
            
            // Add new track
            stream.addTrack(event.track);
            console.log(`➕ Added ${event.track.kind} track. Total tracks: ${stream.getTracks().length}`);
        }
        
        // Ensure video container exists
        this.ensureVideoContainer(peerId, peerName, peerType, stream);
    }
    
    ensureVideoContainer(peerId, peerName, peerType, stream) {
        const remoteVideosContainer = document.getElementById('remoteVideosContainer');
        if (!remoteVideosContainer) {
            console.error('❌ Remote videos container not found!');
            return;
        }
        
        let videoContainer = document.getElementById(`remoteVideoContainer-${peerId}`);
        let videoElement = document.getElementById(`remoteVideo-${peerId}`);
        
        // Create container if it doesn't exist
        if (!videoContainer) {
            console.log(`📦 Creating video container for ${peerName}`);
            
            videoContainer = document.createElement('div');
            videoContainer.className = 'remote-video-container';
            videoContainer.id = `remoteVideoContainer-${peerId}`;
            videoContainer.style.cssText = `
                position: relative;
                background: black;
                border-radius: 10px;
                overflow: hidden;
                min-height: 250px;
            `;
            
            // Create header
            const header = document.createElement('div');
            header.className = 'video-header';
            header.innerHTML = `
                <h3><i class="fas fa-user${peerType === 'proctor' ? '-shield' : ''}"></i> ${peerName}</h3>
                <div class="video-stats">
                    <span><i class="fas fa-microphone"></i> <span id="audioStatus-${peerId}">On</span></span>
                    <span><i class="fas fa-video"></i> <span id="videoStatus-${peerId}">On</span></span>
                </div>
            `;
            
            // Create video element
            videoElement = document.createElement('video');
            videoElement.id = `remoteVideo-${peerId}`;
            videoElement.className = 'remote-video';
            videoElement.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                background: black;
                display: block;
            `;
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.muted = true;
            
            // Create status bar
            const statusBar = document.createElement('div');
            statusBar.className = 'video-status';
            statusBar.innerHTML = `<i class="fas fa-signal"></i> <span id="remoteStatus-${peerId}">Connected</span>`;
            
            // Assemble container
            videoContainer.appendChild(header);
            videoContainer.appendChild(videoElement);
            videoContainer.appendChild(statusBar);
            remoteVideosContainer.appendChild(videoContainer);
            
            console.log(`✅ Video container created for ${peerName}`);
        }
        
        // Update video element reference
        videoElement = document.getElementById(`remoteVideo-${peerId}`);
        if (!videoElement) {
            console.error(`❌ Video element not found for ${peerName}`);
            return;
        }
        
        // Set stream as source
        if (!videoElement.srcObject || videoElement.srcObject.id !== stream.id) {
            console.log(`🎬 Setting video source for ${peerName}`);
            videoElement.srcObject = stream;
            
            // Force play
            setTimeout(() => {
                videoElement.play().catch(e => {
                    console.log(`⚠️ Play error for ${peerName}:`, e);
                    
                    // Try muted play
                    videoElement.muted = true;
                    videoElement.play().catch(e2 => {
                        console.log(`❌ Muted play also failed for ${peerName}:`, e2);
                    });
                });
            }, 100);
        }
        
        // Track events
        if (stream.getVideoTracks()[0]) {
            stream.getVideoTracks()[0].onended = () => {
                console.log(`⏹️ Video track ended for ${peerName}`);
            };
        }
        
        // Video element events
        videoElement.onloadedmetadata = () => {
            console.log(`✅ Video metadata loaded for ${peerName}`);
            console.log(`📏 Dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
            
            // Force play again after metadata
            videoElement.play().catch(e => console.log(`Metadata play error:`, e));
        };
        
        videoElement.onplaying = () => {
            console.log(`▶️ Video is playing for ${peerName}`);
            videoElement.style.border = '2px solid #28a745';
        };
        
        // Monitor dimensions
        const checkDimensions = setInterval(() => {
            if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                console.log(`📐 ${peerName} video: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
                clearInterval(checkDimensions);
            }
        }, 1000);
        
        setTimeout(() => clearInterval(checkDimensions), 10000);
    }
    
    removeRemoteVideo(peerId) {
        const videoContainer = document.getElementById(`remoteVideoContainer-${peerId}`);
        if (videoContainer) {
            console.log(`🗑️ Removing video container for ${peerId}`);
            videoContainer.remove();
        }
        this.remoteStreams.delete(peerId);
    }
    
    async createOfferForPeer(peerId) {
        try {
            const peerConnection = this.peerConnections.get(peerId);
            if (!peerConnection) {
                console.error('❌ No peer connection found for', peerId);
                return;
            }
            
            console.log(`📝 Creating offer for ${peerId}`);
            
            const offerOptions = {
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            };
            
            const offer = await peerConnection.createOffer(offerOptions);
            console.log('✅ Offer created');
            
            await peerConnection.setLocalDescription(offer);
            console.log('✅ Local description set');
            
            if (this.signaling && this.signaling.readyState === WebSocket.OPEN) {
                this.signaling.send(JSON.stringify({
                    type: 'offer',
                    sdp: offer.sdp,
                    targetPeerId: peerId,
                    senderId: this.userId
                }));
                console.log('✅ Offer sent via WebSocket');
            } else {
                console.error('❌ WebSocket not ready for sending offer');
            }
        } catch (error) {
            console.error('❌ Error creating offer for', peerId, ':', error);
            
            setTimeout(() => {
                if (this.peerConnections.has(peerId)) {
                    console.log('🔄 Retrying offer creation for', peerId);
                    this.createOfferForPeer(peerId);
                }
            }, 1000);
        }
    }
    
    async handleOffer(data) {
        try {
            console.log(`📨 Handling offer from ${data.senderName}`);
            
            let peerConnection = this.peerConnections.get(data.senderId);
            if (!peerConnection) {
                const participant = this.participants.get(data.senderId);
                if (participant) {
                    peerConnection = this.createPeerConnection(data.senderId, participant.name, participant.type);
                } else {
                    console.error('❌ No participant info for', data.senderId);
                    return;
                }
            }
            
            await peerConnection.setRemoteDescription(new RTCSessionDescription({
                type: 'offer',
                sdp: data.sdp
            }));
            
            console.log('✅ Remote description set');
            
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            if (this.signaling && this.signaling.readyState === WebSocket.OPEN) {
                this.signaling.send(JSON.stringify({
                    type: 'answer',
                    sdp: answer.sdp,
                    targetPeerId: data.senderId,
                    senderId: this.userId
                }));
                console.log('✅ Answer sent');
            }
            
        } catch (error) {
            console.error('❌ Error handling offer:', error);
        }
    }
    
    async handleAnswer(data) {
        try {
            console.log(`📨 Handling answer from ${data.senderName}`);
            
            const peerConnection = this.peerConnections.get(data.senderId);
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription({
                    type: 'answer',
                    sdp: data.sdp
                }));
                console.log('✅ Answer processed');
            } else {
                console.error('❌ No peer connection for', data.senderId);
            }
        } catch (error) {
            console.error('❌ Error handling answer:', error);
        }
    }
    
    async handleCandidate(data) {
        try {
            console.log(`🧊 Handling ICE candidate from ${data.senderName}`);
            
            const peerConnection = this.peerConnections.get(data.senderId);
            if (peerConnection && data.candidate) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log('✅ ICE candidate added');
            } else {
                console.error('❌ No peer connection or candidate for', data.senderId);
            }
        } catch (error) {
            console.error('❌ Error handling candidate:', error);
        }
    }
    
    async toggleScreenShare() {
        try {
            if (!this.isScreenSharing) {
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: "always",
                        displaySurface: "monitor"
                    },
                    audio: true
                });
                
                if (this.signaling) {
                    this.signaling.send(JSON.stringify({
                        type: 'screen-sharing',
                        active: true
                    }));
                }
                
                this.peerConnections.forEach((peerConnection, peerId) => {
                    const senders = peerConnection.getSenders();
                    const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
                    if (videoSender && this.screenStream) {
                        const screenTrack = this.screenStream.getVideoTracks()[0];
                        if (screenTrack) {
                            videoSender.replaceTrack(screenTrack);
                        }
                    }
                });
                
                this.isScreenSharing = true;
                this.updateParticipantList();
                
                this.screenStream.getVideoTracks()[0].onended = () => {
                    this.stopScreenShare();
                };
                
                this.showMessage('✅ Screen sharing started', 'success');
                
            } else {
                this.stopScreenShare();
            }
            
        } catch (error) {
            console.error('❌ Error toggling screen share:', error);
            if (error.name !== 'NotAllowedError') {
                this.showMessage('❌ Failed to share screen: ' + error.message, 'error');
            }
        }
    }
    
    stopScreenShare() {
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }
        
        if (this.localStream) {
            this.peerConnections.forEach((peerConnection, peerId) => {
                const senders = peerConnection.getSenders();
                const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
                if (videoSender && this.localStream) {
                    const cameraTrack = this.localStream.getVideoTracks()[0];
                    if (cameraTrack) {
                        videoSender.replaceTrack(cameraTrack);
                    }
                }
            });
        }
        
        this.isScreenSharing = false;
        
        if (this.signaling) {
            this.signaling.send(JSON.stringify({
                type: 'screen-sharing',
                active: false
            }));
        }
        
        this.updateParticipantList();
        this.showMessage('🖥️ Screen sharing stopped', 'info');
    }
    
    toggleAudio() {
        if (!this.localStream) return;
        
        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            const audioTrack = audioTracks[0];
            this.isAudioMuted = !audioTrack.enabled;
            audioTrack.enabled = !this.isAudioMuted;
            
            const audioBtn = document.getElementById('toggleAudioBtn');
            if (audioBtn) {
                audioBtn.innerHTML = this.isAudioMuted ? 
                    '<i class="fas fa-microphone-slash"></i> Unmute Audio' : 
                    '<i class="fas fa-microphone"></i> Mute Audio';
            }
            
            document.getElementById('audioStatus').textContent = this.isAudioMuted ? 'Off' : 'On';
            this.showMessage(this.isAudioMuted ? '🔇 Microphone muted' : '🎤 Microphone unmuted', 'info');
        }
    }
    
    toggleVideo() {
        if (!this.localStream) return;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            this.isVideoHidden = !videoTrack.enabled;
            videoTrack.enabled = !this.isVideoHidden;
            
            const videoBtn = document.getElementById('toggleVideoBtn');
            if (videoBtn) {
                videoBtn.innerHTML = this.isVideoHidden ? 
                    '<i class="fas fa-video"></i> Show Video' : 
                    '<i class="fas fa-video-slash"></i> Hide Video';
            }
            
            document.getElementById('videoStatus').textContent = this.isVideoHidden ? 'Off' : 'On';
            this.showMessage(this.isVideoHidden ? '📷 Camera off' : '📷 Camera on', 'info');
        }
    }
    
    takeSnapshot() {
        if (this.userType !== 'proctor') {
            this.showMessage('❌ Only proctors can take snapshots', 'error');
            return;
        }
        
        const remoteVideos = document.querySelectorAll('.remote-video');
        
        if (remoteVideos.length === 0) {
            this.showMessage('❌ No remote videos to capture', 'error');
            return;
        }
        
        remoteVideos.forEach((video, index) => {
            try {
                if (video.videoWidth === 0 || video.videoHeight === 0) return;
                
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const link = document.createElement('a');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                link.download = `snapshot-${this.roomId}-${timestamp}-${index}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                
                this.snapshots.push({
                    timestamp: new Date().toISOString(),
                    roomId: this.roomId,
                    image: link.href
                });
            } catch (error) {
                console.error('Error taking snapshot:', error);
            }
        });
        
        this.showMessage(`📸 ${remoteVideos.length} snapshot(s) saved`, 'success');
    }
    
    async toggleRecording() {
        if (this.userType !== 'proctor') {
            this.showMessage('❌ Only proctors can record sessions', 'error');
            return;
        }
        
        if (!this.isRecording) {
            try {
                if (!this.localStream) {
                    this.showMessage('❌ Start camera first', 'error');
                    return;
                }
                
                this.recordedChunks = [];
                this.mediaRecorder = new MediaRecorder(this.localStream, {
                    mimeType: 'video/webm;codecs=vp9,opus'
                });
                
                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        this.recordedChunks.push(event.data);
                    }
                };
                
                this.mediaRecorder.onstop = () => {
                    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `recording-${this.roomId}-${Date.now()}.webm`;
                    a.click();
                    URL.revokeObjectURL(url);
                    
                    this.showMessage('🎥 Recording saved', 'success');
                };
                
                this.mediaRecorder.start(1000);
                this.isRecording = true;
                
                const recordBtn = document.getElementById('recordBtn');
                if (recordBtn) {
                    recordBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';
                }
                
                this.showMessage('🔴 Recording started', 'success');
                
            } catch (error) {
                console.error('Error starting recording:', error);
                this.showMessage('❌ Failed to start recording: ' + error.message, 'error');
            }
        } else {
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }
            this.isRecording = false;
            
            const recordBtn = document.getElementById('recordBtn');
            if (recordBtn) {
                recordBtn.innerHTML = '<i class="fas fa-video"></i> Record Session';
            }
        }
    }
    
    sendChat() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput || !chatInput.value.trim()) return;
        
        const message = chatInput.value.trim();
        
        if (this.signaling) {
            this.signaling.send(JSON.stringify({
                type: 'chat',
                message: message
            }));
        }
        
        this.displayChatMessage('You', message, false);
        chatInput.value = '';
        chatInput.focus();
    }
    
    displayChatMessage(senderName, message, isRemote = true) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isRemote ? 'remote' : 'local'}`;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageDiv.innerHTML = `
            <div class="chat-sender">${senderName} <span class="chat-time">${timeString}</span></div>
            <div class="chat-text">${this.escapeHtml(message)}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    copyLink() {
        const linkInput = document.getElementById('shareLink');
        if (!linkInput) return;
        
        linkInput.select();
        linkInput.setSelectionRange(0, 99999);
        
        try {
            document.execCommand('copy');
            this.showMessage('✅ Link copied to clipboard', 'success');
        } catch (error) {
            console.error('Copy failed:', error);
            
            navigator.clipboard.writeText(linkInput.value)
                .then(() => this.showMessage('✅ Link copied to clipboard', 'success'))
                .catch(() => this.showMessage('❌ Failed to copy link', 'error'));
        }
    }
    
    endCall() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }
        
        if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }
        
        this.peerConnections.forEach(peerConnection => {
            peerConnection.close();
        });
        this.peerConnections.clear();
        this.remoteStreams.clear();
        
        if (this.signaling) {
            this.signaling.close();
            this.signaling = null;
        }
        
        document.getElementById('startCallBtn').disabled = false;
        document.getElementById('endCallBtn').disabled = true;
        document.getElementById('toggleAudioBtn').disabled = true;
        document.getElementById('toggleVideoBtn').disabled = true;
        document.getElementById('screenShareBtn').disabled = true;
        document.getElementById('snapshotBtn').disabled = true;
        document.getElementById('recordBtn').disabled = true;
        
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.srcObject = null;
            document.getElementById('localStatus').textContent = 'Camera off';
        }
        
        const remoteVideosContainer = document.getElementById('remoteVideosContainer');
        if (remoteVideosContainer) {
            remoteVideosContainer.innerHTML = '';
        }
        
        this.participants.clear();
        this.updateParticipantList();
        
        this.updateStatus('Call ended', 'disconnected');
        this.showMessage('📞 Call ended', 'info');
        
        if (this.userType === 'proctor' && this.signaling) {
            this.signaling.send(JSON.stringify({
                type: 'proctor-left'
            }));
        }
        
        // Clear proctor session if ending
        if (this.userType === 'proctor') {
            localStorage.removeItem('proctorRoom');
            localStorage.removeItem('proctorUserId');
            localStorage.removeItem('proctorName');
        }
    }
    
    debugWebRTC() {
        console.log('=== WEBRTC DEBUG ===');
        console.log('Local Stream:', this.localStream ? 'YES' : 'NO');
        if (this.localStream) {
            const tracks = this.localStream.getTracks();
            console.log('Local Tracks:', tracks.length);
            tracks.forEach((track, i) => {
                console.log(`  Track ${i}: ${track.kind}, enabled: ${track.enabled}`);
            });
        }
        
        console.log('Peer Connections:', this.peerConnections.size);
        this.peerConnections.forEach((pc, peerId) => {
            const participant = this.participants.get(peerId);
            const name = participant ? participant.name : 'Unknown';
            console.log(`  ${name} (${peerId}):`);
            console.log(`    State: ${pc.connectionState}`);
            console.log(`    ICE State: ${pc.iceConnectionState}`);
            
            const senders = pc.getSenders();
            console.log(`    Senders: ${senders.length}`);
            
            const receivers = pc.getReceivers();
            console.log(`    Receivers: ${receivers.length}`);
            receivers.forEach((receiver, i) => {
                console.log(`      Receiver ${i}: ${receiver.track ? receiver.track.kind : 'NO TRACK'}`);
                if (receiver.track) {
                    console.log(`        Track ID: ${receiver.track.id}, readyState: ${receiver.track.readyState}`);
                }
            });
        });
        
        console.log('Remote Streams:', this.remoteStreams.size);
        this.remoteStreams.forEach((stream, peerId) => {
            const participant = this.participants.get(peerId);
            const name = participant ? participant.name : 'Unknown';
            console.log(`  ${name} (${peerId}):`);
            console.log(`    Stream ID: ${stream.id}`);
            console.log(`    Tracks: ${stream.getTracks().length}`);
            stream.getTracks().forEach((track, i) => {
                console.log(`      Track ${i}: ${track.kind}, id: ${track.id}`);
            });
        });
        
        const remoteVideos = document.querySelectorAll('.remote-video');
        let workingVideos = 0;
        remoteVideos.forEach((video, i) => {
            if (video.srcObject && video.srcObject.getTracks().length > 0) {
                workingVideos++;
                console.log(`  Video ${i}: HAS STREAM with ${video.srcObject.getTracks().length} tracks`);
            } else {
                console.log(`  Video ${i}: NO STREAM`);
            }
        });
        
        console.log(`Remote Video Elements: ${remoteVideos.length}`);
        console.log(`Working Remote Videos (with tracks): ${workingVideos}`);
        console.log('=== END DEBUG ===');
    }
}

// Initialize app
window.addEventListener('load', () => {
    console.log('🚀 Loading ProctoringApp...');
    window.proctoringApp = new ProctoringApp();
    
    // Add debug command to window
    window.debugRTC = () => {
        if (window.proctoringApp) {
            window.proctoringApp.debugWebRTC();
        }
    };
    
    // Manual video check
    window.checkVideos = () => {
        if (window.proctoringApp) {
            const app = window.proctoringApp;
            console.log('=== MANUAL VIDEO CHECK ===');
            console.log('Remote videos on page:', document.querySelectorAll('.remote-video').length);
            
            app.peerConnections.forEach((pc, peerId) => {
                const participant = app.participants.get(peerId);
                if (participant) {
                    console.log(`Checking ${participant.name}:`);
                    const video = document.getElementById(`remoteVideo-${peerId}`);
                    if (video) {
                        console.log(`  Video element: ${video.videoWidth}x${video.videoHeight}`);
                        console.log(`  Has stream: ${video.srcObject ? 'YES' : 'NO'}`);
                        if (video.srcObject) {
                            console.log(`  Stream tracks: ${video.srcObject.getTracks().length}`);
                        }
                    } else {
                        console.log(`  No video element found`);
                    }
                }
            });
        }
    };
    
    // Force video visibility
    window.makeVideosVisible = () => {
        document.querySelectorAll('.remote-video').forEach(video => {
            video.style.cssText = `
                display: block !important;
                width: 100% !important;
                height: 100% !important;
                background: black !important;
                border: 3px solid red !important;
                object-fit: cover !important;
            `;
        });
        
        document.querySelectorAll('.remote-video-container').forEach(container => {
            container.style.cssText = `
                display: block !important;
                min-height: 250px !important;
                background: black !important;
                border: 2px solid blue !important;
            `;
        });
        
        console.log('✅ Forced all videos to be visible');
    };
    
    // Enhanced auto-debug with network info
    setInterval(() => {
        if (window.proctoringApp && window.proctoringApp.signaling) {
            console.log('=== Auto-diagnostic (Every 10s) ===');
            console.log('Network status:', navigator.onLine ? 'Online' : 'Offline');
            console.log('Connection type:', navigator.connection ? navigator.connection.effectiveType : 'Unknown');
            window.proctoringApp.debugWebRTC();
        }
    }, 10000);
    
    console.log('✅ ProctoringApp loaded successfully');
});