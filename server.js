const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store active rooms and connections
const rooms = new Map();
const connections = new Map();

// Serve static files ../
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// API endpoint to create a room (only for proctors)
app.get('/api/create-room', (req, res) => {
    const roomId = generateRoomId();
    const userId = req.query.userId || generateUserId();
    const userName = req.query.name || 'Proctor';
    
    rooms.set(roomId, {
        id: roomId,
        participants: new Map(),
        createdAt: Date.now(),
        proctor: userId,
        maxParticipants: 10,
        isActive: false
    });
    
    const roomLink = `${req.protocol}://${req.get('host')}/?room=${roomId}&type=candidate`;
    
    res.json({
        success: true,
        roomId: roomId,
        userId: userId,
        userName: userName,
        link: roomLink,
        message: 'Room created successfully',
        maxParticipants: 10
    });
});

// API endpoint to check room status
app.get('/api/room/:roomId', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }
    
    const participants = Array.from(room.participants.values()).map(p => ({
        id: p.userId,
        type: p.userType,
        name: p.userName,
        isScreenSharing: p.isScreenSharing || false
    }));
    
    res.json({
        roomId: room.id,
        proctor: room.proctor,
        participants: participants,
        participantCount: room.participants.size,
        maxParticipants: room.maxParticipants,
        isActive: room.isActive,
        createdAt: room.createdAt
    });
});

// API endpoint to validate room
app.get('/api/validate-room/:roomId', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json({
        roomId: room.id,
        exists: true,
        proctor: room.proctor
    });
});

// WebSocket connection handling - UPDATED
wss.on('connection', (ws, req) => {
    console.log('=== New WebSocket Connection ===');
    
    // Parse URL parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const roomId = url.searchParams.get('room');
    const userId = url.searchParams.get('userId') || generateUserId();
    const userType = url.searchParams.get('type') || 'candidate';
    const userName = url.searchParams.get('name') || (userType === 'proctor' ? 'Proctor' : `Candidate_${userId.substring(0, 4)}`);
    
    console.log('Connection details:', { roomId, userId, userType, userName });
    
    if (!roomId) {
        console.log('No room ID provided, closing connection');
        ws.close(1008, 'Room ID required');
        return;
    }
    
    // Get room
    let room = rooms.get(roomId);
    if (!room) {
        console.log('Room not found:', roomId);
        ws.close(1008, 'Room not found. Please create room first.');
        return;
    }
    
    console.log(`Room found: ${roomId}, current participants: ${room.participants.size}`);
    
    // Check if trying to join as proctor but room already has one
    if (userType === 'proctor' && room.proctor !== userId) {
        const existingProctor = Array.from(room.participants.values()).find(p => p.userType === 'proctor');
        if (existingProctor) {
            console.log('Room already has a proctor:', existingProctor.userName);
            ws.close(1008, 'Room already has a proctor');
            return;
        }
    }
    
    // Check room capacity
    const maxCapacity = 1 + room.maxParticipants;
    if (room.participants.size >= maxCapacity) {
        console.log('Room is full:', roomId);
        ws.close(1008, 'Room is full');
        return;
    }
    
    // Store connection
    const connection = {
        ws: ws,
        userId: userId,
        roomId: roomId,
        userType: userType,
        userName: userName,
        joinedAt: Date.now(),
        isScreenSharing: false
    };
    
    connections.set(userId, connection);
    room.participants.set(userId, connection);
    
    console.log(`${userName} (${userId}) joined room ${roomId} as ${userType}`);
    console.log(`Room ${roomId} now has ${room.participants.size} participants`);
    
    // Send welcome message with ALL participants info
    const participantList = Array.from(room.participants.values()).map(conn => ({
        id: conn.userId,
        type: conn.userType,
        name: conn.userName,
        joinedAt: conn.joinedAt,
        isScreenSharing: conn.isScreenSharing
    }));
    
    const welcomeMessage = {
        type: 'welcome',
        userId: userId,
        roomId: roomId,
        userType: userType,
        userName: userName,
        participants: participantList,
        participantCount: room.participants.size,
        maxParticipants: room.maxParticipants,
        proctor: room.proctor,
        timestamp: Date.now()
    };
    
    ws.send(JSON.stringify(welcomeMessage));
    console.log('Welcome message sent to', userName);
    
    // Notify ALL other participants about new user
    const userJoinedMessage = {
        type: 'user-joined',
        userId: userId,
        userType: userType,
        userName: userName,
        participants: participantList,
        participantCount: room.participants.size,
        timestamp: Date.now()
    };
    
    broadcastToRoom(roomId, userId, userJoinedMessage);
    console.log('User joined notification sent to room');
    
    // Send peer connection requests to establish mesh - UPDATED
    setTimeout(() => {
        console.log(`Setting up peer connections for ${userName} (${userId})`);
        
        let connectionCount = 0;
        room.participants.forEach((conn, id) => {
            if (id !== userId && conn.ws.readyState === WebSocket.OPEN) {
                console.log(`Setting up connection between ${userName} and ${conn.userName}`);
                
                // Tell existing user to connect to new user
                conn.ws.send(JSON.stringify({
                    type: 'connect-to-peer',
                    peerId: userId,
                    peerName: userName,
                    peerType: userType,
                    timestamp: Date.now()
                }));
                
                // Tell new user to connect to existing user
                ws.send(JSON.stringify({
                    type: 'connect-to-peer',
                    peerId: id,
                    peerName: conn.userName,
                    peerType: conn.userType,
                    timestamp: Date.now()
                }));
                
                connectionCount++;
            }
        });
        
        console.log(`Peer connection requests sent: ${connectionCount}`);
    }, 500);
    
    // Handle incoming messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(roomId, userId, data);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    // Handle disconnection
    ws.on('close', () => {
        console.log(`${userName} (${userId}) disconnected from room ${roomId}`);
        
        // Remove from room
        if (room) {
            room.participants.delete(userId);
            
            // Notify all others
            broadcastToRoom(roomId, userId, {
                type: 'user-left',
                userId: userId,
                userName: userName,
                userType: userType,
                participants: Array.from(room.participants.values()).map(conn => ({
                    id: conn.userId,
                    type: conn.userType,
                    name: conn.userName
                })),
                participantCount: room.participants.size,
                timestamp: Date.now()
            });
            
            // If proctor leaves, notify everyone
            if (userType === 'proctor') {
                broadcastToRoom(roomId, userId, {
                    type: 'proctor-left',
                    message: 'Proctor left the session',
                    timestamp: Date.now()
                });
                
                // Clean up room after 1 minute if empty
                setTimeout(() => {
                    if (rooms.get(roomId)?.participants.size === 0) {
                        rooms.delete(roomId);
                        console.log(`Room ${roomId} cleaned up`);
                    }
                }, 60000);
            }
        }
        
        // Remove connection
        connections.delete(userId);
    });
    
    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error for user', userId, ':', error);
    });
});

