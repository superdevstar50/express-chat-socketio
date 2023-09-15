import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

import createSocketServer from "./socket.js";
import { data } from "./store.js";
import { killAfterXMinutes } from "./util.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

app.use(express.json({ limit: "30mb", extended: true }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));
app.use(cors());

app.post("/create-link", (req, res) => {
  const { minute, name, number } = req.body;

  let roomId = uuidv4();

  const timerId = killAfterXMinutes(minute, roomId);

  data.rooms.push({
    id: roomId,
    users: [],
    history: [],
    timerId,
    minute,
    name,
    number,
    lastdate: new Date(),
  });

  res.json({ id: roomId });
});

app.get("/links", (req, res) => {
  const roomInfo = data.rooms
    .filter((room) => !room.closed)
    .map((room) => ({
      id: room.id,
      users: room.users.length,
      time: room.minute * 60 - parseInt((new Date() - room.lastdate) / 1000),
      name: room.name,
      number: room.number,
    }));

  res.json(roomInfo);
});

app.get("/openedrooms", (req, res) => {
  const roomInfo = data.rooms
    .filter((room) => !room.closed)
    .map((room) => ({
      id: room.id,
      time: room.minute * 60 - parseInt((new Date() - room.lastdate) / 1000),
      name: room.name,
      history: room.history,
    }));

  res.json(roomInfo);
});

app.get("/closedrooms", (req, res) => {
  const roomInfo = data.rooms
    .filter((room) => room.closed)
    .map((room) => ({
      id: room.id,
      name: room.name,
      history: room.history,
    }));

  res.json(roomInfo);
});

createSocketServer(server);

server.listen(PORT, () => {
  console.log(`server listening on ${PORT}`);
});
