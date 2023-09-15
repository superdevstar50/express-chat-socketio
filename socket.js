import { Server } from "socket.io";

import { killAfterXMinutes, findRoom } from "./util.js";

const initSocket = (socket) => {
  const roomId = socket.handshake.query.roomId;

  const room = findRoom(roomId);

  if (room === undefined) {
    socket.emit("roomNotFound");
    socket.disconnect();
    return;
  }

  if (room.users.length >= 2) {
    socket.emit("userFull");
    socket.disconnect();
    return;
  } else {
    socket.emit("enterYourName");
    socket.roomId = roomId;
    room.users.push(socket);
  }
};

const handleMsg = (socket) => (msg) => {
  const room = findRoom(socket.roomId);

  if (!room) return;

  clearTimeout(room.timerId);
  room.timerId = killAfterXMinutes(room.minute, room.id);
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
};

const handleSetName = (socket) => (name) => {
  const room = findRoom(socket.roomId);

  socket.name = name;
  socket.emit("letsChat");

  const userList = room.users
    .filter((user) => user.name)
    .map((user) => user.name);

  room.users.forEach((user) => {
    user.emit("setUserList", userList);
  });
};

const handleDisconnect = (socket) => () => {
  const room = findRoom(socket.roomId);

  if (!room) return;

  room.users = room.users.filter((user) => user.id !== socket.id);

  const userList = room.users
    .filter((user) => user.name)
    .map((user) => user.name);

  room.users.forEach((user) => {
    user.emit("setUserList", userList);
  });
};

export default (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", (socket) => {
    initSocket(socket);

    socket.on("msg", handleMsg(socket));

    socket.on("setName", handleSetName(socket));

    socket.on("disconnect", handleDisconnect(socket));
  });
};