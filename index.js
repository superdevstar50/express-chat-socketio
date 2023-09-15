import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import path from "path";

const __dirname = path.resolve();

import http from "http";

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

import { v4 as uuidv4 } from "uuid";

dotenv.config();

app.use(express.json({ limit: "30mb", extended: true }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));
app.use(cors());

const rooms = [];

app.post("/create-link", (req, res) => {
  let roomId = uuidv4();
  rooms.push({ id: roomId, users: [], history: [] });

  res.json({ id: roomId });
});

app.post("/room/:roomId", (req, res) => {});

app.use("/", express.static(path.join(__dirname, "build")));

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
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
    room.users = room.users.filter((user) => user.id !== socket.id);
    console.log("disconnect");

    const userList = room.users
      .filter((user) => user.name)
      .map((user) => user.name);

    room.users.forEach((user) => {
      user.emit("setUserList", userList);
    });
  });
});

server.listen(PORT);