// Handle different message types - UPDATED
function handleMessage(roomId, senderId, data) {
    const room = rooms.get(roomId);
    if (!room) {
        console.log(`Room ${roomId} not found for message from ${senderId}`);
        return;
    }
    
    const sender = connections.get(senderId);
    if (!sender) {
        console.log(`Sender ${senderId} not found in connections`);
        return;
    }
    
    console.log(`Message from ${sender.userName} (${senderId}):`, data.type);
    
    switch (data.type) {
        case 'offer':
        case 'answer':
        case 'candidate':
            // Forward signaling data to specific peer
            if (data.targetPeerId) {
                const targetConn = connections.get(data.targetPeerId);
                if (targetConn && targetConn.ws.readyState === WebSocket.OPEN) {
                    console.log(`📨 Forwarding ${data.type} from ${sender.userName} to ${targetConn.userName}`);
                    
                    // CRITICAL: Ensure we include sender info
                    const forwardData = {
                        ...data,
                        senderId: senderId,
                        senderName: sender.userName,
                        senderType: sender.userType
                    };
                    
                    targetConn.ws.send(JSON.stringify(forwardData));
                    console.log(`✅ ${data.type} forwarded successfully`);
                } else {
                    console.log(`❌ Target ${data.targetPeerId} not found or WebSocket not open`);
                }
            } else {
                console.log(`❌ No targetPeerId in ${data.type} message`);
            }
            break;
            
        case 'screen-sharing':
            // Update screen sharing status
            sender.isScreenSharing = data.active;
            
            // Notify all participants
            broadcastToRoom(roomId, senderId, {
                type: 'screen-sharing',
                userId: senderId,
                userName: sender.userName,
                active: data.active,
                timestamp: Date.now()
            });
            
            console.log(`${sender.userName} screen sharing: ${data.active ? 'started' : 'stopped'}`);
            break;
            
        case 'chat':
            // Broadcast chat message to all in room
            broadcastToRoom(roomId, senderId, {
                type: 'chat',
                senderId: senderId,
                senderName: sender.userName,
                senderType: sender.userType,
                message: data.message,
                timestamp: Date.now()
            });
            
            console.log(`${sender.userName} sent chat: ${data.message.substring(0, 50)}...`);
            break;
            
        case 'ping':
            // Respond with pong
            if (sender.ws.readyState === WebSocket.OPEN) {
                sender.ws.send(JSON.stringify({
                    type: 'pong',
                    timestamp: Date.now()
                }));
            }
            break;
            
        case 'proctoring-event':
            // Proctoring events (snapshots, recordings, etc.)
            broadcastToRoom(roomId, senderId, {
                ...data,
                senderId: senderId,
                senderName: sender.userName,
                timestamp: Date.now()
            });
            break;
            
        default:
            console.log('Unknown message type:', data.type);
    }
}

// Broadcast message to all participants in a room except sender
function broadcastToRoom(roomId, senderId, message) {
    const room = rooms.get(roomId);
    if (!room) {
        console.log(`Room ${roomId} not found for broadcast`);
        return;
    }
    
    let sentCount = 0;
    room.participants.forEach((conn, userId) => {
        if (userId !== senderId && conn.ws.readyState === WebSocket.OPEN) {
            conn.ws.send(JSON.stringify(message));
            sentCount++;
        }
    });
    
    console.log(`Broadcast sent to ${sentCount} participant(s)`);
}

// Generate random room ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Generate random user ID
function generateUserId() {
    return 'user_' + Math.random().toString(36).substring(2, 10);
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('WebRTC Proctoring Server Started!');
    console.log('='.repeat(50));
    console.log(`HTTP Server: http://localhost:${PORT}`);
    console.log(`WebSocket Server: ws://localhost:${PORT}`);
    console.log('='.repeat(50));
    console.log('\nTo use the system:');
    console.log('1. Open http://localhost:3000 as Proctor');
    console.log('2. Click "Create New Session"');
    console.log('3. Share the link with candidates');
    console.log('4. Everyone sees everyone in a grid view');
    console.log('='.repeat(50));
});

// Clean up old rooms every 30 minutes
setInterval(() => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    for (const [roomId, room] of rooms.entries()) {
        if (now - room.createdAt > oneHour && room.participants.size === 0) {
            rooms.delete(roomId);
            console.log(`Cleaned up old room: ${roomId}`);
        }
    }
}, 30 * 60 * 1000);

console.log('Server initialized successfully');
