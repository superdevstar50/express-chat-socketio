import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import path from "path";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const __dirname = path.resolve();

import http from "http";

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

app.use(express.json({ limit: "30mb", extended: true }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));
app.use(cors());

let rooms = [];

app.post("/create-link", (req, res) => {
  const { minute } = req.body;

  let roomId = uuidv4();

  const timerId = setTimeout(() => {
    rooms = rooms.filter((room) => room.id !== roomId);
  }, minute * 60 * 1000);

  rooms.push({
    id: roomId,
    users: [],
    history: [],
    timerId,
    minute,
    lastdate: new Date(),
  });

  res.json({ id: roomId });
});

app.get("/links", (req, res) => {
  const roomInfo = rooms.map((room) => ({
    id: room.id,
    users: room.users.length,
    time: room.minute * 60 - parseInt((new Date() - room.lastdate) / 1000),
  }));

  res.json(roomInfo);
});

app.post("/room/:roomId", (req, res) => {});

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const findRoom = (roomId) => {
  return rooms.filter((room) => room.id === roomId)[0];
};

io.on("connection", (socket) => {
  const roomId = socket.handshake.query.roomId;

  const room = findRoom(roomId);

  if (room === undefined) {
    socket.emit("roomNotFound");
    socket.disconnect();
    return;
  }

  if (room.users.length >= 2) {
    socket.emit("userFull");
  } else {
    socket.emit("enterYourName");
    socket.roomId = roomId;
    room.users.push(socket);
  }

  socket.on("msg", (msg) => {
    const room = findRoom(socket.roomId);

    if (!room) return;

    clearTimeout(room.timerId);
    room.timerId = setTimeout(() => {
      rooms = rooms.filter((_room) => _room.id !== room.id);
    }, room.minute * 60 * 1000);
    room.lastdate = new Date();

    const message = {
      userId: socket.name,
      msg: msg,
      time: new Date(),
    };

    room.history.push(message);

    room.users.forEach((user) => {
      user.emit("msg", message);
    });
  });

  socket.on("setName", (name) => {
    const room = findRoom(socket.roomId);

    socket.name = name;
    socket.emit("letsChat");

    const userList = room.users
      .filter((user) => user.name)
      .map((user) => user.name);

    room.users.forEach((user) => {
      user.emit("setUserList", userList);
    });
  });

  socket.on("disconnect", () => {
    const room = findRoom(socket.roomId);

    if (!room) return;

    room.users = room.users.filter((user) => user.id !== socket.id);

    const userList = room.users
      .filter((user) => user.name)
      .map((user) => user.name);

    room.users.forEach((user) => {
      user.emit("setUserList", userList);
    });
  });
});

server.listen(PORT, () => {
  console.log(`server listening on ${PORT}`);
});
