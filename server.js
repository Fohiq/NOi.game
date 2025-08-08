const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let rooms = {}; // roomId: { players: [{id, name}], deletedCounts: {} }

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('joinRoom', ({ roomId, playerName }) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [], deletedCounts: {} };
    }
    rooms[roomId].players.push({ id: socket.id, name: playerName });
    rooms[roomId].deletedCounts[socket.id] = 0;
    io.to(roomId).emit('playersUpdate', rooms[roomId].players);
  });

  socket.on('deletePlayer', ({ roomId, targetId }) => {
    if (!rooms[roomId]) return;
    if (!rooms[roomId].deletedCounts[targetId]) rooms[roomId].deletedCounts[targetId] = 0;
    rooms[roomId].deletedCounts[targetId]++;
    io.to(roomId).emit('deletedCountsUpdate', rooms[roomId].deletedCounts);
  });

  socket.on('finalizeChallenge', (roomId) => {
    if (!rooms[roomId]) return;
    let minDeletes = Infinity;
    let challenger = null;
    for (const player of rooms[roomId].players) {
      const count = rooms[roomId].deletedCounts[player.id] || 0;
      if (count < minDeletes) {
        minDeletes = count;
        challenger = player;
      }
    }
    io.to(roomId).emit('challengeResult', challenger);
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (rooms[roomId]) {
        rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
        delete rooms[roomId].deletedCounts[socket.id];
        io.to(roomId).emit('playersUpdate', rooms[roomId].players);
      }
    }
    console.log('user disconnected:', socket.id);
  });
});

http.listen(PORT, () => {
  console.log('listening on *:' + PORT);
});
