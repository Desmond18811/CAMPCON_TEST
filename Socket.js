import { Server as SocketIO } from 'socket.io';
import http from 'http';

const server = http.createServer(app);
const io = new SocketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinResource', (resourceId) => {
        socket.join(resourceId);
        console.log(`User ${socket.id} joined resource ${resourceId}`);
    });

    socket.on('leaveResource', (resourceId) => {
        socket.leave(resourceId);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Use server.listen(PORT) instead of app.listen