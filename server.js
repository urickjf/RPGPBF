// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    socket.on('create-room', (data) => {
        const { roomCode, userName } = data;
        
        if (!rooms.has(roomCode)) {
            rooms.set(roomCode, {
                host: socket.id,
                players: new Map(),
                created: Date.now()
            });
            
            socket.join(roomCode);
            socket.emit('room-created', { roomCode, success: true });
            console.log(`Sala ${roomCode} criada por ${userName}`);
        } else {
            socket.emit('room-created', { success: false, error: 'Sala já existe' });
        }
    });

    socket.on('join-room', (data) => {
        const { roomCode, userName } = data;
        
        if (rooms.has(roomCode)) {
            const room = rooms.get(roomCode);
            room.players.set(socket.id, { name: userName, joined: Date.now() });
            
            socket.join(roomCode);
            socket.to(roomCode).emit('player-joined', { userName, socketId: socket.id });
            socket.emit('room-joined', { success: true, roomCode });
            
            console.log(`${userName} entrou na sala ${roomCode}`);
        } else {
            socket.emit('room-joined', { success: false, error: 'Sala não encontrada' });
        }
    });

    socket.on('webrtc-offer', (data) => {
        socket.to(data.target).emit('webrtc-offer', {
            offer: data.offer,
            sender: socket.id
        });
    });

    socket.on('webrtc-answer', (data) => {
        socket.to(data.target).emit('webrtc-answer', {
            answer: data.answer,
            sender: socket.id
        });
    });

    socket.on('webrtc-ice-candidate', (data) => {
        socket.to(data.target).emit('webrtc-ice-candidate', {
            candidate: data.candidate,
            sender: socket.id
        });
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
        
        // Limpar salas
        for (let [roomCode, room] of rooms.entries()) {
            if (room.host === socket.id) {
                rooms.delete(roomCode);
                io.to(roomCode).emit('room-closed');
            } else if (room.players.has(socket.id)) {
                room.players.delete(socket.id);
                socket.to(roomCode).emit('player-left', { socketId: socket.id });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Signaling server rodando na porta ${PORT}`);
});